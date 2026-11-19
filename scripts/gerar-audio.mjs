#!/usr/bin/env node
/* Gera a trilha e os efeitos sonoros deste reel por síntese, sem baixar nada.
 * Tudo é original, então não há licença a respeitar.
 *
 *   node gerar-audio.mjs <pasta-de-saida> [segundos-da-trilha]
 *
 * Saída: trilha-bruta.wav (passa depois pelo mixar.mjs) e sfx-*.wav
 */
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const saida = process.argv[2] ?? '.';
const segundos = Number(process.argv[3] ?? 40);
fs.mkdirSync(saida, { recursive: true });

// ---------- utilidades ----------
let semente = 7;
const rnd = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const nota = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI para Hz

function salvarWav(nome, canais) {
  const [L, R] = canais.length === 2 ? canais : [canais[0], canais[0]];
  const n = L.length;
  let pico = 0;
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]));
  const g = pico > 0.98 ? 0.98 / pico : 1;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(path.join(saida, nome), buf);
  console.log(`ok ${nome} (${(n / SR).toFixed(2)} s)`);
}

// filtro passa-baixa de um polo
const passaBaixa = (corte) => {
  let y = 0;
  const a = 1 - Math.exp((-2 * Math.PI * corte) / SR);
  return (x) => (y += a * (x - y));
};

// ---------- trilha: 118 BPM, C - G - Am - F, clima de "achado do dia" ----------
function trilha(seg) {
  const bpm = 118;
  const batida = 60 / bpm;
  const n = Math.ceil(seg * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const add = (i, l, r = l) => { if (i >= 0 && i < n) { L[i] += l; R[i] += r; } };

  const acordes = [
    [60, 64, 67, 71], // Cmaj7
    [55, 59, 62, 67], // G
    [57, 60, 64, 69], // Am
    [53, 57, 60, 65], // F
  ];
  const totalBatidas = Math.ceil(seg / batida);

  for (let b = 0; b < totalBatidas; b++) {
    const t0 = b * batida;
    const compasso = Math.floor(b / 4);
    const acorde = acordes[compasso % 4];
    const cheia = compasso >= 1;

    // bumbo em todo tempo
    if (cheia) {
      const ini = Math.round(t0 * SR);
      for (let k = 0; k < SR * 0.35; k++) {
        const t = k / SR;
        const fase = 2 * Math.PI * (50 * t + (110 / 28) * (1 - Math.exp(-t * 28)));
        add(ini + k, Math.sin(fase) * Math.exp(-t * 9) * 0.85);
      }
    }
    // palma no 2 e no 4
    if (cheia && b % 2 === 1) {
      const ini = Math.round(t0 * SR);
      const lp = passaBaixa(5000);
      for (let k = 0; k < SR * 0.2; k++) {
        const t = k / SR;
        const x = lp(rnd()) * Math.exp(-t * 22) * 0.35;
        add(ini + k, x * 0.9, x);
      }
    }
    // chimbal em colcheias, mais forte no contratempo
    for (let c = 0; c < 2; c++) {
      const ini = Math.round((t0 + (c * batida) / 2) * SR);
      let ant = 0;
      const vol = c === 1 ? 0.16 : 0.07;
      for (let k = 0; k < SR * 0.05; k++) {
        const r = rnd();
        const hp = r - ant; ant = r;
        const e = Math.exp(-(k / SR) * 70) * vol;
        add(ini + k, hp * e * 0.8, hp * e);
      }
    }
    // baixo em colcheias, oitava no contratempo
    if (cheia) {
      for (let c = 0; c < 2; c++) {
        const ini = Math.round((t0 + (c * batida) / 2) * SR);
        const f = nota(acorde[0] - 24 + (c === 1 ? 12 : 0));
        const lp = passaBaixa(900);
        for (let k = 0; k < SR * batida * 0.45; k++) {
          const t = k / SR;
          const saw = 2 * ((f * t) % 1) - 1;
          add(ini + k, lp(saw) * Math.min(1, t * 200) * Math.exp(-t * 5) * 0.32);
        }
      }
    }
    // pluck do acorde no contratempo
    {
      const ini = Math.round((t0 + batida / 2) * SR);
      const vol = cheia ? 0.085 : 0.11;
      acorde.forEach((m, idx) => {
        const f = nota(m + 12);
        const pan = 0.5 + (idx - 1.5) * 0.18;
        for (let k = 0; k < SR * 0.4; k++) {
          const t = k / SR;
          const env = Math.min(1, t * 300) * Math.exp(-t * 9);
          const x = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * env * vol;
          add(ini + k, x * (1 - pan) * 1.6, x * pan * 1.6);
        }
      });
    }
    // pad segurando o acorde no compasso inteiro
    if (b % 4 === 0) {
      const ini = Math.round(t0 * SR);
      const dur = batida * 4;
      acorde.forEach((m) => {
        const f = nota(m);
        for (let k = 0; k < SR * dur; k++) {
          const t = k / SR;
          const env = Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 0.4);
          const x = (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t)) * env * 0.022;
          add(ini + k, x, x);
        }
      });
    }
  }
  return [L, R];
}

