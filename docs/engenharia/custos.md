# Registro de custos de IA

Uma linha por sessão/ticket (ver skill `cost-routing`).

| Data | Ticket | Tarefa | Tier usado | Escalonamentos | Iterações | Observação |
|---|---|---|---|---|---|---|
| 2026-10-17 | T-01 | Scaffold monorepo + CI + /health + parity (domain_calc_port/api_endpoint) | standard (sonnet) | 0 | 1 (5 máx.) | Implementação ~2h08 por rede lenta. Revisão (code-reviewer, standard): 0 bloqueia, 3 DEVE corrigidos. TDD formal não seguido (testes de fumaça). |
| 2026-10-17 | T-02 | Domínio compra e venda + parser pt-BR (domain_calc_port) | standard (sonnet) | 0 | 2 (5 máx.) | TDD vermelho→verde. ~27 min. Revisão: 0 bloqueia, 4 DEVE corrigidos (tolerância relativa estrita, RN-022 em compra/venda, IDs de teste). |
| 2026-10-17 | T-03 | Domínio recria + variantes ADR-0008 (domain_calc_port) | standard (sonnet) | 0 | 1 (5 máx.) | TDD vermelho→verde, cobertura 100%. ~24 min. Variantes não padrão aguardam revisão humana. |
| 2026-10-17 | T-02/T-03 | code-review conjunto | standard (sonnet) | 0 | 1 | ~11 min. |
| 2026-10-17 | T-04 etapa 1 | Auth, sessão e tenancy backend (api_endpoint) + revisão de segurança + correções | standard (sonnet) | 0 | 1 (5 máx.) | Implementação ~2h (vitest lento, 60–350 s por rodada). Revisão (code-reviewer): 0 bloqueia, 5 DEVE corrigidos (guardião CA-12, NODE_ENV, TRUST_PROXY, logout sem corpo, IP em logs). Agentes pararam uma vez por limite de uso e foram retomados. |
