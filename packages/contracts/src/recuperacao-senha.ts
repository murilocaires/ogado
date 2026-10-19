import { z } from 'zod';
import { emailSchema, newPasswordSchema } from './auth';

// RF-002 (ADR-0010): recuperação de senha por e-mail. Um schema para API e telas.

/** POST /auth/senha/esqueci: só o e-mail. A resposta é sempre a mesma, exista a conta ou não. */
export const esqueciSenhaRequestSchema = z.strictObject({ email: emailSchema });
export type EsqueciSenhaRequest = z.infer<typeof esqueciSenhaRequestSchema>;

/** 202 neutro: nunca diz se o e-mail tem conta. */
export const esqueciSenhaResponseSchema = z.strictObject({ mensagem: z.string() });
export type EsqueciSenhaResponse = z.infer<typeof esqueciSenhaResponseSchema>;

export const ESQUECI_SENHA_MENSAGEM =
  'Se este e-mail tiver uma conta, enviaremos um link para redefinir a senha. O link vale por 1 hora.';

/**
 * POST /auth/senha/redefinir: o token do link e a nova senha (mesmas regras do cadastro).
 * O token não tem regra de formato de propósito: qualquer valor inválido cai no mesmo erro genérico.
 */
export const redefinirSenhaRequestSchema = z.strictObject({
  token: z
    .string({ error: 'Link inválido ou expirado.' })
    .min(1, 'Link inválido ou expirado.')
    .max(512, 'Link inválido ou expirado.'),
  novaSenha: newPasswordSchema,
});
export type RedefinirSenhaRequest = z.infer<typeof redefinirSenhaRequestSchema>;
