# ADR-0008 — Variantes de fórmula escolhidas pelo usuário

**Status:** aceito (decisão do pecuarista, grill de 2026-10-17) · **Data:** 2026-10-17

## Contexto
Duas divergências entre a planilha e o texto do curso/documentos: a lotação inicial (PA-01, divide por 80 ha fixos) e o faturamento bruto (a planilha usa **peso vivo ÷ 30**; o texto antigo da RN-017 dizia **@ de carcaça**). A constituição exige paridade; o usuário quer poder escolher.

## Decisão
1. Existem **variantes de fórmula** como parâmetros da fazenda (RN-023). **O padrão é sempre o da planilha.** Só há duas variantes na v1:
   - `lotacaoInicial`: `fixa80` (padrão, ADR-0004) | `areaPastavel`.
   - `faturamentoBruto`: `pesoVivo` (padrão: peso final ÷ 30 × cab × R$/@, igual a `E33`/`B29`) | `carcaca` (@ de carcaça/cab da RN-013 × cab × R$/@).
2. A escolha fica **nas configurações da fazenda** (RF-011). Não há seletor dentro de cada simulação.
3. Cada **simulação salva guarda a variante usada** (snapshot dos parâmetros); mudar a configuração depois não altera cenários antigos. O resultado exibe um rótulo com a variante ("Bruto: peso vivo · como na planilha").
4. `packages/domain` recebe a variante como entrada explícita; não há variável global.
5. **Testes:** o ouro (`golden.json`) cobre apenas os padrões. Valores esperados das variantes não padrão são **calculados à mão e revisados pelo humano**, marcados `origem: "nao-planilha"`. A paridade de 1e-6 só é exigida das variantes padrão.
6. Nova variante exige ADR e aprovação humana; não se abre variante "por precaução".

## Consequências
- Mais um caminho de teste por variante (limite de duas na v1).
- A UI deve deixar claro qual variante está ativa; "restaurar padrão da planilha" volta ambas.
- Os parâmetros sincronizam offline como os demais (ADR-0007).
