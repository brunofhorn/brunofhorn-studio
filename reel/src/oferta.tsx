/* Cenas da "pilha de ofertas": o preço cai a cada camada (cupom, cashback...)
   até o preço final. Também tem os ícones e o confete usados pelas outras cenas. */
import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CenaCamada, CenaResultado, Cores, Icone, Oferta } from './tipos';
import { pilhaSans } from './fontes';
import { EstiloCtx, LogoCaixa, gradienteCss } from './marca';

export const CORES_CAMADA = ['#FFC94A', '#5CC8FF', '#FF7AC6', '#B69CFF', '#FF9F4A'];
const corCamada = (cores: Cores, i: number) => {
  const p = cores.camadas && cores.camadas.length ? cores.camadas : CORES_CAMADA;
  return p[i % p.length];
};
const positivo = (cores: Cores) => cores.positivo ?? cores.destaque;

export const brl = (v: number, casas = 0) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

export const precoApos = (o: Oferta, n: number) =>
  o.precoLoja - o.camadas.slice(0, n).reduce((a, c) => a + c.valor, 0);

const mola = (frame: number, fps: number, atrasoSeg: number, config = { damping: 14, stiffness: 160, mass: 0.7 }) =>
  spring({ frame: frame - Math.round(atrasoSeg * fps), fps, config });

/* ---------- ícones ---------- */

const IconeFone: React.FC<{ cor: string; tam: number }> = ({ cor, tam }) => (
  <svg width={tam} height={tam} viewBox="0 0 100 100">
    <path d="M18 60 V50 a32 32 0 0 1 64 0 V60" fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round" />
    <rect x="9" y="55" width="22" height="33" rx="9" fill={cor} />
    <rect x="69" y="55" width="22" height="33" rx="9" fill={cor} />
  </svg>
);

const IconeGrupo: React.FC<{ cor: string; tam: number; fundo: string }> = ({ cor, tam, fundo }) => (
  <svg width={tam} height={tam} viewBox="0 0 100 100">
    <path d="M14 22 h72 a10 10 0 0 1 10 10 v36 a10 10 0 0 1 -10 10 h-40 l-18 16 v-16 h-14 a10 10 0 0 1 -10 -10 v-36 a10 10 0 0 1 10 -10z" fill={cor} />
    <circle cx="34" cy="50" r="6" fill={fundo} />
    <circle cx="50" cy="50" r="6" fill={fundo} />
    <circle cx="66" cy="50" r="6" fill={fundo} />
  </svg>
);

/** o logo da pilha: três barras que caem uma em cima da outra */
export const IconePilha: React.FC<{ tam: number; cores: Cores; atraso?: number }> = ({ tam, cores, atraso = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const barras = [
    { w: 1, cor: cores.destaque },
    { w: 0.8, cor: corCamada(cores, 0) },
    { w: 0.6, cor: corCamada(cores, 1) },
  ];
  const h = tam * 0.24;
  return (
    <div style={{ width: tam, height: tam, position: 'relative' }}>
      {barras.map((b, i) => {
        const e = mola(frame, fps, atraso + i * 0.14, { damping: 11, stiffness: 180, mass: 0.6 });
        const y = tam - (i + 1) * (h + tam * 0.06);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: (tam * (1 - b.w)) / 2, top: y, width: tam * b.w, height: h,
              borderRadius: h / 2.6, background: b.cor,
              transform: `translateY(${(1 - e) * -tam * 1.2}px)`, opacity: Math.min(1, e * 2),
            }}
          />
        );
      })}
    </div>
  );
};

