import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { createPrisma, type PrismaClient } from '@ogado/db';
import { buildApp, type AppOptions } from '../../src/app';
import { TEST_EMAIL_DOMAIN, TEST_ORIGIN, testDatabaseUrl } from './env';

export const VALID_PASSWORD = 'Boi#Gordo2026';

/** Limites altos: a suíte inteira sai do mesmo IP (127.0.0.1). Testes de rate limit usam os reais. */
const relaxedRateLimit = {
  global: { max: 100000, windowMs: 60_000 },
  loginIpEmail: { max: 100000, windowMs: 60_000 },
  loginIp: { max: 100000, windowMs: 60_000 },
  signupIp: { max: 100000, windowMs: 60_000 },
};

export const prisma: PrismaClient = createPrisma(testDatabaseUrl);

export type TestAppOverrides = Partial<Omit<AppOptions, 'prisma' | 'corsOrigins'>> & {
  relaxedLimits?: boolean;
  prisma?: PrismaClient;
};

export function buildTestApp(overrides: TestAppOverrides = {}): FastifyInstance {
  const { relaxedLimits = true, prisma: customPrisma, config, ...rest } = overrides;
  return buildApp({
    prisma: customPrisma ?? prisma,
    corsOrigins: [TEST_ORIGIN],
    ...rest,
    config: {
      ...(relaxedLimits ? { rateLimit: relaxedRateLimit } : {}),
      ...config,
    },
  });
}

export function uniqueEmail(prefix = 'u'): string {
  return `${prefix}-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

interface PostOptions {
  cookie?: string;
  headers?: Record<string, string>;
  remoteAddress?: string;
  /** Padrão: origem permitida. Passe `null` para não enviar Origin. */
  origin?: string | null;
}

export async function postJson(
  app: FastifyInstance,
  url: string,
  body: unknown,
  options: PostOptions = {},
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(options.origin === null ? {} : { origin: options.origin ?? TEST_ORIGIN }),
    ...(options.cookie ? { cookie: options.cookie } : {}),
    ...options.headers,
  };
  return app.inject({
    method: 'POST',
    url,
    headers,
    payload: JSON.stringify(body),
    ...(options.remoteAddress ? { remoteAddress: options.remoteAddress } : {}),
  });
}

export function getWithCookie(
  app: FastifyInstance,
  url: string,
  cookie?: string,
): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url, ...(cookie ? { headers: { cookie } } : {}) });
}

/** Linha `Set-Cookie` do cookie de sessão (ou undefined). */
export function setCookieLine(res: LightMyRequestResponse): string | undefined {
  const raw = res.headers['set-cookie'];
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return lines.find((l) => /ogado_session=/.test(l));
}

/** `nome=valor` pronto para o header Cookie. */
export function cookieFrom(res: LightMyRequestResponse): string {
  const line = setCookieLine(res);
  if (!line) throw new Error('resposta sem cookie de sessão');
  const pair = line.split(';')[0];
  if (!pair) throw new Error('cookie malformado');
  return pair;
}

export async function signup(
  app: FastifyInstance,
  email = uniqueEmail(),
  senha = VALID_PASSWORD,
): Promise<{ email: string; senha: string; cookie: string; res: LightMyRequestResponse }> {
  const res = await postJson(app, '/auth/signup', { email, senha });
  if (res.statusCode !== 201) throw new Error(`signup falhou: ${res.statusCode} ${res.body}`);
  return { email, senha, cookie: cookieFrom(res), res };
}
