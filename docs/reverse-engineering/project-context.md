# Contexto do Projeto O Gado — Restrições para futuras implementações

> Fonte: inspeção direta do repositório (2026-10-20). Toda implementação
> derivada da investigação do Bovin **deve** respeitar este contexto.
> Nada abaixo foi alterado por esta configuração de engenharia reversa.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`), Node ≥ 22 |
| Frontend | **Next.js ^16.4.2** + React ^19.3.1, App Router, TypeScript ^6 strict, PWA offline-first (service worker, `SyncProvider`) |
| Backend | **Fastify ^5.12.7** (`apps/api`), `fastify-type-provider-zod`, helmet, CSRF, rate limit |
| Banco | **PostgreSQL 17** (Docker) + **Prisma ^7.10.1** (`@prisma/adapter-pg`) — `packages/db` |
| Contratos | **Zod** compartilhado em `packages/contracts` (bordas da API e UI) |
| Domínio | **`packages/domain`** — puro, Decimal.js (precisão 28), **sem I/O** |
| UI | **CSS puro + design tokens** (`apps/web/styles/tokens.css`) — sem Tailwind/shadcn/Radix. Componentes próprios em `apps/web/components/` |

## Arquitetura

- Multi-tenant por `fazendaId` (1 fazenda por conta na v1) — plugin
  `apps/api/src/tenant.ts`; toda query e UI escopada.
- Vertical slices: schema → API → UI → testes por ticket.
- Sincronização offline-first: engine em `apps/web/lib/sync/`, histórico em
  `HistoricoSync` (ADR-0016), convenção UUID do cliente + `version`/`updatedAt`
  do servidor + tombstone `deletedAt` (ADR-0007).
- Decisões registradas em **16 ADRs** (`docs/adr/`), mais
  `docs/sdd/constitution.md` (14 princípios inegociáveis), `spec-v1.md`,
  `plan.md`, `tasks.md`, `traceability.md`.

## Regras de negócio pecuárias (protegidas)

Todo cálculo vive em `packages/domain/src/`:

- `compra-venda.ts` — `calcularCompra` / `calcularVenda` (RN-001…006); @ = 30 kg
  PV; venda com base por lote `vivo`(30)/`carcaca`(15) (ADR-0012) e desconto em
  **kg/cabeça** (ADR-0013).
- `recria.ts` — `calcularRecria` (RN-007…023): UA 450 kg, lotação
  (`fixa80`/`areaPastavel`), GMD, proteinado, custo operacional, faturamento
  bruto (`pesoVivo`/`carcaca`).
- `alertas-recria.ts`, `configuracao.ts` (parâmetros por fazenda, ADR-0011;
  variantes de fórmula, ADR-0008), `pt-br.ts` (formatação/parsing pt-BR).

**Lei de paridade** (Constituição §2): o caminho de autoridade é
`.xlsx` → `docs/negocio/03-formulas-e-paridade.md` → `references/calculo/calc.js`
→ `packages/domain`, com golden cases em `tests/fixtures/golden.json` e
tolerância ≤ 1e-6. **Não alterar fórmulas pecuárias sem aprovação explícita.**

Outras proteções: `references/` é somente leitura (hook `protect-sources.sh`);
aritmética decimal sem float (ADR-0003); sem `any`.

## Autenticação e segurança

- Sessão por cookie `httpOnly` de dois segmentos (`id.segredo`), apenas o
  SHA-256 do segredo é persistido; argon2id; CSRF; rate limit por IP/email;
  Google OAuth (1 identidade por conta); logs redigidos sem PII (ADR-0010).
- LGPD: `docs/legal/`, termos versionados com teste de hash.

## Testes e convenções

- Vitest (unit/integration) em todos os workspaces; Testing Library +
  happy-dom no web; Playwright e2e em 3 configs (`apps/web/e2e/`, jornadas E1–E6).
- Scripts raiz: `pnpm test`, `test:parity`, `performance:check`,
  `trace-check --strict`, `validate-routing.mjs`.
- ESLint 10 (flat config) + Prettier; CI no `.github/workflows/ci.yml`
  (typecheck → lint → test → parity → build → e2e Playwright).
- Git hooks `.claude/settings.json` bloqueiam `git push`, `reset --hard`,
  `clean`, `branch -D` e edição de `references/` — respeitá-los.

## Agente e roteamento

- `CLAUDE.md` (instruções permanentes), `GLOSSARY.md` (linguagem ubíqua).
- 28 skills em `.claude/skills/` (21 de mattpocock + 7 do projeto).
- 8 subagentes em `.claude/agents/`.
- Roteamento de modelos por custo em `.claude/config/model-routing.json`
  (política: "cheapest-model-that-passes-the-gate").

## Implicações para a investigação do Bovin

1. Descobertas do Bovin são **material de referência**, não código a copiar:
   registrar como evidência/documentação, nunca transplantar proprietário.
2. Qualquer feature derivada entra como ticket no fluxo SDD existente
   (spec → plan → tasks → implement → traceability).
3. Toda UI nova segue os design tokens pasto e os componentes próprios — não
   introduzir bibliotecas de UI novas sem ADR.
4. Toda persistência nova respeita multi-tenant (`fazendaId`), convenção de
   sync (ADR-0007/0016) e decimais nativos (ADR-0003).
5. Fórmulas pecuárias: só com paridade verificada e aprovação.
