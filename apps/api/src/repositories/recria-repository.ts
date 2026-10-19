import type { PrismaClient } from '@ogado/db';
import type { RecriaEntradaPut } from '@ogado/contracts';
import type { TenantContext } from '../tenant';
import { IdConflictError } from './account-repository';
import { isUniqueViolation } from './sync';

export type RecriaEntradaRecord = NonNullable<
  Awaited<ReturnType<PrismaClient['recriaEntrada']['findFirst']>>
>;

export type PutResult =
  | { status: 'ok'; record: RecriaEntradaRecord; created: boolean }
  | { status: 'conflito'; atual: RecriaEntradaRecord };

/** Entradas da recria: um registro por fazenda. Escopo sempre por `fazendaId` do tenant. */
export function createRecriaRepository(prisma: PrismaClient) {
  const mine = (ctx: TenantContext) => ({ fazendaId: ctx.fazendaId });

  return {
    get(ctx: TenantContext): Promise<RecriaEntradaRecord | null> {
      return prisma.recriaEntrada.findFirst({ where: mine(ctx) });
    },

    /**
     * Sem registro: cria com o id do cliente. Com registro: só grava se `id` e `version` batem;
     * senão 409 com o atual. Id já usado por outra fazenda → `IdConflictError` (sem vazar).
     */
    async put(
      ctx: TenantContext,
      input: RecriaEntradaPut,
      now: Date = new Date(),
    ): Promise<PutResult> {
      const atual = await prisma.recriaEntrada.findFirst({ where: mine(ctx) });
      if (!atual) {
        try {
          const record = await prisma.recriaEntrada.create({
            data: {
              id: input.id,
              fazendaId: ctx.fazendaId,
              entradas: input.entradas,
              lotacaoInicial: input.lotacaoInicial,
              createdAt: now,
              updatedAt: now,
            },
          });
          return { status: 'ok', record, created: true };
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          const corrida = await prisma.recriaEntrada.findFirst({ where: mine(ctx) });
          if (corrida) return { status: 'conflito', atual: corrida };
          throw new IdConflictError();
        }
      }
      if (input.id !== atual.id || input.version !== atual.version) {
        return { status: 'conflito', atual };
      }
      const { count } = await prisma.recriaEntrada.updateMany({
        where: { id: atual.id, ...mine(ctx), version: atual.version },
        data: {
          entradas: input.entradas,
          lotacaoInicial: input.lotacaoInicial,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      const depois = await prisma.recriaEntrada.findFirst({ where: mine(ctx) });
      if (!depois) throw new Error('entrada da recria desapareceu');
      return count === 1
        ? { status: 'ok', record: depois, created: false }
        : { status: 'conflito', atual: depois };
    },
  };
}

export type RecriaRepository = ReturnType<typeof createRecriaRepository>;
