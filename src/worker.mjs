// Worker do Estúdio: pega a fila de renderização na API, gera os JPGs (post e carrossel) ou o
// MP4 (reel), envia ao storage e devolve. Roda no PC ou num servidor com Chromium e ffmpeg.
//
//   npm start          fica escutando a fila
//   npm run once       renderiza o que estiver na fila e sai

import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StudioApi } from './api.mjs';
import { renderReel } from './reel.mjs';
import { closeBrowser, renderSlides } from './slides.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = join(ROOT, 'work');
const once = process.argv.includes('--once');
const pollMs = Number(process.env.POLL_INTERVAL_SECONDS || 15) * 1000;
const concurrency = process.env.REMOTION_CONCURRENCY || null;

const { STUDIO_API_URL, STUDIO_WORKER_TOKEN } = process.env;
if (!STUDIO_API_URL || !STUDIO_WORKER_TOKEN) {
  console.error('Defina STUDIO_API_URL e STUDIO_WORKER_TOKEN (copie .env.example para .env).');
  process.exit(1);
}

const api = new StudioApi(STUDIO_API_URL, STUDIO_WORKER_TOKEN);
const stamp = () => new Date().toLocaleTimeString('pt-BR');

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
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log('Encerrando depois do job atual (de novo para forçar).');
  });
}

console.log(`${stamp()}  worker do Estúdio ligado em ${STUDIO_API_URL}`);
while (!stopping) {
  let job = null;
  try {
    job = await api.claim();
  } catch (error) {
    console.error(`${stamp()}  fila indisponível: ${error.message}`);
  }
  if (job) {
    await handle(job);
    continue;
  }
  if (once) break;
  await new Promise((done) => setTimeout(done, pollMs));
}
await closeBrowser();
