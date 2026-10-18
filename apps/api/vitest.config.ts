import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Aplica as migrações no Postgres de teste e limpa os dados criados pelos testes.
    globalSetup: ['./test/support/global-setup.ts'],
  },
});
