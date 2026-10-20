// Compra e Venda (RN-001…RN-006). Domínio puro: Decimal (precisão 28), sem arredondar no cálculo.
// Compra espelha calc.js/planilha; venda: base da @ por lote (ADR-0012, RN-024) e desconto em kg por
// cabeça como na planilha (ADR-0013, RN-025).
// Sem imports locais: o parity.mjs carrega este arquivo direto (Node strip-types).
import DecimalBase from 'decimal.js';
const Decimal = DecimalBase.clone({ precision: 28 });
type Decimal = DecimalBase;

export type ModoPeso = 'total' | 'medio' | 'individual';

export interface LoteInput {
  modo: ModoPeso;
  /** Cabeças (modos total/médio). No modo individual vale o nº de pesos informados. */
  qtd?: DecimalBase.Value | null;
  /** kg do lote (modo total) ou kg por cabeça (modo médio). */
  peso?: DecimalBase.Value | null;
  /** kg de cada animal (modo individual). */
  pesos?: (DecimalBase.Value | null)[];
  /** R$ por @. */
  preco?: DecimalBase.Value | null;
  /** Só venda (RN-024): `vivo` (padrão) usa `arrobaVivoKg`; `carcaca` usa `arrobaCarcacaKg`. */
  base?: 'vivo' | 'carcaca';
  /** Só venda (RN-025): `false` desliga o desconto; qualquer outro valor mantém ligado (padrão). */
  aplicarDesconto?: boolean;
  /** Só venda (RN-025): kg descontados POR CABEÇA. Vazio/null/inválido usa `params.descontoVendaKgCab`. */
  desconto?: DecimalBase.Value | null;
}

export interface CompraVendaInput {
  compras: LoteInput[];
  vendas: LoteInput[];
}

export interface ParametrosCompraVenda {
  /** kg de peso vivo por @: compra (RN-001) e venda com base `vivo` (RN-024). */
  arrobaVivoKg: Decimal;
  /** kg de carcaça por @: venda com base `carcaca` (RN-024). */
  arrobaCarcacaKg: Decimal;
  /** Desconto padrão da venda, em kg por cabeça (RN-025, ADR-0013). */
  descontoVendaKgCab: Decimal;
}

export const PARAMETROS_COMPRA_VENDA: ParametrosCompraVenda = {
  arrobaVivoKg: new Decimal(30),
  arrobaCarcacaKg: new Decimal(15),
  descontoVendaKgCab: new Decimal(10),
};

export interface LinhaCalculada {
  qtd: Decimal;
  kg: Decimal;
  /** kg após o desconto (= kg na compra); nunca negativo (RN-025). */
  kgLiquido: Decimal;
  /** kg por cabeça efetivamente descontados (0 na compra ou com desconto desligado). */
  descontoKgCab: Decimal;
  /** kg descontados no lote efetivamente (kg − kgLiquido; ≤ qtd × descontoKgCab se o líquido foi limitado a 0). */
  kgDescontado: Decimal;
  arrobas: Decimal;
  preco: Decimal;
  total: Decimal;
  /** R$ por cabeça; `null` (indefinido, RN-022) quando qtd = 0. */
  porCab: Decimal | null;
}

export interface CompraVendaResultado {
  compras: LinhaCalculada[];
  vendas: LinhaCalculada[];
  totalCompras: Decimal;
  totalVendas: Decimal;
  /** vendas − compras (RN-006). */
  saldo: Decimal;
  cabCompra: Decimal;
  cabVenda: Decimal;
  arrCompra: Decimal;
  arrVenda: Decimal;
  params: ParametrosCompraVenda;
}

const ZERO = new Decimal(0);

