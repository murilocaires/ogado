// Modelo neutro de tabela para exportação (RF-041). Os valores já vêm do domínio; aqui só se
// escolhe a escrita final (casas decimais, data). Nenhuma fórmula nova (constituição).
import { Decimal } from '@ogado/domain';

/** `texto`, `numero` (com `casas`) ou `data` (célula `AAAA-MM-DD`). */
export type TipoColuna = 'texto' | 'numero' | 'data';

export interface Coluna {
  titulo: string;
  tipo: TipoColuna;
  /** Casas decimais da escrita final (só `numero`). */
  casas?: number;
}

/** `null` = célula vazia (valor indefinido, RN-022). Números já arredondados nas `casas`. */
export type Celula = string | number | null;

export interface Tabela {
  /** Nome da aba (XLSX). */
  nome: string;
  colunas: readonly Coluna[];
  linhas: readonly (readonly Celula[])[];
}

/** Arredonda só na escrita final (meio para cima, como a exibição) e devolve número do Excel. */
export function numeroFinal(valor: Decimal | null | undefined, casas: number): number | null {
  if (valor === null || valor === undefined || !valor.isFinite()) return null;
  const n = Number(valor.toFixed(casas, Decimal.ROUND_HALF_UP));
  return Object.is(n, -0) ? 0 : n;
}

/** `AAAA-MM-DD` válida -> ela mesma; senão `null` (célula vazia). */
export function dataFinal(iso: string | null | undefined): string | null {
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** Data de hoje no fuso local, para o nome do arquivo (`AAAA-MM-DD`). */
export function dataParaArquivo(agora: Date = new Date()): string {
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mm}-${dd}`;
}

export function totalDeLinhas(tabelas: readonly Tabela[]): number {
  return tabelas.reduce((soma, t) => soma + t.linhas.length, 0);
}
