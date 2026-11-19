// Reel: monta a pasta do reel como a skill `reel` faz (cenas.json + public/), gera o áudio com
// os scripts da skill e renderiza com o template Remotion em `reel/`.

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { alinhar } from './alinhar.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');
// Explícito: sem ele, o Remotion lê "Reel" como caminho e no Windows acha a pasta reel/.
const ENTRY = join(ROOT, 'reel', 'src', 'index.ts');
const WIDTH = 1080;
const HEIGHT = 1920;
/** Quadro da capa: 1 s, com o gancho já na tela. */
const COVER_FRAME = 30;
const WORDS_PER_SECOND = 2.9;

/**
 * O Chrome headless do Playwright (o mesmo dos slides). Na imagem Docker ele já vem instalado,
 * e o Remotion não precisa baixar o dele na hora do render (o download falhava na Railway).
 * `REMOTION_BROWSER` aponta outro executável; sem nenhum, o Remotion usa o próprio.
 */
function playwrightShell() {
  if (process.env.REMOTION_BROWSER) return process.env.REMOTION_BROWSER;
  const base =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
      : join(homedir(), process.platform === 'darwin' ? 'Library/Caches' : '.cache', 'ms-playwright'));
  if (!existsSync(base)) return null;
  const folders = readdirSync(base)
    .filter((name) => name.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  const binary = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  for (const folder of folders) {
    for (const platform of readdirSync(join(base, folder))) {
      const candidate = join(base, folder, platform, binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const BROWSER = playwrightShell();
export const REEL_BROWSER = BROWSER;

const require = createRequire(import.meta.url);
const remotionCli = join(dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');

/** Roda um processo e falha com o fim da saída dele, para o erro chegar ao admin. */
function run(args, { cwd, env } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const keep = (chunk) => {
      output = (output + chunk.toString()).slice(-4000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', fail);
    child.on('close', (code) => {
      if (code === 0) return done(output);
      // Sem cores e sem as linhas da pilha: fica a mensagem que importa.
      const lines = output
        .replace(/\x1b\[[0-9;]*m/g, '')
        .split('\n')
        .filter((line) => line.trim() && !/^\s+at /.test(line));
      const last = lines.slice(-6).join('\n');
      fail(new Error(`${args[0].split(/[\\/]/).pop()} falhou (código ${code}): ${last}`));
    });
  });
}

/** Segundos estimados do reel, para a trilha sintetizada ter o tamanho certo. */
function estimateSeconds(cenas) {
  return cenas.reduce((total, cena) => {
    if (cena.duracao) return total + cena.duracao;
    const words = cena.fala.trim().split(/\s+/).filter(Boolean).length;
    return total + Math.min(6, Math.max(1.5, words / WORDS_PER_SECOND));
  }, 0);
}

async function download(url, path) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!response.ok) throw new Error(`Não consegui baixar ${url} (${response.status})`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

export async function renderReel(job, dir, { log, concurrency }) {
  const publicDir = join(dir, 'public');
  const props = join(dir, 'cenas.json');
  await mkdir(publicDir, { recursive: true });
  await writeFile(props, `${JSON.stringify(job.reel, null, 2)}\n`);

  for (const asset of job.assets) await download(asset.url, join(publicDir, asset.name));

  const audio = job.audio ?? { narration: null, voiceover: null, sfx: false, music: false };
  let seconds = estimateSeconds(job.reel.cenas);
  if (audio.voiceover) {
    // Narração gravada pela pessoa: as cenas e a legenda seguem o ritmo da gravação.
    log('alinhando a narração enviada ao roteiro');
    const file = `narracao${extname(new URL(audio.voiceover.url).pathname) || '.mp3'}`;
    await download(audio.voiceover.url, join(publicDir, file));
    const tempos = await alinhar({
      audioPath: join(publicDir, file),
      cenas: job.reel.cenas,
      remotionCli,
      apiKey: process.env.ELEVENLABS_API_KEY,
      log,
    });
    log(`narração de ${tempos.duracao.toFixed(1)} s (${tempos.metodo})`);
    await writeFile(join(publicDir, 'palavras.json'), JSON.stringify(tempos));
    await writeFile(
      props,
      `${JSON.stringify({ ...job.reel, narracao: file, palavras: 'palavras.json' }, null, 2)}\n`,
    );
    seconds = tempos.duracao;
  } else if (audio.narration) {
    if (process.env.ELEVENLABS_API_KEY) {
      log('narrando com o ElevenLabs');
      const voice = audio.narration.voiceId ? ['--voz', audio.narration.voiceId] : [];
      await run([join(SCRIPTS, 'narrar.mjs'), '--projeto', dir, ...voice]);
    } else {
      log('sem ELEVENLABS_API_KEY: o reel sai sem voz');
    }
  }
  if (audio.sfx || audio.music) {
    log('gerando trilha e efeitos');
    await run([join(SCRIPTS, 'gerar-audio.mjs'), publicDir, String(Math.ceil(seconds + 3))]);
    if (audio.music) {
      await run([join(SCRIPTS, 'mixar.mjs'), join(publicDir, 'trilha-bruta.wav'), '--projeto', dir]);
    }
  }

  const common = [
    `--props=${props}`,
    `--public-dir=${publicDir}`,
    ...(BROWSER ? [`--browser-executable=${BROWSER}`] : []),
  ];
  const video = join(dir, 'reel.mp4');
  const cover = join(dir, 'capa.jpg');
  log('renderizando o vídeo');
  await run(
    [
      remotionCli,
      'render',
      ENTRY,
      'Reel',
      video,
      ...common,
      // O Instagram rejeita vídeo sem faixa de áudio em alguns casos.
      '--enforce-audio-track',
      ...(concurrency ? [`--concurrency=${concurrency}`] : []),
    ],
    { cwd: ROOT },
  );
  await run(
    [remotionCli, 'still', ENTRY, 'Reel', cover, ...common, `--frame=${COVER_FRAME}`, '--image-format=jpeg'],
    { cwd: ROOT },
  );

  return [
    { name: 'reel.mp4', path: video, contentType: 'video/mp4', width: WIDTH, height: HEIGHT, role: 'video' },
    { name: 'capa.jpg', path: cover, contentType: 'image/jpeg', width: WIDTH, height: HEIGHT, role: 'cover' },
  ];
}
