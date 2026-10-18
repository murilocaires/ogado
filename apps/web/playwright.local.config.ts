import { defineConfig } from '@playwright/test';

/**
 * E2E da E1 (produto navegável): só o web, SEM API nem Postgres, como o deploy na Vercel.
 * Os specs de autenticação (que exigem API + banco) ficam em playwright.config.ts.
 *
 * Navegador: `E2E_CHANNEL` (padrão `msedge`; use `chrome` ou vazio para o Chromium do Playwright).
 * `E2E_LOCAL_BUILD=1` testa o build de produção (`next build` + `next start`) em vez do `next dev`.
 */
const webPort = process.env['E2E_LOCAL_PORT'] ?? '3102';
const channel = process.env['E2E_CHANNEL'] ?? 'msedge';
const producao = process.env['E2E_LOCAL_BUILD'] === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: /e1-.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${webPort}`,
    channel: channel || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: producao
      ? `pnpm exec next build && pnpm exec next start -p ${webPort}`
      : `pnpm exec next dev -p ${webPort}`,
    url: `http://localhost:${webPort}/painel`,
    reuseExistingServer: !process.env['CI'],
    timeout: 600_000,
    // Sem API_ORIGIN em produção o repasse /api não existe, igual ao deploy da E1.
    env: producao ? { NODE_ENV: 'production' } : {},
  },
});
