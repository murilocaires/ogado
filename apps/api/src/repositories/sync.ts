/** Resultado de uma escrita com versão otimista (ADR-0011 §4). */
export type WriteResult<T> =
  { status: 'ok'; record: T } | { status: 'conflito'; atual: T } | { status: 'nao_encontrado' };

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
