import type { UsuarioDto } from '@ogado/contracts';
import type { PrismaClient } from '@ogado/db';
import { toUsuarioDto, usuarioDtoSelect } from '../usuario-dto';
import type { FazendaRecord } from './fazenda-repository';

export class EmailTakenError extends Error {
  constructor() {
    super('email_taken');
    this.name = 'EmailTakenError';
  }
}

/** Id (UUID) já pertence a outro registro; o registro alheio nunca é revelado nem alterado. */
export class IdConflictError extends Error {
  constructor() {
    super('id_conflict');
    this.name = 'IdConflictError';
  }
}

export interface NewSessionData {
  id: string;
  segredoHash: string;
  criadaEm: Date;
  expiraEm: Date;
}

export interface UsuarioRecord {
  id: string;
  email: string;
  nome: string | null;
  senhaHash: string | null;
  googleVinculado: boolean;
  aceiteTermosVersao: string | null;
  aceiteTermosEm: Date | null;
}

const fazendaSelect = {
  id: true,
  nome: true,
  areaHa: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

/** Mesmo bloqueio para emissão, resgate e troca de credenciais: serializa por titular. */
async function lockUsuario(tx: Pick<PrismaClient, '$queryRaw'>, usuarioId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${usuarioId}::uuid FOR UPDATE`;
}

export function createAccountRepository(prisma: PrismaClient) {
  return {
    async findUsuarioByEmail(email: string): Promise<UsuarioRecord | null> {
      const row = await prisma.usuario.findUnique({ where: { email }, select: usuarioDtoSelect });
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        nome: row.nome,
        senhaHash: row.senhaHash,
        googleVinculado: row.identidadeGoogle !== null,
        aceiteTermosVersao: row.aceiteTermosVersao,
        aceiteTermosEm: row.aceiteTermosEm,
      };
    },

    /** Usuário vinculado a este `sub` do Google (identidade já conhecida) ou `null`. */
    async findUsuarioIdByGoogleSub(sub: string): Promise<string | null> {
      const row = await prisma.identidadeGoogle.findUnique({
        where: { sub },
        select: { usuarioId: true },
      });
      return row ? row.usuarioId : null;
    },

    /**
     * Vincula o Google à conta (RF-006). `sub_em_uso` = o `sub` já pertence a outra conta;
     * `ja_vinculada` = esta conta já tem outra identidade Google. Corrida resolvida pela unicidade.
     */
    async linkGoogle(input: {
      usuarioId: string;
      sub: string;
      email: string;
      now: Date;
    }): Promise<'ok' | 'sub_em_uso' | 'ja_vinculada'> {
      try {
        await prisma.identidadeGoogle.create({
          data: {
            usuarioId: input.usuarioId,
            sub: input.sub,
            email: input.email,
            criadoEm: input.now,
          },
        });
        return 'ok';
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const dono = await prisma.identidadeGoogle.findUnique({
          where: { sub: input.sub },
          select: { usuarioId: true },
        });
        return dono && dono.usuarioId !== input.usuarioId ? 'sub_em_uso' : 'ja_vinculada';
      }
    },

    /**
     * Desvincula o Google (RF-006). Atômico: só apaga se a conta tem senha (UPDATE/DELETE
     * condicional), então nunca deixa a conta sem nenhum jeito de entrar.
     */
    async unlinkGoogle(usuarioId: string): Promise<'ok' | 'sem_senha' | 'nao_vinculado'> {
      const removed = await prisma.identidadeGoogle.deleteMany({
        where: { usuarioId, usuario: { senhaHash: { not: null } } },
      });
      if (removed.count > 0) return 'ok';
      const existe = await prisma.identidadeGoogle.findUnique({
        where: { usuarioId },
        select: { id: true },
      });
      return existe ? 'sem_senha' : 'nao_vinculado';
    },

    /** RNF-009: registra o aceite da versão informada (a rota só passa a vigente). */
    async registrarAceite(usuarioId: string, versao: string, now: Date): Promise<UsuarioDto> {
      return toUsuarioDto(
        await prisma.usuario.update({
          where: { id: usuarioId },
          data: { aceiteTermosVersao: versao, aceiteTermosEm: now, atualizadoEm: now },
          select: usuarioDtoSelect,
        }),
      );
    },

    /** Login só emite sessão se a credencial verificada continua vigente sob o mesmo bloqueio. */
    async createPasswordSession(input: {
      usuarioId: string;
      expectedHash: string;
      expectedEmail: string;
      rehash?: string;
      session: NewSessionData;
    }): Promise<boolean> {
      return prisma.$transaction(async (tx) => {
        await lockUsuario(tx, input.usuarioId);
        const usuario = await tx.usuario.findUnique({
          where: { id: input.usuarioId },
          select: { senhaHash: true, email: true },
        });
        if (
          !usuario ||
          usuario.senhaHash !== input.expectedHash ||
          usuario.email !== input.expectedEmail
        )
          return false;
        // Rehash técnico é separado da troca de credenciais: conserva links e sessões vigentes.
        if (input.rehash) {
          await tx.usuario.update({
            where: { id: input.usuarioId },
            data: { senhaHash: input.rehash },
          });
        }
        await tx.sessao.create({
          data: {
            id: input.session.id,
            segredoHash: input.session.segredoHash,
            usuarioId: input.usuarioId,
            criadaEm: input.session.criadaEm,
            ultimaVerificacaoEm: input.session.criadaEm,
            expiraEm: input.session.expiraEm,
          },
        });
        return true;
      });
    },

    /** RF-005: senha, links e sessões mudam juntos; verificação obsoleta não pode vencer uma troca. */
    async changeSenha(input: {
      usuarioId: string;
      expectedHash: string | null;
      senhaHash: string;
      currentSessionId: string | null;
      now: Date;
    }): Promise<boolean> {
      return prisma.$transaction(async (tx) => {
        await lockUsuario(tx, input.usuarioId);
        const updated = await tx.usuario.updateMany({
          where: { id: input.usuarioId, senhaHash: input.expectedHash },
          data: { senhaHash: input.senhaHash, atualizadoEm: input.now },
        });
        if (updated.count !== 1) return false;
        await tx.tokenRedefinicao.updateMany({
          where: { usuarioId: input.usuarioId, usadoEm: null },
          data: { usadoEm: input.now },
        });
        await tx.sessao.deleteMany({
          where: {
            usuarioId: input.usuarioId,
            ...(input.currentSessionId ? { id: { not: input.currentSessionId } } : {}),
          },
        });
        return true;
      });
    },

    /** Hash atual da senha (nulo = conta sem senha). Usuário inexistente = `undefined`. */
    async findSenhaHash(usuarioId: string): Promise<string | null | undefined> {
      const row = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { senhaHash: true },
      });
      return row ? row.senhaHash : undefined;
    },

    /**
     * Redefinição de senha (RF-002): invalida os tokens ainda não usados do usuário e grava o novo
     * (só o hash). Tudo ou nada.
     */
    async createResetToken(input: {
      usuarioId: string;
      email: string;
      tokenHash: string;
      now: Date;
      expiraEm: Date;
    }): Promise<boolean> {
      return prisma.$transaction(async (tx) => {
        await lockUsuario(tx, input.usuarioId);
        // O lookup do handler pode ter ocorrido antes de uma troca de e-mail concorrente.
        const usuario = await tx.usuario.findUnique({
          where: { id: input.usuarioId },
          select: { email: true },
        });
        if (!usuario || usuario.email !== input.email) return false;
        await tx.tokenRedefinicao.updateMany({
          where: { usuarioId: input.usuarioId, usadoEm: null },
          data: { usadoEm: input.now },
        });
        await tx.tokenRedefinicao.create({
          data: {
            tokenHash: input.tokenHash,
            usuarioId: input.usuarioId,
            criadoEm: input.now,
            expiraEm: input.expiraEm,
          },
        });
        return true;
      });
    },

    /**
     * Consome o token (existe, não usado, não expirado) e, na mesma transação, grava a nova senha e
     * derruba todas as sessões do usuário. O consumo é um UPDATE condicional: duas requisições com o
     * mesmo token nunca passam as duas. `false` = token inválido (sem dizer por quê).
     */
    async redeemResetToken(input: {
      tokenHash: string;
      senhaHash: string;
      now: Date;
    }): Promise<boolean> {
      return prisma.$transaction(async (tx) => {
        const token = await tx.tokenRedefinicao.findUnique({
          where: { tokenHash: input.tokenHash },
          select: { usuarioId: true },
        });
        if (!token) return false;
        await lockUsuario(tx, token.usuarioId);
        const consumed = await tx.tokenRedefinicao.updateMany({
          where: { tokenHash: input.tokenHash, usadoEm: null, expiraEm: { gt: input.now } },
          data: { usadoEm: input.now },
        });
        if (consumed.count !== 1) return false;
        await tx.tokenRedefinicao.updateMany({
          where: { usuarioId: token.usuarioId, usadoEm: null },
          data: { usadoEm: input.now },
        });
        await tx.usuario.update({
          where: { id: token.usuarioId },
          data: { senhaHash: input.senhaHash, atualizadoEm: input.now },
        });
        await tx.sessao.deleteMany({ where: { usuarioId: token.usuarioId } });
        return true;
      });
    },

    /** Perfil (RF-004). E-mail já usado por outra conta -> `EmailTakenError`. */
    async updatePerfil(
      usuarioId: string,
      perfil: { nome: string; email: string },
      now: Date,
    ): Promise<UsuarioDto> {
      try {
        return await prisma.$transaction(async (tx) => {
          await lockUsuario(tx, usuarioId);
          const anterior = await tx.usuario.findUniqueOrThrow({
            where: { id: usuarioId },
            select: { email: true },
          });
          const usuario = await tx.usuario.update({
            where: { id: usuarioId },
            data: { nome: perfil.nome, email: perfil.email, atualizadoEm: now },
            select: usuarioDtoSelect,
          });
          if (anterior.email !== perfil.email) {
            await tx.tokenRedefinicao.updateMany({
              where: { usuarioId, usadoEm: null },
              data: { usadoEm: now },
            });
          }
          return toUsuarioDto(usuario);
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new EmailTakenError();
        throw error;
      }
    },

    /**
     * Apagar conta (RF-007): numa transação remove a fazenda do tenant (lotes, cenários e recria
     * saem em cascata) e o usuário (sessões em cascata). Tudo ou nada.
     */
    async deleteAccount(ctx: { usuarioId: string; fazendaId: string }): Promise<void> {
      await prisma.$transaction(async (tx) => {
        await tx.fazenda.deleteMany({ where: { id: ctx.fazendaId, donoId: ctx.usuarioId } });
        await tx.usuario.deleteMany({ where: { id: ctx.usuarioId } });
      });
    },

    /**
     * Perfil e fazenda do titular para a exportação (RNF-009). Seleção explícita: o hash da senha
     * só vira `temSenha`, e a identidade Google só vira `googleVinculado` (sem `sub` nem e-mail).
     */
    async loadTitularParaExportar(ctx: { usuarioId: string; fazendaId: string }) {
      const [usuario, fazenda] = await Promise.all([
        prisma.usuario.findUnique({
          where: { id: ctx.usuarioId },
          select: { ...usuarioDtoSelect, criadoEm: true },
        }),
        prisma.fazenda.findFirst({
          where: { id: ctx.fazendaId, donoId: ctx.usuarioId, deletedAt: null },
          select: { id: true, nome: true, areaHa: true, createdAt: true },
        }),
      ]);
      return usuario && fazenda ? { usuario, fazenda } : null;
    },

    async loadFazendaDoUsuario(usuarioId: string): Promise<FazendaRecord | null> {
      return prisma.fazenda.findFirst({
        where: { donoId: usuarioId, deletedAt: null },
        select: fazendaSelect,
      });
    },

    /**
     * Cadastro: Usuario + Fazenda + Sessao numa única transação (ADR-0010 c). Qualquer falha desfaz
     * tudo. Unicidade violada → `EmailTakenError` (e-mail) ou `IdConflictError` (id da fazenda).
     */
    async createAccount(input: {
      email: string;
      /** Nulo = conta criada pelo Google, sem senha (RF-001). */
      senhaHash: string | null;
      nome?: string | null;
      /** Identidade Google criada na mesma transação (entrada com Google). */
      google?: { sub: string };
      /** Versão dos termos aceita no cadastro por e-mail; ausente = sem aceite (Google). */
      aceiteTermosVersao?: string;
      fazendaId: string;
      session: NewSessionData;
      now: Date;
    }): Promise<{ usuario: UsuarioDto; fazenda: FazendaRecord }> {
      try {
        return await prisma.$transaction(async (tx) => {
          const usuario = await tx.usuario.create({
            data: {
              email: input.email,
              senhaHash: input.senhaHash,
              nome: input.nome ?? null,
              ...(input.aceiteTermosVersao
                ? { aceiteTermosVersao: input.aceiteTermosVersao, aceiteTermosEm: input.now }
                : {}),
              criadoEm: input.now,
              atualizadoEm: input.now,
            },
            select: usuarioDtoSelect,
          });
          if (input.google) {
            await tx.identidadeGoogle.create({
              data: {
                usuarioId: usuario.id,
                sub: input.google.sub,
                email: input.email,
                criadoEm: input.now,
              },
            });
          }
          const fazenda = await tx.fazenda.create({
            data: {
              id: input.fazendaId,
              donoId: usuario.id,
              createdAt: input.now,
              updatedAt: input.now,
            },
            select: fazendaSelect,
          });
          await tx.sessao.create({
            data: {
              id: input.session.id,
              segredoHash: input.session.segredoHash,
              usuarioId: usuario.id,
              criadaEm: input.session.criadaEm,
              ultimaVerificacaoEm: input.session.criadaEm,
              expiraEm: input.session.expiraEm,
            },
          });
          return {
            usuario: toUsuarioDto({
              ...usuario,
              identidadeGoogle: input.google ? { id: 'novo' } : null,
            }),
            fazenda,
          };
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Corrida de cadastro com o mesmo e-mail, ou colisão do id da fazenda?
        const existing = await prisma.usuario.findUnique({
          where: { email: input.email },
          select: { id: true },
        });
        throw existing ? new EmailTakenError() : new IdConflictError();
      }
    },
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
