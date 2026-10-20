import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  cenarioCreateSchema,
  cenarioListQuerySchema,
  cenarioListResponseSchema,
  cenarioPatchSchema,
  cenarioSchema,
  deleteQuerySchema,
  idParamsSchema,
  loteCreateSchema,
  loteListQuerySchema,
  loteListResponseSchema,
  lotePatchSchema,
  loteSchema,
  recriaEntradaPutSchema,
  recriaEntradaSchema,
} from '@ogado/contracts';
import { genericConflict, notFound, versionConflict } from '../http-errors';
import { IdConflictError } from '../repositories/account-repository';
import type { CenarioRepository } from '../repositories/cenario-repository';
import type { LoteRepository } from '../repositories/lote-repository';
import type { RecriaRepository } from '../repositories/recria-repository';
import type { WriteResult } from '../repositories/sync';
import { requireTenant } from '../tenant';
import { toCenarioDto, toLoteDto, toRecriaEntradaDto } from './dto';

/** Traduz o resultado de escrita: ok devolve o registro; conflito = 409 com `atual`; resto = 404. */
function unwrap<R, D>(result: WriteResult<R>, toDto: (r: R) => D): D {
  if (result.status === 'ok') return toDto(result.record);
  if (result.status === 'conflito') throw versionConflict(toDto(result.atual));
  throw notFound();
}

/** Colisão de UUID com registro de outra fazenda: 409 genérico, sem revelar nada (CA-15). */
async function guardIdConflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof IdConflictError) throw genericConflict();
    throw error;
  }
}

export interface DadosRoutesDeps {
  lotes: LoteRepository;
  cenarios: CenarioRepository;
  recria: RecriaRepository;
}

/**
 * Dados do site na nuvem (E3): lotes, cenários e entradas da recria. Tudo escopado pelo tenant da
 * sessão; recurso de outra fazenda = 404 igual ao inexistente. POST idempotente pelo id do
 * cliente (201 criou, 200 repetição); PATCH/DELETE/PUT com versão-base (409 com `atual`).
 */
