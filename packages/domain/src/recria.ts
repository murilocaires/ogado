// Recria: cálculo completo com paridade da planilha `calculos-recria.xlsx` (RN-007..RN-023).
// Domínio puro: sem I/O, sem estado global. Variantes (ADR-0008) e parâmetros entram como argumentos.
// Decimal precisão 28 (ADR-0003); nada é arredondado aqui. Valor "indefinido" (RN-022) = null.
import { Decimal as DecimalBase } from 'decimal.js';

// Classe local com precisão 28 (ADR-0003): independente de config global e carregável direto pelo Node (parity.mjs).
const Decimal = DecimalBase.clone({ precision: 28 });
type Decimal = DecimalBase;

/** Entrada numérica aceita: Decimal, string decimal (ponto) ou number. Vazio/inválido = indefinido. */
export type Numerico = DecimalBase.Value | null | undefined;
/** Resultado possivelmente indefinido (campo vazio ou divisão por zero, RN-022). */
export type Valor = Decimal | null;

export type VarianteLotacaoInicial = 'fixa80' | 'areaPastavel';
export type VarianteFaturamentoBruto = 'pesoVivo' | 'carcaca';

/** Variantes de fórmula (ADR-0008/RN-023). O padrão é sempre o da planilha. */
export interface VariantesRecria {
  readonly lotacaoInicial: VarianteLotacaoInicial;
  readonly faturamentoBruto: VarianteFaturamentoBruto;
  /** Arredonda o total de cabeças para cima (não existe fração de cabeça). Omitido = valor exato da planilha. */
  readonly cabecasInteiras?: boolean;
}

export const VARIANTES_PADRAO: VariantesRecria = {
  lotacaoInicial: 'fixa80',
  faturamentoBruto: 'pesoVivo',
  cabecasInteiras: false,
};

/** Constantes "embutidas" nas fórmulas da planilha, editáveis por fazenda (RN-021). */
export interface ParametrosRecria<T = Numerico> {
  /** kg de peso vivo por @ (planilha: 30). */
  arrobaVivoKg: T;
  /** kg de carcaça por @ (planilha: 15). */
  arrobaCarcacaKg: T;
  /** kg por unidade animal, UA (planilha: 450). */
  uaKg: T;
  /** ha fixos do divisor da lotação inicial, variante fixa80 (planilha B24: 80). */
  lotacaoFixaHa: T;
}

export const PARAMETROS_PADRAO: Readonly<ParametrosRecria<string>> = {
  arrobaVivoKg: '30',
  arrobaCarcacaKg: '15',
  uaKg: '450',
  lotacaoFixaHa: '80',
};

/** Dias por mês usados em sanidade (M20) e líquido/mês (F33); fixo na planilha. */
const DIAS_POR_MES = new Decimal(30);

/**
 * Entradas da planilha. Valores duplicados da planilha (F19-F21, B37) são um só campo (RN-020).
 * Percentuais em fração (0,52 = 52%).
 */
export interface EntradaRecria {
  area?: Numerico; // B17, ha
  dias?: Numerico; // B18
  investimento?: Numerico; // B19
  rsCabCompra?: Numerico; // B20
  pesoIni?: Numerico; // B22, kg
  pesoFin?: Numerico; // B25, kg
  precoVenda?: Numerico; // B28, R$/@
  consumoPct?: Numerico; // E23, fração do peso vivo
  precoSuplKg?: Numerico; // F23, R$/kg
  rendCarcaca?: Numerico; // J19, fração
  imposto?: Numerico; // J22, fração
  sanidadeCabMes?: Numerico; // M19, R$/cab/mês
  funcionario?: Numerico; // N23 = B37
  frete?: Numerico; // B36
}

/** Valores padrão da planilha para as entradas (RN-021). */
export const ENTRADA_PADRAO: Readonly<Record<keyof EntradaRecria, string>> = {
  area: '102',
  dias: '270',
  investimento: '122534.8',
  rsCabCompra: '2050',
  pesoIni: '188',
  pesoFin: '420',
  precoVenda: '325',
  consumoPct: '0.003',
  precoSuplKg: '2',
  rendCarcaca: '0.52',
  imposto: '0.015',
  sanidadeCabMes: '2.5',
  funcionario: '9000',
  frete: '3000',
};

