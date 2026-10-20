import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPrisma } from '@ogado/db';
import { TEST_EMAIL_DOMAIN, testDatabaseUrl } from './env';

/** Aplica as migrações (aditivas) no Postgres real antes da suíte; limpa as contas de teste no fim. */
export default function setup(): () => Promise<void> {
  const prismaCli = fileURLToPath(
    new URL('../../../../packages/db/node_modules/prisma/build/index.js', import.meta.url),
  );
  const prismaConfig = fileURLToPath(
    new URL('../../../../packages/db/prisma.config.ts', import.meta.url),
  );
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--config', prismaConfig], {
    stdio: 'pipe',
    timeout: 60_000,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });

  return async () => {
    const prisma = createPrisma(testDatabaseUrl);
    try {
      const where = { dono: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } };
      await prisma.fazenda.deleteMany({ where });
      await prisma.usuario.deleteMany({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } });
    } finally {
      await prisma.$disconnect();
    }
  };
}
