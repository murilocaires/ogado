import { z } from 'zod';
import { fazendaSchema } from './fazenda';
import { usuarioSchema } from './auth';

/** Resposta de cadastro (201), login (200) e GET /auth/session: usuário e fazenda, sem hash nem token. */
export const sessionResponseSchema = z.object({
  usuario: usuarioSchema,
  fazenda: fazendaSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
