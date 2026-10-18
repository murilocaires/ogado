import type { FastifyInstance, HTTPMethods } from 'fastify';

export interface RouteCatalogEntry {
  method: HTTPMethods;
  url: string;
  /** `config.auth === 'public'`. Toda outra rota exige sessão (falha fechada). */
  public: boolean;
}

/**
 * Registra cada rota de aplicação criada (sem HEAD automático nem OPTIONS/CORS). O teste-guardião
 * (CA-12) enumera o catálogo e falha se uma rota autenticada não tiver caso de isolamento.
 */
export function registerRouteCatalog(app: FastifyInstance): void {
  const catalog: RouteCatalogEntry[] = [];
  app.decorate('routeCatalog', catalog);
  app.addHook('onRoute', (route) => {
    for (const method of [route.method].flat()) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      catalog.push({ method, url: route.url, public: route.config?.auth === 'public' });
    }
  });
}
