---
name: spreadsheet-parity
description: Porta fórmulas das planilhas para o domínio TypeScript com paridade exata e testes de ouro. Use em qualquer ticket que toque cálculo de Compra e Venda ou Recria.
---

# Paridade com as planilhas

Autoridade: `references/planilhas/*.xlsx` → especificação textual em `docs/negocio/03-formulas-e-paridade.md` → implementação de referência `references/calculo/calc.js` (verificada 32/32 contra as células) → `packages/domain` em TypeScript.

Procedimento:
1. Localize a fórmula no doc de paridade (ID `RN-xxx`, célula de origem).
2. Escreva o teste de ouro **antes** (valor esperado = literal da célula, tolerância 1e-6 relativo). Não recompute com a mesma fórmula.
3. Implemente com `Decimal`; função pura, sem I/O; entrada/saída tipadas por Zod.
4. Rode `node references/calculo/...` apenas como oráculo comparativo; `pnpm test:parity` deve passar.
5. Divergência intencional (ex.: área pastável no lugar dos 80 ha fixos) → opção explícita de configuração, padrão = comportamento da planilha, documentada em ADR.
6. Não "corrija" rótulos ou fórmulas da planilha em silêncio: veja a lista de pontos de atenção (PA-xx) no doc.
