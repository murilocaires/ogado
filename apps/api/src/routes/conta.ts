import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  contaDeleteSchema,
  fazendaPatchSchema,
  perfilRequestSchema,
  senhaRequestSchema,
  sessionResponseSchema,
} from '@ogado/contracts';
import type { AppConfig } from '../config';
import { AppError, genericConflict, notFound, versionConflict } from '../http-errors';
import type { PasswordHasher } from '../password';
import { EmailTakenError, type AccountRepository } from '../repositories/account-repository';
import type { FazendaRepository } from '../repositories/fazenda-repository';
import { clearSessionCookie, sessionCookieName } from '../session/cookie';
import type { SessionService } from '../session/session-service';
import { requireTenant } from '../tenant';
import { toFazendaDto } from './dto';

export interface ContaRoutesDeps {
  config: AppConfig;
  accounts: AccountRepository;
  fazendas: FazendaRepository;
  sessions: SessionService;
  hasher: PasswordHasher;
  clock: () => Date;
}

/**
 * Conta (T-18, sem Google): perfil (RF-004), senha (RF-005), fazenda (RF-011) e apagar conta
 * (RF-007). Tudo age só sobre o tenant da sessão: nenhum id do cliente seleciona o alvo.
 */
export function registerContaRoutes(app: FastifyInstance, deps: ContaRoutesDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.patch(
    '/conta/perfil',
    { schema: { body: perfilRequestSchema, response: { 200: sessionResponseSchema } } },
    async (request) => {
      const tenant = requireTenant(request);
      const { nome, email } = request.body;

      // Pré-checagem só para o caminho comum; a corrida é pega pela unicidade no banco.
      const dono = await deps.accounts.findUsuarioByEmail(email);
      if (dono && dono.id !== tenant.usuarioId) throw genericConflict();

      let usuario;
      try {
        usuario = await deps.accounts.updatePerfil(tenant.usuarioId, { nome, email }, deps.clock());
      } catch (error) {
        if (error instanceof EmailTakenError) throw genericConflict();
        throw error;
      }
      const fazenda = await deps.fazendas.findById(tenant, tenant.fazendaId);
      if (!fazenda) throw notFound();
      return { usuario, fazenda: toFazendaDto(fazenda) };
    },
  );

  typed.put(
    '/conta/senha',
    { schema: { body: senhaRequestSchema } },
    async (request, reply) => {
      const tenant = requireTenant(request);
      const { senhaAtual, novaSenha } = request.body;
      await app.limiters.passwordChange(request, tenant.usuarioId);

      const hashAtual = await deps.accounts.findSenhaHash(tenant.usuarioId);
      if (hashAtual === undefined) throw notFound();
      if (hashAtual !== null) {
        if (senhaAtual === undefined) {
          throw new AppError(400, 'validacao_invalida', 'Informe a senha atual.', {
            campos: [
              { caminho: 'senhaAtual', regra: 'obrigatoria', mensagem: 'Informe a senha atual.' },
            ],
          });
        }
        if (!(await deps.hasher.verify(hashAtual, senhaAtual))) {
          // 400 (não 401): a sessão está válida; só a senha atual informada está errada.
          throw new AppError(400, 'credenciais_invalidas', 'A senha atual está incorreta.');
        }
      }

      await deps.accounts.updateSenhaHash(tenant.usuarioId, await deps.hasher.hash(novaSenha));
      const token = request.cookies[sessionCookieName(deps.config)];
      if (token) await deps.sessions.invalidateOthersForUser(tenant.usuarioId, token);
      else await deps.sessions.invalidateAllForUser(tenant.usuarioId);
      return reply.code(204).send();
    },
  );

  typed.patch(
    '/fazenda',
    { schema: { body: fazendaPatchSchema, response: { 200: sessionResponseSchema } } },
    async (request) => {
      const tenant = requireTenant(request);
      const { sessionUser } = request;
      if (!sessionUser) throw new Error('contexto de tenant ausente');
      const { nome, areaHa, version } = request.body;

      const result = await deps.fazendas.updateDados(
        tenant,
        { nome, areaHa, version },
        deps.clock(),
      );
      if (result.status === 'conflito') throw versionConflict(toFazendaDto(result.atual));
      if (result.status === 'nao_encontrado') throw notFound();
      return { usuario: sessionUser, fazenda: toFazendaDto(result.record) };
    },
  );

  typed.delete(
    '/conta',
    { config: { allowJsonBody: true }, schema: { body: contaDeleteSchema } },
    async (request, reply) => {
      await deps.accounts.deleteAccount(requireTenant(request));
      clearSessionCookie(reply, deps.config);
      return reply.code(204).send();
    },
  );
}
