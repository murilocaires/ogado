import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { AppConfig, RateLimitRule } from '../config';
import { tooManyAttempts } from '../http-errors';

export interface Limiters {
  /** Login: chave IP + e-mail normalizado (~5/min). Chamar depois da validação do corpo. */
  loginIpEmail(request: FastifyRequest, email: string): Promise<void>;
  /** Login: só IP (~20/min). */
  loginIp(request: FastifyRequest): Promise<void>;
  /** Cadastro: por IP (~5/h). */
  signupIp(request: FastifyRequest): Promise<void>;
}

/**
 * Rate limit (ADR-0010 e): limite global moderado por IP + limitadores nomeados para login e
 * cadastro. Armazenamento em memória enquanto houver uma instância (ADR-0010: Postgres/Redis ao
 * escalar). Estouro = 429 `muitas_tentativas` com `Retry-After`.
 */
export const rateLimitPlugin = fp<{ config: Pick<AppConfig, 'rateLimit'> }>(
  async (app: FastifyInstance, { config }) => {
    const rules = config.rateLimit;

    await app.register(rateLimit, {
      global: true,
      max: rules.global.max,
      timeWindow: rules.global.windowMs,
      errorResponseBuilder: (_request, context) => tooManyAttempts(context.ttl / 1000),
    });

    // Um limitador por regra, criado uma vez (o contador vive no store do limitador). A chave leva
    // o nome da regra, para IP puro, IP + e-mail e cadastro não se misturarem.
    const make = (
      name: string,
      rule: RateLimitRule,
      keySuffix: (request: FastifyRequest) => string,
    ) =>
      app.createRateLimit({
        max: rule.max,
        timeWindow: rule.windowMs,
        keyGenerator: (request) => `${name}:${request.ip}${keySuffix(request)}`,
      });

    const emailByRequest = new WeakMap<FastifyRequest, string>();
    const loginIp = make('login-ip', rules.loginIp, () => '');
    const signupIp = make('signup-ip', rules.signupIp, () => '');
    const loginIpEmail = make(
      'login-ip-email',
      rules.loginIpEmail,
      (request) => `:${emailByRequest.get(request) ?? ''}`,
    );

    const enforce = async (
      check: ReturnType<typeof make>,
      request: FastifyRequest,
    ): Promise<void> => {
      const result = await check(request);
      if (!result.isAllowed && result.isExceeded) throw tooManyAttempts(result.ttlInSeconds);
    };

    const limiters: Limiters = {
      loginIp: (request) => enforce(loginIp, request),
      signupIp: (request) => enforce(signupIp, request),
      loginIpEmail(request, email) {
        emailByRequest.set(request, email);
        return enforce(loginIpEmail, request);
      },
    };
    app.decorate('limiters', limiters);
  },
);
