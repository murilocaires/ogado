import { describe, expect, it } from 'vitest';
import { signupRequestSchema, loginRequestSchema, type ErrorEnvelope } from './index';

const ok = { email: 'ana@exemplo.com', senha: 'Boi#2026a', aceiteTermos: true };

function failedRules(senha: string): string[] {
  const r = signupRequestSchema.safeParse({ ...ok, senha });
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

  it.each(['_', '@', '!', '#', '$', '%', '-', '.', '+', '~'])(
    'RF-001 CA-06: aceita "%s" como símbolo',
    (simbolo) => {
      expect(failedRules(`Boi2026ab${simbolo}`)).toEqual([]);
    },
  );

  it.each([
    ['emoji', 'Boi2026ab🐂'],
    ['espaço', 'Boi 2026ab'],
    ['acento', 'Boi2026abé'],
  ])('RF-001 CA-06: %s não conta como símbolo', (_nome, senha) => {
    expect(failedRules(senha)).toEqual(['simbolo']);
  });

  it('RF-001 CA-06: mensagens em pt-BR não ecoam a senha', () => {
    const senha = 'segredosecreto';
    const r = signupRequestSchema.safeParse({ ...ok, senha });
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

describe('signupRequestSchema · aceite dos termos (RNF-009)', () => {
  it('sem aceiteTermos, ou com false, reprova com mensagem clara em aceiteTermos', () => {
    for (const corpo of [
      { email: ok.email, senha: ok.senha },
      { ...ok, aceiteTermos: false },
    ]) {
      const r = signupRequestSchema.safeParse(corpo);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.map((i) => i.path[0])).toEqual(['aceiteTermos']);
        expect(r.error.issues[0]?.message).toMatch(/Aceite os Termos de Uso/);
      }
    }
  });

  it('recusa chaves desconhecidas (strict)', () => {
    expect(signupRequestSchema.safeParse({ ...ok, admin: true }).success).toBe(false);
  });
});
