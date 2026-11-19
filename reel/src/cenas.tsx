/* Os tipos de cena. Cada um ocupa a parte de cima da tela (até ~1150 px) e deixa
   o centro-baixo para a legenda. Tudo se mexe o tempo todo: entrada com mola e um
   zoom lento, para nenhum quadro ficar parado. */
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import type {
  Cena, CenaAntesDepois, CenaCamada, CenaCta, CenaGancho, CenaLista, CenaNumero, CenaResultado, CenaTitulo, Cores, Oferta,
} from './tipos';
import { pilhaSans, pilhaSerif } from './fontes';
import { Camada, IconeVisual, Resultado } from './oferta';
import { EstiloCtx, TextoGradiente, gradienteCss } from './marca';

type Props<C> = { cena: C; cores: Cores; fonte: string; fonteItalica: string; duracao: number; oferta?: Oferta };

/** onde termina a área das cenas: sem legenda, elas podem usar mais da tela */
export const AreaCena = React.createContext(1180);

const useEntrada = (atrasoSeg = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - Math.round(atrasoSeg * fps), fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
};

/** zoom lento em toda cena: nada fica parado, mesmo cena longa */
const Respira: React.FC<{ duracao: number; children: React.ReactNode; topo?: number }> = ({
  duracao, children, topo = 230,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = interpolate(frame, [0, Math.max(1, duracao * fps)], [1, 1.045]);
  const fim = React.useContext(AreaCena);
  return (
    <AbsoluteFill
      style={{
        top: topo, height: fim - topo, padding: '0 90px', justifyContent: 'center',
        alignItems: 'center', transform: `scale(${s})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** escreve o texto e pinta o trecho `destaque` em itálico na cor de destaque */
const ComDestaque: React.FC<{ texto: string; destaque?: string; cores: Cores; fonteItalica: string }> = ({
  texto, destaque, cores, fonteItalica,
}) => {
  const estilo = React.useContext(EstiloCtx);
  const i = destaque ? texto.toLowerCase().indexOf(destaque.toLowerCase()) : -1;
  if (!destaque || i < 0) return <>{texto}</>;
  if (estilo.destaque === 'gradiente') {
    return (
      <>
        {texto.slice(0, i)}
        <TextoGradiente cores={cores}>{texto.slice(i, i + destaque.length)}</TextoGradiente>
        {texto.slice(i + destaque.length)}
      </>
    );
  }
  return (
    <>
      {texto.slice(0, i)}
      <span style={{ color: cores.destaque, fontFamily: pilhaSerif(fonteItalica), fontStyle: 'italic', fontWeight: 400 }}>
        {texto.slice(i, i + destaque.length)}
      </span>
      {texto.slice(i + destaque.length)}
    </>
  );
};

const Selo: React.FC<{ texto: string; cores: Cores; fonte: string; atraso: number }> = ({ texto, cores, fonte, atraso }) => {
  const e = spring({ frame: useCurrentFrame() - Math.round(atraso * useVideoConfig().fps), fps: useVideoConfig().fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        display: 'inline-block', marginTop: 60, padding: '20px 44px', borderRadius: 24,
        background: cores.gradiente ? gradienteCss(cores, 100) : cores.destaque,
        color: cores.sobreDestaque, fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 72, letterSpacing: '-0.01em',
        opacity: Math.min(1, e * 2), transform: `rotate(-6deg) scale(${2 - e})`,
        boxShadow: `0 20px 70px color-mix(in srgb, ${cores.destaque} 40%, transparent)`,
      }}
    >
      {texto}
    </div>
  );
};

const Gancho: React.FC<Props<CenaGancho>> = ({ cena, cores, fonte, fonteItalica, duracao }) => {
  const e = useEntrada();
  return (
    <Respira duracao={duracao} topo={260}>
      {cena.icone && <div style={{ marginBottom: 50 }}><IconeVisual icone={cena.icone} tam={170} cores={cores} /></div>}
      <div
        style={{
          fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 116, lineHeight: 1.02,
          letterSpacing: '-0.035em', color: cores.texto, textAlign: 'center', textWrap: 'balance',
          opacity: e, transform: `translateY(${(1 - e) * 70}px) scale(${1.08 - 0.08 * e})`,
        }}
      >
        <ComDestaque texto={cena.titulo} destaque={cena.destaque} cores={cores} fonteItalica={fonteItalica} />
      </div>
      {cena.selo && <Selo texto={cena.selo} cores={cores} fonte={fonte} atraso={0.55} />}
    </Respira>
  );
};

const Titulo: React.FC<Props<CenaTitulo>> = ({ cena, cores, fonte, fonteItalica, duracao }) => {
  const e = useEntrada();
  const e2 = useEntrada(0.25);
  return (
    <Respira duracao={duracao}>
      {cena.icone && <div style={{ marginBottom: 60 }}><IconeVisual icone={cena.icone} tam={200} cores={cores} /></div>}
      <div style={{ textAlign: 'center', textWrap: 'balance' }}>
        <div
          style={{
            fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 96, lineHeight: 1.04,
            letterSpacing: '-0.03em', color: cores.texto, opacity: e, transform: `translateY(${(1 - e) * 60}px)`,
          }}
        >
          <ComDestaque texto={cena.titulo} destaque={cena.destaque} cores={cores} fonteItalica={fonteItalica} />
        </div>
        {cena.subtitulo && (
          <div
            style={{
              marginTop: 36, fontFamily: pilhaSans(fonte), fontWeight: 400, fontSize: 46, lineHeight: 1.3,
              color: cores.suave, opacity: e2, transform: `translateY(${(1 - e2) * 30}px)`,
            }}
          >
            {cena.subtitulo}
          </div>
        )}
      </div>
    </Respira>
  );
};

const Lista: React.FC<Props<CenaLista>> = ({ cena, cores, fonte, duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eTitulo = useEntrada();
  const n = cena.itens.length;
  // os itens entram espalhados pelos primeiros 70% da cena
  const passo = n > 1 ? (duracao * 0.7) / n : 0;
  return (
    <Respira duracao={duracao}>
      <div style={{ width: '100%' }}>
        {cena.titulo && (
          <div
            style={{
              fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 70, letterSpacing: '-0.03em',
              color: cores.texto, marginBottom: 48, opacity: eTitulo,
            }}
          >
            {cena.titulo}
          </div>
        )}
        {cena.itens.map((item, i) => {
          const e = spring({ frame: frame - Math.round((0.15 + i * passo) * fps), fps, config: { damping: 15, stiffness: 150 } });
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 32, marginBottom: 30,
                opacity: e, transform: `translateX(${(1 - e) * -80}px)`,
              }}
            >
              <div
                style={{
                  flex: '0 0 92px', height: 92, borderRadius: 46, background: cores.destaque, color: cores.sobreDestaque,
                  fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 50, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 54, lineHeight: 1.15, color: cores.texto }}>
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </Respira>
  );
};

const Numero: React.FC<Props<CenaNumero>> = ({ cena, cores, fonte, duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEntrada();
  const eRotulo = useEntrada(0.3);
  const de = cena.de ?? 0;
  const casas = cena.decimais ?? 0;
  const v = interpolate(frame, [0, Math.max(2, duracao * 0.6 * fps)], [de, cena.ate], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const texto = v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return (
    <Respira duracao={duracao}>
      <div style={{ textAlign: 'center', textWrap: 'balance' }}>
        <div
          style={{
            fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 230, lineHeight: 1, letterSpacing: '-0.05em',
            color: cores.destaque, fontVariantNumeric: 'tabular-nums', opacity: e, transform: `scale(${0.85 + 0.15 * e})`,
          }}
        >
          {cena.prefixo ?? ''}
          {texto}
          {cena.sufixo ?? ''}
        </div>
        {cena.rotulo && (
          <div
            style={{
              marginTop: 30, fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 52, lineHeight: 1.2,
              color: cores.texto, opacity: eRotulo, transform: `translateY(${(1 - eRotulo) * 30}px)`,
            }}
          >
            {cena.rotulo}
          </div>
        )}
      </div>
    </Respira>
  );
};

const Cartao: React.FC<{
  rotulo: string; texto: string; cores: Cores; fonte: string; forte: boolean; e: number;
}> = ({ rotulo, texto, cores, fonte, forte, e }) => (
  <div
    style={{
      width: '100%', borderRadius: 36, padding: '38px 46px',
      background: forte ? `color-mix(in srgb, ${cores.destaque} 14%, ${cores.fundo})` : `color-mix(in srgb, ${cores.texto} 6%, ${cores.fundo})`,
      border: `3px solid ${forte ? cores.destaque : `color-mix(in srgb, ${cores.texto} 14%, transparent)`}`,
      opacity: e, transform: `translateY(${(1 - e) * 60}px)`,
    }}
  >
    <div
      style={{
        fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 34, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: forte ? cores.destaque : cores.suave, marginBottom: 14,
      }}
    >
      {rotulo}
    </div>
    <div style={{ fontFamily: pilhaSans(fonte), fontWeight: forte ? 900 : 700, fontSize: 56, lineHeight: 1.15, color: cores.texto }}>
      {texto}
    </div>
  </div>
);

const AntesDepois: React.FC<Props<CenaAntesDepois>> = ({ cena, cores, fonte, duracao }) => {
  const eAntes = useEntrada();
  const eDepois = useEntrada(Math.min(1.6, duracao * 0.42));
  return (
    <Respira duracao={duracao}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 34 }}>
        <Cartao rotulo={cena.rotuloAntes ?? 'Antes'} texto={cena.antes} cores={cores} fonte={fonte} forte={false} e={eAntes} />
        <Cartao rotulo={cena.rotuloDepois ?? 'Depois'} texto={cena.depois} cores={cores} fonte={fonte} forte e={eDepois} />
      </div>
    </Respira>
  );
};

const Cta: React.FC<Props<CenaCta>> = ({ cena, cores, fonte, fonteItalica }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEntrada();
  const ePalavra = useEntrada(0.2);
  const ePromessa = useEntrada(0.45);
  const pulso = 1 + 0.035 * Math.sin((frame / fps) * Math.PI * 2 * 0.9);
  const eSeta = useEntrada(0.8);
  const estilo = React.useContext(EstiloCtx);
  const eCanais = useEntrada(0.65);
  const quica = Math.abs(Math.sin((frame / fps) * Math.PI * 1.6)) * 30;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px', top: -60 }}>
      <div style={{ textAlign: 'center', textWrap: 'balance', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginBottom: 40 }}><IconeVisual icone={estilo.logo ? 'logo' : 'grupo'} tam={estilo.logo ? 190 : 150} cores={cores} /></div>
        <div
          style={{
            ...(estilo.destaque === 'gradiente'
              ? { fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 92 }
              : { fontFamily: pilhaSerif(fonteItalica), fontStyle: 'italic' as const, fontSize: 110 }),
            color: cores.texto,
            opacity: e, transform: `translateY(${(1 - e) * 40}px)`,
          }}
        >
          {cena.chamada ?? 'Comenta'}
        </div>
        <div
          style={{
            display: 'inline-block', marginTop: 26, padding: '26px 64px', borderRadius: 30,
            background: cores.gradiente ? gradienteCss(cores, 100) : cores.destaque, color: cores.sobreDestaque, fontFamily: pilhaSans(fonte), fontWeight: 900,
            fontSize: 150, letterSpacing: '-0.02em', lineHeight: 1,
            opacity: ePalavra, transform: `scale(${(0.6 + 0.4 * ePalavra) * pulso})`,
            boxShadow: `0 20px 80px color-mix(in srgb, ${cores.destaque} 35%, transparent)`,
          }}
        >
          {cena.palavra.toUpperCase()}
        </div>
        {cena.promessa && (
          <div
            style={{
              marginTop: 50, fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 52, lineHeight: 1.25,
              color: cores.texto, opacity: ePromessa, transform: `translateY(${(1 - ePromessa) * 30}px)`,
            }}
          >
            {cena.promessa}
          </div>
        )}
        {cena.canais && cena.canais.length > 0 && (
          <div style={{ display: 'flex', gap: 22, marginTop: 40, opacity: eCanais, transform: `translateY(${(1 - eCanais) * 30}px)` }}>
            {cena.canais.map((c) => (
              <div
                key={c.nome}
                style={{
                  padding: '16px 34px', borderRadius: 20, background: c.cor, color: '#FFFFFF',
                  fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 40,
                  boxShadow: `0 14px 40px color-mix(in srgb, ${c.cor} 40%, transparent)`,
                }}
              >
                {c.nome}
              </div>
            ))}
          </div>
        )}
        <svg width="90" height="110" viewBox="0 0 90 110" style={{ marginTop: 50, opacity: eSeta, transform: `translateY(${quica}px)` }}>
          <path d="M45 8 V92 M12 62 L45 96 L78 62" fill="none" stroke={cores.destaque} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

export const CenaVisual: React.FC<Props<Cena>> = (p) => {
  switch (p.cena.tipo) {
    case 'gancho': return <Gancho {...(p as Props<CenaGancho>)} />;
    case 'titulo': return <Titulo {...(p as Props<CenaTitulo>)} />;
    case 'lista': return <Lista {...(p as Props<CenaLista>)} />;
    case 'numero': return <Numero {...(p as Props<CenaNumero>)} />;
    case 'antes-depois': return <AntesDepois {...(p as Props<CenaAntesDepois>)} />;
    case 'cta': return <Cta {...(p as Props<CenaCta>)} />;
    case 'camada': return <Camada {...(p as Props<CenaCamada>)} />;
    case 'resultado': return <Resultado {...(p as Props<CenaResultado>)} />;
    default: return null;
  }
};
