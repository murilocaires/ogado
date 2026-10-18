# ADR-0009 — Versões e ferramentas do esqueleto (T-01)

**Status:** aceito · **Data:** 2026-10-17

Versões resolvidas na instalação do T-01 (travadas em `pnpm-lock.yaml`; faixas `^` nos `package.json`). Complementa o ADR-0002.

| Área | Escolha | Versão |
|---|---|---|
| Runtime / gerenciador | Node, pnpm | 22 LTS (22.23), pnpm 11.13.1 (`packageManager`; o 11.13.0 foi publicado sem binário e quebra o install na Vercel) |
| Linguagem | TypeScript | **~6.0.3** (ver nota) |
| Web | Next.js (App Router, Turbopack), React | 16.4.2, 19.3.1 |
| API | Fastify, `fastify-type-provider-zod`, `@fastify/cors` | 5.12.7, 7.0.0, 11.3.1 |
| Contratos | Zod | 4.6.7 |
| Domínio | decimal.js | 10.6.0 |
| Banco | Prisma (`prisma-client` generator + driver adapter `@prisma/adapter-pg`), `pg` | 7.10.1, 8.23.1 |
| PostgreSQL | imagem `postgres:17-alpine` (Compose e CI) | 17 |
| Testes | Vitest | 5.0.5 |
| Lint / formato | ESLint (flat config) + typescript-eslint, Prettier | 10.13, 8.71.2, 3.9.10 |
| Execução / build da API | tsx (dev), tsup (bundle ESM, empacota `@ogado/*`) | 4.23.15, 9.0.0 |

Decisões e notas:
- **TypeScript 6.0, não 7.x:** `typescript-eslint` 8.71 declara peer `typescript <6.1`; o 7.x (latest) geraria peer não atendido. Subir para 7 quando o typescript-eslint suportar.
- **Pacotes internos exportam TypeScript-fonte** (`exports` → `src/index.ts`): Next usa `transpilePackages`; a API é empacotada com tsup; Vitest lê direto. Sem etapa de build por pacote. Consequência: imports relativos em `packages/contracts` e `packages/domain` são **sem extensão** (Turbopack não resolve `./x.js` para `x.ts`).
- **Prisma 7:** `datasource` sem `url` no schema; a URL vem de `packages/db/prisma.config.ts` (`DATABASE_URL`). Client gerado em `packages/db/src/generated` (ignorado pelo git; `pnpm db:generate` roda localmente e no CI). O pacote `prisma` 8.0.0-rc apareceu como `latest` em uma resolução; fixamos `^7.10.1` para casar com `@prisma/client`.
- **pnpm 11 e scripts de build:** `allowBuilds` em `pnpm-workspace.yaml` libera apenas `prisma`, `@prisma/engines` e `esbuild`.
- **Paridade sem Python:** `scripts/parity.mjs` carrega `references/calculo/calc.js` e compara com `tests/fixtures/golden.json` (tolerância relativa 1e-6). `verify.py` fica como `pnpm parity:xlsx` opcional (Linux/CI), pois quebra no Windows.
- **Fora do T-01:** Testing Library, Playwright, Dexie/Serwist (entram nos tickets que os usam).
