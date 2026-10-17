// Compra e Venda (RN-001…RN-006). Domínio puro: Decimal (precisão 28), sem arredondar no cálculo.
// Espelha references/calculo/calc.js (compraVenda) e as células de compra-e-venda-de-gado.xlsx.
// Sem imports locais: o parity.mjs carrega este arquivo direto (Node strip-types).
import Decimal from 'decimal.js';

Decimal.set({ precision: 28 });

export type ModoPeso = 'total' | 'medio' | 'individual';

export interface LoteInput {
  modo: ModoPeso;
  /** Cabeças (modos total/médio). No modo individual vale o nº de pesos informados. */
  qtd?: Decimal.Value | null;
  /** kg do lote (modo total) ou kg por cabeça (modo médio). */
  peso?: Decimal.Value | null;
  /** kg de cada animal (modo individual). */
  pesos?: (Decimal.Value | null)[];
  /** R$ por @. */
  preco?: Decimal.Value | null;
}

export interface CompraVendaInput {
  compras: LoteInput[];
  vendas: LoteInput[];
}

export interface ParametrosCompraVenda {
  /** kg por @ na compra (RN-001). */
  arrobaCompraKg: Decimal;
  /** kg por @ na venda (RN-002). */
  arrobaVendaKg: Decimal;
  /** kg descontados por cabeça antes da conversão em @ na venda (RN-002). */
  descontoVendaKgCab: Decimal;
}

export const PARAMETROS_COMPRA_VENDA: ParametrosCompraVenda = {
  arrobaCompraKg: new Decimal(30),
  arrobaVendaKg: new Decimal(15),
  descontoVendaKgCab: new Decimal(10),
};

export interface LinhaCalculada {
  qtd: Decimal;
  kg: Decimal;
  arrobas: Decimal;
  preco: Decimal;
  total: Decimal;
  porCab: Decimal;
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
function tentar(v: Decimal.Value | null | undefined): Decimal | null {
  if (v === undefined || v === null) return null;
  try {
    const d = new Decimal(v);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function dec(v: Decimal.Value | null | undefined): Decimal {
  return tentar(v) ?? ZERO;
}

/** Parâmetro sobrescrito: vazio ou inválido cai no padrão da planilha (RN-021). */
function parametro(v: Decimal.Value | null | undefined, padrao: Decimal): Decimal {
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

function fechar(qtd: Decimal, kg: Decimal, arrobas: Decimal, lote: LoteInput): LinhaCalculada {
  const preco = dec(lote.preco);
  const total = arrobas.times(preco);
  return { qtd, kg, arrobas, preco, total, porCab: qtd.isZero() ? ZERO : total.div(qtd) };
}

/** RN-001, RN-003, RN-004: @ = kg ÷ 30; total = @ × R$/@; R$/cab. = total ÷ qtd. */
export function calcularCompra(
  lote: LoteInput,
  params: ParametrosCompraVenda = PARAMETROS_COMPRA_VENDA,
): LinhaCalculada {
  const { qtd, kg } = pesoLote(lote);
  return fechar(qtd, kg, kg.div(params.arrobaCompraKg), lote);
}

/** RN-002, RN-003, RN-005: @ = (kg − qtd×10) ÷ 15; total = @ × R$/@. */
export function calcularVenda(
  lote: LoteInput,
  params: ParametrosCompraVenda = PARAMETROS_COMPRA_VENDA,
): LinhaCalculada {
  const { qtd, kg } = pesoLote(lote);
  const arrobas = kg.minus(qtd.times(params.descontoVendaKgCab)).div(params.arrobaVendaKg);
  return fechar(qtd, kg, arrobas, lote);
}

function soma(linhas: LinhaCalculada[], campo: keyof LinhaCalculada): Decimal {
  return Decimal.sum(ZERO, ...linhas.map((l) => l[campo]));
}

/** RN-006: saldo = total de vendas − total de compras. */
export function calcularCompraVenda(
  entrada: CompraVendaInput,
  sobrescritas: Partial<Record<keyof ParametrosCompraVenda, Decimal.Value | null>> = {},
): CompraVendaResultado {
  const padrao = PARAMETROS_COMPRA_VENDA;
  const params: ParametrosCompraVenda = {
    arrobaCompraKg: parametro(sobrescritas.arrobaCompraKg, padrao.arrobaCompraKg),
    arrobaVendaKg: parametro(sobrescritas.arrobaVendaKg, padrao.arrobaVendaKg),
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
