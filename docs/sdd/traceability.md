# Matriz de rastreabilidade

Atualizada pelo `docs-keeper` com a skill `traceability`. Rode `node scripts/trace-check.mjs` para ver cobertura por ID.

| ID | Ticket | Teste(s) | Código | Status |
|---|---|---|---|---|
| RNF-011 | T-01 | `apps/api/test/health.test.ts` | `apps/api/src/app.ts`, `docker-compose.yml` | Parcial (seed de ouro nos tickets de telas) |
| RNF-010 | T-01 | — (gate de CI: typecheck, lint, test; exceção: não é testável por ID; cobertura ≥ 95% do domínio vem em T-02) | `.github/workflows/ci.yml`, `eslint.config.js` | Atendido pelo gate |
| RNF-001 | T-01 (base) | `packages/domain/src/index.test.ts` | `packages/domain/src/index.ts` | Parcial (cálculos em T-02/T-03) |
| RN-001…RN-006, RNF-007 | T-02 | `packages/domain/src/compra-venda.test.ts`, `pt-br.test.ts` | `packages/domain/src/compra-venda.ts`, `pt-br.ts` | Implementado; ticket aguardando aprovação (regra do parser `1.234`) |
| RN-007…RN-023 | T-03 | `packages/domain/src/recria.test.ts`, `tests/fixtures/variantes.json` | `packages/domain/src/recria.ts` | Implementado; variantes aguardando revisão humana |
| RF-001 (e-mail), RF-002 (sessão/logout), RF-010, RNF-003, RNF-004 | T-04 | `apps/api/test/*.test.ts` (auth-signup, auth-login, auth-session, session-lifecycle, storage, isolation, fazenda-repository, rate-limit, security), `packages/contracts/src/auth.test.ts`, `apps/web/lib/auth/*.test.ts`, `apps/web/components/AuthScreen.test.tsx`, `apps/web/components/PainelPlaceholder.test.tsx`, `apps/web/e2e/auth.spec.ts` | `apps/api/src/**`, `apps/web/{lib/auth,components,app/entrar,app/cadastrar,app/painel}/**`, `packages/db/prisma/schema.prisma`, `packages/contracts/src/{auth,errors,fazenda,session,password-rules}.ts` | Implementado (backend CA-01…19; front e e2e CA-20…22); aguardando revisão humana |
| RF-003, RF-011, RN-021, RN-023, RF-076 (Fazenda) | T-05 | — (previstos: `apps/api/test/fazenda-config*.test.ts`, isolation, teste do mapeamento de configuração no domínio, testes das telas de primeiros passos/configurações, `apps/web/e2e/primeiros-passos.spec.ts`) | — | ADR-0011 aprovado (Q1–Q4 respondidas). Etapa 1 em andamento (pausada): domínio `packages/domain/src/configuracao.ts` + `configuracao.test.ts` verdes (CA-18/19/20); migração e contratos parciais; rotas pendentes |
| RF-001 (Google), RF-002 | T-16 | — | — | Pendente |
| RF-021, RF-023, RN-002, RN-005, RN-006 | T-17 | — | — | Pendente |
| RF-070, RF-071, RF-072, RNF-012, RNF-016 | T-13 | — | — | Pendente |
| RF-073, RF-074, RF-076, RF-079, RF-080, RNF-013, RNF-017 | T-14 | — | — | Pendente |
| RF-075, RF-077, RF-078, RNF-014, RNF-015 | T-15 | — | — | Pendente |
| RN-024, RN-025, RN-027 (domínio); RF-024…RF-026 | T-02 (nova rodada), T-06, T-17 | `packages/domain/src/compra-venda.test.ts`, `configuracao.test.ts` | `packages/domain/src/compra-venda.ts` (`calcularVenda`, `categoriaFeminina`); UI (T-06/T-17) pendente; ADR-0012 aprovado |
| RN-026, RF-031 (completo), RF-030 | T-07 | `packages/domain/src/alertas-recria.test.ts` | `packages/domain/src/alertas-recria.ts` (`alertasRecria`); UI pendente |
| RF-032…RF-036, RF-040 (cartão com o último cenário), RN-023 (snapshot), RNF-004 (migração do storage E1→E2) | E2 (T-08 + T-19 locais, sem API) | `apps/web/components/CenariosScreen.test.tsx`, `apps/web/lib/repo/local-repo.test.ts` (cenários e migração), `apps/web/e2e/e2-cenarios.spec.ts` (`pnpm --filter @ogado/web test:e2e:local`) | `apps/web/components/{CenariosScreen,NomeDialog,RecriaScreen,RecriaRoute,PainelScreen}.tsx`, `apps/web/lib/{cenarios,custo-cores}.ts`, `apps/web/lib/repo/{types,local-repo}.ts`, `apps/web/styles/app.css` | Implementado, dados só no localStorage (snapshot imutável com resultado do domínio em string decimal; chave `ogado.e2.v2`, lê `ogado.e1.v1`). Aguardando revisão humana; API/sincronização na E3 |
| RF-004…RF-007 | T-18 | — | — | Pendente |
| RF-052, RF-053 | T-10 | — | — | Pendente |
| RF-024…RF-026, RF-030, RF-031, RF-040, RF-051…RF-053, RN-024…RN-027 (versão local) | E1 (T-06 + T-17 + T-07 locais) | `apps/web/components/{NegociosScreen,RecriaScreen,PainelScreen,InfoPopover}.test.tsx`, `apps/web/lib/repo/local-repo.test.ts`, `apps/web/e2e/e1-jornadas.spec.ts` (`pnpm --filter @ogado/web test:e2e:local`, sem API) | `apps/web/app/(app)/**`, `apps/web/components/{AppShell,NegociosScreen,LoteModal,RecriaScreen,PainelScreen,InfoPopover,Dialog,Fields,Toast}.tsx`, `apps/web/lib/{negocios,lote-draft,recria,format,info}.ts`, `apps/web/lib/repo/**`, `apps/web/styles/app.css` | Implementado, dados só no localStorage (ADR-0007: telas só falam com `lib/repo`); cálculo 100% via `@ogado/domain`; fora da E1: login, cenários, comparação, PWA/offline, sync, primeiros passos, parâmetros. Aguardando revisão humana |$
| (preencher por ticket) | | | | |
