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


## Como subir tudo (T-01)
Pré-requisitos: Node 22, pnpm 11, Docker.
```bash
cp .env.example .env          # valores de dev; .env é ignorado pelo git
docker compose up -d          # Postgres (volume ogado_pgdata, healthcheck, porta POSTGRES_PORT)
pnpm install
pnpm db:generate              # gera o Prisma Client (packages/db)
pnpm dev                      # API em :3001 e web em :3000
```
Abra http://localhost:3000: a página mostra o resultado de `GET http://localhost:3001/health` (`{"status":"ok","db":"ok"}`). A URL da API vem de `NEXT_PUBLIC_API_URL`; o CORS da API usa `WEB_ORIGIN`.

### Gates
```bash
pnpm typecheck
pnpm lint
pnpm test          # o teste de /health usa Postgres real (docker compose up -d antes; DATABASE_URL)
pnpm test:parity   # script Node: oráculo references/calculo/calc.js vs tests/fixtures/golden.json (tol. 1e-6)
pnpm build
node scripts/trace-check.mjs
node scripts/validate-routing.mjs
```
`pnpm parity:xlsx` roda o `verify.py` (compara com as planilhas .xlsx; exige Python + `pip install openpyxl`). É opcional e pensado para Linux/CI: no Windows o `verify.py` quebra por causa das barras invertidas no caminho passado ao node.

Estrutura: `apps/web` (Next), `apps/api` (Fastify), `packages/domain`, `packages/contracts`, `packages/db`. Versões e ferramentas: `docs/adr/0009-versoes-e-ferramentas.md`.

## Verificação rápida
```bash
node scripts/validate-routing.mjs     # coerência agentes/skills/JSON
node scripts/route-model.mjs api_endpoint
node scripts/trace-check.mjs          # cobertura de requisitos por teste
pnpm test:parity                      # oráculo vs golden.json (Node, sem Python)
pnpm parity:xlsx                      # opcional: verify.py vs planilhas (Linux/CI; pip install openpyxl)
```

## Método: loop engineering
Ver `docs/adr/0001-loop-engineering-com-rastreabilidade-leve.md`.

Skills de terceiros: © Matt Pocock, licença MIT (`.claude/skills/LICENSE-mattpocock-skills.txt`).
