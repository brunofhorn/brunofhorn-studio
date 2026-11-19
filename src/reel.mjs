// Reel: monta a pasta do reel como a skill `reel` faz (cenas.json + public/), gera o áudio com
// os scripts da skill e renderiza com o template Remotion em `reel/`.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');
// Explícito: sem ele, o Remotion lê "Reel" como caminho e no Windows acha a pasta reel/.
const ENTRY = join(ROOT, 'reel', 'src', 'index.ts');
const WIDTH = 1080;
const HEIGHT = 1920;
/** Quadro da capa: 1 s, com o gancho já na tela. */
const COVER_FRAME = 30;
const WORDS_PER_SECOND = 2.9;

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
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Não consegui baixar ${url} (${response.status})`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

export async function renderReel(job, dir, { log, concurrency }) {
  const publicDir = join(dir, 'public');
  const props = join(dir, 'cenas.json');
  await mkdir(publicDir, { recursive: true });
  await writeFile(props, `${JSON.stringify(job.reel, null, 2)}\n`);

  for (const asset of job.assets) await download(asset.url, join(publicDir, asset.name));

  const audio = job.audio ?? { narration: null, sfx: false, music: false };
  if (audio.narration) {
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
    const seconds = Math.ceil(estimateSeconds(job.reel.cenas) + 3);
    await run([join(SCRIPTS, 'gerar-audio.mjs'), publicDir, String(seconds)]);
    if (audio.music) {
      await run([join(SCRIPTS, 'mixar.mjs'), join(publicDir, 'trilha-bruta.wav'), '--projeto', dir]);
    }
  }

  const common = [`--props=${props}`, `--public-dir=${publicDir}`];
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
