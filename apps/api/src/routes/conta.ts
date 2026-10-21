import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  aceiteRequestSchema,
  contaDeleteSchema,
  EXPORTACAO_VERSAO_DO_FORMATO,
  EXPORTACAO_ENVIO_MENSAGEM,
  exportacaoDadosSchema,
  exportacaoEnvioSchema,
  type ExportacaoDados,
  fazendaPatchSchema,
  perfilRequestSchema,
  senhaRequestSchema,
  sessionResponseSchema,
  TERMOS_VERSAO,
} from '@bovaro/contracts';
import type { AppConfig } from '../config';
import { dadosPorEmail } from '../email/export-email';
import type { EmailSender } from '../email/email-sender';
import { AppError, genericConflict, notFound, versionConflict } from '../http-errors';
import type { PasswordHasher } from '../password';
import { EmailTakenError, type AccountRepository } from '../repositories/account-repository';
import type { CenarioRepository } from '../repositories/cenario-repository';
import type { FazendaRepository } from '../repositories/fazenda-repository';
import type { LoteRepository } from '../repositories/lote-repository';
import type { RecriaRepository } from '../repositories/recria-repository';
import { clearSessionCookie, readSessionToken } from '../session/cookie';
import type { SessionService } from '../session/session-service';
import { parseToken } from '../session/tokens';
import { requireTenant, type TenantContext } from '../tenant';
import { toCenarioDto, toFazendaDto, toLoteDto, toRecriaEntradaDto } from './dto';

export interface ContaRoutesDeps {
  config: AppConfig;
  email: EmailSender;
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

  // RNF-009: novo aceite (conta do Google ou termos atualizados). Só a versão vigente é aceita.
  typed.post(
    '/conta/aceite',
    { schema: { body: aceiteRequestSchema, response: { 200: sessionResponseSchema } } },
    async (request) => {
      const tenant = requireTenant(request);
      if (request.body.versao !== TERMOS_VERSAO) {
        throw new AppError(
          409,
          'conflito',
          'Os termos foram atualizados. Recarregue a página para ler a versão atual.',
        );
      }
      const usuario = await deps.accounts.registrarAceite(
        tenant.usuarioId,
        TERMOS_VERSAO,
        deps.clock(),
      );
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

    const token = readSessionToken(request.cookies, deps.config);
    const changed = await deps.accounts.changeSenha({
      usuarioId: tenant.usuarioId,
      expectedHash: hashAtual,
      senhaHash: await deps.hasher.hash(novaSenha),
      currentSessionId: token ? (parseToken(token)?.id ?? null) : null,
      now: deps.clock(),
    });
    if (!changed) throw new AppError(400, 'credenciais_invalidas', 'A senha atual está incorreta.');
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

  /** Monta o JSON da exportação (RNF-009) do tenant da sessão; `null` se o titular sumiu. */
  async function montarExportacao(
    tenant: TenantContext,
    agora: Date,
  ): Promise<ExportacaoDados | null> {
    const titular = await deps.accounts.loadTitularParaExportar(tenant);
    if (!titular) return null;
    const [lotes, cenarios, recria] = await Promise.all([
      deps.lotes.list(tenant, { incluirExcluidos: false }),
      deps.cenarios.list(tenant, false),
      deps.recria.get(tenant),
    ]);
    const { usuario, fazenda } = titular;
    return {
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
        aceiteTermosVersao: usuario.aceiteTermosVersao,
        aceiteTermosEm: usuario.aceiteTermosEm ? usuario.aceiteTermosEm.toISOString() : null,
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
    };
  }

  const nomeArquivoExportacao = (agora: Date): string =>
    `bovaro-meus-dados-${agora.toISOString().slice(0, 10)}.json`;

  // RNF-009: cópia dos dados do titular. Só leitura, só do tenant da sessão, sem segredos.
  typed.get(
    '/conta/exportar',
    { schema: { response: { 200: exportacaoDadosSchema } } },
    async (request, reply) => {
      const tenant = requireTenant(request);
      await app.limiters.exportUser(request, tenant.usuarioId);

      const agora = deps.clock();
      const dados = await montarExportacao(tenant, agora);
      if (!dados) throw notFound();
      return reply
        .header('content-disposition', `attachment; filename="${nomeArquivoExportacao(agora)}"`)
        .header('cache-control', 'no-store')
        .send(dados);
    },
  );

  // RNF-009: o mesmo JSON, enviado como anexo ao e-mail da própria conta. Resposta sempre 202; falha
  // do provedor só é registrada (sem PII), como na recuperação de senha.
  typed.post(
    '/conta/exportar/enviar',
    { schema: { response: { 202: exportacaoEnvioSchema } } },
    async (request, reply) => {
      const tenant = requireTenant(request);
      await app.limiters.exportEmailUser(request, tenant.usuarioId);

      const agora = deps.clock();
      const dados = await montarExportacao(tenant, agora);
      if (!dados) throw notFound();
      deps.email
        .send(
          dadosPorEmail(dados.perfil.email, {
            filename: nomeArquivoExportacao(agora),
            content: Buffer.from(JSON.stringify(dados, null, 2), 'utf8').toString('base64'),
          }),
        )
        .catch(() => {
          request.log.error(
            { category: 'email_delivery_failed', operation: 'data_export' },
            'falha ao enviar e-mail com os dados do titular',
          );
        });
      return reply.code(202).send({ mensagem: EXPORTACAO_ENVIO_MENSAGEM });
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
