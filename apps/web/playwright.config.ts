import { defineConfig } from '@playwright/test';

/**
 * E2E contra a API real + Postgres (docker compose up postgres). Sobe a API (tsx) e o web (Next)
 * e usa a mesma origem `/api` via rewrite, como em produção.
 *
 * Navegador: `E2E_CHANNEL` (padrão `msedge`, presente no Windows; use `chrome` ou deixe vazio
 * para o Chromium baixado por `pnpm exec playwright install chromium`).
 */
const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://ogado:ogado_dev@localhost:5432/ogado?schema=public';
const apiPort = process.env['E2E_API_PORT'] ?? '3101';
const webPort = process.env['E2E_WEB_PORT'] ?? '3100';
const webOrigin = `http://localhost:${webPort}`;
const channel = process.env['E2E_CHANNEL'] ?? 'msedge';

export default defineConfig({
  testDir: './e2e',
  // Jornadas da E1/E2 não dependem de API/Postgres: rodam pelo playwright.local.config.ts.
  // A E4 exige build de produção (service worker): playwright.offline.config.ts.
  testIgnore: /e[124]-.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: './e2e/warmup.ts',
  globalTeardown: './e2e/teardown.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: webOrigin,
    channel: channel || undefined,
    trace: 'retain-on-failure',
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
        // O e2e cria várias contas do mesmo IP: sobe só o limite de cadastro (CA-16 tem teste próprio).
        RATE_LIMIT_SIGNUP_IP_PER_HOUR: '1000',
      },
    },
    {
      command: `pnpm exec next dev -p ${webPort}`,
      url: `${webOrigin}/entrar`,
      reuseExistingServer: !process.env['CI'],
      timeout: 240_000,
      env: { API_ORIGIN: `http://127.0.0.1:${apiPort}` },
    },
  ],
});
