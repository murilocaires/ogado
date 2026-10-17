import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { healthErrorSchema, healthResponseSchema } from '@ogado/contracts';
import type { PrismaClient } from '@ogado/db';

export interface AppOptions {
  prisma: Pick<PrismaClient, '$queryRaw'>;
  corsOrigins: string[];
  logger?: boolean;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(cors, { origin: options.corsOrigins });

  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        response: { 200: healthResponseSchema, 503: healthErrorSchema },
      },
    },
    async (_request, reply) => {
      try {
        await options.prisma.$queryRaw`SELECT 1`;
        return { status: 'ok' as const, db: 'ok' as const };
      } catch (error) {
        app.log.error(error, 'health check: banco indisponível');
        return reply.code(503).send({ status: 'error' as const, db: 'down' as const });
      }
    },
  );

  return app;
}
