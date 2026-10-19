import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { AppConfig, RateLimitRule } from '../config';
import { tooManyAttempts } from '../http-errors';
import { clientIp } from './client-ip';

export interface Limiters {
  /** Login: chave IP + e-mail normalizado (~5/min). Chamar depois da validação do corpo. */
  loginIpEmail(request: FastifyRequest, email: string): Promise<void>;
  /** Login: só IP (~20/min). */
  loginIp(request: FastifyRequest): Promise<void>;
  /** Troca de senha: chave IP + usuário, mesma regra do login por IP + e-mail (~5/min). */
  passwordChange(request: FastifyRequest, usuarioId: string): Promise<void>;
  /** Cadastro: por IP (~5/h). */
  signupIp(request: FastifyRequest): Promise<void>;
  /** Esqueci a senha: por IP (~10/h). */
  forgotIp(request: FastifyRequest): Promise<void>;
  /** Esqueci a senha: por e-mail normalizado, de qualquer IP (~3/h), contra e-mail em massa. */
  forgotEmail(request: FastifyRequest, email: string): Promise<void>;
  /** Redefinir senha: por IP (~20/h). */
  resetIp(request: FastifyRequest): Promise<void>;
}

/**
 * Rate limit (ADR-0010 e): limite global moderado por IP + limitadores nomeados para login e
 * cadastro. Armazenamento em memória enquanto houver uma instância (ADR-0010: Postgres/Redis ao
 * escalar). Estouro = 429 `muitas_tentativas` com `Retry-After`.
 */
export const rateLimitPlugin = fp<{ config: Pick<AppConfig, 'rateLimit' | 'proxySecret'> }>(
  async (app: FastifyInstance, { config }) => {
    const rules = config.rateLimit;

    await app.register(rateLimit, {
      global: true,
      max: rules.global.max,
      timeWindow: rules.global.windowMs,
      keyGenerator: (request) => clientIp(request, config.proxySecret),
      errorResponseBuilder: (_request, context) => tooManyAttempts(context.ttl / 1000),
    });

    // Um limitador por regra, criado uma vez (o contador vive no store do limitador). A chave leva
    // o nome da regra, para IP puro, IP + e-mail e cadastro não se misturarem.
    const make = (
      name: string,
      rule: RateLimitRule,
      keySuffix: (request: FastifyRequest) => string,
      byIp = true,
    ) =>
      app.createRateLimit({
        max: rule.max,
        timeWindow: rule.windowMs,
        keyGenerator: (request) =>
          `${name}:${byIp ? clientIp(request, config.proxySecret) : ''}${keySuffix(request)}`,
      });

    const emailByRequest = new WeakMap<FastifyRequest, string>();
    const loginIp = make('login-ip', rules.loginIp, () => '');
    const signupIp = make('signup-ip', rules.signupIp, () => '');
    const passwordChange = make(
      'password-change',
      rules.loginIpEmail,
      (request) => `:${emailByRequest.get(request) ?? ''}`,
    );
    const loginIpEmail = make(
      'login-ip-email',
      rules.loginIpEmail,
      (request) => `:${emailByRequest.get(request) ?? ''}`,
    );

    const forgotIp = make('forgot-ip', rules.forgotIp, () => '');
    const forgotEmail = make(
      'forgot-email',
      rules.forgotEmail,
      (request) => `:${emailByRequest.get(request) ?? ''}`,
      false,
    );
    const resetIp = make('reset-ip', rules.resetIp, () => '');

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
      forgotIp: (request) => enforce(forgotIp, request),
      resetIp: (request) => enforce(resetIp, request),
      forgotEmail(request, email) {
        emailByRequest.set(request, email);
        return enforce(forgotEmail, request);
      },
      passwordChange(request, usuarioId) {
        emailByRequest.set(request, usuarioId);
        return enforce(passwordChange, request);
      },
      loginIpEmail(request, email) {
        emailByRequest.set(request, email);
        return enforce(loginIpEmail, request);
      },
    };
    app.decorate('limiters', limiters);
  },
);
