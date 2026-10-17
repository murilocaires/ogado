# 01 (T-01): Monorepo, CI e "hello" ponta a ponta

**What to build:** o esqueleto executável: monorepo pnpm com web, API, domínio, contratos e banco; Postgres via Docker Compose; uma rota de saúde na API exibida numa página da web; seed vazio. Todos os comandos do CLAUDE.md passam a existir.

**Blocked by:** None (can start immediately)

**Status:** aguardando-aprovacao (vira `ready-for-agent` após aprovação)

**Reqs:** RNF-010, RNF-011 · **Seam:** rotas HTTP da API + e2e mínimo

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` verdes; `pnpm test:parity` roda o oráculo (decidir uso do `verify.py` no Windows)
- [ ] `docker compose up` sobe o Postgres e a API responde ao "hello" visto na web
- [ ] `node scripts/trace-check.mjs` e `node scripts/validate-routing.mjs` rodam
- [ ] CI executa install → typecheck → lint → test → build
- [ ] README explica como subir tudo