export function registerDadosRoutes(app: FastifyInstance, deps: DadosRoutesDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // --- Lotes (RF-020 compra, RF-021 venda) ---
  typed.get(
    '/lotes',
    { schema: { querystring: loteListQuerySchema, response: { 200: loteListResponseSchema } } },
    async (request) => {
      const { tipo, incluirExcluidos, incremental, cursorUpdatedAt, cursorId, limit } =
        request.query;
      if (incremental === 'true') {
        const lista = await deps.lotes.listPage(requireTenant(request), {
          tipo,
          limit,
          cursor:
            cursorUpdatedAt && cursorId ? { updatedAt: cursorUpdatedAt, id: cursorId } : undefined,
        });
        const pagina = lista.slice(0, limit);
        const ultimo = pagina.at(-1);
        return {
          lotes: pagina.map(toLoteDto),
          proximoCursor:
            lista.length > limit && ultimo
              ? { updatedAt: ultimo.updatedAt.toISOString(), id: ultimo.id }
              : null,
        };
      }
      const lotes = await deps.lotes.list(requireTenant(request), {
        tipo,
        incluirExcluidos: incluirExcluidos === 'true',
      });
      return { lotes: lotes.map(toLoteDto) };
    },
  );

  typed.get(
    '/lotes/:id',
    { schema: { params: idParamsSchema, response: { 200: loteSchema } } },
    async (request) => {
      const lote = await deps.lotes.findById(requireTenant(request), request.params.id);
      if (!lote) throw notFound();
      return toLoteDto(lote);
    },
  );

  typed.post(
    '/lotes',
    { schema: { body: loteCreateSchema, response: { 200: loteSchema, 201: loteSchema } } },
    async (request, reply) => {
      const { record, created } = await guardIdConflict(() =>
        deps.lotes.create(requireTenant(request), request.body),
      );
      return reply.code(created ? 201 : 200).send(toLoteDto(record));
    },
  );

  typed.patch(
    '/lotes/:id',
    {
      schema: { params: idParamsSchema, body: lotePatchSchema, response: { 200: loteSchema } },
    },
    async (request) =>
      unwrap(
        await deps.lotes.update(requireTenant(request), request.params.id, request.body),
        toLoteDto,
      ),
  );

  typed.delete(
    '/lotes/:id',
    {
      schema: {
        params: idParamsSchema,
        querystring: deleteQuerySchema,
        response: { 200: loteSchema },
      },
    },
    async (request) =>
      unwrap(
        await deps.lotes.softDelete(
          requireTenant(request),
          request.params.id,
          request.query.version,
        ),
        toLoteDto,
      ),
  );

  // --- Cenários (RF-032) ---
  typed.get(
    '/cenarios',
    {
      schema: { querystring: cenarioListQuerySchema, response: { 200: cenarioListResponseSchema } },
    },
    async (request) => {
      const { incremental, cursorUpdatedAt, cursorId, limit } = request.query;
      if (incremental === 'true') {
        const lista = await deps.cenarios.listPage(requireTenant(request), {
          limit,
          cursor:
            cursorUpdatedAt && cursorId ? { updatedAt: cursorUpdatedAt, id: cursorId } : undefined,
        });
        const pagina = lista.slice(0, limit);
        const ultimo = pagina.at(-1);
        return {
          cenarios: pagina.map(toCenarioDto),
          proximoCursor:
            lista.length > limit && ultimo
              ? { updatedAt: ultimo.updatedAt.toISOString(), id: ultimo.id }
              : null,
        };
      }
      const lista = await deps.cenarios.list(
        requireTenant(request),
        request.query.incluirExcluidos === 'true',
      );
      return { cenarios: lista.map(toCenarioDto) };
    },
  );

  typed.get(
    '/cenarios/:id',
    { schema: { params: idParamsSchema, response: { 200: cenarioSchema } } },
    async (request) => {
      const cenario = await deps.cenarios.findById(requireTenant(request), request.params.id);
      if (!cenario) throw notFound();
      return toCenarioDto(cenario);
    },
  );

  typed.post(
    '/cenarios',
    { schema: { body: cenarioCreateSchema, response: { 200: cenarioSchema, 201: cenarioSchema } } },
    async (request, reply) => {
      const { record, created } = await guardIdConflict(() =>
        deps.cenarios.create(requireTenant(request), request.body),
      );
      return reply.code(created ? 201 : 200).send(toCenarioDto(record));
    },
  );

  typed.patch(
    '/cenarios/:id',
    {
      schema: {
        params: idParamsSchema,
        body: cenarioPatchSchema,
        response: { 200: cenarioSchema },
      },
    },
    async (request) =>
      unwrap(
        await deps.cenarios.rename(
          requireTenant(request),
          request.params.id,
          request.body.nome,
          request.body.version,
        ),
        toCenarioDto,
      ),
  );

  typed.delete(
    '/cenarios/:id',
    {
      schema: {
        params: idParamsSchema,
        querystring: deleteQuerySchema,
        response: { 200: cenarioSchema },
      },
    },
    async (request) =>
      unwrap(
        await deps.cenarios.softDelete(
          requireTenant(request),
          request.params.id,
          request.query.version,
        ),
        toCenarioDto,
      ),
  );

  // --- Entradas da recria (uma por fazenda) ---
  typed.get(
    '/recria-entrada',
    { schema: { response: { 200: recriaEntradaSchema } } },
    async (request) => {
      const entrada = await deps.recria.get(requireTenant(request));
      if (!entrada) throw notFound();
      return toRecriaEntradaDto(entrada);
    },
  );

  typed.put(
    '/recria-entrada',
    {
      schema: {
        body: recriaEntradaPutSchema,
        response: { 200: recriaEntradaSchema, 201: recriaEntradaSchema },
      },
    },
    async (request, reply) => {
      const result = await guardIdConflict(() =>
        deps.recria.put(requireTenant(request), request.body),
      );
      if (result.status === 'conflito') throw versionConflict(toRecriaEntradaDto(result.atual));
      return reply.code(result.created ? 201 : 200).send(toRecriaEntradaDto(result.record));
    },
  );
}
