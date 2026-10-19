import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginRequestSchema, sessionResponseSchema, signupRequestSchema } from '@ogado/contracts';
import type { AppConfig } from '../config';
import { emailUnavailable, genericConflict, invalidCredentials } from '../http-errors';
import type { PasswordHasher } from '../password';
import {
  EmailTakenError,
  IdConflictError,
  type AccountRepository,
} from '../repositories/account-repository';
import type { FazendaRepository } from '../repositories/fazenda-repository';
import { clearSessionCookie, sessionCookieName, setSessionCookie } from '../session/cookie';
import type { SessionService } from '../session/session-service';
import { toFazendaDto } from './dto';

export interface AuthRoutesDeps {
  config: AppConfig;
  accounts: AccountRepository;
  fazendas: FazendaRepository;
  sessions: SessionService;
  hasher: PasswordHasher;
  clock: () => Date;
  newFazendaId: () => string;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRoutesDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/auth/signup',
    {
      config: { auth: 'public' },
      schema: { body: signupRequestSchema, response: { 201: sessionResponseSchema } },
    },
    async (request, reply) => {
      const { email, senha } = request.body;
      await app.limiters.signupIp(request);

      if (await deps.accounts.findUsuarioByEmail(email)) throw emailUnavailable();

      const senhaHash = await deps.hasher.hash(senha);
      const session = deps.sessions.issue();
      try {
        const { usuario, fazenda } = await deps.accounts.createAccount({
          email,
          senhaHash,
          fazendaId: deps.newFazendaId(),
          session,
          now: deps.clock(),
        });
        setSessionCookie(reply, deps.config, session.token, session.maxAgeSeconds);
        return reply.code(201).send({ usuario, fazenda: toFazendaDto(fazenda) });
      } catch (error) {
        if (error instanceof EmailTakenError) throw emailUnavailable();
        if (error instanceof IdConflictError) throw genericConflict();
        throw error;
      }
    },
  );

  typed.post(
    '/auth/login',
    {
      config: { auth: 'public' },
      schema: { body: loginRequestSchema, response: { 200: sessionResponseSchema } },
    },
    async (request, reply) => {
      const { email, senha } = request.body;
      await app.limiters.loginIp(request);
      await app.limiters.loginIpEmail(request, email);

      const usuario = await deps.accounts.findUsuarioByEmail(email);
      let autenticado = false;
      if (usuario?.senhaHash) {
        autenticado = await deps.hasher.verify(usuario.senhaHash, senha);
      } else {
        // E-mail inexistente (ou conta só Google): gasta o mesmo tempo de uma verificação real.
        await deps.hasher.verifyDummy(senha);
      }
      if (!usuario || !autenticado) throw invalidCredentials();

      if (usuario.senhaHash && deps.hasher.needsRehash(usuario.senhaHash)) {
        await deps.accounts.updateSenhaHash(usuario.id, await deps.hasher.hash(senha));
      }

      const fazenda = await deps.accounts.loadFazendaDoUsuario(usuario.id);
      if (!fazenda) throw invalidCredentials();

      // Sessão sempre nova; um cookie anterior enviado junto nunca é reaproveitado (sem fixação).
      const session = await deps.sessions.create(usuario.id);
      setSessionCookie(reply, deps.config, session.token, session.maxAgeSeconds);
      return reply.code(200).send({
        usuario: { id: usuario.id, email: usuario.email },
        fazenda: toFazendaDto(fazenda),
      });
    },
  );

  // Idempotente: apaga a sessão no servidor (se houver) e o cookie; sempre 204.
  typed.post('/auth/logout', { config: { auth: 'public' } }, async (request, reply) => {
    const token = request.cookies[sessionCookieName(deps.config)];
    if (token) await deps.sessions.invalidate(token);
    clearSessionCookie(reply, deps.config);
    return reply.code(204).send();
  });

  typed.get(
    '/auth/session',
    { schema: { response: { 200: sessionResponseSchema } } },
    async (request) => {
      const { tenant, sessionUser } = request;
      if (!tenant || !sessionUser) throw new Error('contexto de tenant ausente');
      const fazenda = await deps.fazendas.findById(tenant, tenant.fazendaId);
      if (!fazenda) throw new Error('fazenda da sessão não encontrada');
      return { usuario: sessionUser, fazenda: toFazendaDto(fazenda) };
    },
  );
}
