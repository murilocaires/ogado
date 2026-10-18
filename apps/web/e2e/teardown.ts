import { execSync } from 'node:child_process';

/** Apaga as contas @teste.ogado.invalid criadas pelo e2e (via script da API; o web não importa o banco). */
export default function globalTeardown(): void {
  execSync('pnpm --filter @ogado/api exec tsx scripts/cleanup-test-accounts.ts', {
    cwd: '../..',
    stdio: 'inherit',
    env: process.env,
  });
}
