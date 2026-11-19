/* Peças de marca: o estilo do destaque (itálico ou gradiente), o texto pintado
   com o gradiente da marca e o logo que se monta caixa por caixa. */
import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Cores } from './tipos';

export type Estilo = { destaque: 'italico' | 'gradiente'; logo?: string };
export const EstiloCtx = React.createContext<Estilo>({ destaque: 'italico' });

export const gradienteCss = (cores: Cores, angulo = 90) => {
  const g = cores.gradiente && cores.gradiente.length >= 2 ? cores.gradiente : [cores.destaque, cores.destaque];
  return `linear-gradient(${angulo}deg, ${g.join(', ')})`;
};

/** texto pintado com o gradiente da marca */
export const TextoGradiente: React.FC<{ cores: Cores; children: React.ReactNode; style?: React.CSSProperties }> = ({
  cores, children, style,
}) => (
  <span
    style={{
      backgroundImage: gradienteCss(cores), WebkitBackgroundClip: 'text', backgroundClip: 'text',
      color: 'transparent', WebkitTextFillColor: 'transparent', ...style,
    }}
  >
    {children}
  </span>
);

/* O logo tem três caixas empilhadas entre colchetes. Cada faixa é recortada da
   mesma imagem e cai no lugar; parado, o resultado é o logo original.
   As frações abaixo valem para o logo-transparente.png (502x393). */
const FAIXAS = {
  topo: 'inset(0% 16.3% 71.5% 17%)',
  meio: 'inset(28.5% 16.3% 43.5% 17%)',
  base: 'inset(56.5% 16.3% 0% 17%)',
  esq: 'inset(0% 83% 0% 0%)',
  dir: 'inset(0% 0% 0% 83.7%)',
};
const PROPORCAO = 393 / 502;

export const LogoAnimado: React.FC<{ src: string; largura: number; atraso?: number; montar?: boolean }> = ({
  src, largura, atraso = 0, montar = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const altura = largura * PROPORCAO;
  const queda = (k: number) =>
    montar ? spring({ frame: frame - Math.round((atraso + k * 0.16) * fps), fps, config: { damping: 11, stiffness: 170, mass: 0.7 } }) : 1;
  const eBase = queda(0);
  const eMeio = queda(1);
  const eTopo = queda(2);
  const eCol = montar ? spring({ frame: frame - Math.round((atraso + 0.5) * fps), fps, config: { damping: 14, stiffness: 160 } }) : 1;
  const camada = (clip: string, e: number, extra = '') => (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute', inset: 0, width: largura, height: altura, clipPath: clip,
        transform: `translateY(${(1 - e) * -altura * 1.3}px) ${extra}`, opacity: Math.min(1, e * 3),
      }}
    />
  );
  return (
    <div style={{ position: 'relative', width: largura, height: altura }}>
      {camada(FAIXAS.base, eBase)}
      {camada(FAIXAS.meio, eMeio)}
      {camada(FAIXAS.topo, eTopo)}
      <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: largura, height: altura, clipPath: FAIXAS.esq, opacity: eCol, transform: `translateX(${(1 - eCol) * largura * 0.15}px)` }} />
      <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: largura, height: altura, clipPath: FAIXAS.dir, opacity: eCol, transform: `translateX(${(1 - eCol) * -largura * 0.15}px)` }} />
    </div>
  );
};

/** o logo dentro da caixa arredondada do site, com brilho âmbar e reflexo passando */
export const LogoCaixa: React.FC<{ src: string; tam: number; cores: Cores; atraso?: number }> = ({ src, tam, cores, atraso = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - Math.round(atraso * fps), fps, config: { damping: 13, stiffness: 150 } });
  const brilho = 0.5 + 0.25 * Math.sin(frame / 18);
  const reflexo = interpolate((frame / fps) % 3.2, [0.8, 1.8], [-1.2, 1.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const borda = cores.camadas?.[0] ?? cores.destaque;
  return (
    <div style={{ position: 'relative', width: tam, height: tam, opacity: Math.min(1, e * 2), transform: `scale(${0.7 + 0.3 * e})` }}>
      <div
        style={{
          position: 'absolute', inset: -tam * 0.18, borderRadius: tam * 0.4, filter: `blur(${tam * 0.16}px)`,
          background: gradienteCss(cores), opacity: 0.35 * brilho,
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: tam * 0.26, overflow: 'hidden',
          background: `linear-gradient(135deg, color-mix(in srgb, ${cores.texto} 7%, ${cores.fundo}), color-mix(in srgb, ${cores.texto} 12%, ${cores.fundo}) 50%, ${cores.fundo})`,
          border: `${Math.max(2, tam * 0.012)}px solid color-mix(in srgb, ${borda} 35%, transparent)`,
          boxShadow: `0 ${tam * 0.1}px ${tam * 0.36}px color-mix(in srgb, ${borda} 28%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <LogoAnimado src={src} largura={tam * 0.78} atraso={atraso + 0.1} />
        <div
          style={{
            position: 'absolute', inset: 0, transform: `translateX(${reflexo * 100}%) skewX(-18deg)`,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
          }}
        />
      </div>
    </div>
  );
};
