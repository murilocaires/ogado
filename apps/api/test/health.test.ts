import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@bovaro/contracts';
import { createPrisma } from '@bovaro/db';
import { buildApp } from '../src/app.js';

// Integração com Postgres real (docker compose up -d postgres ou service do CI).
const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://ogado:ogado_dev@localhost:5432/ogado?schema=public';

const prisma = createPrisma(databaseUrl);
const app = buildApp({ prisma, corsOrigins: ['http://localhost:3000'] });

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('GET /health', () => {
  it('RNF-011: retorna {status:"ok", db:"ok"} após SELECT 1 no Postgres do compose', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json())).toEqual({ status: 'ok', db: 'ok' });
  });

  it('libera CORS para a origem da web configurada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('retorna 503 quando o banco não responde', async () => {
    const broken = buildApp({
      prisma: { $queryRaw: () => Promise.reject(new Error('db down')) } as never,
      corsOrigins: [],
    });
    const res = await broken.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'error', db: 'down' });
    await broken.close();
  });
});
