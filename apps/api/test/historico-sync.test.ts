import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { buildTestApp, prisma, signup } from './support/harness';
import { TEST_ORIGIN } from './support/env';
import { historicoSyncSchema, historicoSyncListSchema } from '@ogado/contracts';
const app = buildTestApp();
beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
it('arquiva de forma idempotente e recupera as versoes mesmo apos excluir o lote', async () => {
  const { cookie } = await signup(app);
  const headers = { cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' };
  const entidadeId = randomUUID();
  const criado = await app.inject({
    method: 'POST',
    url: '/lotes',
    headers,
    payload: {
      id: entidadeId,
      tipo: 'compra',
      categoria: 'BOI',
      modo: 'total',
      qtd: '10',
      peso: '2000',
      preco: '300',
    },
  });
  expect(criado.statusCode).toBe(201);
  const registro = {
    id: randomUUID(),
    entidadeId,
    tipo: 'lote',
    motivo: 'mesclagem',
    local: { id: entidadeId, qtd: '99', preco: '300' },
    servidor: { id: entidadeId, qtd: '50', preco: '300' },
    resultado: { id: entidadeId, qtd: '99', preco: '300' },
  };
  for (let i = 0; i < 2; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/historico-sync',
      headers,
      payload: registro,
    });
    expect(res.statusCode).toBe(200);
    expect(historicoSyncSchema.parse(res.json()).servidor['qtd']).toBe('50');
  }
  await app.inject({ method: 'DELETE', url: `/lotes/${entidadeId}?version=1`, headers });
  const lista = await app.inject({
    method: 'GET',
    url: `/historico-sync?entidadeId=${entidadeId}`,
    headers: { cookie },
  });
  expect(historicoSyncListSchema.parse(lista.json()).registros).toHaveLength(1);
  const res = await app.inject({
    method: 'GET',
    url: `/historico-sync/${registro.id}`,
    headers: { cookie },
  });
  expect(historicoSyncSchema.parse(res.json()).local['qtd']).toBe('99');
  expect(res.body).not.toContain('fazendaId');
});
