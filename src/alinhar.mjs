// Narração enviada pela pessoa: descobre quando cada palavra do roteiro é dita e grava o
// `palavras.json` no mesmo formato que `scripts/narrar.mjs` gera, para o template cronometrar as
// cenas e a legenda pela fala.
//
// Com ELEVENLABS_API_KEY usa o alinhamento forçado da ElevenLabs (áudio + texto → tempo de cada
// palavra). Sem a chave, distribui as palavras pela duração do áudio: as cenas acompanham o
// tamanho da gravação, mas a legenda fica aproximada.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const API = 'https://api.elevenlabs.io/v1/forced-alignment';

const arred = (n) => Math.round(n * 1000) / 1000;
const separar = (fala) => fala.trim().split(/\s+/).filter(Boolean);
/** Para comparar a palavra dita com a do roteiro: sem caixa, acento nem pontuação. */
const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/** Duração do áudio pelo ffprobe que vem com o Remotion (a imagem não tem ffmpeg). */
export function audioSeconds(remotionCli, path) {
  return new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [remotionCli, 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('error', fail);
    child.on('close', (code) => {
      const seconds = Number.parseFloat(out.trim().split('\n').pop() ?? '');
      if (code === 0 && seconds > 0) done(seconds);
      else fail(new Error('Não consegui ler a duração da narração enviada (o arquivo é de áudio?)'));
    });
  });
}

/** Palavras do roteiro, com a cena de cada uma. */
function roteiro(cenas) {
  return cenas.flatMap((cena, indice) => separar(cena.fala).map((texto) => ({ texto, cena: indice })));
}

async function elevenlabs(audioPath, texto, apiKey) {
  const form = new FormData();
  form.append('file', new Blob([await readFile(audioPath)]), basename(audioPath));
  form.append('text', texto);
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(5 * 60_000),
  });
  if (!response.ok) {
    const corpo = (await response.text()).slice(0, 200);
    throw new Error(`Alinhamento da ElevenLabs respondeu ${response.status}: ${corpo}`);
  }
  const { words } = await response.json();
  return (words ?? [])
    .filter((word) => normalizar(word.text ?? '') !== '')
    .map((word) => ({ texto: word.text.trim(), inicio: word.start, fim: word.end }));
}

/**
 * Casa as palavras ditas com as do roteiro, na ordem. Com a mesma contagem é um para um; se a
 * pessoa improvisou um pouco, cada palavra do roteiro pega a dita na mesma posição relativa.
 */
function casar(previstas, ditas) {
  if (ditas.length === 0) return null;
  const mesma = ditas.length === previstas.length;
  return previstas.map((palavra, i) => {
    const dita = mesma ? ditas[i] : ditas[Math.round((i * (ditas.length - 1)) / Math.max(1, previstas.length - 1))];
    return { ...palavra, inicio: dita.inicio, fim: dita.fim };
  });
}

/** Sem alinhamento: espalha as palavras pela gravação, as longas demorando mais. */
function espalhar(previstas, segundos) {
  const pesos = previstas.map((palavra) => palavra.texto.length + 2);
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const util = Math.max(0.5, segundos - 0.4);
  let cursor = 0.15;
  return previstas.map((palavra, i) => {
    const d = (pesos[i] / soma) * util;
    const item = { ...palavra, inicio: cursor, fim: cursor + d * 0.92 };
    cursor += d;
    return item;
  });
}

/**
 * @param {{ audioPath: string, cenas: { fala: string }[], remotionCli: string, apiKey?: string, log: (m: string) => void }} input
 * @returns {Promise<{ duracao: number, cenas: { inicio: number, fim: number }[], palavras: object[], metodo: string }>}
 */
export async function alinhar({ audioPath, cenas, remotionCli, apiKey, log }) {
  const segundos = await audioSeconds(remotionCli, audioPath);
  const previstas = roteiro(cenas);
  const texto = previstas.map((palavra) => palavra.texto).join(' ');

  let palavras = null;
  let metodo = 'estimado';
  if (apiKey) {
    try {
      const ditas = await elevenlabs(audioPath, texto, apiKey);
      palavras = casar(previstas, ditas);
      if (palavras) {
        metodo = ditas.length === previstas.length ? 'elevenlabs' : 'elevenlabs-aproximado';
        if (metodo !== 'elevenlabs') {
          log(`a gravação tem ${ditas.length} palavras e o roteiro ${previstas.length}; legenda aproximada`);
        }
      }
    } catch (error) {
      log(`${error.message}; seguindo com a estimativa pela duração`);
    }
  } else {
    log('sem ELEVENLABS_API_KEY: cenas pela duração da gravação, legenda aproximada');
  }
  palavras ??= espalhar(previstas, segundos);

  const duracao = Math.max(segundos, ...palavras.map((palavra) => palavra.fim)) + 0.1;
  const blocos = cenas.map((_, i) => {
    const primeira = palavras.find((palavra) => palavra.cena === i);
    return { inicio: i === 0 ? 0 : Math.max(0, (primeira?.inicio ?? 0) - 0.08) };
  });
  // Cena sem palavra (fala vazia não existe, mas por garantia) herda o início da anterior.
  blocos.forEach((bloco, i) => {
    if (i > 0 && bloco.inicio < blocos[i - 1].inicio) bloco.inicio = blocos[i - 1].inicio;
  });
  blocos.forEach((bloco, i) => {
    bloco.fim = i + 1 < blocos.length ? blocos[i + 1].inicio : duracao;
  });

  return {
    metodo,
    duracao: arred(duracao),
    cenas: blocos.map((bloco) => ({ inicio: arred(bloco.inicio), fim: arred(bloco.fim) })),
    palavras: palavras.map((palavra) => ({ ...palavra, inicio: arred(palavra.inicio), fim: arred(palavra.fim) })),
  };
}
