import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppConfig } from '../config';
import type { GoogleOAuthClient } from '../google/google-client';
import { AppError, notFound } from '../http-errors';
import {
  EmailTakenError,
  IdConflictError,
  type AccountRepository,
} from '../repositories/account-repository';
import { sessionCookieName, setSessionCookie } from '../session/cookie';
import type { SessionService } from '../session/session-service';
import { requireTenant } from '../tenant';

export interface GoogleRoutesDeps {
  config: AppConfig;
  /** Ausente = sem GOOGLE_CLIENT_ID/SECRET: as rotas respondem 404. */
  google: GoogleOAuthClient | undefined;
  accounts: AccountRepository;
  sessions: SessionService;
  clock: () => Date;
  newFazendaId: () => string;
  /** Origem do site (primeiro item de WEB_ORIGIN). */
  webOrigin: string;
}

/** Vida do cookie do fluxo: o usuário tem 10 minutos para concluir no Google. */
const FLOW_MAX_AGE_SECONDS = 10 * 60;

const flowSchema = z.object({
  /** state anti-CSRF, nonce do id_token e verificador PKCE. */
  s: z.string().min(32),
  n: z.string().min(32),
  v: z.string().min(43),
  m: z.enum(['entrar', 'vincular']),
  /** Só no modo vincular: a conta logada que iniciou o fluxo. */
  u: z.string().optional(),
});
type Flow = z.infer<typeof flowSchema>;

const startQuerySchema = z.object({ modo: z.enum(['entrar', 'vincular']).default('entrar') });
const callbackQuerySchema = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().max(256).optional(),
});

/** Cookie do fluxo: `__Host-` em produção, como o da sessão (ADR-0010 a.2). */
function flowCookieName(config: Pick<AppConfig, 'production'>): string {
  return config.production ? '__Host-ogado_google' : 'ogado_google';
}

