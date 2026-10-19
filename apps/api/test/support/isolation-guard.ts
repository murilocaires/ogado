import { expect } from 'vitest';
import type { RouteCatalogEntry } from '../../src/plugins/route-catalog';

/** Única superfície pública permitida (CA-12). Rota pública nova exige revisão de segurança + ADR. */
export const PUBLIC_ROUTE_ALLOWLIST: readonly string[] = [
  'GET /health',
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /auth/senha/esqueci',
  'POST /auth/senha/redefinir',
];

export function assertPublicAllowlist(catalog: readonly RouteCatalogEntry[]): void {
  const publicas = catalog.filter((r) => r.public).map((r) => `${r.method} ${r.url}`);
  const inesperadas = publicas.filter((rota) => !PUBLIC_ROUTE_ALLOWLIST.includes(rota));
  expect(inesperadas, 'rotas públicas fora da allowlist (CA-12)').toEqual([]);
}

/**
 * Executa um caso de isolamento e exige prova de "A tentando B": o caso devolve quantas tentativas
 * de A contra B fez (>= 1) e precisa ter feito ao menos uma asserção. Um caso vazio falha.
 */
export async function runIsolationCase<T>(
  rota: string,
  caso: (a: T, b: T) => Promise<number>,
  a: T,
  b: T,
): Promise<void> {
  const antes = expect.getState().assertionCalls;
  const tentativas = await caso(a, b);
  const depois = expect.getState().assertionCalls;
  expect(tentativas, `${rota}: o caso não provou nenhuma tentativa de A contra B`).toBeGreaterThan(
    0,
  );
  expect(depois - antes, `${rota}: o caso não fez nenhuma asserção`).toBeGreaterThan(0);
}
