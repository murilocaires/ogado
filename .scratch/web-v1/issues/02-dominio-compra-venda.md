# 02 (T-02): Domínio — compra e venda com paridade

**What to build:** funções públicas do domínio que calculam compras e vendas nos 3 modos de peso (total, médio, individual) e o saldo, mais o parser pt-BR de números e valores. Skill `spreadsheet-parity`.

**Blocked by:** 01

**Status:** aguardando-aprovacao

**Reqs:** RN-001…RN-006, RNF-001, RNF-007 · **Seam:** funções públicas de `packages/domain`

- [ ] Resultado igual ao ouro (saldo −R$ 89.475,83), tolerância relativa 1e-6, Decimal em dinheiro e peso
- [ ] Os 3 modos de peso valem para compra e venda; R$/cab. calculado em todas as linhas
- [ ] Parser e formatação `1.234,56` / BRL testados
- [ ] Testes nomeados com os IDs RN-xxx; cobertura do domínio ≥ 95%
