import { createPrisma } from '@ogado/db';
import { buildApp } from './app.js';
import { configFromEnv } from './config.js';
import { createGoogleOAuthClient } from './google/google-client.js';
import { createMemoryEmailSender, createUnconfiguredEmailSender } from './email/memory-sender.js';
import { createResendEmailSender } from './email/resend-sender.js';
import { loadEnv, parseOrigins } from './env.js';

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
const config = configFromEnv(env);
const emailConfigured = env.RESEND_API_KEY !== undefined && env.EMAIL_FROM !== undefined;
const googleClient =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? createGoogleOAuthClient({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      })
    : undefined;
const app = buildApp({
  ...(googleClient ? { googleClient } : {}),
  prisma,
  corsOrigins: parseOrigins(env.WEB_ORIGIN),
  logger: true,
  config,
  emailSender: emailConfigured
    ? createResendEmailSender({ apiKey: env.RESEND_API_KEY ?? '', from: env.EMAIL_FROM ?? '' })
    : config.production
      ? createUnconfiguredEmailSender((mensagem) => app.log.warn(mensagem))
      : createMemoryEmailSender(),
});
if (!emailConfigured && config.production) {
  app.log.warn(
    'RESEND_API_KEY/EMAIL_FROM ausentes em produção: a recuperação de senha NÃO enviará e-mails.',
  );
}

const shutdown = async (): Promise<void> => {
  await app.close();
  await prisma.$disconnect();
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await app.listen({ host: env.API_HOST, port: env.API_PORT });
