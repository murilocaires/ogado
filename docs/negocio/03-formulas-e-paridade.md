# Fórmulas e paridade com as planilhas

Autoridade em ordem: **células do .xlsx** (`references/planilhas/`) → este documento → `references/calculo/calc.js` (oráculo JS, 32/32 verificado por `references/calculo/verify.py`) → `packages/domain` (TypeScript). Tolerância dos testes: erro relativo ≤ 1e-6.

## A. Compra e Venda (`compra-e-venda-de-gado.xlsx`)

> **Atenção (ADR-0012):** as linhas de **venda** abaixo (`F11`, `H11`, `H19` e o saldo −89.475,83) são a **regra original da planilha**. O protótipo muda a venda (base da @ e desconto %); ver §A2 e §D3. Compra e recria não mudam.

| Campo | Fórmula | Célula | Ouro |
|---|---|---|---|
| kg do lote | informado, ou qtd × peso médio, ou Σ pesos | `E` | lote 2: 10 × 210 = 2.100 |
| @ compra | kg ÷ 30 | `F4` | lote 1: 377,0333… |
| total compra | @ × R$/@ | `H4` | lote 1: 122.535,8333… |
| R$/cab. | total ÷ qtd | `I5` | lote 2: 2.030,00 |
| total compras | Σ | `H8` | 142.835,8333… |
| @ venda | (kg − qtd × 10) ÷ 15 | `F11` | (2.920 − 160) ÷ 15 = 184 |
| total venda | @ × R$/@ | `H11`/`H15` | 53.360,00 |
| **saldo** | vendas − compras | `H19` | **−89.475,8333…** |

Cenário de ouro (RN-001…006): compras = {60 cab., 11.311 kg total, R$ 325/@; 10 cab., 210 kg médio, R$ 290/@}; vendas = {16 cab., 2.920 kg total, R$ 290/@}.
Caso extra (modo individual, RN-003): 3 animais de 200, 210 e 220 kg a R$ 300/@ → 630 kg, 21 @, R$ 6.300,00, R$ 2.100,00/cab.

### A2. Venda no protótipo (ADR-0012 — aguardando aprovação, Q-A)
O protótipo (`docs/prototipo/ogado-prototipo.html`, função `vendaLinha`) calcula a venda assim; **substitui** as linhas `@ venda`/`total venda` da tabela acima como regra do produto, e a planilha fica como referência histórica:

| Campo | Fórmula | Regra |
|---|---|---|
| kg líquido | kg × (1 − desconto%) ; desconto padrão 10%, 0% se desligado | RN-025 |
| @ venda | kg líquido ÷ 30 (base `vivo`, padrão) ou ÷ 15 (base `carcaca`) | RN-024 |
| total venda | @ × R$/@ | RN-005 |
| R$/cab. | total ÷ qtd (indefinido com qtd 0) | RN-004 |

**Valores propostos para o novo ouro da venda** (lote 16 cab., 2.920 kg, R$ 290/@; compras inalteradas = 142.835,8333…). Calculados à mão a partir das fórmulas acima, `origem: "nao-planilha"`, **a revisar pelo humano** antes de virarem teste:

| Base | Desconto | @ | Total venda | Saldo |
|---|---|---|---|---|
| carcaça (÷ 15) | 10% | 175,2 | 50.808,00 | −92.027,8333… |
| peso vivo (÷ 30) | sem desconto | 97,3333… | 28.226,6667… | −114.609,1667… |
| peso vivo (÷ 30) | 10% | 87,6 | 25.404,00 | −117.431,8333… |

O ouro original da planilha (saldo **−89.475,8333…**, `@ = (2.920 − 16×10) ÷ 15 = 184`) continua no oráculo `calc.js` e em `tests/fixtures/golden.json` como **referência histórica**; deixa de ser o critério de aceite do saldo se o ADR-0012 for aprovado.

## B. Recria (`calculos-recria.xlsx`)

Entradas padrão: área 102 · dias 270 · investimento 122.534,80 · R$/cab. 2.050 · peso 188 → 420 · R$/@ 325 · consumo 0,3% · proteinado R$ 2,00/kg · rend. 52% · imposto 1,5% · sanidade R$ 2,50 · funcionário 9.000 · frete 3.000 · lotação inicial = "fixa80".

