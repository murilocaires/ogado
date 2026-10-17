# 03 (T-03): Domínio — recria com paridade e variantes de fórmula

**What to build:** cálculo completo da recria (custos, bruto, líquido, caixa, por mês e por ha) com os parâmetros padrão editáveis e as duas variantes do ADR-0008 (lotação inicial; faturamento bruto).

**Blocked by:** 01

**Status:** aguardando-aprovacao

**Reqs:** RN-007…RN-023 (inclui RN-019, RN-020, RN-022) · **Seam:** funções públicas de `packages/domain`

- [ ] Variantes padrão (`fixa80`, `pesoVivo`) iguais ao ouro (bruto 271.967,48…; líquido 102.408,05…; 32 checks)
- [ ] Variantes `areaPastavel` e `carcaca` com valores calculados à mão, marcados `origem: "nao-planilha"` e **revisados pelo humano**
- [ ] Divisão por zero e campo vazio devolvem "indefinido" sem quebrar (RN-022)
- [ ] Cabeças fracionárias calculadas exatas; o aviso "≈ 60 cab." fica para a UI
- [ ] Variante entra como parâmetro explícito, sem estado global
