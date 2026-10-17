# O Gado — kit de desenvolvimento (SDD + agentes + skills)

Kit para começar a construir a **versão web v1** do O Gado com Claude Code.

| Pasta / arquivo | O que é |
|---|---|
| `PROMPT_INICIAL.md` | **Comece aqui.** Passo a passo e o prompt para colar no Claude Code. |
| `CLAUDE.md` | Instruções permanentes dos agentes. |
| `.claude/agents/` | 8 subagentes (spec-architect, backend/frontend/test engineer, code-reviewer, debugger, docs-keeper, explorer), cada um com seu modelo-base. |
| `.claude/skills/` | 21 skills de [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) + 7 do projeto (`sdd-workflow`, `cost-routing`, `spreadsheet-parity`, `zod-contracts`, `prisma-migrations`, `design-to-code`, `traceability`). |
| `.claude/config/model-routing.json` | **JSON de alternância entre modelos** por tarefa, com orçamentos e escalonamento. |
| `.claude/hooks/` + `settings.json` | Bloqueio de git perigoso e proteção de `references/`. |
| `docs/negocio/` | Negócio, requisitos (RF/RN/RNF) e fórmulas com paridade. |
| `docs/sdd/` | Constituição, spec v1, plano, tickets, rastreabilidade. |
| `docs/adr/` | Decisões (loop vs graph engineering, stack, decimal, 80 ha, roteamento, skills). |
| `references/` | Design (pranchas `.dc.html`, tokens), planilhas originais, oráculo de cálculo (`calc.js`, `verify.py`), imagens de referência. |
| `tests/fixtures/golden.json` | Casos de ouro para os testes de paridade. |
| `scripts/` | `route-model.mjs`, `validate-routing.mjs`, `trace-check.mjs`. |

## Verificação rápida
```bash
node scripts/validate-routing.mjs     # coerência agentes/skills/JSON
node scripts/route-model.mjs api_endpoint
node scripts/trace-check.mjs          # cobertura de requisitos por teste
python3 references/calculo/verify.py  # 32 checks vs planilhas (pip install openpyxl)
```

## Método: loop engineering
Ver `docs/adr/0001-loop-engineering-com-rastreabilidade-leve.md`.

Skills de terceiros: © Matt Pocock, licença MIT (`.claude/skills/LICENSE-mattpocock-skills.txt`).
