// IA no PC: executa os pedidos da fila de IA da API com o Claude Code (`claude -p`), logado na
// assinatura de quem usa este PC. Nenhuma credencial do Claude sai daqui: a API manda as
// instruções, o pedido e o formato da resposta, e recebe só o resultado.
//
//   studio_write  conteúdo do Estúdio (slides, cenas e legenda), numa chamada só
//   cover         capa: desenha o SVG, pede à API a renderização, revisa olhando o PNG

import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CLAUDE = process.env.CLAUDE_BIN || 'claude';
/** Um reel ou uma capa com revisão leva alguns minutos; acima disso, algo travou. */
const RUN_TIMEOUT_MS = 12 * 60_000;
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg' };

/** Há Claude Code neste computador? (`STUDIO_AI=off` desliga a IA no worker.) */
export function claudeAvailable() {
  if (process.env.STUDIO_AI === 'off') return false;
  const result = spawnSync(CLAUDE, ['--version'], { encoding: 'utf8', timeout: 20_000 });
  return result.status === 0;
}

/** Roda o Claude Code sem interação e devolve a resposta estruturada (validada pelo schema). */
async function ask({ dir, system, prompt, schema, tools = '' }) {
  const systemFile = join(dir, 'instrucoes.md');
  await writeFile(systemFile, system);
  const args = [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    // O Claude Code não resolve a referência de `$schema` (rascunho 2020-12 do Zod).
    JSON.stringify({ ...schema, $schema: undefined }),
    '--system-prompt-file',
    systemFile,
    '--tools',
    tools,
    '--no-session-persistence',
    '--effort',
    process.env.CLAUDE_EFFORT || 'medium',
  ];
  if (tools) args.push('--allowedTools', tools);
  if (process.env.CLAUDE_MODEL) args.push('--model', process.env.CLAUDE_MODEL);

  const output = await new Promise((done, fail) => {
    const child = spawn(CLAUDE, args, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error('o Claude Code passou de 12 minutos sem responder'));
    }, RUN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr = (stderr + chunk).slice(-2000)));
    child.on('error', (error) => {
      clearTimeout(timer);
      fail(new Error(`não consegui abrir o Claude Code (${error.message})`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (stdout.trim()) return done(stdout);
      fail(new Error(`o Claude Code saiu com código ${code}: ${stderr.trim().slice(-300)}`));
    });
    child.stdin.end(prompt);
  });

  let result;
  try {
    result = JSON.parse(output);
  } catch {
    throw new Error(`resposta do Claude Code ilegível: ${output.slice(0, 200)}`);
  }
  if (result.is_error || result.subtype !== 'success') {
    // Ex.: limite de uso da assinatura atingido, login expirado.
    const reason = String(result.result || result.subtype || 'erro desconhecido').slice(0, 400);
    throw new Error(`o Claude Code não terminou: ${reason}`);
  }
  if (result.structured_output == null) {
    throw new Error('o Claude Code respondeu sem o conteúdo no formato pedido');
  }
  return result.structured_output;
}

/** Conteúdo do Estúdio: a mesma chamada que a API faria, pelo Claude Code. */
async function write(job, dir) {
  const { system, prompt, schema } = job.request;
  return ask({ dir, system, prompt, schema });
}

/**
 * Capa: as imagens vão para a pasta (o Claude Code as abre com a ferramenta Read), o SVG volta,
 * a API renderiza com o mesmo renderizador da capa final e o Claude Code revisa o PNG.
 */
async function cover(job, dir, api) {
  const { system, prompt, review, designSchema, reviewSchema, assets } = job.request;
  const files = [];
  for (const asset of assets) {
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) continue;
    const type = response.headers.get('content-type')?.split(';')[0]?.trim();
    const file = `asset-${asset.name}.${EXTENSIONS[type] ?? 'png'}`;
    await writeFile(join(dir, file), Buffer.from(await response.arrayBuffer()));
    files.push(`- ${file}: imagem "asset:${asset.name}" (${asset.label}).`);
  }
  const images = files.length
    ? `Imagens desta capa, nesta pasta (abra cada uma com a ferramenta Read antes de desenhar):\n${files.join('\n')}\n\n`
    : '';

  const design = await ask({
    dir,
    system,
    prompt: `${images}${prompt}`,
    schema: designSchema,
    tools: files.length ? 'Read' : '',
  });

  const rendered = await api.renderCover(job, design.svg);
  let reviewPrompt;
  if (rendered.png) {
    await writeFile(join(dir, 'capa-renderizada.png'), Buffer.from(rendered.png, 'base64'));
    reviewPrompt =
      'A capa renderizada a partir do seu SVG está em capa-renderizada.png (abra com a ferramenta Read).';
  } else {
    reviewPrompt = `O renderizador recusou o SVG: ${rendered.error}`;
  }
  const checked = await ask({
    dir,
    system,
    prompt: `${images}${prompt}\n\nSVG que você entregou:\n${design.svg}\n\n${reviewPrompt}\n\n${review}`,
    schema: reviewSchema,
    tools: 'Read',
  });
  return { design, review: checked };
}

/** Executa um pedido e devolve o resultado (ou a falha) à API. */
export async function handleAiJob(job, { api, work, log }) {
  const dir = join(work, `ia-${job.id}`);
  await mkdir(dir, { recursive: true });
  const started = Date.now();
  log(`IA no PC: ${job.kind === 'cover' ? 'capa' : 'conteúdo do Estúdio'}`);
  try {
    const output = job.kind === 'cover' ? await cover(job, dir, api) : await write(job, dir);
    await api.completeAi(job, output);
    log(`IA pronta em ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (error) {
    if (error.status === 409) {
      log('o pedido foi cancelado ou refeito no admin; descartado');
    } else {
      log(`IA falhou: ${error.message}`);
      await api.failAi(job, error.message).catch(() => undefined);
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
