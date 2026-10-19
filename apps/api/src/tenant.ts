/** Contexto de tenant resolvido da sessão (ADR-0010 d). Todo repositório o exige como parâmetro. */
export interface TenantContext {
  usuarioId: string;
  fazendaId: string;
}

/** Contexto de tenant da requisição autenticada; ausente = erro de programação (rota sem sessão). */
export function requireTenant(request: { tenant: TenantContext | null }): TenantContext {
  if (!request.tenant) throw new Error('contexto de tenant ausente');
  return request.tenant;
}
