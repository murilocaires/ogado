import type { PrismaClient } from '@ogado/db';
import type { TenantContext } from '../tenant';

export interface FazendaRecord {
  id: string;
  nome: string | null;
  version: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

const select = { id: true, nome: true, version: true, updatedAt: true, deletedAt: true } as const;

/**
 * Repositório da Fazenda (ADR-0010 d). Todo método exige o contexto de tenant e escopa a consulta
 * por ele (id + dono), inclusive update/delete. Registro de outra fazenda = `null` (vira 404).
 * A Fazenda é o próprio tenant: o escopo é `id === ctx.fazendaId`.
 */
export function createFazendaRepository(prisma: PrismaClient) {
  return {
    async list(ctx: TenantContext): Promise<FazendaRecord[]> {
      return prisma.fazenda.findMany({
        where: { id: ctx.fazendaId, donoId: ctx.usuarioId, deletedAt: null },
        select,
      });
    },

    async findById(ctx: TenantContext, id: string): Promise<FazendaRecord | null> {
      if (id !== ctx.fazendaId) return null;
      return prisma.fazenda.findFirst({
        where: { id: ctx.fazendaId, donoId: ctx.usuarioId, deletedAt: null },
        select,
      });
    },

    /**
     * Mutação aceita: `version` + 1 e `updatedAt` do relógio do servidor. O cliente não escolhe
     * nenhum dos dois (o tipo de entrada nem aceita `updatedAt`/`version`).
     */
    async update(
      ctx: TenantContext,
      id: string,
      changes: { nome: string | null },
      now: Date = new Date(),
    ): Promise<FazendaRecord | null> {
      if (id !== ctx.fazendaId) return null;
      const where = { id: ctx.fazendaId, donoId: ctx.usuarioId, deletedAt: null };
      const { count } = await prisma.fazenda.updateMany({
        where,
        data: { nome: changes.nome, version: { increment: 1 }, updatedAt: now },
      });
      if (count === 0) return null;
      return prisma.fazenda.findFirst({ where, select });
    },

    /** Exclusão lógica (lápide): preenche `deletedAt`, avança `version` e `updatedAt`. */
    async softDelete(ctx: TenantContext, id: string, now: Date = new Date()): Promise<boolean> {
      if (id !== ctx.fazendaId) return false;
      const { count } = await prisma.fazenda.updateMany({
        where: { id: ctx.fazendaId, donoId: ctx.usuarioId, deletedAt: null },
        data: { deletedAt: now, version: { increment: 1 }, updatedAt: now },
      });
      return count > 0;
    },
  };
}

export type FazendaRepository = ReturnType<typeof createFazendaRepository>;
