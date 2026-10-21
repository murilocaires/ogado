import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type {
  HistoricoSyncRepository,
  HistoricoSyncRecord,
} from '../repositories/historico-sync-repository';
import {
  historicoSyncCreateSchema,
  historicoSyncSchema,
  historicoSyncListQuerySchema,
  historicoSyncListSchema,
  idParamsSchema,
} from '@bovaro/contracts';
import { requireTenant } from '../tenant';
import { notFound } from '../http-errors';

export function registerHistoricoSyncRoutes(
  app: FastifyInstance,
  repo: HistoricoSyncRepository,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const dto = (r: HistoricoSyncRecord) =>
    historicoSyncSchema.parse({ ...r, criadoEm: r.criadoEm.toISOString() });
  typed.post(
    '/historico-sync',
    {
      schema: { body: historicoSyncCreateSchema, response: { 200: historicoSyncSchema } },
    },
    async (request) => {
      const record = await repo.create(requireTenant(request), request.body);
      if (!record) throw notFound();
      return dto(record);
    },
  );
  typed.get(
    '/historico-sync',
    {
      schema: {
        querystring: historicoSyncListQuerySchema,
        response: { 200: historicoSyncListSchema },
      },
    },
    async (request) => {
      const registros = await repo.list(requireTenant(request), request.query);
      return { registros: registros.map(dto) };
    },
  );
  typed.get(
    '/historico-sync/:id',
    {
      schema: { params: idParamsSchema, response: { 200: historicoSyncSchema } },
    },
    async (request) => {
      const record = await repo.find(requireTenant(request), request.params.id);
      if (!record) throw notFound();
      return dto(record);
    },
  );
}
