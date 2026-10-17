import { createPrisma } from '@ogado/db';
import { buildApp } from './app.js';
import { loadEnv, parseOrigins } from './env.js';

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
const app = buildApp({ prisma, corsOrigins: parseOrigins(env.WEB_ORIGIN), logger: true });

const shutdown = async (): Promise<void> => {
  await app.close();
  await prisma.$disconnect();
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await app.listen({ host: env.API_HOST, port: env.API_PORT });
