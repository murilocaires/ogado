import { describe, expect, it } from 'vitest';
import { signupRequestSchema, loginRequestSchema, type ErrorEnvelope } from './index';

const ok = { email: 'ana@exemplo.com', senha: 'Boi#2026a' };

function failedRules(senha: string): string[] {
  const r = signupRequestSchema.safeParse({ email: ok.email, senha });
  if (r.success) return [];
  return r.error.issues.map((i) => String((i as { params?: { regra?: string } }).params?.regra));
}

describe('signupRequestSchema', () => {
  it('RF-001 CA-06: aceita senha com 8+ caracteres, maiúscula, número e símbolo', () => {
    expect(signupRequestSchema.safeParse(ok).success).toBe(true);
  });

  it('RF-001 CA-06: limite inferior (8) e superior (128) são aceitos', () => {
    expect(signupRequestSchema.safeParse({ ...ok, senha: 'Abcde1!x' }).success).toBe(true);
    const noLimite = 'A1!' + 'a'.repeat(125);
    expect(noLimite).toHaveLength(128);
    expect(signupRequestSchema.safeParse({ ...ok, senha: noLimite }).success).toBe(true);
  });

  it.each([
    ['curta', 'Ab1!xyz', ['minimo']],
    ['sem maiúscula', 'boi#2026a', ['maiuscula']],
    ['sem número', 'Boi#Gadoa', ['numero']],
    ['sem símbolo', 'Boi2026ab', ['simbolo']],
    ['longa demais', 'A1!' + 'a'.repeat(126), ['maximo']],
    ['só minúsculas', 'abcdefgh', ['maiuscula', 'numero', 'simbolo']],
  ])('RF-001 CA-06: reprova senha %s e indica a regra', (_nome, senha, regras) => {
    expect(failedRules(senha)).toEqual(regras);
  });

  it('RF-001 CA-06: mensagens em pt-BR não ecoam a senha', () => {
    const senha = 'segredosecreto';
    const r = signupRequestSchema.safeParse({ email: ok.email, senha });
    expect(r.success).toBe(false);
    if (!r.success) {
      for (const issue of r.error.issues) expect(issue.message).not.toContain(senha);
      expect(r.error.issues.map((i) => i.message)).toContain(
        'A senha deve ter pelo menos uma letra maiúscula.',
      );
    }
  });

  it('RF-001 CA-02: normaliza o e-mail (trim + minúsculas)', () => {
    const r = signupRequestSchema.parse({ ...ok, email: '  Ana@Exemplo.COM ' });
    expect(r.email).toBe('ana@exemplo.com');
  });

  it('RF-001: rejeita e-mail inválido', () => {
    expect(signupRequestSchema.safeParse({ ...ok, email: 'sem-arroba' }).success).toBe(false);
  });
});

describe('loginRequestSchema', () => {
  it('RF-001: no login só exige senha não vazia e até 128', () => {
    expect(loginRequestSchema.safeParse({ email: ok.email, senha: 'qualquer' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: ok.email, senha: '' }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: ok.email, senha: 'a'.repeat(129) }).success).toBe(
      false,
    );
  });
});

describe('ErrorEnvelope', () => {
  it('tipo exportado para a web', () => {
    const e: ErrorEnvelope = {
      erro: { codigo: 'nao_autenticado', mensagem: 'Entre para continuar.' },
    };
    expect(e.erro.codigo).toBe('nao_autenticado');
  });
});
