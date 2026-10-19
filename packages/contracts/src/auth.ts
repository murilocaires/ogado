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

/**
 * Cadastro por e-mail (RF-001, RNF-009): exige o aceite explícito dos Termos de Uso e da Política
 * de Privacidade. A API grava a versão vigente (`TERMOS_VERSAO`); o cliente só diz "aceitei".
 */
export const signupRequestSchema = z.strictObject({
  email: emailSchema,
  senha: newPasswordSchema,
  aceiteTermos: z.literal(true, {
    error: 'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.',
  }),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({ email: emailSchema, senha: loginPasswordSchema });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const usuarioSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  /** Nome de exibição (RF-004); nulo até o usuário preencher. */
  nome: z.string().nullable(),
  /** Selo "Senha definida" (RF-006): falso para conta criada só com Google. */
  temSenha: z.boolean(),
  /** Selo "Google vinculado" (RF-006). */
  googleVinculado: z.boolean(),
  /** RNF-009: a versão aceita é a vigente (`TERMOS_VERSAO`)? Falso = a web bloqueia até aceitar. */
  aceiteVigente: z.boolean(),
  /** Versão dos termos que o usuário aceitou (AAAA-MM-DD); nulo = nunca aceitou. */
  aceiteTermosVersao: z.string().nullable(),
  /** Quando aceitou (ISO 8601); nulo = nunca aceitou. */
  aceiteTermosEm: z.iso.datetime().nullable(),
});
export type UsuarioDto = z.infer<typeof usuarioSchema>;
