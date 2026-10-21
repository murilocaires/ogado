import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Apaga as contas @teste.bovaro.invalid criadas pelo e2e (via script da API; o web não importa o banco). */
export default function globalTeardown(): void {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../api/node_modules/tsx/dist/cli.mjs', import.meta.url)),
      fileURLToPath(new URL('../../api/scripts/cleanup-test-accounts.ts', import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: 'inherit',
      env: process.env,
    },
  );
}
