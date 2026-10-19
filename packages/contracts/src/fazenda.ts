import { z } from 'zod';

/**
 * Fazenda (tenant), com a convenção de entidade sincronizável do ADR-0007:
 * `id` UUID, `version` incrementada só pelo servidor, `updatedAt` do relógio do servidor
 * (ISO 8601, ms) e `deletedAt` (lápide).
 */
export const fazendaSchema = z.object({
  id: z.uuid(),
  nome: z.string().nullable(),
  /** Área em hectares (RF-011), string decimal canônica. */
  areaHa: z.string().nullable(),
  version: z.number().int().min(1),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type FazendaDto = z.infer<typeof fazendaSchema>;

export const fazendaListResponseSchema = z.object({ fazendas: z.array(fazendaSchema) });
export type FazendaListResponse = z.infer<typeof fazendaListResponseSchema>;

export const fazendaIdParamsSchema = z.object({
  id: z.uuid('O identificador da fazenda é inválido.'),
});