export interface CustoRecria {
  id: 'supl' | 'san' | 'imp' | 'frete' | 'func';
  nome: string;
  valor: Valor;
}

export interface ResultadoRecria {
  cabecas: Valor; // B21
  lotacaoTotalUA: Valor; // B23
  lotacaoHaInicial: Valor; // B24
  pesoMedio: Valor; // B26
  lotacaoFinal: Valor; // B27
  arrobasProduzidas: Valor; // B29
  consumoKgDia: Valor; // F24
  suplCabDia: Valor; // F25
  suplDia: Valor; // F26
  suplTotal: Valor; // F27
  arrobasCarcacaCab: Valor; // J20
  vendaCab: Valor; // J21
  impostoCab: Valor; // J23
  impostoTotal: Valor; // J24
  sanidadeTotal: Valor; // M20
  custos: CustoRecria[]; // B33..B37
  custoTotal: Valor; // B38
  faturamentoBruto: Valor; // E33
  faturamentoLiquido: Valor; // E35
  totalEmCaixa: Valor; // E38
  liquidoMes: Valor; // F33
  liquidoHa: Valor; // F35
  gmdImplicito: Valor; // RN-019
  /** Variante usada (snapshot para a simulação salva, ADR-0008). */
  variantes: VariantesRecria;
  /** Parâmetros efetivamente usados (RN-021). */
  parametros: ParametrosRecria<Decimal>;
}

