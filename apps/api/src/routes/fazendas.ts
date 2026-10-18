import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { fazendaIdParamsSchema, fazendaListResponseSchema, fazendaSchema } from '@ogado/contracts';
import { notFound } from '../http-errors';
import type { FazendaRepository } from '../repositories/fazenda-repository';
import type { TenantContext } from '../tenant';
import { toFazendaDto } from './dto';

function tenantOf(request: { tenant: TenantContext | null }): TenantContext {
  if (!request.tenant) throw new Error('contexto de tenant ausente');
  return request.tenant;
}

/** Leitura da fazenda: só a do tenant da sessão. Outra fazenda = 404, nunca 403 (ADR-0010 d.3). */
export function registerFazendaRoutes(
  app: FastifyInstance,
  deps: { fazendas: FazendaRepository },
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/fazendas',
    { schema: { response: { 200: fazendaListResponseSchema } } },
    async (request) => {
      const fazendas = await deps.fazendas.list(tenantOf(request));
      return { fazendas: fazendas.map(toFazendaDto) };
    },
  );

  typed.get(
    '/fazendas/:id',
    { schema: { params: fazendaIdParamsSchema, response: { 200: fazendaSchema } } },
    async (request) => {
      const fazenda = await deps.fazendas.findById(tenantOf(request), request.params.id);
      if (!fazenda) throw notFound();
      return toFazendaDto(fazenda);
    },
  );
}
