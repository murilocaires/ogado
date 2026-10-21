import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, expect, it } from 'vitest';
import type { PrismaClient } from '@bovaro/db';
import { registerHistoricoSyncRoutes } from '../src/routes/historico-sync';
import {
  createHistoricoSyncRepository,
  type HistoricoSyncRecord,
} from '../src/repositories/historico-sync-repository';
import { registerErrorHandling } from '../src/plugins/error-handler';
const farm = '00000000-0000-4000-8000-000000000001';
const outro = '00000000-0000-4000-8000-000000000002';
const entidadeId = '00000000-0000-4000-8000-000000000003';
const id = '00000000-0000-4000-8000-000000000004';
const evento = {
  id,
  entidadeId,
  tipo: 'lote',
  motivo: 'mesclagem',
  local: { id: entidadeId, qtd: '99' },
  servidor: { id: entidadeId, qtd: '50' },
  resultado: { id: entidadeId, qtd: '99' },
};
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
function montar() {
  const registros = new Map<string, HistoricoSyncRecord>();
  const prisma = {
    lote: {
      findFirst: async ({ where }: { where: { fazendaId: string; id: string } }) =>
        where.fazendaId === farm && where.id === entidadeId ? { id: entidadeId } : null,
    },
    cenario: { findFirst: async () => null },
    historicoSync: {
      upsert: async ({ create }: { create: Omit<HistoricoSyncRecord, 'criadoEm'> }) => {
        const key = create.fazendaId + create.id;
        const valor = registros.get(key) ?? { ...create, criadoEm: new Date() };
        registros.set(key, valor);
        return valor;
      },
      findFirst: async ({ where }: { where: { fazendaId: string; id: string } }) =>
        registros.get(where.fazendaId + where.id) ?? null,
      findMany: async ({
        where,
        skip,
        take,
      }: {
        where: { fazendaId: string; entidadeId?: string };
        skip: number;
        take: number;
      }) =>
        [...registros.values()]
          .filter(
            (r) =>
              r.fazendaId === where.fazendaId &&
              (!where.entidadeId || r.entidadeId === where.entidadeId),
          )
          .slice(skip, skip + take),
    },
  } as unknown as PrismaClient;
  const app = Fastify();
  apps.push(app);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  app.decorateRequest('tenant', null);
  app.addHook('onRequest', async (req, reply) => {
    if (!req.headers['x-farm']) {
      await reply.code(401).send({});
      return;
    }
    req.tenant = { usuarioId: farm, fazendaId: String(req.headers['x-farm']) };
  });
  registerHistoricoSyncRoutes(app, createHistoricoSyncRepository(prisma));
  return { app, registros };
}
it('POST idempotente e GET recuperam exatamente as duas versoes', async () => {
  const { app, registros } = montar();
  for (let n = 0; n < 2; n++) {
    const res = await app.inject({
      method: 'POST',
      url: '/historico-sync',
      headers: { 'x-farm': farm },
      payload: evento,
    });
    expect(res.statusCode).toBe(200);
  }
  expect(registros.size).toBe(1);
  const res = await app.inject({
    method: 'GET',
    url: `/historico-sync/${id}`,
    headers: { 'x-farm': farm },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().servidor.qtd).toBe('50');
  expect(res.json().local.qtd).toBe('99');
  expect(res.json()).not.toHaveProperty('fazendaId');
});
it('outra conta nao grava, nao lista e nao consulta o historico', async () => {
  const { app } = montar();
  await app.inject({
    method: 'POST',
    url: '/historico-sync',
    headers: { 'x-farm': farm },
    payload: evento,
  });
  const criar = await app.inject({
    method: 'POST',
    url: '/historico-sync',
    headers: { 'x-farm': outro },
    payload: evento,
  });
  expect(criar.statusCode).toBe(404);
  const listar = await app.inject({
    method: 'GET',
    url: `/historico-sync?entidadeId=${entidadeId}`,
    headers: { 'x-farm': outro },
  });
  expect(listar.json()).toEqual({ registros: [] });
  const ler = await app.inject({
    method: 'GET',
    url: `/historico-sync/${id}`,
    headers: { 'x-farm': outro },
  });
  expect(ler.statusCode).toBe(404);
});
it('sem sessao bloqueia a leitura e snapshots incoerentes sao recusados', async () => {
  const { app } = montar();
  const anonimo = await app.inject({ method: 'GET', url: '/historico-sync' });
  expect(anonimo.statusCode).toBe(401);
  const invalido = await app.inject({
    method: 'POST',
    url: '/historico-sync',
    headers: { 'x-farm': farm },
    payload: { ...evento, local: { id: outro } },
  });
  expect(invalido.statusCode).toBe(400);
});
