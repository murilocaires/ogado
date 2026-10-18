import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { forbidden } from '../http-errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SAME_SITE_VALUES = new Set(['same-origin', 'same-site']);

/**
 * CSRF sem token sincronizador (ADR-0010 e), quatro barreiras somadas: SameSite=Lax no cookie e,
 * aqui, em todo método que altera estado: (1) `Origin` presente e na lista permitida;
 * (2) `Sec-Fetch-Site`, quando presente, `same-origin` ou `same-site`; (3) `Content-Type:
 * application/json`, que força preflight de CORS entre origens. GET nunca altera estado.
 */
export const csrfPlugin = fp<{ allowedOrigins: string[] }>(
  async (app: FastifyInstance, { allowedOrigins }) => {
    const allowed = new Set(allowedOrigins);

    app.addHook('onRequest', async (request) => {
      if (!UNSAFE_METHODS.has(request.method)) return;

      const origin = request.headers.origin;
      if (typeof origin !== 'string' || !allowed.has(origin)) throw forbidden();

      const fetchSite = request.headers['sec-fetch-site'];
      if (typeof fetchSite === 'string' && !SAME_SITE_VALUES.has(fetchSite)) throw forbidden();

      const mediaType = (request.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
      if (mediaType !== 'application/json') throw forbidden();
    });
  },
);
