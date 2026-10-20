import type { PrismaClient } from '@ogado/db';
import type { TenantContext } from '../tenant';

type SyncTransaction = Pick<PrismaClient, 'lote' | 'cenario' | '$queryRaw'>;

/** RF-074/RNF-017: ordem de commit por fazenda e relógio lógico persistido nos registros.
 * Reservar updatedAt antes de esperar uma escrita permite que o pull pule commits atrasados.
 * O lock só é liberado no commit; o próximo timestamp supera todos os já confirmados.
 */
export function withSyncWrite<T>(
  prisma: PrismaClient,
  ctx: TenantContext,
  now: Date,
  write: (tx: SyncTransaction, stamp: Date) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Fazenda" WHERE "id" = ${ctx.fazendaId} FOR UPDATE`;
    const [lote, cenario] = await Promise.all([
      tx.lote.aggregate({ where: { fazendaId: ctx.fazendaId }, _max: { updatedAt: true } }),
      tx.cenario.aggregate({ where: { fazendaId: ctx.fazendaId }, _max: { updatedAt: true } }),
    ]);
    const anterior = Math.max(
      lote._max.updatedAt?.getTime() ?? 0,
      cenario._max.updatedAt?.getTime() ?? 0,
    );
    return write(tx, new Date(Math.max(now.getTime(), anterior + 1)));
  });
}
