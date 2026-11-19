/* O formato do cenas.json. É o único arquivo que muda de um reel para outro:
   o código da composição fica igual. */

export type Cores = {
  /** cor do fundo */
  fundo: string;
  /** cor do texto principal */
  texto: string;
  /** cor de destaque: palavra marcada, números, CTA */
  destaque: string;
  /** texto secundário (subtítulos, rótulos) */
  suave: string;
  /** cor do texto escrito em cima da cor de destaque (o bloco do CTA) */
  sobreDestaque: string;
  /** cor do preço riscado (opcional) */
  alerta?: string;
  /** cor do que é ganho: preço que caiu, economia, medidor (padrão: destaque) */
  positivo?: string;
  /** cores das fichas de cada camada, em ordem */
  camadas?: string[];
  /** gradiente da marca, usado no destaque, na barra e no bloco do CTA */
  gradiente?: string[];
};

type Base = {
  /** o que é dito nessa cena. Vira narração e legenda palavra por palavra. */
  fala: string;
  /** segundos. Só vale quando NÃO há narração; com narração, quem manda é o áudio. */
  duracao?: number;
};

export type Icone = 'pilha' | 'fone' | 'grupo' | 'logo';
export type CenaGancho = Base & { tipo: 'gancho'; titulo: string; destaque?: string; selo?: string; icone?: Icone };
export type CenaTitulo = Base & { tipo: 'titulo'; titulo: string; subtitulo?: string; destaque?: string; icone?: Icone };
export type CenaLista = Base & { tipo: 'lista'; titulo?: string; itens: string[] };
export type CenaNumero = Base & {
  tipo: 'numero';
  de?: number;
  ate: number;
  prefixo?: string;
  sufixo?: string;
  rotulo?: string;
  decimais?: number;
};
export type CenaAntesDepois = Base & {
  tipo: 'antes-depois';
  antes: string;
  depois: string;
  rotuloAntes?: string;
  rotuloDepois?: string;
};
export type CenaCta = Base & {
  tipo: 'cta'; palavra: string; chamada?: string; promessa?: string;
  /** selos abaixo da promessa, ex.: [{ "nome": "WhatsApp", "cor": "#128C7E" }] */
  canais?: { nome: string; cor: string }[];
};
/** uma camada da pilha de ofertas: mostra as `mostrar` primeiras camadas de `oferta`, a última entrando agora */
export type CenaCamada = Base & { tipo: 'camada'; mostrar: number };
/** o preço final, com a economia total */
export type CenaResultado = Base & { tipo: 'resultado'; rotulo?: string; selo?: string };

export type Oferta = {
  produto: string;
  /** de onde vem o preço cheio (ex.: "no site da loja") */
  origem?: string;
  precoLoja: number;
  camadas: { rotulo: string; valor: number }[];
  /** ex.: "em 10x sem juros" */
  parcelas?: string;
  icone?: Icone;
};

export type Cena = CenaGancho | CenaTitulo | CenaLista | CenaNumero | CenaAntesDepois | CenaCta | CenaCamada | CenaResultado;

export type Palavra = { texto: string; inicio: number; fim: number; cena: number };
export type Tempos = {
  palavras: Palavra[];
  cenas: { inicio: number; fim: number }[];
  duracao: number;
};

export type ReelProps = {
  cores?: Partial<Cores>;
  /** família do Google Fonts para o texto forte, ou "sistema" */
  fonte?: string;
  /** família do Google Fonts para as palavras em itálico, ou "sistema" */
  fonteItalica?: string;
  /** false desliga a legenda palavra por palavra */
  legenda?: boolean;
  /** arquivo em public/, gerado por scripts/narrar.mjs */
  narracao?: string | null;
  /** arquivo em public/ com o tempo de cada palavra, gerado por scripts/narrar.mjs */
  palavras?: string | null;
  /** arquivo em public/, preparado por scripts/mixar.mjs */
  trilha?: string | null;
  /** volume da trilha de 0 a 1 (padrão: 0,3 com narração, 0,8 sem) */
  volumeTrilha?: number;
  cenas: Cena[];
  /** a compra das cenas "camada" e "resultado" */
  oferta?: Oferta;
  /** nome da marca no selo do topo (some se vazio). A última palavra sai no gradiente. */
  marca?: string;
  /** arquivo em public/ com o logo (PNG transparente) */
  logo?: string;
  /** "italico" (padrão: serifa itálica) ou "gradiente" (mesma fonte, pintada com o gradiente) */
  estiloDestaque?: 'italico' | 'gradiente';
  /** etiquetas que flutuam no fundo no lugar dos símbolos, ex.: ["-70% OFF", "Frete Grátis"] */
  etiquetas?: string[];
  /** true liga os efeitos sonoros automáticos (precisa dos sfx-*.wav em public/) */
  sfx?: boolean;
  /** volume dos efeitos, de 0 a 1 (padrão 0,7) */
  volumeSfx?: number;
  /** preenchido sozinho pelo calculateMetadata; não escreva no JSON */
  tempos?: Tempos;
};

export const CORES_PADRAO: Cores = {
  fundo: '#0E0F12',
  texto: '#F4F4F2',
  destaque: '#FFC94A',
  suave: '#9A9CA3',
  sobreDestaque: '#0E0F12',
  alerta: '#FF5C5C',
};
