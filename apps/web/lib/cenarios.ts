// Cenários da recria (RF-032…RF-036, RN-023): snapshot, busca/ordenação e linhas da comparação.
// Nenhuma fórmula aqui: o resultado vem de @ogado/domain e é guardado como string decimal sem
// arredondar (ADR-0003). Ordenar e comparar usam Decimal sobre o snapshot, nunca recalculam.
import { Decimal } from '@ogado/domain';
import { brl, num, valorCampo } from './format';
import type { InfoKey } from './info';
import { calcularRecriaEntidade } from './recria';
import {
  CENARIO_RESULTADO_CAMPOS,
  type CenarioEntity,
  type CenarioResultado,
  type CenarioResultadoCampo,
  type CenarioSalvar,
  type RecriaEntity,
} from './repo/types';

export const COMPARAR_MAX = 3;

export type OrdemCenarios = 'recentes' | 'liquido' | 'nome';

function texto(valor: Decimal | null): string | null {
  return valor ? valor.toFixed() : null;
}

/** String decimal do snapshot -> Decimal (`null` se indefinido ou ilegível). */
export function decimalDe(valor: string | null): Decimal | null {
  if (valor === null) return null;
  try {
    const d = new Decimal(valor);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/**
 * Congela a simulação atual (entradas + variantes + parâmetros + resultado do domínio).
 * `null` quando o líquido é indefinido (campos vazios/ inválidos): não há o que comparar.
 */
export function snapshotDaRecria(recria: RecriaEntity, nome: string): CenarioSalvar | null {
  const { resultado: r } = calcularRecriaEntidade(recria);
  if (!r.faturamentoLiquido) return null;
  const campos = Object.fromEntries(
    CENARIO_RESULTADO_CAMPOS.map((campo) => [campo, texto(r[campo])]),
  ) as Record<CenarioResultadoCampo, string | null>;
  const resultado: CenarioResultado = {
    ...campos,
    custos: r.custos.map((c) => ({ id: c.id, nome: c.nome, valor: texto(c.valor) })),
  };
  return {
    nome,
    form: { ...recria.form },
    variantes: { ...r.variantes },
    parametros: {
      arrobaVivoKg: r.parametros.arrobaVivoKg.toFixed(),
      arrobaCarcacaKg: r.parametros.arrobaCarcacaKg.toFixed(),
      uaKg: r.parametros.uaKg.toFixed(),
      lotacaoFixaHa: r.parametros.lotacaoFixaHa.toFixed(),
    },
    resultado,
  };
}

export function liquidoDe(c: CenarioEntity): Decimal | null {
  return decimalDe(c.resultado.faturamentoLiquido);
}

/** Maior faturamento líquido entre todos os cenários salvos (não só os filtrados). */
export function melhorLiquido(cenarios: readonly CenarioEntity[]): Decimal | null {
  let melhor: Decimal | null = null;
  for (const c of cenarios) {
    const l = liquidoDe(c);
    if (l && (!melhor || l.gt(melhor))) melhor = l;
  }
  return melhor;
}

/** ★ só com 2+ cenários salvos (RF-036). */
export function ehMelhor(c: CenarioEntity, todos: readonly CenarioEntity[]): boolean {
  if (todos.length < 2) return false;
  const l = liquidoDe(c);
  const melhor = melhorLiquido(todos);
  return !!l && !!melhor && l.eq(melhor);
}

/** Último cenário salvo (mais recente; no mesmo instante, o salvo depois). */
export function ultimoCenario(cenarios: readonly CenarioEntity[]): CenarioEntity | null {
  return filtrarOrdenar(cenarios, '', 'recentes')[0] ?? null;
}

/** Busca por nome (sem distinguir caixa) e ordenação (RF-034). */
export function filtrarOrdenar(
  cenarios: readonly CenarioEntity[],
  busca: string,
  ordem: OrdemCenarios,
): CenarioEntity[] {
  const q = busca.trim().toLowerCase();
  const indexados = cenarios
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => q === '' || c.nome.toLowerCase().includes(q));
  indexados.sort((a, b) => {
    if (ordem === 'nome') return a.c.nome.localeCompare(b.c.nome, 'pt-BR');
    if (ordem === 'liquido') {
      const la = liquidoDe(a.c);
      const lb = liquidoDe(b.c);
      if (la && lb) return lb.cmp(la) || b.i - a.i;
      return la ? -1 : lb ? 1 : 0;
    }
    // Mais recentes primeiro; no mesmo instante, o salvo depois vem antes.
    return b.c.criadoEm.localeCompare(a.c.criadoEm) || b.i - a.i;
  });
  return indexados.map(({ c }) => c);
}

/** Percentual de um custo no total do snapshot, só para a largura da barra (0 a 100). */
export function percentualCusto(c: CenarioEntity, valor: string | null): string {
  const total = decimalDe(c.resultado.custoTotal);
  const v = decimalDe(valor);
  if (!total || !v || total.isZero() || v.isNegative()) return '0';
  return v.div(total).times(100).toFixed(2);
}

// ---------------------------------------------------------------------------------------------
// Comparação (RF-033)
// ---------------------------------------------------------------------------------------------

export interface LinhaComparacao {
  id: string;
  rotulo: string;
  info?: InfoKey;
  /** Valor do cenário (snapshot) ou `null` quando não há (mostra "—"). */
  valor: (c: CenarioEntity) => Decimal | null;
  formatar: (v: Decimal | null) => string;
  /** 1 = maior é melhor, −1 = menor é melhor, 0 = neutra (sem verde/vermelho). */
  direcao: 1 | -1 | 0;
  /** Destaca o melhor (★) — só o faturamento líquido. */
  estrela?: boolean;
}

const moeda = (v: Decimal | null): string => brl(v);
const moeda0 = (v: Decimal | null): string => brl(v, 0);

export const LINHAS_COMPARACAO: readonly LinhaComparacao[] = [
  {
    id: 'liq',
    rotulo: 'Faturamento líquido',
    info: 'recLiq',
    valor: (c) => decimalDe(c.resultado.faturamentoLiquido),
    formatar: moeda,
    direcao: 1,
    estrela: true,
  },
  {
    id: 'mes',
    rotulo: 'Líquido por mês',
    info: 'mes',
    valor: (c) => decimalDe(c.resultado.liquidoMes),
    formatar: moeda0,
    direcao: 1,
  },
  {
    id: 'ha',
    rotulo: 'Líquido por hectare',
    info: 'ha',
    valor: (c) => decimalDe(c.resultado.liquidoHa),
    formatar: moeda0,
    direcao: 1,
  },
  {
    id: 'caixa',
    rotulo: 'Total em caixa',
    info: 'caixa',
    valor: (c) => decimalDe(c.resultado.totalEmCaixa),
    formatar: moeda,
    direcao: 1,
  },
  {
    id: 'bruto',
    rotulo: 'Faturamento bruto',
    info: 'bruto',
    valor: (c) => decimalDe(c.resultado.faturamentoBruto),
    formatar: moeda,
    direcao: 1,
  },
  {
    id: 'custo',
    rotulo: 'Custo operacional',
    info: 'custo',
    valor: (c) => decimalDe(c.resultado.custoTotal),
    formatar: moeda,
    direcao: -1,
  },
  {
    id: 'invest',
    rotulo: 'Investimento',
    info: 'invest',
    valor: (c) => valorCampo(c.form.investimento),
    formatar: moeda,
    direcao: 0,
  },
  {
    id: 'cab',
    rotulo: 'Cabeças',
    info: 'cabecas',
    valor: (c) => decimalDe(c.resultado.cabecas),
    formatar: (v) => num(v, 2),
    direcao: 0,
  },
  {
    id: 'dias',
    rotulo: 'Dias de recria',
    valor: (c) => valorCampo(c.form.dias),
    formatar: (v) => num(v, 0),
    direcao: 0,
  },
  {
    id: 'preco',
    rotulo: 'Preço de venda (R$/@)',
    valor: (c) => valorCampo(c.form.precoVenda),
    formatar: moeda,
    direcao: 0,
  },
  {
    id: 'lotfin',
    rotulo: 'Lotação final (UA/ha)',
    info: 'lotFin',
    valor: (c) => decimalDe(c.resultado.lotacaoFinal),
    formatar: (v) => num(v, 2),
    direcao: 0,
  },
];

/** "188 → 420 kg" a partir das entradas do snapshot. */
export function pesoInicialFinal(c: CenarioEntity): string {
  return `${num(valorCampo(c.form.pesoIni), 0)} → ${num(valorCampo(c.form.pesoFin), 0)} kg`;
}

export interface Diferenca {
  texto: string;
  /** `melhor` = verde, `pior` = vermelho, `neutra` = sem juízo de valor. */
  tom: 'melhor' | 'pior' | 'neutra';
}

/** Diferença de um cenário em relação ao primeiro marcado (`base`); `null` se igual/indefinida. */
export function diferenca(
  linha: LinhaComparacao,
  valor: Decimal | null,
  base: Decimal | null,
): Diferenca | null {
  if (!valor || !base) return null;
  const d = valor.minus(base);
  if (d.isZero()) return null;
  const tom = linha.direcao === 0 ? 'neutra' : d.times(linha.direcao).gt(0) ? 'melhor' : 'pior';
  const sinal = d.gt(0) ? '+' : '−';
  return { texto: `${sinal}${linha.formatar(d.abs())}`, tom };
}
