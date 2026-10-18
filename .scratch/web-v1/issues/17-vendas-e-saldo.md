# 17 (T-17): Vendas e saldo

**What to build:** CRUD de lotes de venda e o resumo com cabeças, @ e total por aba e o saldo (vendas − compras) com sinal e cor.

**Blocked by:** 06

**Status:** aguardando-aprovacao

**Reqs:** RF-021, RF-023, RN-002, RN-005, RN-006 · **Seam:** API + e2e

- [ ] Saldo igual ao ouro (−R$ 89.475,83) com os dados de exemplo
- [ ] Venda: 1 @ = 15 kg com desconto de 10 kg × cab, nos 3 modos de peso
- [ ] Fiel a `WebCompraVenda`

**Revisão pós-protótipo (ADR-0012, proposta):** o critério "1 @ = 15 kg com desconto de 10 kg × cab" é substituído por RN-024/RN-025 (base da @ por lote; desconto % padrão 10%, automático para fêmeas, RF-026) e o saldo de ouro por §A2 de `03-formulas-e-paridade.md`. Depende da aprovação do Q-A/Q-B. Tela única Negócios (RF-024).
