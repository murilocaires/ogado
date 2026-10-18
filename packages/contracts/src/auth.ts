import { z } from 'zod';
import { PASSWORD_RULES } from './password-rules';

/** E-mail normalizado na borda: trim + minúsculas (ADR-0010 c). */
export const emailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(1, 'Informe o e-mail.')
      .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
      .pipe(z.email({ error: 'Informe um e-mail válido.' })),
  );

/** Senha nova (cadastro): aplica todas as regras e reporta cada uma que falhou, sem ecoar o valor. */
export const newPasswordSchema = z.string({ error: 'Informe a senha.' }).check((ctx) => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.ok(ctx.value)) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message: rule.mensagem,
        params: { regra: rule.id },
      });
    }
  }
});

/** Senha no login: só limita o tamanho (contas antigas não são reprovadas por regra de composição). */
export const loginPasswordSchema = z
  .string({ error: 'Informe a senha.' })
  .min(1, 'Informe a senha.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.');

export const signupRequestSchema = z.object({ email: emailSchema, senha: newPasswordSchema });
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({ email: emailSchema, senha: loginPasswordSchema });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const usuarioSchema = z.object({ id: z.uuid(), email: z.string() });
export type UsuarioDto = z.infer<typeof usuarioSchema>;
