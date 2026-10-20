import type { PrismaClient } from '@ogado/db';
import type { HistoricoSyncCreate } from '@ogado/contracts';
import type { TenantContext } from '../tenant';

export type HistoricoSyncRecord = NonNullable<
  Awaited<ReturnType<PrismaClient['historicoSync']['findFirst']>>
>;
export function createHistoricoSyncRepository(prisma: PrismaClient) {
  return {
    async create(
      ctx: TenantContext,
      body: HistoricoSyncCreate,
    ): Promise<HistoricoSyncRecord | null> {
      const { fazendaId } = ctx;
      const where = { id: body.entidadeId, fazendaId };
      const existe =
        body.tipo === 'lote'
          ? await prisma.lote.findFirst({ where, select: { id: true } })
          : await prisma.cenario.findFirst({ where, select: { id: true } });
      if (!existe) return null;
      return prisma.historicoSync.upsert({
        where: { fazendaId_id: { fazendaId, id: body.id } },
        create: { ...body, fazendaId },
        update: {},
      });
    },
    list(ctx: TenantContext, query: { entidadeId?: string | undefined; offset: number }) {
      return prisma.historicoSync.findMany({
        where: {
          fazendaId: ctx.fazendaId,
          ...(query.entidadeId ? { entidadeId: query.entidadeId } : {}),
        },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: 100,
        skip: query.offset,
      });
    },
    find(ctx: TenantContext, id: string) {
      return prisma.historicoSync.findFirst({ where: { fazendaId: ctx.fazendaId, id } });
    },
  };
}
export type HistoricoSyncRepository = ReturnType<typeof createHistoricoSyncRepository>;
