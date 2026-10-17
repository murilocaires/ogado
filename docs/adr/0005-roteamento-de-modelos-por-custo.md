# ADR-0005 — Roteamento de modelos por custo

**Status:** aceito · **Data:** 2026-10-17

Config única em `.claude/config/model-routing.json`: tarefas → tiers (`economy`=haiku, `standard`=sonnet, `premium`=opus, `frontier` desligado). Regra: começar no tier mais barato que passa o gate; escalar 1 tier após 2 falhas iguais; nunca rebaixar spec/arquitetura/segurança/paridade; orçamentos soft/hard por ticket e sessão (em pontos relativos de custo); contexto compactado aos 60%. Subagentes fixam o modelo-base no frontmatter e o orquestrador pode sobrepor com `scripts/route-model.mjs`. Preços reais ficam em `pricing_usd_per_mtok` (preencher).
