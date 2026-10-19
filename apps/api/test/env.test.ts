import { hash } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';
import { configFromEnv } from '../src/config';
import { loadEnv, parseOrigins } from '../src/env';
import { createPasswordHasher } from '../src/password';

const base = { DATABASE_URL: 'postgresql://x:y@localhost:5432/db' };

describe('NODE_ENV falha fechado (RNF-003)', () => {
  it.each(['production', 'staging', 'prod', 'PRODUCTION', 'qualquer-coisa'])(
    'NODE_ENV=%s liga o modo de produção (cookie Secure/__Host-, HSTS)',
    (nodeEnv) => {
      const env = loadEnv({ ...base, NODE_ENV: nodeEnv, TRUST_PROXY: 'none' });
      expect(configFromEnv(env).production).toBe(true);
    },
  );

  it.each(['development', 'test'])('NODE_ENV=%s não é produção', (nodeEnv) => {
    expect(configFromEnv(loadEnv({ ...base, NODE_ENV: nodeEnv })).production).toBe(false);
  });

  it('NODE_ENV ausente (ou vazio) falha na subida em vez de cair em development', () => {
    expect(() => loadEnv({ ...base })).toThrow();
    expect(() => loadEnv({ ...base, NODE_ENV: '' })).toThrow();
  });
});

describe('TRUST_PROXY em produção', () => {
  it('sem TRUST_PROXY (ou vazio) em produção falha na subida', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/TRUST_PROXY/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', TRUST_PROXY: ' ' })).toThrow(
      /TRUST_PROXY/,
    );
  });

  it('TRUST_PROXY=none explícito não confia em proxy algum', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'production', TRUST_PROXY: 'none' });
    expect(env.TRUST_PROXY).toEqual([]);
  });

  it('IP/CIDR do proxy é aceito em produção', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'production', TRUST_PROXY: '10.0.0.0/8, 172.16.0.1' });
    expect(env.TRUST_PROXY).toEqual(['10.0.0.0/8', '172.16.0.1']);
  });

  it('fora de produção TRUST_PROXY pode faltar', () => {
    expect(loadEnv({ ...base, NODE_ENV: 'development' }).TRUST_PROXY).toEqual([]);
  });
});

describe('WEB_ORIGIN', () => {
  it('normaliza para a origem exata (sem barra final, caminho nem caixa)', () => {
    expect(parseOrigins('http://localhost:3000/, HTTPS://App.Exemplo.com/painel?x=1')).toEqual([
      'http://localhost:3000',
      'https://app.exemplo.com',
    ]);
  });

  it('valor que não é URL falha na subida', () => {
    expect(() => parseOrigins('localhost:3000,nao-e-url')).toThrow();
  });
});

describe('PasswordHasher', () => {
  const params = { memoryKiB: 19456, timeCost: 2, parallelism: 1 };

  it('needsRehash é verdadeiro para hash que não é argon2id, mesmo com parâmetros fortes', async () => {
    const argon2i = await hash('Boi#Gordo2026', {
      algorithm: 1, // Argon2i
      memoryCost: params.memoryKiB,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
    });
    const hasher = createPasswordHasher(params);
    expect(hasher.needsRehash(argon2i)).toBe(true);
    expect(hasher.needsRehash(await hasher.hash('Boi#Gordo2026'))).toBe(false);
  });
});

describe('porta da plataforma (deploy)', () => {
  it('RNF-003: usa PORT quando API_PORT não está definido; API_PORT explícito tem prioridade', () => {
    expect(loadEnv({ ...base, NODE_ENV: 'test', PORT: '8080' }).API_PORT).toBe(8080);
    expect(loadEnv({ ...base, NODE_ENV: 'test', PORT: '8080', API_PORT: '4000' }).API_PORT).toBe(
      4000,
    );
    expect(loadEnv({ ...base, NODE_ENV: 'test' }).API_PORT).toBe(3001);
  });
});

describe('e-mail transacional (RF-002)', () => {
  it('sem RESEND_API_KEY a API sobe normalmente, inclusive em produção', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'production', TRUST_PROXY: 'none' });
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it('RESEND_API_KEY sem EMAIL_FROM falha na subida', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'development', RESEND_API_KEY: 're_x' })).toThrow(
      /EMAIL_FROM/,
    );
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      RESEND_API_KEY: 're_x',
      EMAIL_FROM: 'O Gado <nao-responda@ogado.example>',
    });
    expect(env.EMAIL_FROM).toContain('ogado.example');
  });
});
