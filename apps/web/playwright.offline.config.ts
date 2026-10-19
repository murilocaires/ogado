import { defineConfig } from '@playwright/test';

/**
 * E2E da E4 (instalável e offline): precisa do BUILD DE PRODUÇÃO (`next build` + `next start`),
 * porque o service worker só registra em produção. Sobe também a API real + Postgres
 * (docker compose up postgres): o login prova a jornada de verdade (sessão no aparelho, abrir sem
 * internet) e o lançamento offline é conferido na API depois de reconectar.
 *
 * Navegador: `E2E_CHANNEL` (padrão `msedge`; use `chrome` ou vazio para o Chromium do Playwright).
 */
const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://ogado:ogado_dev@localhost:5432/ogado?schema=public';
const apiPort = process.env['E2E_OFFLINE_API_PORT'] ?? '3105';
const webPort = process.env['E2E_OFFLINE_WEB_PORT'] ?? '3104';
const webOrigin = `http://localhost:${webPort}`;
const channel = process.env['E2E_CHANNEL'] ?? 'msedge';

export default defineConfig({
  testDir: './e2e',
  testMatch: /e4-.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  globalTeardown: './e2e/teardown.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: webOrigin,
    channel: channel || undefined,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: [
    {
      command: 'pnpm --filter @ogado/api exec tsx src/server.ts',
      cwd: '../..',
      url: `http://localhost:${apiPort}/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
      env: {
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'development',
        API_PORT: apiPort,
        API_HOST: '127.0.0.1',
        WEB_ORIGIN: webOrigin,
        RATE_LIMIT_SIGNUP_IP_PER_HOUR: '1000',
      },
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${webPort}`,
      url: `${webOrigin}/entrar`,
      reuseExistingServer: !process.env['CI'],
      timeout: 900_000,
      env: { NODE_ENV: 'production', API_ORIGIN: `http://127.0.0.1:${apiPort}` },
    },
  ],
});
