# ADR-0002 — Stack e estrutura do monorepo

**Status:** aceito (revisável no grill) · **Data:** 2026-10-17

- **Linguagem:** TypeScript estrito em tudo; Node LTS.
- **Web:** Next.js (App Router). **API:** Fastify com `fastify-type-provider-zod`. **Contratos:** Zod. **ORM:** Prisma. **Banco:** PostgreSQL.
- **Monorepo:** pnpm workspaces — `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, `packages/db`.
- **Testes:** Vitest (unidade/integração), Testing Library, Playwright (e2e e verificação visual). Postgres real via Docker Compose/testcontainers.
- **Por que API separada do Next:** o app móvel futuro reutiliza a mesma API e o mesmo domínio.
- **Evitar:** lógica de negócio em Server Actions/rotas do Next; duplicar fórmulas no cliente.
Alternativas: tRPC (acopla ao TS do cliente; rejeitado por causa do app móvel), Drizzle (válido, mas o Prisma foi pedido).
