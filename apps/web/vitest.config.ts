import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['lib/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    // Máquinas lentas (antivírus, disco): dá folga ao arranque dos workers.
    // Localmente, um arquivo por vez: em disco lento o arranque do happy-dom em paralelo estoura o
    // timeout (fixo, 60 s) do worker do Vitest. No CI roda em paralelo.
    fileParallelism: !!process.env['CI'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
