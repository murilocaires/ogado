import { z } from 'zod';

/** Códigos estáveis do envelope de erro (ADR-0010 e). A web decide o comportamento por eles. */
export const errorCodeSchema = z.enum([
  'validacao_invalida',
  'requisicao_invalida',
  'nao_autenticado',
  'sessao_expirada',
  'credenciais_invalidas',
  'requisicao_bloqueada',
  'nao_encontrado',
  'conflito',
  'muitas_tentativas',
  'erro_interno',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Detalhe de um campo inválido: caminho e regra que falhou, nunca o valor enviado. */
export const fieldErrorSchema = z.object({
  caminho: z.string(),
  regra: z.string(),
  mensagem: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Envelope único de erro da API: `{ erro: { codigo, mensagem } }`. Sem stack nem mensagem de ORM. */
export const errorEnvelopeSchema = z.object({
  erro: z.object({
    codigo: errorCodeSchema,
    mensagem: z.string(),
    campos: z.array(fieldErrorSchema).optional(),
    /** Só no 500, para suporte correlacionar com o log. */
    requestId: z.string().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
