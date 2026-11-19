import React, { useMemo } from 'react';
import { AbsoluteFill, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CORES_PADRAO, type Cores, type ReelProps } from './tipos';
import { estimarTempos, montarLinhas } from './tempo';
import { Fontes } from './fontes';
import { Legenda } from './Legenda';
import { AreaCena, CenaVisual } from './cenas';
import { IconePilha, TEMPO_CAMADA, TEMPO_RESULTADO } from './oferta';
import { pilhaSans } from './fontes';
import { EstiloCtx, TextoGradiente, gradienteCss } from './marca';
import { Img } from 'remotion';
import type { Cena, Tempos } from './tipos';

/** símbolos de oferta subindo devagar no fundo */
const Particulas: React.FC<{ cores: Cores }> = ({ cores }) => {
  const frame = useCurrentFrame();
  const simbolos = ['R$', '%', '−', 'R$', '%', '+'];
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {Array.from({ length: 16 }).map((_, i) => {
        const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
        const vel = 0.6 + r(1) * 1.1;
        const y = 2050 - ((frame * vel * 2 + r(2) * 2200) % 2300);
        const x = r(3) * 1000 + 40 + Math.sin(frame / (40 + r(4) * 40) + i) * 30;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x, top: y, fontFamily: pilhaSans('Inter'), fontWeight: 900,
              fontSize: 50 + r(5) * 70, color: i % 3 === 0 ? cores.destaque : cores.texto, opacity: 0.05 + r(6) * 0.05,
              transform: `rotate(${(r(7) - 0.5) * 40}deg)`,
            }}
          >
            {simbolos[i % simbolos.length]}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** etiquetas de oferta inclinadas, flutuando nas bordas (como no site) */
const POSICOES = [
  { x: 40, y: 330, r: -8 }, { x: 700, y: 250, r: 8 }, { x: 30, y: 1350, r: -6 },
  { x: 720, y: 1500, r: 7 }, { x: 60, y: 1720, r: 5 }, { x: 640, y: 1760, r: -7 },
];
const Etiquetas: React.FC<{ textos: string[]; cores: Cores; fonte: string }> = ({ textos, cores, fonte }) => {
  const frame = useCurrentFrame();
  const paleta = cores.camadas && cores.camadas.length ? cores.camadas : [cores.destaque];
  return (
    <AbsoluteFill>
      {textos.slice(0, POSICOES.length).map((t, i) => {
        const p = POSICOES[i];
        const cor = paleta[i % paleta.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: p.x, top: p.y + Math.sin(frame / 25 + i * 1.7) * 18,
              transform: `rotate(${p.r + Math.sin(frame / 40 + i) * 2}deg)`, opacity: 0.32,
              padding: '14px 26px', borderRadius: 22, whiteSpace: 'nowrap',
              background: `color-mix(in srgb, ${cor} 16%, transparent)`, border: `2px solid color-mix(in srgb, ${cor} 45%, transparent)`,
              color: cor, fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 36,
            }}
          >
            {t}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** selo da marca no topo e barra de progresso do vídeo */
const Marca: React.FC<{ marca?: string; logo?: string; cores: Cores; fonte: string }> = ({ marca, logo, cores, fonte }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const e = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 10, width: `${(frame / durationInFrames) * 100}%`, background: cores.gradiente ? gradienteCss(cores) : cores.destaque }} />
      {marca && (
        <div
          style={{
            position: 'absolute', top: 100, left: 0, right: 0, display: 'flex', justifyContent: 'center',
            opacity: e, transform: `translateY(${(1 - e) * -30}px)`,
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 18, padding: '14px 30px 14px 20px', borderRadius: 999,
              background: `color-mix(in srgb, ${cores.texto} 8%, ${cores.fundo})`,
              border: `2px solid color-mix(in srgb, ${cores.destaque} 40%, transparent)`,
            }}
          >
            {logo ? <Img src={staticFile(logo)} style={{ height: 50 }} /> : <IconePilha tam={46} cores={cores} />}
            <span style={{ fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 34, letterSpacing: '0.1em', color: cores.texto }}>
              {(() => {
                const ps = marca.toUpperCase().split(' ');
                if (!cores.gradiente || ps.length < 2) return marca.toUpperCase();
                return <>{ps.slice(0, -1).join(' ')} <TextoGradiente cores={cores}>{ps[ps.length - 1]}</TextoGradiente></>;
              })()}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** flash rápido e leve em cada troca de cena */
const Flash: React.FC<{ cores: Cores }> = ({ cores }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 5], [0.16, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: cores.texto, opacity: op, pointerEvents: 'none' }} />;
};

type Som = { arquivo: string; em: number; volume: number };

/* Os efeitos sonoros saem do tipo de cada cena: whoosh na troca, encaixe quando a
   camada cai na pilha, tique no contador, ka-ching no preço final. */
const montarSons = (cenas: Cena[], tempos: Tempos): Som[] => {
  const sons: Som[] = [];
  const add = (arquivo: string, em: number, volume = 1) => { if (em >= 0) sons.push({ arquivo, em, volume }); };
  cenas.forEach((c, i) => {
    const t = tempos.cenas[i].inicio;
    if (i > 0) add('sfx-whoosh.wav', t - 0.12, 0.55);
    if (c.tipo === 'gancho') { add('sfx-pop.wav', t + 0.05, 0.8); if (c.selo) add('sfx-carimbo.wav', t + 0.6, 0.9); }
    if (c.tipo === 'titulo') { add('sfx-pop.wav', t + 0.1, 0.6); if (c.icone === 'pilha') [0, 1, 2].forEach((k) => add('sfx-encaixe.wav', t + 0.3 + k * 0.14, 0.45)); }
    if (c.tipo === 'lista') c.itens.forEach((_, k) => add('sfx-pop.wav', t + 0.2 + k * 0.4, 0.6));
    if (c.tipo === 'camada') {
      if (c.mostrar === 0) add('sfx-pop.wav', t + 0.3, 0.8);
      else {
        add('sfx-encaixe.wav', t + TEMPO_CAMADA.pouso, 0.55);
        add('sfx-pop.wav', t + TEMPO_CAMADA.contaIni, 0.5);
        for (let k = TEMPO_CAMADA.contaIni; k < TEMPO_CAMADA.contaFim; k += 0.09) add('sfx-tique.wav', t + k, 0.5);
      }
    }
    if (c.tipo === 'resultado') {
      add('sfx-subida.wav', t - 1.0, 0.7);
      for (let k = TEMPO_RESULTADO.contaIni; k < TEMPO_RESULTADO.contaFim - 0.1; k += 0.08) add('sfx-tique.wav', t + k, 0.45);
      add('sfx-kaching.wav', t + TEMPO_RESULTADO.contaFim, 0.8);
      add('sfx-carimbo.wav', t + TEMPO_RESULTADO.selo + 0.05, 0.9);
      add('sfx-pop.wav', t + TEMPO_RESULTADO.parcelas, 0.6);
    }
    if (c.tipo === 'numero') add('sfx-kaching.wav', t + 0.6, 0.8);
    if (c.tipo === 'cta') { add('sfx-pop.wav', t + 0.2, 0.8); add('sfx-kaching.wav', t + 0.35, 0.5); }
  });
  return sons;
};

/** fundo com um brilho suave da cor de destaque que passeia devagar */
const Fundo: React.FC<{ cores: Cores }> = ({ cores }) => {
  const frame = useCurrentFrame();
  const x = 50 + 22 * Math.sin(frame / 90);
  const y = 32 + 10 * Math.cos(frame / 120);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: cores.fundo,
        backgroundImage: cores.gradiente && cores.gradiente.length >= 3
          ? `radial-gradient(circle at ${x - 25}% ${y - 10}%, color-mix(in srgb, ${cores.gradiente[0]} 13%, transparent), transparent 50%),
             radial-gradient(circle at ${110 - x}% ${y + 40}%, color-mix(in srgb, ${cores.gradiente[cores.gradiente.length - 1]} 11%, transparent), transparent 52%)`
          : `radial-gradient(circle at ${x}% ${y}%, color-mix(in srgb, ${cores.destaque} 16%, transparent), transparent 58%)`,
      }}
    />
  );
};

export const Reel: React.FC<ReelProps> = (props) => {
  const { fps, durationInFrames } = useVideoConfig();
  const cores: Cores = { ...CORES_PADRAO, ...(props.cores ?? {}) };
  const fonte = props.fonte ?? 'Inter';
  const fonteItalica = props.fonteItalica ?? 'Instrument Serif';
  const tempos = props.tempos ?? estimarTempos(props.cenas);
  const linhas = useMemo(() => montarLinhas(tempos.palavras), [tempos]);
  const destaques = props.cenas.flatMap((c) => ('destaque' in c && c.destaque ? [c.destaque] : []));
  // sem legenda repetida: no CTA, e em cena cujo título já é a própria fala (o gancho, quase sempre)
  const so = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const cenasSemLegenda = props.cenas.flatMap((c, i) =>
    c.tipo === 'cta' || ('titulo' in c && c.titulo && so(c.titulo) === so(c.fala)) ? [i] : [],
  );
  const temNarracao = Boolean(props.narracao);
  const volumeBase = props.volumeTrilha ?? (temNarracao ? 0.3 : 0.8);
  const totalSeg = durationInFrames / fps;

  // ducking simples: a trilha cai para metade quando há voz, e sobe nas pausas
  const volumeTrilha = (f: number) => {
    const t = f / fps;
    const fade = Math.min(
      interpolate(t, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
      interpolate(t, [totalSeg - 1.2, totalSeg], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    );
    if (!temNarracao) return volumeBase * fade;
    let dist = Infinity;
    for (const p of tempos.palavras) {
      const d = t < p.inicio - 0.15 ? p.inicio - 0.15 - t : t > p.fim + 0.35 ? t - p.fim - 0.35 : 0;
      if (d < dist) dist = d;
      if (dist === 0) break;
    }
    const abre = Math.min(1, dist / 0.3);
    return volumeBase * (0.5 + 0.5 * abre) * fade;
  };

  return (
    <AbsoluteFill>
      <Fundo cores={cores} />
      <Fontes fonte={fonte} fonteItalica={fonteItalica}>
        <EstiloCtx.Provider value={{ destaque: props.estiloDestaque ?? 'italico', logo: props.logo ?? undefined }}>
        {props.etiquetas && props.etiquetas.length ? <Etiquetas textos={props.etiquetas} cores={cores} fonte={fonte} /> : <Particulas cores={cores} />}
        <AreaCena.Provider value={props.legenda === false ? 1600 : 1180}>
        {props.cenas.map((cena, i) => {
          const b = tempos.cenas[i];
          const from = Math.round(b.inicio * fps);
          const dur = Math.max(1, Math.round(b.fim * fps) - from);
          return (
            <Sequence key={i} from={from} durationInFrames={dur} name={`${i + 1}. ${cena.tipo}`}>
              <CenaVisual cena={cena} cores={cores} fonte={fonte} fonteItalica={fonteItalica} duracao={dur / fps} oferta={props.oferta} />
              {i > 0 && <Flash cores={cores} />}
            </Sequence>
          );
        })}
        {props.legenda !== false && (
          <Legenda
            linhas={linhas}
            cores={cores}
            fonte={fonte}
            fonteItalica={fonteItalica}
            destaques={destaques}
            cenasSemLegenda={cenasSemLegenda}
          />
        )}
        </AreaCena.Provider>
        <Marca marca={props.marca} logo={props.logo ?? undefined} cores={cores} fonte={fonte} />
        </EstiloCtx.Provider>
      </Fontes>
      {props.sfx === true &&
        montarSons(props.cenas, tempos).map((s, k) => (
          <Sequence key={`sfx${k}`} from={Math.round(s.em * fps)} durationInFrames={Math.round(1.3 * fps)} layout="none">
            <Html5Audio src={staticFile(s.arquivo)} volume={s.volume * (props.volumeSfx ?? 0.7)} />
          </Sequence>
        ))}
      {props.narracao && <Html5Audio src={staticFile(props.narracao)} />}
      {props.trilha && <Html5Audio src={staticFile(props.trilha)} loop volume={volumeTrilha} />}
    </AbsoluteFill>
  );
};
