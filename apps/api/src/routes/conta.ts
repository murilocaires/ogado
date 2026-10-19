import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  contaDeleteSchema,
  EXPORTACAO_VERSAO_DO_FORMATO,
  exportacaoDadosSchema,
  fazendaPatchSchema,
  perfilRequestSchema,
  senhaRequestSchema,
  sessionResponseSchema,
} from '@ogado/contracts';
import type { AppConfig } from '../config';
import { AppError, genericConflict, notFound, versionConflict } from '../http-errors';
import type { PasswordHasher } from '../password';
import { EmailTakenError, type AccountRepository } from '../repositories/account-repository';
import type { CenarioRepository } from '../repositories/cenario-repository';
import type { FazendaRepository } from '../repositories/fazenda-repository';
import type { LoteRepository } from '../repositories/lote-repository';
import type { RecriaRepository } from '../repositories/recria-repository';
import { clearSessionCookie, sessionCookieName } from '../session/cookie';
import type { SessionService } from '../session/session-service';
import { requireTenant } from '../tenant';
import { toCenarioDto, toFazendaDto, toLoteDto, toRecriaEntradaDto } from './dto';

export interface ContaRoutesDeps {
  config: AppConfig;
  accounts: AccountRepository;
  fazendas: FazendaRepository;
  lotes: LoteRepository;
  cenarios: CenarioRepository;
  recria: RecriaRepository;
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

  typed.put('/conta/senha', { schema: { body: senhaRequestSchema } }, async (request, reply) => {
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
  });

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

  // RNF-009: cópia dos dados do titular. Só leitura, só do tenant da sessão, sem segredos.
  typed.get(
    '/conta/exportar',
    { schema: { response: { 200: exportacaoDadosSchema } } },
    async (request, reply) => {
      const tenant = requireTenant(request);
      await app.limiters.exportUser(request, tenant.usuarioId);

      const titular = await deps.accounts.loadTitularParaExportar(tenant);
      if (!titular) throw notFound();
      const [lotes, cenarios, recria] = await Promise.all([
        deps.lotes.list(tenant, { incluirExcluidos: false }),
        deps.cenarios.list(tenant, false),
        deps.recria.get(tenant),
      ]);
      const agora = deps.clock();
      const { usuario, fazenda } = titular;

      return reply
        .header(
          'content-disposition',
          `attachment; filename="ogado-meus-dados-${agora.toISOString().slice(0, 10)}.json"`,
        )
        .header('cache-control', 'no-store')
        .send({
          versaoDoFormato: EXPORTACAO_VERSAO_DO_FORMATO,
          geradoEm: agora.toISOString(),
          observacao:
            'Este arquivo traz apenas os registros não excluídos. Registros excluídos, senhas, ' +
            'sessões e outros dados de segurança não fazem parte da exportação.',
          perfil: {
            id: usuario.id,
            email: usuario.email,
            nome: usuario.nome,
            criadoEm: usuario.criadoEm.toISOString(),
            temSenha: usuario.senhaHash !== null,
            googleVinculado: usuario.identidadeGoogle !== null,
          },
          fazenda: {
            id: fazenda.id,
            nome: fazenda.nome,
            areaHa: fazenda.areaHa ? fazenda.areaHa.toFixed() : null,
            criadoEm: fazenda.createdAt.toISOString(),
          },
          lotes: lotes.map(toLoteDto),
          cenarios: cenarios.map(toCenarioDto),
          recriaEntrada: recria && !recria.deletedAt ? toRecriaEntradaDto(recria) : null,
        });
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
