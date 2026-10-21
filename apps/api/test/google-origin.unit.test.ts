import { afterAll, describe, expect, it } from 'vitest';
import { createPrisma } from '@bovaro/db';
import { buildApp } from '../src/app';
import { createFakeGoogleClient } from './support/fake-google';

// As rotas exercitadas não consultam banco nem Google. Nenhum segredo/serviço real é usado.
const prisma = createPrisma('postgresql://test:test@127.0.0.1:1/bovaro_test');
const app = buildApp({
  prisma,
  corsOrigins: ['https://canonical.example'],
  googleClient: createFakeGoogleClient().client,
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('RF-001 OAuth começa e termina na mesma origem', () => {
  it.each(['entrar', 'vincular'])(
    'navega do alias para a origem canônica antes de emitir cookie (%s)',
    async (modo) => {
      const result = await app.inject({
        method: 'GET',
        url: `/auth/google/start?modo=${modo}&origem=https%3A%2F%2Falias.example`,
      });
      expect(result.statusCode).toBe(302);
      const next = new URL(String(result.headers.location));
      expect(next.origin).toBe('https://canonical.example');
      expect(next.pathname).toBe('/api/auth/google/start');
      expect(next.searchParams.get('modo')).toBe(modo);
      expect(result.headers['set-cookie']).toBeUndefined();
    },
  );

  it('cria cookie de fluxo na origem canônica e mantém state/PKCE', async () => {
    const result = await app.inject({
      method: 'GET',
      url: '/auth/google/start?origem=https%3A%2F%2Fcanonical.example',
    });
    expect(result.statusCode).toBe(302);
    expect(String(result.headers['set-cookie'])).toContain('bovaro_google=');
    const target = new URL(String(result.headers.location));
    expect(target.searchParams.get('redirect_uri')).toBe(
      'https://canonical.example/api/auth/google/callback',
    );
    expect(target.searchParams.get('state')).toBeTruthy();
    expect(target.searchParams.get('code_challenge')).toBeTruthy();
  });

  it('origem não confiável nunca vira destino de redirecionamento', async () => {
    const result = await app.inject('/auth/google/start?origem=https%3A%2F%2Fevil.example');
    expect(new URL(String(result.headers.location)).origin).toBe('https://canonical.example');
  });
});
