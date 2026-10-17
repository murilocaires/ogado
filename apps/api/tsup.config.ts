import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // Pacotes internos exportam TS; empacota-os no bundle da API.
  noExternal: [/^@ogado\//],
});
