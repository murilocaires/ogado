import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { PrismaClient } from '@ogado/db';
import { resolveConfig, type PartialAppConfig } from './config';
import { createPasswordHasher } from './password';
import { authPlugin } from './plugins/auth';
import { csrfPlugin } from './plugins/csrf';
import { registerErrorHandling } from './plugins/error-handler';
import { registerRouteCatalog } from './plugins/route-catalog';
import { rateLimitPlugin } from './plugins/rate-limit';
import { createAccountRepository } from './repositories/account-repository';
import { createFazendaRepository } from './repositories/fazenda-repository';
import { registerAuthRoutes } from './routes/auth';
import { registerFazendaRoutes } from './routes/fazendas';
import { registerHealthRoutes } from './routes/health';
import { createSessionService } from './session/session-service';

export interface AppOptions {
  prisma: PrismaClient;
  corsOrigins: string[];
  logger?: boolean;
  /** Destino dos logs (testes capturam para checar que não há PII). */
  logStream?: NodeJS.WritableStream;
  config?: PartialAppConfig;
  /** Relógio injetável (testes de expiração de sessão). */
  clock?: () => Date;
  /** Gerador do id da Fazenda criada no cadastro (injetável para testar colisão de UUID). */
  newFazendaId?: () => string;
}

/** Logs sem PII (ADR-0010 e): nenhum cookie, credencial, senha, e-mail nem corpo de requisição. */
function loggerOptions(stream: NodeJS.WritableStream | undefined) {
  return {
    level: 'info',
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        'req.body',
        'body',
        'password',
        'senha',
        'email',
        'cookie',
        'authorization',
        '*.password',
        '*.senha',
        '*.email',
        '*.cookie',
        '*.authorization',
      ],
      censor: '[redigido]',
    },
    // IP é PII (LGPD): o log de requisição leva só método, rota e id, sem remoteAddress.
    serializers: {
      req: (req: { method?: string; url?: string; id?: string }) => ({
        method: req.method,
        url: req.url,
      }),
    },
    ...(stream ? { stream } : {}),
  };
}

export function buildApp(options: AppOptions): FastifyInstance {
  const config = resolveConfig(options.config);
  const clock = options.clock ?? ((): Date => new Date());
  const prisma = options.prisma;

  const app = Fastify({
    logger: options.logger ? loggerOptions(options.logStream) : false,
    bodyLimit: 64 * 1024,
    trustProxy: config.trustProxy.length > 0 ? config.trustProxy : false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  registerRouteCatalog(app);

  const sessions = createSessionService(prisma, config, clock);
  const accounts = createAccountRepository(prisma);
  const fazendas = createFazendaRepository(prisma);
  const hasher = createPasswordHasher(config.argon2);

  // A API só serve JSON: CSP fechada, nosniff, sem referrer; HSTS só em produção (ADR-0010 e).
  void app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: config.production
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
  });
  void app.register(cors, {
    origin: options.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  void app.register(cookie);
  void app.register(rateLimitPlugin, { config });
  void app.register(csrfPlugin, { allowedOrigins: options.corsOrigins });
  void app.register(authPlugin, { config, sessions });

  registerHealthRoutes(app, {
    pingDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  });
  registerAuthRoutes(app, {
    config,
    accounts,
    fazendas,
    sessions,
    hasher,
    clock,
    newFazendaId: options.newFazendaId ?? randomUUID,
  });

  registerFazendaRoutes(app, { fazendas });

  return app;
}
