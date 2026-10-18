/** Contexto de tenant resolvido da sessão (ADR-0010 d). Todo repositório o exige como parâmetro. */
export interface TenantContext {
  usuarioId: string;
  fazendaId: string;
}