export const IconeVisual: React.FC<{ icone: Icone; tam: number; cores: Cores; atraso?: number }> = ({ icone, tam, cores, atraso = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = mola(frame, fps, atraso);
  const flutua = Math.sin(frame / 14) * 8;
  const estilo = React.useContext(EstiloCtx);
  if (icone === 'logo' || (icone === 'pilha' && estilo.logo)) {
    if (!estilo.logo) return null;
    return <div style={{ transform: `translateY(${flutua}px)` }}><LogoCaixa src={estilo.logo} tam={tam * 1.25} cores={cores} atraso={atraso} /></div>;
  }
  if (icone === 'pilha') return <div style={{ transform: `translateY(${flutua}px)` }}><IconePilha tam={tam} cores={cores} atraso={atraso} /></div>;
  return (
    <div style={{ transform: `translateY(${flutua}px) scale(${e})`, opacity: e }}>
      {icone === 'fone' ? <IconeFone cor={cores.destaque} tam={tam} /> : <IconeGrupo cor={cores.destaque} tam={tam} fundo={cores.fundo} />}
    </div>
  );
};

/* ---------- confete ---------- */

export const Confete: React.FC<{ emSeg: number; cores: Cores; x?: number; y?: number }> = ({ emSeg, cores, x = 540, y = 700 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - emSeg;
  if (t < 0 || t > 2.4) return null;
  const paleta = [cores.destaque, positivo(cores), ...(cores.camadas ?? CORES_CAMADA)];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 70 }).map((_, i) => {
        const ang = random(`a${i}`) * Math.PI * 2;
        const vel = 900 + random(`v${i}`) * 1300;
        const px = x + Math.cos(ang) * vel * t;
        const py = y + Math.sin(ang) * vel * t * 0.8 + 1500 * t * t;
        const rot = random(`r${i}`) * 720 * t;
        const op = interpolate(t, [0, 1.6, 2.4], [1, 1, 0]);
        const w = 14 + random(`w${i}`) * 16;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: px, top: py, width: w, height: w * 0.55, borderRadius: 3,
              background: paleta[i % paleta.length], opacity: op, transform: `rotate(${rot}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- peças da pilha ---------- */

const Ficha: React.FC<{ rotulo: string; valor: number; cor: string; cores: Cores; fonte: string; compacta?: boolean }> = ({
  rotulo, valor, cor, cores, fonte, compacta,
}) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      width: compacta ? undefined : 860, padding: compacta ? '14px 26px' : '30px 44px', borderRadius: compacta ? 22 : 34,
      background: cor, color: '#0B0D12', boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
      fontFamily: pilhaSans(fonte),
    }}
  >
    <div style={{ fontWeight: 700, fontSize: compacta ? 30 : 46, lineHeight: 1.1 }}>{rotulo}</div>
    <div style={{ fontWeight: 900, fontSize: compacta ? 32 : 58, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
      −{brl(valor)}
    </div>
  </div>
);

const Produto: React.FC<{ oferta: Oferta; cores: Cores; fonte: string; e: number }> = ({ oferta, cores, fonte, e }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', gap: 30, padding: '24px 40px 24px 26px', borderRadius: 40,
      background: `color-mix(in srgb, ${cores.texto} 7%, ${cores.fundo})`,
      border: `2px solid color-mix(in srgb, ${cores.texto} 14%, transparent)`,
      opacity: e, transform: `translateY(${(1 - e) * -40}px)`,
    }}
  >
    <div
      style={{
        width: 110, height: 110, borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `color-mix(in srgb, ${cores.destaque} 16%, ${cores.fundo})`,
      }}
    >
      <IconeFone cor={cores.destaque} tam={78} />
    </div>
    <div style={{ fontFamily: pilhaSans(fonte) }}>
      <div style={{ fontWeight: 900, fontSize: 50, color: cores.texto, letterSpacing: '-0.02em' }}>{oferta.produto}</div>
      {oferta.origem && <div style={{ fontWeight: 400, fontSize: 34, color: cores.suave, marginTop: 4 }}>{oferta.origem}</div>}
    </div>
  </div>
);

/** barra de "quanto já caiu", com a porcentagem */
const Medidor: React.FC<{ fracao: number; cores: Cores; fonte: string }> = ({ fracao, cores, fonte }) => (
  <div style={{ width: 860 }}>
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 32,
        color: cores.suave, marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}
    >
      <span>Desconto empilhado</span>
      <span style={{ color: positivo(cores) }}>{Math.round(fracao * 100)}%</span>
    </div>
    <div style={{ height: 26, borderRadius: 13, background: `color-mix(in srgb, ${cores.texto} 10%, ${cores.fundo})`, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%', width: `${Math.min(100, (fracao / 0.5) * 100)}%`, borderRadius: 13,
          background: cores.gradiente ? gradienteCss(cores) : `linear-gradient(90deg, ${corCamada(cores, 0)}, ${positivo(cores)})`,
        }}
      />
    </div>
  </div>
);

type PropsOferta<C> = { cena: C; cores: Cores; fonte: string; fonteItalica: string; duracao: number; oferta?: Oferta };

/** momentos da cena de camada, em segundos (o Reel usa os mesmos para os efeitos sonoros) */
export const TEMPO_CAMADA = { ficha: 0.15, pouso: 0.42, contaIni: 0.45, contaFim: 1.25 };
export const TEMPO_RESULTADO = { contaIni: 0.2, contaFim: 1.5, selo: 1.75, parcelas: 2.3 };

export const Camada: React.FC<PropsOferta<CenaCamada>> = ({ cena, cores, fonte, oferta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!oferta) return null;
  const n = Math.max(0, Math.min(cena.mostrar, oferta.camadas.length));
  const t = frame / fps;
  const anterior = n > 0 ? precoApos(oferta, n - 1) : oferta.precoLoja;
  const atual = precoApos(oferta, n);
  const T = TEMPO_CAMADA;
  const conta = interpolate(t, [T.contaIni, T.contaFim], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const preco = n === 0 ? oferta.precoLoja : anterior + (atual - anterior) * conta;
  const fracaoAnt = (oferta.precoLoja - anterior) / oferta.precoLoja;
  const fracao = fracaoAnt + ((oferta.precoLoja - atual) / oferta.precoLoja - fracaoAnt) * conta;

  const eProduto = n === 0 ? mola(frame, fps, 0) : 1;
  const ePreco = n === 0 ? mola(frame, fps, 0.25) : 1;
  const eFicha = mola(frame, fps, T.ficha, { damping: 10, stiffness: 170, mass: 0.8 });
  // tremidinha quando a ficha pousa
  const desdePouso = t - T.pouso;
  const tremor = n > 0 && desdePouso > 0 && desdePouso < 0.3 ? Math.sin(desdePouso * 90) * 14 * (1 - desdePouso / 0.3) : 0;
  // o "−R$ 150" que sobe do preço
  const tVoa = t - T.contaIni;
  const voa = n > 0 && tVoa > 0 && tVoa < 1.1;
  const pulsoPreco = n > 0 ? 1 + 0.08 * Math.max(0, 1 - Math.abs(t - T.contaFim) / 0.18) : 1;
  const riscado = interpolate(t, [T.contaIni - 0.1, T.contaIni + 0.25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 330, transform: `translateY(${tremor}px)` }}>
      <Produto oferta={oferta} cores={cores} fonte={fonte} e={eProduto} />

      <div style={{ marginTop: 54, textAlign: 'center', fontFamily: pilhaSans(fonte), opacity: ePreco, transform: `scale(${0.8 + 0.2 * ePreco})` }}>
        <div style={{ fontWeight: 700, fontSize: 34, letterSpacing: '0.14em', textTransform: 'uppercase', color: cores.suave }}>
          {n === 0 ? 'Preço da loja' : 'Você paga'}
        </div>
        <div style={{ position: 'relative', height: 64, marginTop: 6 }}>
          {n > 0 && (
            <div style={{ display: 'inline-block', position: 'relative', fontWeight: 700, fontSize: 52, color: cores.alerta }}>
              {brl(anterior)}
              <div
                style={{
                  position: 'absolute', left: -6, top: '52%', height: 6, borderRadius: 3, background: cores.alerta,
                  width: `calc(${riscado * 100}% + 12px)`,
                }}
              />
            </div>
          )}
        </div>
        <div
          style={{
            fontWeight: 900, fontSize: 200, lineHeight: 1, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums',
            color: n === 0 ? cores.texto : positivo(cores), transform: `scale(${pulsoPreco})`,
          }}
        >
          {brl(Math.round(preco))}
        </div>
      </div>

      {voa && (
        <div
          style={{
            position: 'absolute', top: 560 - tVoa * 260, right: 90, fontFamily: pilhaSans(fonte), fontWeight: 900,
            fontSize: 74, color: corCamada(cores, n - 1),
            opacity: interpolate(tVoa, [0, 0.15, 0.8, 1.1], [0, 1, 1, 0]), transform: `rotate(-6deg)`,
          }}
        >
          −{brl(oferta.camadas[n - 1].valor)}
        </div>
      )}

      <div style={{ marginTop: 40, opacity: n === 0 ? ePreco : 1 }}>
        <Medidor fracao={fracao} cores={cores} fonte={fonte} />
      </div>

      {/* a pilha: a camada mais nova fica em cima */}
      <div style={{ marginTop: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {oferta.camadas.slice(0, n).map((c, i) => ({ c, i })).reverse().map(({ c, i }) => {
          const nova = i === n - 1;
          return (
            <div
              key={i}
              style={nova ? {
                transform: `translateY(${(1 - eFicha) * -700}px) rotate(${(1 - eFicha) * -10}deg)`,
                opacity: Math.min(1, eFicha * 3),
              } : { opacity: 0.85, transform: `scale(${1 - (n - 1 - i) * 0.04})` }}
            >
              <Ficha rotulo={c.rotulo} valor={c.valor} cor={corCamada(cores, i)} cores={cores} fonte={fonte} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Resultado: React.FC<PropsOferta<CenaResultado>> = ({ cena, cores, fonte, oferta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!oferta) return null;
  const t = frame / fps;
  const T = TEMPO_RESULTADO;
  const final = precoApos(oferta, oferta.camadas.length);
  const economia = oferta.precoLoja - final;
  const conta = interpolate(t, [T.contaIni, T.contaFim], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  });
  const preco = oferta.precoLoja - economia * conta;
  const eTopo = mola(frame, fps, 0);
  const eSelo = mola(frame, fps, T.selo, { damping: 9, stiffness: 220, mass: 0.6 });
  const eParcelas = mola(frame, fps, T.parcelas);
  const eFichas = mola(frame, fps, T.parcelas + 0.25);
  const pulso = 1 + 0.1 * Math.max(0, 1 - Math.abs(t - T.contaFim) / 0.2);
  const brilho = t > T.contaFim ? 0.45 + 0.2 * Math.sin((t - T.contaFim) * 6) : 0;

  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300, fontFamily: pilhaSans(fonte), textAlign: 'center' }}>
      <div style={{ opacity: eTopo, transform: `translateY(${(1 - eTopo) * -30}px)` }}>
        <div style={{ fontWeight: 700, fontSize: 38, letterSpacing: '0.16em', textTransform: 'uppercase', color: cores.suave }}>
          {cena.rotulo ?? 'Preço final'}
        </div>
        <div style={{ display: 'inline-block', position: 'relative', marginTop: 18, fontWeight: 700, fontSize: 64, color: cores.alerta }}>
          {brl(oferta.precoLoja)}
          <div style={{ position: 'absolute', left: -8, right: -8, top: '52%', height: 7, borderRadius: 4, background: cores.alerta }} />
        </div>
      </div>

      <div
        style={{
          marginTop: 10, fontWeight: 900, fontSize: 250, lineHeight: 1, letterSpacing: '-0.05em',
          fontVariantNumeric: 'tabular-nums', color: positivo(cores), transform: `scale(${pulso})`,
          textShadow: `0 0 80px color-mix(in srgb, ${positivo(cores)} ${Math.round(brilho * 100)}%, transparent)`,
        }}
      >
        {brl(Math.round(preco))}
      </div>

      <div
        style={{
          marginTop: 50, padding: '22px 46px', borderRadius: 24, border: `6px solid ${positivo(cores)}`,
          color: positivo(cores), fontWeight: 900, fontSize: 64, letterSpacing: '0.02em', textTransform: 'uppercase',
          opacity: Math.min(1, eSelo * 2), transform: `rotate(-7deg) scale(${2.2 - 1.2 * eSelo})`,
        }}
      >
        {cena.selo ?? `Economizei ${brl(economia)}`}
      </div>

      {oferta.parcelas && (
        <div
          style={{
            marginTop: 56, padding: '18px 40px', borderRadius: 999, background: `color-mix(in srgb, ${cores.texto} 9%, ${cores.fundo})`,
            color: cores.texto, fontWeight: 700, fontSize: 46, opacity: eParcelas, transform: `translateY(${(1 - eParcelas) * 40}px)`,
          }}
        >
          {oferta.parcelas}
        </div>
      )}

      <div
        style={{
          marginTop: 56, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, padding: '0 70px',
          opacity: eFichas, transform: `translateY(${(1 - eFichas) * 40}px)`,
        }}
      >
        {oferta.camadas.map((c, i) => (
          <Ficha key={i} rotulo={c.rotulo} valor={c.valor} cor={corCamada(cores, i)} cores={cores} fonte={fonte} compacta />
        ))}
      </div>

      <Confete emSeg={T.contaFim} cores={cores} y={760} />
    </AbsoluteFill>
  );
};
