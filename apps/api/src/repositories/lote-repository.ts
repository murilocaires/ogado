import type { PrismaClient } from '@ogado/db';
import type { LoteCreate, LotePatch, LoteTipo } from '@ogado/contracts';
import type { TenantContext } from '../tenant';
import { IdConflictError } from './account-repository';
import { isUniqueViolation, type WriteResult } from './sync';

export type LoteRecord = NonNullable<Awaited<ReturnType<PrismaClient['lote']['findFirst']>>>;

const MAX_NUMERO_RETRIES = 5;

function toDate(data: string | null): Date | null {
  return data === null ? null : new Date(`${data}T00:00:00.000Z`);
}

/**
 * Repositório de Lote. Toda consulta filtra por `fazendaId` do tenant (RNF-004); lote de outra
 * fazenda é indistinguível de inexistente. O número é do servidor: max+1 por fazenda+tipo (lápides
 * contam, então nunca se reutiliza), protegido pela unicidade (fazendaId, tipo, numero).
 */
export function createLoteRepository(prisma: PrismaClient) {
  const scope = (ctx: TenantContext, id: string) => ({ id, fazendaId: ctx.fazendaId });

  async function finish(
    ctx: TenantContext,
    id: string,
    count: number,
  ): Promise<WriteResult<LoteRecord>> {
    const atual = await prisma.lote.findFirst({ where: scope(ctx, id) });
    if (!atual) return { status: 'nao_encontrado' };
    if (count === 1) return { status: 'ok', record: atual };
    // não gravou: lápide = inexistente; senão a versão-base divergiu
    return atual.deletedAt ? { status: 'nao_encontrado' } : { status: 'conflito', atual };
  }

  return {
    list(
      ctx: TenantContext,
      filtro: { tipo?: LoteTipo | undefined; incluirExcluidos: boolean },
    ): Promise<LoteRecord[]> {
      return prisma.lote.findMany({
        where: {
          fazendaId: ctx.fazendaId,
          ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
          ...(filtro.incluirExcluidos ? {} : { deletedAt: null }),
        },
        orderBy: [{ tipo: 'asc' }, { numero: 'asc' }, { id: 'asc' }],
      });
    },

    findById(ctx: TenantContext, id: string): Promise<LoteRecord | null> {
      return prisma.lote.findFirst({ where: { ...scope(ctx, id), deletedAt: null } });
    },

    /**
     * Idempotente pelo id do cliente: repetir devolve o mesmo lote (`created: false`), sem aplicar
     * o corpo de novo. Id de outra fazenda → `IdConflictError` (sem revelar o dono, CA-15).
     */
    async create(
      ctx: TenantContext,
      input: LoteCreate,
      now: Date = new Date(),
    ): Promise<{ record: LoteRecord; created: boolean }> {
      for (let tentativa = 0; tentativa < MAX_NUMERO_RETRIES; tentativa++) {
        const existente = await prisma.lote.findFirst({ where: scope(ctx, input.id) });
        if (existente) return { record: existente, created: false };

        const ultimo = await prisma.lote.aggregate({
          where: { fazendaId: ctx.fazendaId, tipo: input.tipo },
          _max: { numero: true },
        });
        try {
          const record = await prisma.lote.create({
            data: {
              id: input.id,
              fazendaId: ctx.fazendaId,
              tipo: input.tipo,
              numero: (ultimo._max.numero ?? 0) + 1,
              categoria: input.categoria,
              data: toDate(input.data),
              modo: input.modo,
              qtd: input.qtd,
              peso: input.peso,
              pesos: input.pesos,
              preco: input.preco,
              base: input.base,
              aplicarDesconto: input.aplicarDesconto,
              desconto: input.desconto,
              createdAt: now,
              updatedAt: now,
            },
          });
          return { record, created: true };
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          const noutra = await prisma.lote.findUnique({
            where: { id: input.id },
            select: { fazendaId: true },
          });
          if (noutra) {
            // corrida da mesma requisição repetida (nossa) ou colisão de UUID com outra fazenda
            const meu = await prisma.lote.findFirst({ where: scope(ctx, input.id) });
            if (meu) return { record: meu, created: false };
            throw new IdConflictError();
          }
          // senão: outro lote do mesmo tipo pegou o número; recalcula e tenta de novo
        }
      }
      throw new Error('numero_de_lote_indisponivel');
    },

    async update(
      ctx: TenantContext,
      id: string,
      patch: LotePatch,
      now: Date = new Date(),
    ): Promise<WriteResult<LoteRecord>> {
      const { version, data, ...resto } = patch;
      const { count } = await prisma.lote.updateMany({
        where: { ...scope(ctx, id), deletedAt: null, version },
        data: {
          ...resto,
          ...(data !== undefined ? { data: toDate(data) } : {}),
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      return finish(ctx, id, count);
    },

    /** Lápide: `deletedAt`, `version` + 1, `updatedAt`. Só com a versão-base correta. */
    async softDelete(
      ctx: TenantContext,
      id: string,
      version: number,
      now: Date = new Date(),
    ): Promise<WriteResult<LoteRecord>> {
      const { count } = await prisma.lote.updateMany({
        where: { ...scope(ctx, id), deletedAt: null, version },
        data: { deletedAt: now, version: { increment: 1 }, updatedAt: now },
      });
      return finish(ctx, id, count);
    },
  };
}

export type LoteRepository = ReturnType<typeof createLoteRepository>;