/** Converte para Decimal; vazio, NaN/Infinity ou texto inválido = indefinido. Nunca lança. */
function paraDecimal(v: Numerico): Valor {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  try {
    const d = new Decimal(typeof v === 'string' ? v.trim() : v);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function somar(a: Valor, b: Valor): Valor {
  return a && b ? a.plus(b) : null;
}
function subtrair(a: Valor, b: Valor): Valor {
  return a && b ? a.minus(b) : null;
}
function multiplicar(a: Valor, b: Valor): Valor {
  return a && b ? a.times(b) : null;
}
/** Divisão: indefinido se faltar operando ou se o divisor for zero (RN-022). */
function dividir(a: Valor, b: Valor): Valor {
  return a && b && !b.isZero() ? a.div(b) : null;
}

function parametroEfetivo(informado: Numerico, padrao: string): Decimal {
  return paraDecimal(informado) ?? new Decimal(padrao);
}

/**
 * Calcula a recria. `variantes` e `parametros` são explícitos (sem estado global); omitidos = padrão
 * da planilha. Parâmetro vazio/inválido cai no padrão; parâmetro zero em divisor gera indefinido.
 */
export function calcularRecria(
  entrada: EntradaRecria,
  variantes: VariantesRecria = VARIANTES_PADRAO,
  parametros: Partial<ParametrosRecria> = {},
): ResultadoRecria {
  const p: ParametrosRecria<Decimal> = {
    arrobaVivoKg: parametroEfetivo(parametros.arrobaVivoKg, PARAMETROS_PADRAO.arrobaVivoKg),
    arrobaCarcacaKg: parametroEfetivo(
      parametros.arrobaCarcacaKg,
      PARAMETROS_PADRAO.arrobaCarcacaKg,
    ),
    uaKg: parametroEfetivo(parametros.uaKg, PARAMETROS_PADRAO.uaKg),
    lotacaoFixaHa: parametroEfetivo(parametros.lotacaoFixaHa, PARAMETROS_PADRAO.lotacaoFixaHa),
  };
  const i = {
    area: paraDecimal(entrada.area),
    dias: paraDecimal(entrada.dias),
    investimento: paraDecimal(entrada.investimento),
    rsCabCompra: paraDecimal(entrada.rsCabCompra),
    pesoIni: paraDecimal(entrada.pesoIni),
    pesoFin: paraDecimal(entrada.pesoFin),
    precoVenda: paraDecimal(entrada.precoVenda),
    consumoPct: paraDecimal(entrada.consumoPct),
    precoSuplKg: paraDecimal(entrada.precoSuplKg),
    rendCarcaca: paraDecimal(entrada.rendCarcaca),
    imposto: paraDecimal(entrada.imposto),
    sanidadeCabMes: paraDecimal(entrada.sanidadeCabMes),
    funcionario: paraDecimal(entrada.funcionario),
    frete: paraDecimal(entrada.frete),
  };

  const cabecasExatas = dividir(i.investimento, i.rsCabCompra);
  // B21: a planilha usa o valor exato; com `cabecasInteiras` (decisão do produto) arredonda para cima.
  const cabecas = variantes.cabecasInteiras && cabecasExatas ? cabecasExatas.ceil() : cabecasExatas;
  const lotacaoTotalUA = dividir(multiplicar(cabecas, i.pesoIni), p.uaKg); // B23
  const divisorLotacaoInicial =
    variantes.lotacaoInicial === 'areaPastavel' ? i.area : p.lotacaoFixaHa;
  const lotacaoHaInicial = dividir(lotacaoTotalUA, divisorLotacaoInicial); // B24
  const pesoMedio = dividir(somar(i.pesoIni, i.pesoFin), new Decimal(2)); // B26
  const lotacaoFinal = dividir(dividir(multiplicar(cabecas, pesoMedio), p.uaKg), i.area); // B27
  const arrobasProduzidas = multiplicar(dividir(i.pesoFin, p.arrobaVivoKg), cabecas); // B29

  const consumoKgDia = multiplicar(pesoMedio, i.consumoPct); // F24
  const suplCabDia = multiplicar(consumoKgDia, i.precoSuplKg); // F25
  const suplDia = multiplicar(suplCabDia, cabecas); // F26
  const suplTotal = multiplicar(suplDia, i.dias); // F27

  const arrobasCarcacaCab = dividir(multiplicar(i.pesoFin, i.rendCarcaca), p.arrobaCarcacaKg); // J20
  const vendaCab = multiplicar(arrobasCarcacaCab, i.precoVenda); // J21
  const impostoCab = multiplicar(vendaCab, i.imposto); // J23
  const impostoTotal = multiplicar(impostoCab, cabecas); // J24

  const sanidadeTotal = multiplicar(
    multiplicar(dividir(i.dias, DIAS_POR_MES), cabecas),
    i.sanidadeCabMes,
  ); // M20

  const custos: CustoRecria[] = [
    { id: 'supl', nome: 'Suplemento', valor: suplTotal },
    { id: 'san', nome: 'Sanidade', valor: sanidadeTotal },
    { id: 'imp', nome: 'Imposto', valor: impostoTotal },
    { id: 'frete', nome: 'Transporte (frete)', valor: i.frete },
    { id: 'func', nome: 'Funcionário', valor: i.funcionario },
  ];
  const custoTotal = custos.reduce<Valor>((acc, c) => somar(acc, c.valor), new Decimal(0)); // B38

  // E33 (padrão pesoVivo: B29 x R$/@) | carcaca: @ de carcaça/cab (RN-013) x cab x R$/@
  const faturamentoBruto =
    variantes.faturamentoBruto === 'carcaca'
      ? multiplicar(multiplicar(arrobasCarcacaCab, cabecas), i.precoVenda)
      : multiplicar(arrobasProduzidas, i.precoVenda);
  const faturamentoLiquido = subtrair(subtrair(faturamentoBruto, custoTotal), i.investimento); // E35
  const totalEmCaixa = somar(i.investimento, faturamentoLiquido); // E38
  const liquidoMes = dividir(faturamentoLiquido, dividir(i.dias, DIAS_POR_MES)); // F33
  const liquidoHa = dividir(faturamentoLiquido, i.area); // F35
  const gmdImplicito = dividir(subtrair(i.pesoFin, i.pesoIni), i.dias); // RN-019

  return {
    cabecas,
    lotacaoTotalUA,
    lotacaoHaInicial,
    pesoMedio,
    lotacaoFinal,
    arrobasProduzidas,
    consumoKgDia,
    suplCabDia,
    suplDia,
    suplTotal,
    arrobasCarcacaCab,
    vendaCab,
    impostoCab,
    impostoTotal,
    sanidadeTotal,
    custos,
    custoTotal,
    faturamentoBruto,
    faturamentoLiquido,
    totalEmCaixa,
    liquidoMes,
    liquidoHa,
    gmdImplicito,
    variantes: {
      lotacaoInicial: variantes.lotacaoInicial,
      faturamentoBruto: variantes.faturamentoBruto,
      cabecasInteiras: variantes.cabecasInteiras ?? false,
    },
    parametros: p,
  };
}
