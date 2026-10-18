// Alertas não bloqueantes do resultado da recria (RN-026). Puro: a UI monta a mensagem.
import type { Decimal } from 'decimal.js';
import type { ResultadoRecria } from './recria';

export const LIMITES_ALERTA_RECRIA = {
  fracaoCabecas: 0.0001,
  lotacaoInicial: 4,
  lotacaoFinal: 6,
  cabecas: 250,
} as const;

export type AlertaRecria =
  | { codigo: 'cabecas_fracionadas'; cabecas: Decimal; cabecasArredondadas: Decimal }
  | { codigo: 'lotacao_entrada_alta'; lotacao: Decimal; limite: number }
  | { codigo: 'lotacao_saida_alta'; lotacao: Decimal; limite: number }
  | { codigo: 'muitas_cabecas'; cabecas: Decimal; limite: number };

/** RN-026: valores indefinidos (null) não geram alerta. Ordem estável. */
export function alertasRecria(
  resultado: Pick<ResultadoRecria, 'cabecas' | 'lotacaoHaInicial' | 'lotacaoFinal'>,
): AlertaRecria[] {
  const alertas: AlertaRecria[] = [];
  const { cabecas, lotacaoHaInicial, lotacaoFinal } = resultado;
  if (cabecas) {
    const arredondadas = cabecas.toDecimalPlaces(0, 4);
    if (cabecas.minus(arredondadas).abs().gt(LIMITES_ALERTA_RECRIA.fracaoCabecas)) {
      alertas.push({ codigo: 'cabecas_fracionadas', cabecas, cabecasArredondadas: arredondadas });
    }
  }
  if (lotacaoHaInicial && lotacaoHaInicial.gt(LIMITES_ALERTA_RECRIA.lotacaoInicial)) {
    alertas.push({
      codigo: 'lotacao_entrada_alta',
      lotacao: lotacaoHaInicial,
      limite: LIMITES_ALERTA_RECRIA.lotacaoInicial,
    });
  }
  if (lotacaoFinal && lotacaoFinal.gt(LIMITES_ALERTA_RECRIA.lotacaoFinal)) {
    alertas.push({
      codigo: 'lotacao_saida_alta',
      lotacao: lotacaoFinal,
      limite: LIMITES_ALERTA_RECRIA.lotacaoFinal,
    });
  }
  if (cabecas && cabecas.gt(LIMITES_ALERTA_RECRIA.cabecas)) {
    alertas.push({ codigo: 'muitas_cabecas', cabecas, limite: LIMITES_ALERTA_RECRIA.cabecas });
  }
  return alertas;
}
