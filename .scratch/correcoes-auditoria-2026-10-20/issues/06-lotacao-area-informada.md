# RN-009 — lotação total sobre a área pastável informada
Type: task
Status: claimed
Blocked by: —

Pedido explícito do dono em 20/10/2026 durante a retomada: corrigir a lotação que usava /80. A ponte da simulação passa a selecionar sempre `areaPastavel`, inclusive para legado aberto no simulador. Área vazia/zero fica indefinida. Preservar snapshots originais e compatibilidade de paridade do domínio.

Critérios: 100 UA / 20 ha = 5 UA/ha; a mesma lotação / 50 ha = 2 UA/ha. Jornada real altera 102 → 51 ha e confirma a densidade, sem modificar o faturamento. ADR-0017 e três testes públicos da ponte documentam o comportamento. Aguardando gates integrados.
