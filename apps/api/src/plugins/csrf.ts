import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { forbidden } from '../http-errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SAME_SITE_VALUES = new Set(['same-origin', 'same-site']);

/**
 * CSRF sem token sincronizador (ADR-0010 e), quatro barreiras somadas: SameSite=Lax no cookie e,
 * aqui, em todo método que altera estado: (1) `Origin` presente e na lista permitida;
 * (2) `Sec-Fetch-Site`, quando presente, `same-origin` ou `same-site`; (3) `Content-Type:
 * application/json`, que força preflight de CORS entre origens (DELETE sem corpo é isento, ADR-0011 §7).
 * GET nunca altera estado.
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

      // DELETE sem corpo (ADR-0011 §7): não é método "simples" do CORS (sempre faz preflight) e
      // formulário HTML não envia DELETE; então o Content-Type não acrescenta barreira. Com corpo, bloqueia.
      const mediaType = (request.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
      const json = mediaType === 'application/json';
      if (request.method === 'DELETE') {
        const comCorpo =
          Number(request.headers['content-length'] ?? 0) > 0 ||
          request.headers['transfer-encoding'] !== undefined;
        // Exceção explícita por rota (DELETE /conta, RF-007): corpo só se for JSON.
        if (comCorpo && !(request.routeOptions.config.allowJsonBody && json)) throw forbidden();
        return;
      }

      if (!json) throw forbidden();
    });
  },
);
