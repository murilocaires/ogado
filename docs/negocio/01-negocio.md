# O Gado — Documento de Negócio

> Fonte: 4 planilhas do curso **O Pecuário** (Compra e Venda de Gado, Cálculos Recria, CRIA, RECRIA), em `references/planilhas/`. Este documento explica o negócio para que qualquer pessoa (ou agente) entenda *por que* o sistema calcula o que calcula. Termos canônicos estão em `GLOSSARY.md`.

## 1. Quem é o usuário e qual a dor

O **pecuarista de cria/recria** (pequeno e médio, fazenda de 50–500 ha) toma decisões caras com planilhas: quantos bezerros comprar, por quanto, quanto custa engordá-los no pasto e quando vender. Hoje ele:

- digita tudo no Excel/Google Sheets, muitas vezes no celular, com risco de quebrar fórmulas;
- não tem histórico por safra nem comparação entre cenários;
- mistura valores digitados com calculados (células trocadas, fórmula com valor fixo "escondido");
- decide pelo "olhômetro" a *arroba* certa para comprar e vender.

**Proposta do O Gado:** manter *exatamente* os cálculos validados no curso, num produto web/app que impede erros de preenchimento, guarda o histórico e mostra o resultado em linguagem de fazenda — "Cada arroba na ponta do lápis".

## 2. O negócio em uma página

```
        CRIA                       RECRIA                      (ENGORDA)
 vaca → bezerro (desmama)  →  compra bezerro leve  →  pasto + suplemento  →  venda
   ↑ indicadores:               ↓ ~270 dias                   ↓                ↓
 prenhez, desmame,        seca (120 d) + águas (240 d)   ganho de peso     @ de carcaça
 kg desmamado/vaca        ano safra Jul–Jun              (GMD)             menos imposto
```

- **Cria**: manter matrizes (vacas), cobrir/inseminar (IATF ou touro), parir e desmamar bezerros. Receita = bezerros desmamados. O que importa: *quantos bezerros e quantos kg por vaca/ha*.
- **Recria**: comprar bezerros após a desmama e criá-los a pasto até o peso de venda (ou de entrada na engorda). Receita = ganho de peso (arrobas produzidas) valorizado ao preço da @. O que importa: *custo por @ produzida e margem sobre o capital investido*.
- **Compra e venda**: registro dos lotes comprados e vendidos, com o *saldo* do giro.

A **v1 do O Gado cobre Compra e Venda + Cálculos de Recria** (as duas planilhas simples). Cria completa e as demais abas de Recria (planejamento, suplementação, adubação, água, lotação) vêm nas versões seguintes.

## 3. Conceitos e unidades (resumo; detalhes no GLOSSARY)

| Conceito | Definição usada nas planilhas |
|---|---|
| **Arroba (@)** | Na **compra**, 1 @ = **30 kg de peso vivo**. Na **venda** (protótipo, ADR-0012) o lote escolhe a base: **peso vivo** (30 kg, padrão) ou **carcaça** (15 kg). Na planilha original a venda era sempre 15 kg de carcaça. |
| **Rendimento de carcaça** | 52% do peso vivo (padrão editável). |
| **Desconto na venda** | **Percentual do peso** (padrão 10%) aplicado por lote antes de converter em @; vem ligado para categorias femininas e desligado para as demais (editável). Na planilha original: 10 kg por cabeça. |
| **UA — Unidade Animal** | 450 kg de peso vivo. Lotação = UA por hectare. |
| **GMD** | Ganho médio diário (kg/cab/dia) = (peso final − inicial) / dias. |
| **Ano safra** | Julho a junho. Recria típica: 120 dias de seca + 240 dias de capim verde (o app permite informar os dias). |
| **Proteinado / suplemento** | Mistura fornecida no cocho; consumo ≈ 0,3% do peso vivo médio por dia. |
| **Sanidade** | Vacinas, vermífugos etc.; R$ 2,50 por cabeça por mês (padrão). |
| **Imposto** | 1,5% sobre o valor de venda. |
| **Cabeça (cab.)** | Um animal. Lote = grupo comprado ou vendido junto. |

## 4. Planilha 1 — Compra e Venda de Gado (v1)

**Objetivo:** registrar lotes comprados e vendidos e apurar o **saldo** (vendas − compras).

Linhas de **compra** (categoria, quantidade, peso, preço da @, data):
- O peso pode ser informado como **peso total do lote (kg)** *ou* **peso médio × quantidade**. O app acrescenta um terceiro modo pedido pelo usuário: **peso individual** (animal a animal), somando os pesos.
- @ = kg ÷ 30 · Total = @ × R$/@ · R$/cab. = Total ÷ cabeças.