function flowCookieOptions(config: Pick<AppConfig, 'production'>) {
  return { httpOnly: true, secure: config.production, sameSite: 'lax' as const, path: '/' };
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const parsed = flowSchema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Entrada com Google (RF-001) e vínculo (RF-006): Authorization Code + PKCE feito no servidor.
 * O estado do fluxo (state, nonce, verificador PKCE) vive num cookie HttpOnly de 10 minutos; ele
 * só contém valores aleatórios descartáveis e o `__Host-` impede que outro subdomínio o escreva.
 * Erros viram redirecionamento com código curto, sem detalhes; nada sensível é logado.
 */
export function registerGoogleRoutes(app: FastifyInstance, deps: GoogleRoutesDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const redirectUri = `${deps.webOrigin}/api/auth/google/callback`;
  const goEntrar = (reply: FastifyReply, erro: string) =>
    reply.redirect(`${deps.webOrigin}/entrar?erro=${erro}`, 302);
  const goConta = (reply: FastifyReply, query: string) =>
    reply.redirect(`${deps.webOrigin}/conta?${query}`, 302);

  const limited = async (request: FastifyRequest): Promise<boolean> => {
    try {
      await app.limiters.googleIp(request);
      return false;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 429) return true;
      throw error;
    }
  };

  /** Sessão atual (se houver), sem exigir: estas rotas são públicas e decidem sozinhas. */
  const currentUsuarioId = async (request: FastifyRequest): Promise<string | null> => {
    const token = request.cookies[sessionCookieName(deps.config)];
    if (!token) return null;
    const result = await deps.sessions.validate(token);
    return result.status === 'ok' ? result.tenant.usuarioId : null;
  };

  typed.get(
    '/auth/google/start',
    { config: { auth: 'public' }, schema: { querystring: startQuerySchema } },
    async (request, reply) => {
      const google = deps.google;
      if (!google) throw notFound();
      if (await limited(request)) return goEntrar(reply, 'google');

      const { modo } = request.query;
      const logado = modo === 'vincular' ? await currentUsuarioId(request) : null;
      if (modo === 'vincular' && !logado) return goEntrar(reply, 'google');

      const flow: Flow = {
        s: randomBytes(32).toString('base64url'),
        n: randomBytes(32).toString('base64url'),
        v: randomBytes(32).toString('base64url'),
        m: modo,
        ...(logado ? { u: logado } : {}),
      };
      void reply.setCookie(
        flowCookieName(deps.config),
        Buffer.from(JSON.stringify(flow)).toString('base64url'),
        { ...flowCookieOptions(deps.config), maxAge: FLOW_MAX_AGE_SECONDS },
      );
      const url = google.authorizationUrl({
        state: flow.s,
        nonce: flow.n,
        codeChallenge: createHash('sha256').update(flow.v).digest('base64url'),
        redirectUri,
      });
      return reply.redirect(url, 302);
    },
  );

  typed.get(
    '/auth/google/callback',
    { config: { auth: 'public' }, schema: { querystring: callbackQuerySchema } },
    async (request, reply) => {
      const google = deps.google;
      if (!google) throw notFound();

      // O fluxo é de uso único: o cookie some a cada retorno, com sucesso ou erro.
      const cookieName = flowCookieName(deps.config);
      const flow = readFlow(request.cookies[cookieName]);
      void reply.clearCookie(cookieName, flowCookieOptions(deps.config));

      const falhar = (motivo: string): FastifyReply => {
        // Só uma categoria fixa: nunca code, state, tokens, e-mail ou mensagens do Google.
        request.log.warn({ motivo }, 'falha na entrada com Google');
        return flow?.m === 'vincular' ? goConta(reply, 'erro=google') : goEntrar(reply, 'google');
      };

      if (await limited(request)) return goEntrar(reply, 'google');
      const { code, state, error } = request.query;
      if (!flow) return falhar('sem_fluxo');
      if (error || !code || !state) return falhar('retorno_incompleto');
      if (!sameSecret(state, flow.s)) return falhar('state');

      let claims;
      try {
        claims = await google.exchangeCode({ code, codeVerifier: flow.v, redirectUri });
      } catch {
        return falhar('troca_do_code');
      }
      if (!sameSecret(claims.nonce, flow.n)) return falhar('nonce');
      if (claims.emailVerified !== true) return falhar('email_nao_verificado');
      const email = claims.email.trim().toLowerCase();
      if (claims.sub.length === 0 || email.length === 0) return falhar('claims');

      const now = deps.clock();

      if (flow.m === 'vincular') {
        const usuarioId = await currentUsuarioId(request);
        if (!usuarioId) return goEntrar(reply, 'google');
        // O retorno precisa ser da mesma conta que iniciou o fluxo.
        if (usuarioId !== flow.u) return falhar('sessao_diferente');
        const dono = await deps.accounts.findUsuarioIdByGoogleSub(claims.sub);
        if (dono && dono !== usuarioId) return goConta(reply, 'erro=google-ja-vinculado');
        if (dono === usuarioId) return goConta(reply, 'google=vinculado');
        const resultado = await deps.accounts.linkGoogle({
          usuarioId,
          sub: claims.sub,
          email,
          now,
        });
        return resultado === 'ok'
          ? goConta(reply, 'google=vinculado')
          : goConta(reply, 'erro=google-ja-vinculado');
      }

      // Entrar: identidade conhecida -> sessão; e-mail novo -> cria conta; senão recusa.
      const usuarioId = await deps.accounts.findUsuarioIdByGoogleSub(claims.sub);
      if (!usuarioId) {
        // Não vincula por e-mail: o cadastro por senha não verifica o e-mail (ADR-0010 Q3), e
        // vincular automaticamente permitiria tomar a conta de quem ainda não criou a do Google.
        if (await deps.accounts.findUsuarioByEmail(email)) {
          return goEntrar(reply, 'google-conta-existente');
        }
        const session = deps.sessions.issue();
        try {
          await deps.accounts.createAccount({
            email,
            senhaHash: null,
            nome: claims.name,
            google: { sub: claims.sub },
            fazendaId: deps.newFazendaId(),
            session,
            now,
          });
        } catch (erro) {
          if (erro instanceof EmailTakenError) return goEntrar(reply, 'google-conta-existente');
          if (erro instanceof IdConflictError) return falhar('conflito_de_id');
          throw erro;
        }
        setSessionCookie(reply, deps.config, session.token, session.maxAgeSeconds);
        return reply.redirect(`${deps.webOrigin}/painel`, 302);
      }

      // Sessão sempre nova; um cookie de sessão anterior nunca é reaproveitado (sem fixação).
      const session = await deps.sessions.create(usuarioId);
      setSessionCookie(reply, deps.config, session.token, session.maxAgeSeconds);
      return reply.redirect(`${deps.webOrigin}/painel`, 302);
    },
  );

  // RF-006: desvincular exige sessão e uma senha definida (senão a conta ficaria sem entrada).
  typed.delete('/conta/google', async (request, reply) => {
    const tenant = requireTenant(request);
    const resultado = await deps.accounts.unlinkGoogle(tenant.usuarioId);
    if (resultado === 'nao_vinculado') throw notFound();
    if (resultado === 'sem_senha') {
      throw new AppError(
        409,
        'conflito',
        'Defina uma senha antes de desvincular o Google, senão você perde o acesso à conta.',
      );
    }
    return reply.code(204).send();
  });
}
