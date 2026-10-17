import { z } from 'zod';

/** Contrato de GET /health (RNF-010): API e banco respondendo. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.literal('ok'),
});

/** Resposta 503 quando o banco não responde. */
export const healthErrorSchema = z.object({
  status: z.literal('error'),
  db: z.literal('down'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type HealthError = z.infer<typeof healthErrorSchema>;
