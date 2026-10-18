/**
 * Regras de senha (RF-001, ADR-0010 Q1). Fonte única: a API valida com elas e a tela as lista
 * antes do envio. Mínimo 8, máximo 128; ao menos 1 maiúscula, 1 número e 1 símbolo.
 * Símbolo = pontuação ou símbolo Unicode (\p{P}, \p{S}); espaço não conta como símbolo.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRuleId = 'minimo' | 'maximo' | 'maiuscula' | 'numero' | 'simbolo';

export interface PasswordRule {
  readonly id: PasswordRuleId;
  /** Mensagem em pt-BR dizendo o que falta (nunca ecoa a senha). */
  readonly mensagem: string;
  readonly ok: (senha: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'minimo',
    mensagem: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    ok: (senha) => senha.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'maximo',
    mensagem: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    ok: (senha) => senha.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'maiuscula',
    mensagem: 'A senha deve ter pelo menos uma letra maiúscula.',
    ok: (senha) => /\p{Lu}/u.test(senha),
  },
  {
    id: 'numero',
    mensagem: 'A senha deve ter pelo menos um número.',
    ok: (senha) => /[0-9]/.test(senha),
  },
  {
    id: 'simbolo',
    mensagem: 'A senha deve ter pelo menos um símbolo (por exemplo ! ? # @ $ %).',
    ok: (senha) => /[\p{P}\p{S}]/u.test(senha),
  },
];

/** Regras que a senha não cumpre (lista vazia = senha válida). */
export function failedPasswordRules(senha: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.ok(senha));
}
