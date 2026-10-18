# ADR-0004 — Lotação inicial: 80 ha fixos vs área pastável (PA-01)

**Status:** aceito (confirmado pelo pecuarista; generalizado em ADR-0008) · **Data:** 2026-10-17

> **Atualização (ADR-0012, proposta):** a escolha passa a ser feita na simulação e salva em cada cenário.

A célula `B24` da planilha divide por 80 (valor embutido), enquanto a área informada é 102 ha. Parece erro, mas a v1 exige paridade. **Decisão:** parâmetro `areaLotacaoInicial` com valores `fixa80` (padrão, igual à planilha) e `areaPastavel`. A UI exibe a opção como "Calcular pela área pastável" com ajuda explicando a diferença. Impacto: só `lotacaoHaInicial` muda; custos e resultado financeiro não dependem dela.
