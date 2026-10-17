---
name: cost-routing
description: Escolhe o modelo certo por tarefa (haiku/sonnet/opus) lendo .claude/config/model-routing.json e aplica orçamentos e escalonamento. Use antes de delegar a um subagente ou quando uma tarefa falhar repetidamente.
---

# Roteamento de modelo por custo

Fonte única: `.claude/config/model-routing.json`. Consulta rápida: `node scripts/route-model.mjs <tarefa> [--failures N]`.

1. Classifique a tarefa numa chave de `tasks` (ex.: `api_endpoint`, `zod_contracts`, `spec_write`).
2. Delegue ao subagente indicado (`agent`) — o frontmatter dele já fixa o modelo-base. Para sobrepor, passe `model` na chamada do subagente com o resultado do script.
3. **Comece barato.** Suba de tier só se o gate falhar 2x pelo mesmo motivo (máx. 1 escalonamento por tarefa). `frontier` nunca é automático.
4. Nunca rebaixe: `spec`, `architecture`, `security_review`, `migration_review`, `calc_parity`.
5. Poupe contexto: use `explorer` (haiku) para ler muito; peça resumos; não cole arquivos grandes; compacte aos 60%.
6. Ao fim da sessão, registre uma linha em `docs/engenharia/custos.md` (tarefa, tier usado, escalonamentos, iterações). Se um tipo de tarefa escala com frequência, sugira ajustar o tier no JSON (via ADR curto).