| Resultado | Fórmula | Célula | Ouro |
|---|---|---|---|
| cabeças | investimento ÷ R$/cab. | `B21` | 59,773073170731706 |
| UA total | cab × pesoIni ÷ 450 | `B23` | 24,9718616802168 |
| lotação inicial/ha | UA ÷ 80 (ou ÷ área) | `B24` | 0,31214827100271 |
| peso médio | (ini+fin) ÷ 2 | `B26` | 304 |
| lotação final/ha | cab × médio ÷ 450 ÷ área | `B27` | 0,39588266326584837 |
| @ na venda | fin ÷ 30 × cab | `B29` | 836,8230243902439 |
| consumo kg/cab/dia | médio × 0,3% | `F24` | 0,912 |
| suplemento/dia (lote) | consumo × R$/kg × cab | `F26` | 109,02608546341463 |
| suplemento total | × dias | `F27` | 29.437,04307512195 |
| @ carcaça/cab | fin × 52% ÷ 15 | `J20` | 14,56 |
| venda/cab | × R$/@ | `J21` | 4.732,00 |
| imposto/cab · total | × 1,5% · × cab | `J23`,`J24` | 70,98 · 4.242,692733658537 |
| sanidade total | dias ÷ 30 × cab × 2,5 | `M20` | 1.344,8941463414633 |
| **custo operacional** | suplemento + sanidade + imposto + frete + func. | `B38` | **47.024,62995512195** |
| bruto (`pesoVivo`, padrão) | peso final ÷ 30 × cab × 325 (= `B29` × 325; **não** usa a @ de carcaça) | `E33` | 271.967,48292682925 |
| **líquido** | bruto − custo − investimento | `E35` | **102.408,0529717073** |
| total em caixa | investimento + líquido | `E38` | 224.942,8529717073 |
| líquido/mês | líquido ÷ (dias ÷ 30) | `F33` | 11.378,672552411921 |
| líquido/ha | líquido ÷ área | `F35` | 1.004,0005193304637 |
| GMD implícito | (fin − ini) ÷ dias | — | 0,8592592592592593 |

## C. Regras de arredondamento e exibição
- Calcule em precisão total; arredonde **somente** na exibição (BRL 2 casas; @ 2 casas; kg 0 casas; cabeças inteiras com "≈").
- Moeda negativa com sinal tipográfico "−" e cor de atenção (Barro); positiva em Folha/Pasto conforme o fundo.

## D. Oráculo
`node -e "const c=require('./references/calculo/calc.js');console.log(c.recria(c.sample.recria).faturamentoLiquido)"` → `102408.0529717073`.
`python3 references/calculo/verify.py` → `TOTAL 32 falhas 0` (requer `openpyxl`).

## D2. Divergências deliberadas em relação ao `calc.js` (entrada e exibição)
- **R$/cab. com quantidade 0** é indefinido ("—"), não 0 como no oráculo (RN-022).
- **Parser de formulário** (`parseNumeroPtBr`): só a vírgula é decimal; `1.500` e `1.5` retornam inválido. O modo `{ ambiguoPonto: 'planilha' }` reproduz o `calc.js` (colar texto da planilha). Decisão do pecuarista em 2026-10-17.
- **Tolerância de paridade:** relativa estrita, `|atual − esperado| ≤ 1e-6 × |esperado|`.

## D3. Divergências deliberadas em relação à planilha (protótipo, ADR-0012)
- **Venda:** base da @ por lote (vivo 30 kg | carcaça 15 kg) e desconto **percentual** (padrão 10%, por lote) no lugar de 10 kg × cab (RN-024/025). O padrão deixa de ser a planilha (Q-A).
- **Compra:** inalterada (@ = kg ÷ 30), sem desconto.
- **Recria:** as fórmulas do protótipo são as da planilha (conferidas linha a linha com `recria()` do protótipo: cabeças, UA, lotação, suplemento, imposto, sanidade, custo, bruto = `pesoFin ÷ 30 × cab × R$/@`, líquido, caixa, mês, ha, GMD). Muda só a **escolha** da lotação inicial (na simulação) e a **ausência** da variante `carcaca` do bruto.
- **Entradas em %:** o simulador recebe consumo, rendimento e imposto em % (ex.: `0,3`, `52`, `1,5`) e converte para fração antes de calcular; a API/domínio continuam em fração (ADR-0011 §2).
- **Cabeças = 0 / campos vazios:** o protótipo mostra R$ 0 onde a spec manda "—" (RN-022); a spec prevalece.

## E. Alertas da recria (promovidos à v1 — RN-026)
Cabeças fracionárias · lotação inicial > 4 UA/ha · lotação final > 6 UA/ha · mais de 250 cabeças. Informativos, nunca bloqueiam. (As demais "Metas" abaixo seguem na v2.)

## F. Fórmulas futuras (v2) — Metas da RECRIA
GMD = (saída − entrada) ÷ dias · lotação entrada/média/saída = (cab/ha × peso) ÷ 450 · R$ compra = (peso ÷ 30) × cab × R$/@ · custo op. = (dias ÷ 30) × cab × desembolso · faturamento = (peso saída ÷ 30) × cab × R$/@ · rentabilidade a.m. = (margem ÷ custo total) ÷ meses · @ produzidas = ((saída − entrada) ÷ 30) × cab · custo da @ = custo op. ÷ @ produzidas · anos para pagar = (custo total + investimentos) ÷ faturamento. Alertas: ≤ 250 cab./lote; lotação entrada ≤ 4 e saída ≤ 6 UA/ha.