// ---------- efeitos ----------
function mono(seg, fn) {
  const n = Math.ceil(seg * SR);
  const a = new Float32Array(n);
  for (let k = 0; k < n; k++) a[k] = fn(k / SR);
  return [a];
}

// whoosh: ruído com filtro que abre e fecha
const whoosh = () => {
  let y1 = 0, y2 = 0;
  return mono(0.45, (t) => {
    const s = Math.sin(Math.PI * Math.min(1, t / 0.45));
    const a = 1 - Math.exp((-2 * Math.PI * (400 + 5000 * s)) / SR);
    y1 += a * (rnd() - y1); y2 += a * (y1 - y2);
    return y2 * s * s * 1.4;
  });
};
// pop: blip com queda de altura
const pop = () => mono(0.14, (t) => Math.sin(2 * Math.PI * (900 * t - 2200 * t * t)) * Math.exp(-t * 30) * 0.8);
// encaixe: batida grave mais clique, quando a camada cai na pilha
const encaixe = () => mono(0.3, (t) => {
  const grave = Math.sin(2 * Math.PI * (70 * t + (120 / 35) * (1 - Math.exp(-t * 35)))) * Math.exp(-t * 14);
  const clique = t < 0.012 ? rnd() * (1 - t / 0.012) : 0;
  return grave * 0.9 + clique * 0.5;
});
// ka-ching: duas notas de sino mais chocalho de moedas
const kaching = () => {
  const lp = passaBaixa(7000);
  return mono(1.1, (t) => {
    const sino = (f, ini) => (t < ini ? 0
      : (Math.sin(2 * Math.PI * f * (t - ini)) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * (t - ini))) * Math.exp(-(t - ini) * 4.5));
    const moedas = t > 0.08 && t < 0.5 ? lp(rnd()) * Math.exp(-(t - 0.08) * 9) * (0.6 + 0.4 * Math.sin(t * 180)) : 0;
    return sino(1568, 0) * 0.32 + sino(2093, 0.09) * 0.36 + moedas * 0.45;
  });
};
// subida: tom que sobe mais ruído crescendo, antes da revelação
const subida = () => {
  const lp = passaBaixa(3000);
  const d = 1.2;
  return mono(d, (t) => {
    const p = t / d;
    const fase = 2 * Math.PI * ((220 * d) / Math.log(4)) * (Math.pow(4, p) - 1);
    return (Math.sin(fase) * 0.25 + lp(rnd()) * 0.5) * p * p;
  });
};
// tique: clique curto para o contador
const tique = () => mono(0.04, (t) => Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 120) * 0.5);
// carimbo: baque seco
const carimbo = () => {
  const lp = passaBaixa(1800);
  return mono(0.35, (t) => (Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t * 18) + lp(rnd()) * Math.exp(-t * 40)) * 0.9);
};

salvarWav('trilha-bruta.wav', trilha(segundos));
salvarWav('sfx-whoosh.wav', whoosh());
salvarWav('sfx-pop.wav', pop());
salvarWav('sfx-encaixe.wav', encaixe());
salvarWav('sfx-kaching.wav', kaching());
salvarWav('sfx-subida.wav', subida());
salvarWav('sfx-tique.wav', tique());
salvarWav('sfx-carimbo.wav', carimbo());
