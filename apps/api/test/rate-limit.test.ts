import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema } from '@ogado/contracts';
import { buildTestApp, postJson, prisma, uniqueEmail, VALID_PASSWORD } from './support/harness';

// Limites reais (sem o relaxamento da suíte): o IP é fixado por teste para não interferir entre si.
const app = buildTestApp({ relaxedLimits: false });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('rate limit', () => {
  it('RNF-003 CA-16: a 6ª tentativa de login em 1 minuto para o mesmo IP + e-mail responde 429 muitas_tentativas com Retry-After', async () => {
    const ip = '10.1.0.1';
    const email = uniqueEmail();
    for (let i = 1; i <= 5; i++) {
      const res = await postJson(
        app,
        '/auth/login',
        { email, senha: 'Errada#123' },
        { remoteAddress: ip },
      );
      expect(res.statusCode, `tentativa ${i}`).toBe(401);
    }

    const sexta = await postJson(
      app,
      '/auth/login',
      { email, senha: 'Errada#123' },
      { remoteAddress: ip },
    );
    expect(sexta.statusCode).toBe(429);
    expect(errorEnvelopeSchema.parse(sexta.json()).erro.codigo).toBe('muitas_tentativas');
    expect(Number(sexta.headers['retry-after'])).toBeGreaterThan(0);

    // outro e-mail, mesmo IP: a chave composta ainda não estourou
    const outro = await postJson(
      app,
      '/auth/login',
      { email: uniqueEmail(), senha: 'Errada#123' },
      { remoteAddress: ip },
    );
    expect(outro.statusCode).toBe(401);
  });

  it('RNF-003 CA-16: o limite só por IP (20/min) vale para e-mails diferentes', async () => {
    const ip = '10.1.0.2';
    for (let i = 1; i <= 20; i++) {
      const res = await postJson(
        app,
        '/auth/login',
        { email: uniqueEmail(), senha: 'Errada#123' },
        { remoteAddress: ip },
      );
      expect(res.statusCode, `tentativa ${i}`).toBe(401);
    }
    const vigesimaPrimeira = await postJson(
      app,
      '/auth/login',
      { email: uniqueEmail(), senha: 'Errada#123' },
      { remoteAddress: ip },
    );
    expect(vigesimaPrimeira.statusCode).toBe(429);
  });

  it('RNF-003 CA-16: o cadastro tem limite por IP (5/h) e a 6ª tentativa responde 429', async () => {
    const ip = '10.1.0.3';
    for (let i = 1; i <= 5; i++) {
      const res = await postJson(
        app,
        '/auth/signup',
        { email: uniqueEmail(), senha: VALID_PASSWORD, aceiteTermos: true },
        { remoteAddress: ip },
      );
      expect(res.statusCode, `cadastro ${i}`).toBe(201);
    }
    const sexta = await postJson(
      app,
      '/auth/signup',
      { email: uniqueEmail(), senha: VALID_PASSWORD, aceiteTermos: true },
      { remoteAddress: ip },
    );
    expect(sexta.statusCode).toBe(429);
    expect(errorEnvelopeSchema.parse(sexta.json()).erro.codigo).toBe('muitas_tentativas');
    expect(Number(sexta.headers['retry-after'])).toBeGreaterThan(0);
  });
});
