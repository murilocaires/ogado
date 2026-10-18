import { execSync } from 'node:child_process';
import { createPrisma } from '@ogado/db';
import { TEST_EMAIL_DOMAIN, testDatabaseUrl } from './env';

/** Aplica as migrações (aditivas) no Postgres real antes da suíte; limpa as contas de teste no fim. */
export default function setup(): () => Promise<void> {
  execSync('pnpm --filter @ogado/db exec prisma migrate deploy', {
    stdio: 'pipe',
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