/** Valor numérico ou `null` se vazio/inválido/infinito (RN-022: nunca lança). */
function tentar(v: DecimalBase.Value | null | undefined): Decimal | null {
  if (v === undefined || v === null) return null;
  try {
    const d = new Decimal(v);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function dec(v: DecimalBase.Value | null | undefined): Decimal {
  return tentar(v) ?? ZERO;
}

/** Parâmetro sobrescrito: vazio ou inválido cai no padrão da planilha (RN-021). */
function parametro(v: DecimalBase.Value | null | undefined, padrao: Decimal): Decimal {
  return tentar(v) ?? padrao;
}

/** Peso do lote nos 3 modos (RN-003). */
function pesoLote(lote: LoteInput): { qtd: Decimal; kg: Decimal } {
  if (lote.modo === 'individual') {
    const pesos = (lote.pesos ?? []).map(dec).filter((p) => p.gt(0));
    return { qtd: new Decimal(pesos.length), kg: Decimal.sum(ZERO, ...pesos) };
  }
  const qtd = dec(lote.qtd);
  const peso = dec(lote.peso);
  return { qtd, kg: lote.modo === 'medio' ? qtd.times(peso) : peso };
}

function fechar(
  qtd: Decimal,
  kg: Decimal,
  kgLiquido: Decimal,
  descontoKgCab: Decimal,
  arrobas: Decimal,
  lote: LoteInput,
): LinhaCalculada {
  const preco = dec(lote.preco);
  const total = arrobas.times(preco);
  return {
    qtd,
    kg,
    kgLiquido,
    descontoKgCab,
    kgDescontado: kg.minus(kgLiquido),
    arrobas,
    preco,
    total,
    porCab: qtd.isZero() ? null : total.div(qtd),
  };
}

/** RN-001, RN-003, RN-004: @ = kg ÷ 30; total = @ × R$/@; R$/cab. = total ÷ qtd. Sem desconto. */
export function calcularCompra(
  lote: LoteInput,
  params: ParametrosCompraVenda = PARAMETROS_COMPRA_VENDA,
): LinhaCalculada {
  const { qtd, kg } = pesoLote(lote);
  return fechar(qtd, kg, kg, ZERO, kg.div(params.arrobaVivoKg), lote);
}

/**
 * RN-002, RN-024, RN-025: kg líquido = kg − qtd × desconto (kg/cab.); @ = kg líquido ÷ (30 vivo | 15
 * carcaça); total = @ × R$/@. Se qtd × desconto > kg, o kg líquido é limitado a 0 (sem @ negativa).
 */
export function calcularVenda(
  lote: LoteInput,
  params: ParametrosCompraVenda = PARAMETROS_COMPRA_VENDA,
): LinhaCalculada {
  const { qtd, kg } = pesoLote(lote);
  const descontoKgCab =
    lote.aplicarDesconto === false
      ? ZERO
      : Decimal.max(ZERO, parametro(lote.desconto, params.descontoVendaKgCab));
  const kgLiquido = Decimal.max(ZERO, kg.minus(qtd.times(descontoKgCab)));
  const kgPorArroba = lote.base === 'carcaca' ? params.arrobaCarcacaKg : params.arrobaVivoKg;
  return fechar(qtd, kg, kgLiquido, descontoKgCab, kgLiquido.div(kgPorArroba), lote);
}

function soma(linhas: LinhaCalculada[], campo: 'qtd' | 'arrobas' | 'total'): Decimal {
  return Decimal.sum(ZERO, ...linhas.map((l) => l[campo]));
}

/** RN-006: saldo = total de vendas − total de compras. */
export function calcularCompraVenda(
  entrada: CompraVendaInput,
  sobrescritas: Partial<Record<keyof ParametrosCompraVenda, DecimalBase.Value | null>> = {},
): CompraVendaResultado {
  const padrao = PARAMETROS_COMPRA_VENDA;
  const params: ParametrosCompraVenda = {
    arrobaVivoKg: parametro(sobrescritas.arrobaVivoKg, padrao.arrobaVivoKg),
    arrobaCarcacaKg: parametro(sobrescritas.arrobaCarcacaKg, padrao.arrobaCarcacaKg),
    descontoVendaKgCab: parametro(sobrescritas.descontoVendaKgCab, padrao.descontoVendaKgCab),
  };
  const compras = entrada.compras.map((l) => calcularCompra(l, params));
  const vendas = entrada.vendas.map((l) => calcularVenda(l, params));
  const totalCompras = soma(compras, 'total');
  const totalVendas = soma(vendas, 'total');
  return {
    compras,
    vendas,
    totalCompras,
    totalVendas,
    saldo: totalVendas.minus(totalCompras),
    cabCompra: soma(compras, 'qtd'),
    cabVenda: soma(vendas, 'qtd'),
    arrCompra: soma(compras, 'arrobas'),
    arrVenda: soma(vendas, 'arrobas'),
    params,
  };
}

/** RN-025: categoria feminina liga o desconto da venda por padrão (regex do protótipo). */
export function categoriaFeminina(categoria: string): boolean {
  return /(bezerra|novilha|vaca|femea|fêmea|matriz|garrota)/i.test(categoria);
}
