// Worker do Estúdio: pega a fila de renderização na API, gera os JPGs (post e carrossel) ou o
// MP4 (reel), envia ao storage e devolve. Roda no PC ou num servidor com Chromium e ffmpeg.
//
//   npm start          fica consultando a fila (PC)
//   npm run once       renderiza o que estiver na fila e sai
//   npm run serve      espera a API acordá-lo com POST /wake (Railway com Serverless)
//
// No modo `serve` o worker não faz nenhuma chamada enquanto a fila está vazia: sem tráfego de
// saída, a Railway põe o serviço para dormir e ele deixa de custar.

import { timingSafeEqual } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { claudeAvailable, handleAiJob } from './ai.mjs';
import { StudioApi } from './api.mjs';
import { renderReel } from './reel.mjs';
import { closeBrowser, renderSlides } from './slides.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = join(ROOT, 'work');
const mode = process.argv.includes('--serve')
  ? 'serve'
  : process.argv.includes('--once')
    ? 'once'
    : 'poll';
const pollMs = Number(process.env.POLL_INTERVAL_SECONDS || 15) * 1000;
const concurrency = process.env.REMOTION_CONCURRENCY || null;

const { STUDIO_API_URL, STUDIO_WORKER_TOKEN } = process.env;
if (!STUDIO_API_URL || !STUDIO_WORKER_TOKEN) {
  console.error('Defina STUDIO_API_URL e STUDIO_WORKER_TOKEN (copie .env.example para .env).');
  process.exit(1);
}

const api = new StudioApi(STUDIO_API_URL, STUDIO_WORKER_TOKEN);
const stamp = () => new Date().toLocaleTimeString('pt-BR');
// Com o Claude Code instalado e logado, este PC também atende a fila de IA (Configurações › PC).
const ai = claudeAvailable();

async function handle(job) {
  const log = (message) => console.log(`${stamp()}  ${job.contentId.slice(0, 8)}  ${message}`);
  const dir = join(WORK, `${job.contentId}-${job.version}`);
  await mkdir(dir, { recursive: true });
  const started = Date.now();
  log(`${job.format}, versão ${job.version}`);
  try {
    const files =
      job.format === 'reel'
        ? await renderReel(job, dir, { log, concurrency })
        : await renderSlides(job, dir);
    log(`enviando ${files.length} arquivo(s)`);
    const uploaded = await api.upload(job, files);
    await api.complete(job, uploaded);
    log(`pronto em ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (error) {
    // 409: o conteúdo mudou durante a renderização; a API já o devolveu à fila.
    if (error.status === 409) {
      log('o conteúdo mudou no meio do caminho; fica para a próxima rodada');
    } else {
      log(`falhou: ${error.message}`);
      await api.fail(job, error.message).catch(() => undefined);
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

let stopping = false;

/** Um pedido de IA, se houver: o conteúdo escrito costuma gerar uma renderização logo depois. */
async function nextAi() {
  if (!ai) return false;
  let job = null;
  try {
    job = await api.claimAi();
  } catch (error) {
    console.error(`${stamp()}  fila de IA indisponível: ${error.message}`);
    return false;
  }
  if (!job) return false;
  const log = (message) => console.log(`${stamp()}  ${job.id.slice(0, 8)}  ${message}`);
  await handleAiJob(job, { api, work: WORK, log });
  return true;
}

/** Atende as filas até esvaziarem e fecha o Chromium, para não ocupar memória parado. */
async function drain() {
  let done = 0;
  while (!stopping) {
    if (await nextAi()) {
      done++;
      continue;
    }
    let job = null;
    try {
      job = await api.claim();
    } catch (error) {
      console.error(`${stamp()}  fila indisponível: ${error.message}`);
      break;
    }
    if (!job) break;
    await handle(job);
    done++;
  }
  await closeBrowser();
  return done;
}

// ---------- Modo serve: dorme até a API chamar ----------

function authorized(header) {
  const given = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(STUDIO_WORKER_TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function serve() {
  let draining = null;
  // Pedido que chegou durante uma rodada: roda de novo no fim, para não perder o conteúdo.
  let again = false;
  const wake = () => {
    if (draining) {
      again = true;
      return;
    }
    draining = (async () => {
      do {
        again = false;
        const done = await drain();
        if (done > 0) console.log(`${stamp()}  fila vazia; dormindo`);
      } while (again && !stopping);
    })().finally(() => {
      draining = null;
    });
  };

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://worker').pathname;
    if (request.method === 'GET' && path === '/health') {
      response.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    if (request.method === 'POST' && path === '/wake') {
      if (!authorized(request.headers.authorization)) {
        response.writeHead(401).end();
        return;
      }
      // Responde logo: a API não espera a renderização.
      response.writeHead(202).end();
      wake();
      return;
    }
    response.writeHead(404).end();
  });

  const port = Number(process.env.PORT || 8080);
  // `::` aceita IPv4 e IPv6 (a rede privada da Railway usa IPv6).
  server.listen(port, '::', () => {
    console.log(`${stamp()}  worker do Estúdio esperando a API em :${port} (${STUDIO_API_URL})`);
    // Ao ligar, confere a fila: pode ter sobrado algo de antes de dormir.
    wake();
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (stopping) process.exit(1);
      stopping = true;
      console.log('Encerrando depois do job atual (de novo para forçar).');
      server.close();
      void (draining ?? Promise.resolve()).then(() => process.exit(0));
    });
  }
}

// ---------- Modos poll e once: consultam a fila ----------

async function poll() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (stopping) process.exit(1);
      stopping = true;
      console.log('Encerrando depois do job atual (de novo para forçar).');
    });
  }
  console.log(`${stamp()}  worker do Estúdio ligado em ${STUDIO_API_URL}`);
  console.log(
    ai
      ? `${stamp()}  Claude Code encontrado: este PC atende a IA do painel (Configurações › PC)`
      : process.env.STUDIO_AI === 'off'
        ? `${stamp()}  STUDIO_AI=off: só renderização (apague a linha no .env para atender a IA)`
        : `${stamp()}  sem Claude Code: só renderização (instale e faça login para atender a IA)`,
  );
  while (!stopping) {
    await drain();
    if (mode === 'once') break;
    await new Promise((done) => setTimeout(done, pollMs));
  }
}

if (mode === 'serve') serve();
else await poll();
