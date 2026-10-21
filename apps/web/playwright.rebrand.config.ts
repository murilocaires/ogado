import { defineConfig } from '@playwright/test';

/** IndexedDB real em origem interceptada: sem servidor, API ou banco externo. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'rebrand-storage.spec.ts',
  workers: 1,
  use: { channel: process.env['E2E_CHANNEL'] || undefined },
});