Linhas de **venda** (planilha original): igual, porém @ = (kg − cabeças × 10) ÷ 15 e Total = @ × R$/@.

**Venda no protótipo (ADR-0012, aguardando aprovação):** cada lote escolhe a **base do preço da @** (peso vivo ÷ 30, padrão, ou carcaça ÷ 15) e um **desconto percentual** sobre o peso (padrão 10%, ligado automaticamente para fêmeas). @ = kg × (1 − desconto%) ÷ (30 ou 15); Total = @ × R$/@. As telas de Compra e Venda viram uma só, **Negócios**, com abas Todas/Compras/Vendas.

**Exemplo de ouro** (planilha original): compras R$ 142.835,83, vendas R$ 53.360,00, **saldo −R$ 89.475,83**. Com a regra do protótipo o saldo muda (valores propostos em `03-formulas-e-paridade.md` §A2).

Pontos de atenção da planilha: ver §8.

## 5. Planilha 2 — Cálculos Recria (v1)

**Objetivo:** responder "se eu investir R$ X em bezerros e criá-los por N dias em Y ha, quanto sobra?".

Entradas (células brancas): área pastável (102 ha), dias (270), investimento (R$ 122.534,80), R$/cab. de compra (2.050), peso inicial (188 kg) e final (420 kg), preço de venda (R$ 325/@), consumo de suplemento (0,3%), preço do proteinado (R$ 2/kg), rendimento de carcaça (52%), imposto (1,5%), sanidade (R$ 2,50/cab./mês), funcionário (R$ 9.000) e frete (R$ 3.000).

Cadeia de cálculo (todas as fórmulas com célula no doc `03-formulas-e-paridade.md`):

1. **Cabeças** = investimento ÷ R$/cab. (59,77 — a planilha **não arredonda**; o app guarda o valor exato e exibe 60).
2. **Lotação**: UA total = cab × peso ÷ 450; lotação inicial = UA ÷ 80 ha; peso médio = (ini + fin) ÷ 2; lotação final = cab × peso médio ÷ 450 ÷ área.
3. **Produção**: @ na venda = peso final ÷ 30 × cab.
4. **Suplemento**: consumo/cab/dia = peso médio × 0,3%; custo = consumo × R$/kg × cab × dias.
5. **Venda**: @ de carcaça/cab = peso final × 52% ÷ 15; venda/cab = @ × R$/@; imposto = venda/cab × 1,5% × cab.
6. **Custos**: sanidade = dias ÷ 30 × cab × 2,5; **custo operacional** = suplemento + sanidade + imposto + frete + funcionário.
7. **Resultado**: bruto = @ × preço; **líquido = bruto − custo operacional − investimento**; total em caixa = investimento + líquido; líquido/mês; líquido/ha.

**Exemplo de ouro**: custo operacional R$ 47.024,63 · bruto R$ 271.967,48 · **líquido R$ 102.408,05** · em caixa R$ 224.942,85 · líquido/mês R$ 11.378,67 · líquido/ha R$ 1.004,00.

## 6. Planilha 3 — CRIA (17 abas; versões futuras)

Controle da fazenda de cria. Abas e propósito:

| Aba | Para que serve | Versão alvo |
|---|---|---|
| Indicadores (oculta) | taxa de prenhez = prenhas ÷ vacas; taxa de desmame = desmamados ÷ vacas; kg desmamado/vaca = (peso × desmamados) ÷ vacas; kg/ha; bezerros/ha | v2 |
| Planejamento (~7.000 fórmulas, 572 linhas ocultas) | calendário e metas do ano reprodutivo | v2 |
| IATF x Touro; 1 IATF + Touro; 2 IATF + Touro | comparação de protocolos de cobertura (custo por prenhez) | v2 |
| Reprodutivo LANÇAR; Ficha Reprodutivo IMPRIMIR | lançamento por matriz e ficha impressa | v2 |
| Formulação de suplementos | misturas e custo/kg | v2 |
| CHUVAS | registro de chuva mensal | v2 (módulo compartilhado) |
| Cadastro de pastos; Planejamento de lotação; Resultado lotação; Potencial dos pastos | pastos, lotação e capacidade de suporte | v2 |
| Adubação; Dimensionamento de água; Resumo materiais | insumos e infraestrutura | v2 (compartilhado) |
| Evolução dos anos – Avançado | série histórica por safra | v3 |

