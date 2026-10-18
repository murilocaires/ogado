import type { PrismaClient } from '@ogado/db';
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
  senhaHash: string | null;
}

const fazendaSelect = {
  id: true,
  nome: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export function createAccountRepository(prisma: PrismaClient) {
  return {
    findUsuarioByEmail(email: string): Promise<UsuarioRecord | null> {
      return prisma.usuario.findUnique({
        where: { email },
        select: { id: true, email: true, senhaHash: true },
      });
    },

    async updateSenhaHash(usuarioId: string, senhaHash: string): Promise<void> {
      await prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash } });
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
      senhaHash: string;
      fazendaId: string;
      session: NewSessionData;
      now: Date;
    }): Promise<{ usuario: { id: string; email: string }; fazenda: FazendaRecord }> {
      try {
        return await prisma.$transaction(async (tx) => {
          const usuario = await tx.usuario.create({
            data: {
              email: input.email,
              senhaHash: input.senhaHash,
              criadoEm: input.now,
              atualizadoEm: input.now,
            },
            select: { id: true, email: true },
          });
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
          return { usuario, fazenda };
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
