import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { AppConfig } from '../config';
import { sessionExpired, unauthenticated } from '../http-errors';
import { clearSessionCookie, sessionCookieName, setSessionCookie } from '../session/cookie';
import type { SessionService } from '../session/session-service';

export interface AuthDeps {
  config: Pick<AppConfig, 'production'>;
  sessions: SessionService;
}

/**
 * Hook de autenticação (ADR-0010 d.1): resolve o contexto de tenant a partir do cookie de sessão.
 * Toda rota exige sessão, salvo as marcadas `config: { auth: 'public' }`. Sem contexto = 401.
 */
export const authPlugin = fp<AuthDeps>(async (app: FastifyInstance, deps) => {
  app.decorateRequest('tenant', null);
  app.decorateRequest('sessionUser', null);

  app.addHook('onRequest', async (request, reply) => {
    const expectedUsuarioId = request.headers['x-ogado-usuario'];
    const bound = expectedUsuarioId !== undefined;
    const boundLogout = request.routeOptions.url === '/auth/logout' && bound;
    if (request.is404 || (request.routeOptions.config.auth === 'public' && !boundLogout)) return;

    if (expectedUsuarioId !== undefined && typeof expectedUsuarioId !== 'string') {
      throw unauthenticated();
    }

    const token = request.cookies[sessionCookieName(deps.config)];
    if (!token) throw unauthenticated();

    const result = await deps.sessions.validate(token, expectedUsuarioId);
    if (result.status === 'invalida') {
      if (!bound) clearSessionCookie(reply, deps.config);
      throw unauthenticated();
    }
    if (result.status === 'expirada') {
      if (!bound) clearSessionCookie(reply, deps.config);
      throw sessionExpired();
    }

    request.tenant = result.tenant;
    request.sessionUser = result.usuario;
    if (result.renewedMaxAgeSeconds !== null && !boundLogout) {
      setSessionCookie(reply, deps.config, token, result.renewedMaxAgeSeconds);
    }
  });
});
