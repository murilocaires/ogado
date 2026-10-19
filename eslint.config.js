import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/generated/**',
      'references/**',
      'coverage/**',
      '.claude/worktrees/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Service worker (E4): scripts clássicos do navegador, fora do bundle do Next.
    files: ['apps/web/public/sw.js', 'apps/web/public/sw-policy.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        importScripts: 'readonly',
        module: 'writable',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  {
    // ADR-0010 d.2: rotas e plugins não tocam o Prisma. Só repositórios (escopados por tenant), o
    // módulo de sessão e a raiz de composição (app.ts, server.ts) importam o pacote de banco.
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/repositories/**',
      'apps/api/src/session/**',
      'apps/api/src/app.ts',
      'apps/api/src/server.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ogado/db', '@ogado/db/*', '@prisma/*', '**/generated/**'],
              message:
                'Rotas e plugins não importam o Prisma: use um repositório com contexto de tenant (ADR-0010 d.2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  prettier,
);
