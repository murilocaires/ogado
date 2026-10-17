# ADR-0003 — Aritmética decimal para dinheiro e peso

**Status:** aceito · **Data:** 2026-10-17

`decimal.js` no domínio (precisão 28), `Decimal` do Prisma na persistência (`Decimal(14,2)` dinheiro; `(10,3)` peso). Cálculo intermediário sem arredondar; arredondar só na exibição. Serialização na API como string decimal. **Esclarecimento:** `Decimal(14,2)`/`(10,3)` valem para *entradas* digitadas; resultados derivados guardados (ex.: resultado de uma simulação salva) ficam como string decimal **sem arredondar**. No IndexedDB (ADR-0007) todo valor decimal é guardado como string, nunca `number`. Razão: paridade ≤ 1e-6 com o Excel (IEEE-754 double) sem acumular erros de centavos e sem divergir de forma arbitrária; testes de ouro usam a tolerância relativa documentada.
