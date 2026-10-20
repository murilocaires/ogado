import type { PrismaClient } from '@ogado/db';
import type { CenarioCreate } from '@ogado/contracts';
import type { TenantContext } from '../tenant';
import { IdConflictError } from './account-repository';
import { type WriteResult } from './sync';
import { withSyncWrite } from './sync-write';

export type CenarioRecord = NonNullable<Awaited<ReturnType<PrismaClient['cenario']['findFirst']>>>;

/** Repositório de Cenário (snapshot imutável; só o nome muda). Tudo escopado por `fazendaId`. */
export function createCenarioRepository(prisma: PrismaClient) {
  const leitura = cenarioOperations(prisma);
  return {
    ...leitura,
    create: (ctx: TenantContext, input: CenarioCreate, now = new Date()) =>
      withSyncWrite(prisma, ctx, now, (tx, stamp) =>
        cenarioOperations(tx).create(ctx, input, stamp),
      ),
    rename: (ctx: TenantContext, id: string, nome: string, version: number, now = new Date()) =>
      withSyncWrite(prisma, ctx, now, (tx, stamp) =>
        cenarioOperations(tx).rename(ctx, id, nome, version, stamp),
      ),
    softDelete: (ctx: TenantContext, id: string, version: number, now = new Date()) =>
      withSyncWrite(prisma, ctx, now, (tx, stamp) =>
        cenarioOperations(tx).softDelete(ctx, id, version, stamp),
      ),
  };
}

function cenarioOperations(prisma: Pick<PrismaClient, 'cenario'>) {
  const scope = (ctx: TenantContext, id: string) => ({ id, fazendaId: ctx.fazendaId });

  async function finish(
    ctx: TenantContext,
    id: string,
    count: number,
  ): Promise<WriteResult<CenarioRecord>> {
    const atual = await prisma.cenario.findFirst({ where: scope(ctx, id) });
    if (!atual) return { status: 'nao_encontrado' };
    if (count === 1) return { status: 'ok', record: atual };
    return atual.deletedAt ? { status: 'nao_encontrado' } : { status: 'conflito', atual };
  }

  return {
    async listPage(
      ctx: TenantContext,
      filtro: {
        cursor?: { updatedAt: string; id: string } | undefined;
        limit: number;
      },
    ): Promise<CenarioRecord[]> {
      const cursor = filtro.cursor;
      return prisma.cenario.findMany({
        where: {
          fazendaId: ctx.fazendaId,
          ...(cursor
            ? {
                OR: [
                  { updatedAt: { gt: new Date(cursor.updatedAt) } },
                  { updatedAt: new Date(cursor.updatedAt), id: { gt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: filtro.limit + 1,
      });
    },
    list(ctx: TenantContext, incluirExcluidos: boolean): Promise<CenarioRecord[]> {
      return prisma.cenario.findMany({
        where: { fazendaId: ctx.fazendaId, ...(incluirExcluidos ? {} : { deletedAt: null }) },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      });
    },

    findById(ctx: TenantContext, id: string): Promise<CenarioRecord | null> {
      return prisma.cenario.findFirst({ where: { ...scope(ctx, id), deletedAt: null } });
    },

    /** Idempotente pelo id do cliente; id de outra fazenda → `IdConflictError` (CA-15). */
    async create(
      ctx: TenantContext,
      input: CenarioCreate,
      now: Date = new Date(),
    ): Promise<{ record: CenarioRecord; created: boolean }> {
      const existente = await prisma.cenario.findFirst({ where: scope(ctx, input.id) });
      if (existente) return { record: existente, created: false };
      const { count } = await prisma.cenario.createMany({
        skipDuplicates: true,
        data: {
          id: input.id,
          fazendaId: ctx.fazendaId,
          nome: input.nome,
          criadoEm: new Date(input.criadoEm),
          entradas: input.entradas,
          variantes: input.variantes,
          parametros: input.parametros,
          resultado: input.resultado,
          createdAt: now,
          updatedAt: now,
        },
      });
      const meu = await prisma.cenario.findFirst({ where: scope(ctx, input.id) });
      if (meu) return { record: meu, created: count === 1 };
      throw new IdConflictError();
    },

    async rename(
      ctx: TenantContext,
      id: string,
      nome: string,
      version: number,
      now: Date = new Date(),
    ): Promise<WriteResult<CenarioRecord>> {
      const { count } = await prisma.cenario.updateMany({
        where: { ...scope(ctx, id), deletedAt: null, version },
        data: { nome, version: { increment: 1 }, updatedAt: now },
      });
      return finish(ctx, id, count);
    },

    async softDelete(
      ctx: TenantContext,
      id: string,
      version: number,
      now: Date = new Date(),
    ): Promise<WriteResult<CenarioRecord>> {
      const { count } = await prisma.cenario.updateMany({
        where: { ...scope(ctx, id), deletedAt: null, version },
        data: { deletedAt: now, version: { increment: 1 }, updatedAt: now },
      });
      return finish(ctx, id, count);
    },
  };
}

export type CenarioRepository = ReturnType<typeof createCenarioRepository>;
