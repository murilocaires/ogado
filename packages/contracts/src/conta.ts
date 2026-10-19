import { z } from 'zod';
import { emailSchema, loginPasswordSchema, newPasswordSchema } from './auth';
import { baseVersionSchema } from './dados';
import { decimalStringSchema } from './decimal';

// E3 / T-18 (RF-004, RF-005, RF-007, RF-011): API da Conta. Um schema para API e telas.

/** PATCH /conta/perfil: nome obrigatório e e-mail válido (normalizado como no cadastro). */
export const perfilRequestSchema = z.strictObject({
  nome: z
    .string({ error: 'Informe o nome.' })
    .trim()
    .min(1, 'Informe o nome.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  email: emailSchema,
});
export type PerfilRequest = z.infer<typeof perfilRequestSchema>;

/**
 * PUT /conta/senha: `senhaAtual` é exigida só quando a conta já tem senha (a API decide);
 * a nova segue as regras do cadastro. A confirmação "igual à nova" é da tela.
 */
export const senhaRequestSchema = z.strictObject({
  senhaAtual: loginPasswordSchema.optional(),
  novaSenha: newPasswordSchema,
});
export type SenhaRequest = z.infer<typeof senhaRequestSchema>;

export const areaHaSchema = decimalStringSchema({
  rotulo: 'A área',
  precisao: 12,
  escala: 2,
});

/**
 * PATCH /fazenda: nome e área da fazenda da sessão, com versão-base (concorrência otimista,
 * ADR-0011 §4). `areaHa` omitido = não altera; `null` = limpa.
 */
export const fazendaPatchSchema = z.strictObject({
  nome: z
    .string({ error: 'Informe o nome da fazenda.' })
    .trim()
    .min(1, 'Informe o nome da fazenda.')
    .max(120, 'O nome da fazenda deve ter no máximo 120 caracteres.'),
  areaHa: areaHaSchema.nullable().optional(),
  version: baseVersionSchema,
});
export type FazendaPatch = z.infer<typeof fazendaPatchSchema>;

/** DELETE /conta: confirmação digitada ("deletar", RF-007). */
export const contaDeleteSchema = z.strictObject({
  confirmacao: z.literal('deletar', { error: 'Digite "deletar" para confirmar.' }),
});
export type ContaDelete = z.infer<typeof contaDeleteSchema>;
