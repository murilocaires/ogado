# ADR-0017 — Lotação da simulação pela área pastável informada

**Status:** decisão explícita do dono em 20/10/2026, durante as correções da auditoria.

Pedido: “o cálculo é pra ser a lotação total sobre a área pastável informada”. Na interface atual, **lotação inicial por hectare = lotação total em UA ÷ área pastável digitada**. A lotação total já incorpora cabeças e peso inicial; não se altera esse numerador.

A ponte `calcularRecriaEntidade` seleciona `areaPastavel` para toda simulação, inclusive quando um rascunho ou cenário aberto carrega o antigo `fixa80`. Área vazia ou zero produz resultado indefinido, conforme RN-022. Mudar a área recalcula a lotação por hectare imediatamente. Não muda custos ou faturamento.

Isso substitui a parte do ADR-0014 §3 que mantinha o divisor antigo ao abrir dados salvos no simulador. O snapshot histórico continua imutável; abrir e salvar novamente captura a variante `areaPastavel` efetivamente usada. A função pura do domínio conserva `fixa80` para leitura histórica e paridade com a planilha original; a interface não seleciona essa variante.

Exemplo independente: 100 cabeças de 450 kg = 100 UA. Em 20 ha, lotação 5 UA/ha; em 50 ha, 2 UA/ha. Testes: `apps/web/lib/recria.test.ts` e jornadas de Recria em `e1-jornadas.spec.ts` (102 → 51 ha).
