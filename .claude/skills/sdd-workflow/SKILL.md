---
name: sdd-workflow
description: Orquestra o ciclo SDD do O Gado (especificar, planejar, implementar em loop, revisar, entregar) com roteamento de modelo por custo. Use ao iniciar qualquer funcionalidade ou ao perguntar "qual o próximo passo".
---

# Fluxo SDD com loops limitados

A **spec é a fonte da verdade**; código e testes derivam dela. Usamos **loop engineering** (ADR-0001): ciclos curtos com *gate* objetivo, limite de iterações e orçamento, mais uma **matriz de rastreabilidade** leve (`docs/sdd/traceability.md`) no lugar de um grafo pesado.

## Fases e portões

| # | Fase | Skill / agente | Saída | Portão (gate) |
|---|------|----------------|-------|---------------|
| 0 | Contexto | `explorer` | resumo ≤25 linhas | — |
| 1 | Especificar | `grill-with-docs` → `to-spec` (`spec-architect`) | `docs/sdd/spec-*.md`, GLOSSARY, ADRs | Humano aprova a spec; todo RF/RN tem critério de aceite |
| 2 | Planejar | `codebase-design`, `to-tickets` | `docs/sdd/plan.md`, tickets com bloqueios | Humano aprova a quebra; cada ticket cita IDs de requisito |
| 3 | Implementar (LOOP) | `implement` ou `implement-spec` + `tdd` | commits na branch do ticket | typecheck + lint + testes do ticket + `test:parity` verdes |
| 4 | Revisar | `code-review` (`code-reviewer`) | relatório Standards × Spec | 0 achados "bloqueia" |
| 5 | Entregar | `pr`, `docs-keeper` | PR + traceability atualizada | CI verde; humano faz o merge |

## O loop da fase 3 (por ticket)

```
repita (máx. 5 iterações):
  1. escolha o modelo:  node scripts/route-model.mjs <tarefa> --failures <n>
  2. RED: escreva 1 teste que falha (seam acordado, nome com ID do requisito)
  3. GREEN: implementação mínima
  4. GATE: pnpm typecheck && pnpm test <arquivo> && pnpm lint   (suíte completa só no fim)
  5. se verde → próximo critério de aceite; se vermelho 2x pelo mesmo motivo → escale 1 tier (uma vez)
  6. se ainda vermelho ou orçamento "hard" estourado → PARE e rode `handoff` com o diagnóstico
fim do ticket: `pnpm test` completo + `pnpm test:parity` → `code-review`
```

## Regras
- Nunca pule do pedido para o código: sem requisito numerado, volte à fase 1.
- Humano decide: regras de negócio, aprovação de spec, merge, migrações destrutivas, uso do tier `frontier`.
- Um ticket cabe numa janela de contexto. Contexto > 60%: `handoff` e sessão nova.
- Paralelismo só em tickets sem aresta de bloqueio (worktrees; veja `implement-spec`).
- Ao terminar cada fase, atualize `docs/sdd/traceability.md` (use a skill `traceability`).
