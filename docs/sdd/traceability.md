# Matriz de rastreabilidade

Atualizada pelo `docs-keeper` com a skill `traceability`. Rode `node scripts/trace-check.mjs` para ver cobertura por ID.

| ID | Ticket | Teste(s) | Código | Status |
|---|---|---|---|---|
| RNF-011 | T-01 | `apps/api/test/health.test.ts` | `apps/api/src/app.ts`, `docker-compose.yml` | Parcial (seed de ouro nos tickets de telas) |
| RNF-010 | T-01 | — (gate de CI: typecheck, lint, test; exceção: não é testável por ID; cobertura ≥ 95% do domínio vem em T-02) | `.github/workflows/ci.yml`, `eslint.config.js` | Atendido pelo gate |
| RNF-001 | T-01 (base) | `packages/domain/src/index.test.ts` | `packages/domain/src/index.ts` | Parcial (cálculos em T-02/T-03) |
| RN-001…RN-006, RNF-007 | T-02 | `packages/domain/src/compra-venda.test.ts`, `pt-br.test.ts` | `packages/domain/src/compra-venda.ts`, `pt-br.ts` | Implementado; ticket aguardando aprovação (regra do parser `1.234`) |
| RN-007…RN-023 | T-03 | `packages/domain/src/recria.test.ts`, `tests/fixtures/variantes.json` | `packages/domain/src/recria.ts` | Implementado; variantes aguardando revisão humana |
| RF-001 (e-mail), RF-010, RNF-003, RNF-004 | T-04 | — | — | Pendente |
| RF-001 (Google), RF-002 | T-16 | — | — | Pendente |
| RF-021, RF-023, RN-002, RN-005, RN-006 | T-17 | — | — | Pendente |
| RF-070, RF-071, RF-072, RNF-012, RNF-016 | T-13 | — | — | Pendente |
| RF-073, RF-074, RF-076, RF-079, RF-080, RNF-013, RNF-017 | T-14 | — | — | Pendente |
| RF-075, RF-077, RF-078, RNF-014, RNF-015 | T-15 | — | — | Pendente |
| (preencher por ticket) | | | | |
