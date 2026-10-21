import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';

export const PROXY_SECRET_HEADER = 'x-bovaro-proxy-secret';
export const CLIENT_IP_HEADER = 'x-bovaro-client-ip';
const LEGACY_PROXY_SECRET_HEADER = 'x-ogado-proxy-secret';
const LEGACY_CLIENT_IP_HEADER = 'x-ogado-client-ip';

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function sameSecret(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * IP do cliente para limites de taxa. Atrás da Vercel e do Railway o `request.ip` é o egress da
 * Vercel (igual para todos). O site repassa o IP real em `x-bovaro-client-ip` junto com um segredo
 * compartilhado; sem segredo configurado, ou se não conferir, vale `request.ip`.
 */
export function clientIp(request: FastifyRequest, proxySecret: string | undefined): string {
  if (!proxySecret) return request.ip;
  const currentSecret = header(request, PROXY_SECRET_HEADER);
  const currentIp = header(request, CLIENT_IP_HEADER)?.trim();
  const legacySecret = header(request, LEGACY_PROXY_SECRET_HEADER);
  const legacyIp = header(request, LEGACY_CLIENT_IP_HEADER)?.trim();
  const received = currentSecret ?? legacySecret;
  const ip = currentSecret ? currentIp : legacyIp;
  if (received && ip && isIP(ip) !== 0 && sameSecret(received, proxySecret)) return ip;
  return request.ip;
}
