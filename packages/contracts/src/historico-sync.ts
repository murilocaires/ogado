import { z } from 'zod';

const snapshot = z.record(z.string(), z.json());
export const historicoSyncCreateSchema = z
  .object({
    id: z.uuid(),
    entidadeId: z.uuid(),
    tipo: z.enum(['lote', 'cenario']),
    motivo: z.enum(['mesclagem', 'exclusao', 'sem-base']),
    local: snapshot,
    servidor: snapshot,
    resultado: snapshot,
  })
  .refine((v) => [v.local, v.servidor, v.resultado].every((s) => s['id'] === v.entidadeId), {
    message: 'As versoes devem pertencer ao mesmo registro.',
  });
export const historicoSyncSchema = historicoSyncCreateSchema.safeExtend({
  criadoEm: z.iso.datetime(),
});
export const historicoSyncListQuerySchema = z.object({
  entidadeId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export const historicoSyncListSchema = z.object({ registros: z.array(historicoSyncSchema) });
export type HistoricoSyncCreate = z.infer<typeof historicoSyncCreateSchema>;
export type HistoricoSync = z.infer<typeof historicoSyncSchema>;
