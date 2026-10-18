// Ponte entre os lotes salvos e o domínio (@ogado/domain). Nenhuma fórmula aqui (constituição).
import {
  calcularCompraVenda,
  Decimal,
  type CompraVendaResultado,
  type LinhaCalculada,
  type LoteInput,
} from '@ogado/domain';
import { lerCampo, valorCampo } from './format';
import type { LoteEntity, LoteTipo } from './repo/types';

export interface ItemNegocio {
  tipo: LoteTipo;
  lote: LoteEntity;
  linha: LinhaCalculada;
}

/** Percentual digitado (`10`) -> fração do domínio (`0,10`). */
export function fracaoDePercentual(texto: string): Decimal | null {
  const v = valorCampo(texto);
  return v ? v.div(100) : null;
}

/** Lote salvo -> entrada do domínio. Valores inválidos viram `null` (indefinido). */
export function loteParaDominio(lote: LoteEntity): LoteInput {
  const base: LoteInput = {
    modo: lote.modo,
    qtd: valorCampo(lote.qtd),
    peso: valorCampo(lote.peso),
    pesos: lote.pesos.map(valorCampo),
    preco: valorCampo(lote.preco),
  };
  if (lote.tipo === 'compra') return base;
  return {
    ...base,
    base: lote.base ?? 'vivo',
    aplicarDesconto: lote.aplicarDesconto ?? false,
    desconto: lote.aplicarDesconto ? fracaoDePercentual(lote.descontoPct ?? '') : null,
  };
}

export interface ResumoNegocios {
  resultado: CompraVendaResultado;
  itens: ItemNegocio[];
}

/** Calcula tudo de uma vez pelo domínio (RN-006: saldo = vendas − compras). */
export function resumirNegocios(lotes: readonly LoteEntity[]): ResumoNegocios {
  const compras = lotes.filter((l) => l.tipo === 'compra');
  const vendas = lotes.filter((l) => l.tipo === 'venda');
  const resultado = calcularCompraVenda({
    compras: compras.map(loteParaDominio),
    vendas: vendas.map(loteParaDominio),
  });
  const itens: ItemNegocio[] = [
    ...compras.map((lote, i) => ({ tipo: 'compra' as const, lote, linha: resultado.compras[i]! })),
    ...vendas.map((lote, i) => ({ tipo: 'venda' as const, lote, linha: resultado.vendas[i]! })),
  ];
  return { resultado, itens };
}

/** Data decrescente; lotes sem data por último (RF-024). Estável. */
export function ordenarPorData(itens: readonly ItemNegocio[]): ItemNegocio[] {
  return [...itens].sort((a, b) => {
    const da = a.lote.data;
    const db = b.lote.data;
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? 1 : -1;
  });
}

export function proximoNumero(lotes: readonly LoteEntity[], tipo: LoteTipo): number {
  const numeros = lotes.filter((l) => l.tipo === tipo).map((l) => l.numero);
  return numeros.length ? Math.max(...numeros) + 1 : 1;
}

/** Peso a peso aceita uma linha por peso, `;` ou `, ` (vírgula seguida de espaço). */
export function separarPesos(texto: string): string[] {
  return texto
    .split(/[\n;]+|,\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pesosValidos(pesos: readonly string[]): Decimal[] {
  return pesos.flatMap((p) => {
    const l = lerCampo(p);
    return l.tipo === 'ok' && l.valor.gt(0) ? [l.valor] : [];
  });
}