## 7. Planilha 4 — RECRIA completa (11 abas; versões futuras)

Metas, planejamento e acompanhamento da recria: CHUVAS, **Metas**, Adubação, Dimensionamento de água, Formulação de suplemento, Relatório/Resumo de suplementação, Resumo materiais, "Vamos ver", **Fechamento** e **Acompanhamento de lotação e suplementação** (≈7.300 fórmulas; ≈3.300 células destravadas).

**Metas** (v2) formaliza indicadores: GMD = (saída − entrada) ÷ dias; lotação de entrada/média/saída (UA/ha); R$ de compra = (peso ÷ 30) × cab × R$/@; custo operacional = (dias ÷ 30) × cab × desembolso mensal; faturamento = (peso saída ÷ 30) × cab × R$/@; margem; rentabilidade a.m. = (margem ÷ custo total) ÷ meses; @ produzidas = ((saída − entrada) ÷ 30) × cab; **custo da @** = custo operacional ÷ @ produzidas; anos para pagar = (custo total + investimentos) ÷ faturamento. Alertas: máx. 250 cabeças por lote; lotação de entrada > 4 UA/ha e de saída > 6 UA/ha; referência da média brasileira de 6 @/ha/ano.

Quatro abas (CHUVAS, Adubação, Dimensionamento de água, Resumo materiais) são **idênticas** em CRIA e RECRIA → viram **módulos compartilhados** no produto.

## 8. Pontos de atenção encontrados nas planilhas (decisões herdadas)

| ID | Achado | Decisão proposta |
|---|---|---|
| PA-01 | `B24` (lotação inicial) divide por **80 ha fixos**, não pela área informada (102) | Padrão = igual à planilha; opção "Pela área pastável" desligada por padrão. ADR-0004 |
| PA-02 | Rótulos trocados: `B28` é R$/@, `F24` é consumo kg/cab/dia | App usa os rótulos corretos; paridade pelos valores |
| PA-03 | `F19/F20/F21/B37` repetem valores digitados | No app são **o mesmo campo** (um valor, vários usos) |
| PA-04 | Cabeças fracionárias (59,77) | Calcula com valor exato, exibe arredondado com aviso "≈ 60 cab." |
| PA-05 | `I4` (R$/cab.) só existe na linha 5 | Calculado para todas as linhas |
| PA-06 | Nenhuma aba oculta/protegida nas duas planilhas v1; ocultas só na CRIA | Registrar para v2 |
| PA-07 | Células "travadas" vs editáveis: azul/branco entrada, restante calculado | Campo branco = entrada; menta + cadeado = calculado |
| PA-08 | Venda na planilha: @ sempre de 15 kg e desconto fixo de 10 kg/cab (vale igual para machos e fêmeas) | O protótipo troca por base da @ por lote + desconto % (padrão 10%, automático para fêmeas). Decisão pendente de aprovação: ADR-0012 / Q-A |

## 9. Visão de produto e roadmap

- **v1 (web)**: conta, fazenda, Compra e Venda (3 modos de peso), Recria (simulador + resultado), painel, exportação. **Instalável (PWA) e utilizável offline com sincronização (ADR-0007).** *Paridade exata com as planilhas v1.*
- **v1 também inclui** cenários nomeados e datados (RF-032, T-08), com busca, ordenação, lista/grade e **comparação de 2 a 3 cenários** (RF-033…RF-036, promovida da v1.1 pelo ADR-0012), a tela **Conta** (RF-004…RF-007, T-18) e a **ajuda contextual** "i" (RF-052); a exportação CSV/XLSX é desejável (RF-041, nível S).
- **v1.1**: importação de planilha Excel (RF-042); várias fazendas por conta.
- **v2**: Cria (indicadores, reprodutivo, IATF×touro), Metas e Fechamento da Recria, módulos compartilhados (chuvas, adubação, água, materiais), integração Google Sheets.
- **v3**: app móvel nativo (o offline já existe na web v1), evolução multi-safra, relatórios e equipe.

## 10. Premissas e riscos

- Os parâmetros (30 kg, 15 kg, 10 kg, 450 kg, 52%, 1,5%…) são **padrões do curso**, editáveis por fazenda mas com *reset para o padrão da planilha*.
- Conteúdo do curso O Pecuário é referência de método; confirme direitos de uso do nome/material antes de publicar.
- Valores monetários exibidos em BRL; cálculos em precisão decimal.
- Risco: usuário confunde simulação com contabilidade → deixar claro "simulação / estimativa".
