import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { logUnexpectedError } from '../plugins/error-handler';
import { healthErrorSchema, healthResponseSchema } from '@ogado/contracts';

export function registerHealthRoutes(
  app: FastifyInstance,
  deps: { pingDatabase: () => Promise<void> },
): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      config: { auth: 'public' },
      schema: {
        response: { 200: healthResponseSchema, 503: healthErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        await deps.pingDatabase();
        return { status: 'ok' as const, db: 'ok' as const };
      } catch (error) {
        logUnexpectedError(request.log, error, 'health check: banco indisponível');
        return reply.code(503).send({ status: 'error' as const, db: 'down' as const });
      }
    },
  );
}
