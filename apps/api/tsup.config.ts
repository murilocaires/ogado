import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // Pacotes internos exportam TS; empacota-os no bundle da API.
  noExternal: [/^@ogado\//],
  // Dependências CJS (pg) empacotadas junto usam `require` de módulos nativos do Node.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
