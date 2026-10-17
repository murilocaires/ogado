# 01 (T-01): Monorepo, CI e "hello" ponta a ponta

**What to build:** o esqueleto executável: monorepo pnpm com web, API, domínio, contratos e banco; Postgres via Docker Compose; uma rota de saúde na API exibida numa página da web; seed vazio. Todos os comandos do CLAUDE.md passam a existir.

**Blocked by:** None (can start immediately)

**Status:** aguardando-aprovacao (vira `ready-for-agent` após aprovação)

**Reqs:** RNF-010, RNF-011 · **Seam:** rotas HTTP da API + e2e mínimo

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` verdes; `pnpm test:parity` roda o oráculo (decidir uso do `verify.py` no Windows)
- [x] `docker compose up` sobe o Postgres; a API e a web sobem com `pnpm dev` e a web mostra o "hello" (interpretação: compose = só Postgres, decisão registrada na revisão)
- [x] Seed vazio: `pnpm --filter @ogado/db seed` (no-op); o cenário de ouro entra nos tickets de telas
- Lacunas anotadas para o T-04: `setErrorHandler` sem vazar `err.message`, helmet, rate limit; `@ogado/domain` entra em `transpilePackages` no T-13; `@ogado/db` nunca é importado pela web
- [ ] `node scripts/trace-check.mjs` e `node scripts/validate-routing.mjs` rodam
- [ ] CI executa install → typecheck → lint → test → build
- [ ] README explica como subir tudo
