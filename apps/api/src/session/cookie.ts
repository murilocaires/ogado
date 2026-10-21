import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../config';

/** Cookie `__Host-` em produção (exige Secure, Path=/ e sem Domain); simples em dev (ADR-0010 a.2). */
export function sessionCookieName(config: Pick<AppConfig, 'production'>): string {
  return config.production ? '__Host-bovaro_session' : 'bovaro_session';
}

export function legacySessionCookieName(config: Pick<AppConfig, 'production'>): string {
  return config.production ? '__Host-ogado_session' : 'ogado_session';
}

export function readSessionToken(
  cookies: Record<string, string | undefined>,
  config: Pick<AppConfig, 'production'>,
): string | undefined {
  return cookies[sessionCookieName(config)] ?? cookies[legacySessionCookieName(config)];
}

function baseOptions(config: Pick<AppConfig, 'production'>) {
  return {
    httpOnly: true,
    secure: config.production,
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function setSessionCookie(
  reply: FastifyReply,
  config: Pick<AppConfig, 'production'>,
  token: string,
  maxAgeSeconds: number,
): void {
  void reply.setCookie(sessionCookieName(config), token, {
    ...baseOptions(config),
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(
  reply: FastifyReply,
  config: Pick<AppConfig, 'production'>,
): void {
  void reply.clearCookie(sessionCookieName(config), baseOptions(config));
  void reply.clearCookie(legacySessionCookieName(config), baseOptions(config));
}
