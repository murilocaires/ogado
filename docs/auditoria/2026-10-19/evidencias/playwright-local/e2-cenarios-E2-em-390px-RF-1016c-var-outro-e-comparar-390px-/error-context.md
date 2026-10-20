# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2-cenarios.spec.ts >> E2 em 390px >> RF-032/RF-033 simular, salvar, salvar outro e comparar (390px)
- Location: apps\web\e2e\e2-cenarios.spec.ts:20:5

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByLabel('Área pastável', { exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "Pular para o conteúdo" [ref=e3] [cursor=pointer]:
      - /url: "#conteudo"
    - generic [ref=e4]:
      - main [ref=e5]:
        - generic [ref=e7]:
          - heading "Cálculos Recria" [level=1] [ref=e8]
          - paragraph [ref=e9]: Mude os números e veja o resultado na hora.
        - tablist "Recria" [ref=e10]:
          - tab "Simulador" [selected] [ref=e11] [cursor=pointer]
          - tab "Cenários 0" [ref=e12] [cursor=pointer]:
            - text: Cenários
            - generic [ref=e13]: "0"
        - tabpanel "Simulador" [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]:
              - region [ref=e17]:
                - generic [ref=e18]:
                  - heading "Dados do lote" [level=2] [ref=e19]
                  - button "Limpar Dados do lote" [ref=e20] [cursor=pointer]: Limpar
                - generic [ref=e21]:
                  - generic [ref=e22]:
                    - generic [ref=e23]: Área Pastável
                    - generic [ref=e24]:
                      - textbox "Área Pastável" [ref=e25]
                      - generic [aria-hidden] [ref=e26]: ha
                    - generic [ref=e27]: Preencha este campo para calcular.
                  - generic [ref=e28]:
                    - generic [ref=e29]: Dias de Recria
                    - generic [ref=e30]:
                      - textbox "Dias de Recria" [ref=e31]
                      - generic [aria-hidden] [ref=e32]: dias
                    - generic [ref=e33]: Preencha este campo para calcular.
                  - generic [ref=e34]:
                    - generic [ref=e35]: Investimento (compra)
                    - generic [ref=e36]:
                      - generic [aria-hidden] [ref=e37]: R$
                      - textbox "Investimento (compra)" [ref=e38]
                    - generic [ref=e39]: Preencha este campo para calcular.
                  - generic [ref=e40]:
                    - generic [ref=e41]: R$/cab (compra)
                    - generic [ref=e42]:
                      - generic [aria-hidden] [ref=e43]: R$
                      - textbox "R$/cab (compra)" [ref=e44]
                    - generic [ref=e45]: Preencha este campo para calcular.
                  - generic [ref=e46]:
                    - generic [ref=e47]:
                      - text: Total de cabeças
                      - 'button "O que é: Cabeças" [ref=e48] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e49]: i
                    - 'group "Total de cabeças O que é: Cabeças" [ref=e50]':
                      - status [ref=e54]: —
                  - generic [ref=e55]:
                    - generic [ref=e56]: Peso inicial
                    - generic [ref=e57]:
                      - textbox "Peso inicial" [ref=e58]
                      - generic [aria-hidden] [ref=e59]: kg
                    - generic [ref=e60]: Preencha este campo para calcular.
                  - generic [ref=e61]:
                    - generic [ref=e62]:
                      - text: Lotação Total
                      - 'button "O que é: Lotação total" [ref=e63] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e64]: i
                    - 'group "Lotação Total O que é: Lotação total" [ref=e65]':
                      - status [ref=e69]: —
                  - generic [ref=e70]:
                    - generic [ref=e71]:
                      - text: Lotação/ha
                      - 'button "O que é: Lotação inicial" [ref=e72] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e73]: i
                    - 'group "Lotação/ha O que é: Lotação inicial" [ref=e74]':
                      - status [ref=e78]: —
                  - generic [ref=e79]:
                    - generic [ref=e80]: Peso Final
                    - generic [ref=e81]:
                      - textbox "Peso Final" [ref=e82]
                      - generic [aria-hidden] [ref=e83]: kg
                    - generic [ref=e84]: Preencha este campo para calcular.
                  - generic [ref=e85]:
                    - generic [ref=e86]:
                      - text: Peso Médio
                      - 'button "O que é: Peso médio" [ref=e87] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e88]: i
                    - 'group "Peso Médio O que é: Peso médio" [ref=e89]':
                      - status [ref=e93]: —
                  - generic [ref=e94]:
                    - generic [ref=e95]:
                      - text: Lotação Final
                      - 'button "O que é: Lotação final" [ref=e96] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e97]: i
                    - 'group "Lotação Final O que é: Lotação final" [ref=e98]':
                      - status [ref=e102]: —
                  - generic [ref=e103]:
                    - generic [ref=e104]:
                      - text: GMD implícito
                      - 'button "O que é: GMD implícito" [ref=e105] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e106]: i
                    - 'group "GMD implícito O que é: GMD implícito" [ref=e107]':
                      - status [ref=e111]: —
                  - generic [ref=e112]:
                    - generic [ref=e113]: R$/cab (venda)
                    - generic [ref=e114]:
                      - generic [aria-hidden] [ref=e115]: R$
                      - textbox "R$/cab (venda)" [ref=e116]
                      - generic [aria-hidden] [ref=e117]: /@
                    - generic [ref=e118]: Preencha este campo para calcular.
                  - generic [ref=e119]:
                    - generic [ref=e120]:
                      - text: Produzidas
                      - 'button "O que é: @ na venda (peso vivo)" [ref=e121] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e122]: i
                    - 'group "Produzidas O que é: @ na venda (peso vivo)" [ref=e123]':
                      - status [ref=e127]: —
              - region [ref=e128]:
                - generic [ref=e129]:
                  - heading "Cálculo do Suplemento" [level=2] [ref=e130]
                  - button "Limpar Cálculo do Suplemento" [ref=e131] [cursor=pointer]: Limpar
                - generic [ref=e132]:
                  - generic [ref=e133]:
                    - generic [ref=e134]: Proteinado
                    - generic [ref=e135]:
                      - textbox "Proteinado" [ref=e136]
                      - generic [aria-hidden] [ref=e137]: "%"
                    - generic [ref=e138]: Preencha este campo para calcular.
                  - generic [ref=e139]:
                    - generic [ref=e140]: R$/Kg
                    - generic [ref=e141]:
                      - generic [aria-hidden] [ref=e142]: R$
                      - textbox "R$/Kg" [ref=e143]
                      - generic [aria-hidden] [ref=e144]: /kg
                    - generic [ref=e145]: Preencha este campo para calcular.
                  - generic [ref=e146]:
                    - generic [ref=e147]:
                      - text: GMD
                      - 'button "O que é: Consumo por cabeça" [ref=e148] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e149]: i
                    - 'group "GMD O que é: Consumo por cabeça" [ref=e150]':
                      - status [ref=e154]: —
                  - generic [ref=e155]:
                    - generic [ref=e156]: R$/cab/dia
                    - group "R$/cab/dia" [ref=e157]:
                      - status [ref=e161]: —
                  - generic [ref=e162]:
                    - generic [ref=e163]: R$/dia
                    - group "R$/dia" [ref=e164]:
                      - status [ref=e168]: —
                  - generic [ref=e169]:
                    - generic [ref=e170]:
                      - text: Custo total
                      - 'button "O que é: Suplemento" [ref=e171] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e172]: i
                    - 'group "Custo total O que é: Suplemento" [ref=e173]':
                      - status [ref=e177]: —
              - region [ref=e178]:
                - generic [ref=e179]:
                  - heading "Cálculo do Imposto" [level=2] [ref=e180]
                  - button "Limpar Cálculo do Imposto" [ref=e181] [cursor=pointer]: Limpar
                - generic [ref=e182]:
                  - generic [ref=e183]:
                    - generic [ref=e184]: Se
                    - generic [ref=e185]:
                      - textbox "Se" [ref=e186]
                      - generic [aria-hidden] [ref=e187]: "% da carcaça"
                    - generic [ref=e188]: Preencha este campo para calcular.
                  - generic [ref=e189]:
                    - generic [ref=e190]:
                      - text: "@ /cab"
                      - 'button "O que é: @ de carcaça por cabeça" [ref=e191] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e192]: i
                    - 'group "@ /cab O que é: @ de carcaça por cabeça" [ref=e193]':
                      - status [ref=e197]: —
                  - generic [ref=e198]:
                    - generic [ref=e199]:
                      - text: R$/cab
                      - 'button "O que é: Venda por cabeça" [ref=e200] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e201]: i
                    - 'group "R$/cab O que é: Venda por cabeça" [ref=e202]':
                      - status [ref=e206]: —
                  - generic [ref=e207]:
                    - generic [ref=e208]: Imposto
                    - generic [ref=e209]:
                      - textbox "Imposto" [ref=e210]
                      - generic [aria-hidden] [ref=e211]: "%"
                    - generic [ref=e212]: Preencha este campo para calcular.
                  - generic [ref=e213]:
                    - generic [ref=e214]: Imposto (R$/cab)
                    - group "Imposto (R$/cab)" [ref=e215]:
                      - status [ref=e219]: —
                  - generic [ref=e220]:
                    - generic [ref=e221]:
                      - text: Total
                      - 'button "O que é: Imposto" [ref=e222] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e223]: i
                    - 'group "Total O que é: Imposto" [ref=e224]':
                      - status [ref=e228]: —
              - region [ref=e229]:
                - generic [ref=e230]:
                  - heading "Cálculo da Sanidade" [level=2] [ref=e231]
                  - button "Limpar Cálculo da Sanidade" [ref=e232] [cursor=pointer]: Limpar
                - generic [ref=e233]:
                  - generic [ref=e234]:
                    - generic [ref=e235]: Sanidade
                    - generic [ref=e236]:
                      - generic [aria-hidden] [ref=e237]: R$
                      - textbox "Sanidade" [ref=e238]
                      - generic [aria-hidden] [ref=e239]: /cab./mês
                    - generic [ref=e240]: Preencha este campo para calcular.
                  - generic [ref=e241]:
                    - generic [ref=e242]:
                      - text: Total
                      - 'button "O que é: Sanidade" [ref=e243] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e244]: i
                    - 'group "Total O que é: Sanidade" [ref=e245]':
                      - status [ref=e249]: —
                  - generic [ref=e250]:
                    - generic [ref=e251]: Funcionário
                    - generic [ref=e252]:
                      - generic [aria-hidden] [ref=e253]: R$
                      - textbox "Funcionário" [ref=e254]
                    - generic [ref=e255]: Preencha este campo para calcular.
                  - generic [ref=e256]:
                    - generic [ref=e257]: Transporte (frete)
                    - generic [ref=e258]:
                      - generic [aria-hidden] [ref=e259]: R$
                      - textbox "Transporte (frete)" [ref=e260]
                    - generic [ref=e261]: Preencha este campo para calcular.
            - region "Resultado da recria" [ref=e262]:
              - generic [ref=e263]:
                - generic [ref=e264]:
                  - text: Faturamento líquido
                  - 'button "O que é: Faturamento líquido" [ref=e265] [cursor=pointer]':
                    - generic [aria-hidden] [ref=e266]: i
                - generic [ref=e267]: —
                - generic [ref=e268]:
                  - generic [ref=e269]:
                    - generic [ref=e270]:
                      - text: Faturamento bruto
                      - 'button "O que é: Faturamento bruto" [ref=e271] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e272]: i
                    - generic [ref=e273]: —
                  - generic [ref=e274]:
                    - generic [ref=e275]:
                      - text: (−) Custo operacional
                      - 'button "O que é: Custo operacional" [ref=e276] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e277]: i
                    - generic [ref=e278]: —
                  - generic [ref=e279]:
                    - generic [ref=e280]:
                      - text: (−) Investimento
                      - 'button "O que é: Investimento" [ref=e281] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e282]: i
                    - generic [ref=e283]: —
                - generic [ref=e284]:
                  - generic [ref=e285]:
                    - generic [ref=e286]:
                      - text: Por mês
                      - 'button "O que é: Líquido por mês" [ref=e287] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e288]: i
                    - generic [ref=e289]: —
                  - generic [ref=e290]:
                    - generic [ref=e291]:
                      - text: Por hectare
                      - 'button "O que é: Líquido por hectare" [ref=e292] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e293]: i
                    - generic [ref=e294]: —
                  - generic [ref=e295]:
                    - generic [ref=e296]:
                      - text: Total em caixa
                      - 'button "O que é: Total em caixa" [ref=e297] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e298]: i
                    - generic [ref=e299]: —
                - paragraph [ref=e300]: Preencha todos os campos com números válidos para ver o resultado completo (faltam 14).
              - region [ref=e301]:
                - heading [level=2] [ref=e302]:
                  - text: Custo operacional
                  - 'button "O que é: Custo operacional" [ref=e303] [cursor=pointer]':
                    - generic [aria-hidden] [ref=e304]: i
                - generic [ref=e305]: —
                - generic [ref=e307]:
                  - generic [ref=e308]:
                    - generic [ref=e310]:
                      - text: Suplemento
                      - 'button "O que é: Suplemento" [ref=e311] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e312]: i
                    - emphasis [ref=e313]: —
                    - generic [ref=e314]: —
                  - generic [ref=e315]:
                    - generic [ref=e317]:
                      - text: Sanidade
                      - 'button "O que é: Sanidade" [ref=e318] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e319]: i
                    - emphasis [ref=e320]: —
                    - generic [ref=e321]: —
                  - generic [ref=e322]:
                    - generic [ref=e324]:
                      - text: Imposto
                      - 'button "O que é: Imposto" [ref=e325] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e326]: i
                    - emphasis [ref=e327]: —
                    - generic [ref=e328]: —
                  - generic [ref=e329]:
                    - generic [ref=e331]:
                      - text: Transporte (frete)
                      - 'button "O que é: Transporte (frete)" [ref=e332] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e333]: i
                    - emphasis [ref=e334]: —
                    - generic [ref=e335]: —
                  - generic [ref=e336]:
                    - generic [ref=e338]:
                      - text: Funcionário
                      - 'button "O que é: Funcionário" [ref=e339] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e340]: i
                    - emphasis [ref=e341]: —
                    - generic [ref=e342]: —
              - button "Salvar como cenário" [ref=e343] [cursor=pointer]
      - navigation "Principal" [ref=e344]:
        - link [ref=e345] [cursor=pointer]:
          - /url: /painel
        - link [ref=e349] [cursor=pointer]:
          - /url: /negocios
        - link [ref=e353] [cursor=pointer]:
          - /url: /recria
        - link [ref=e358] [cursor=pointer]:
          - /url: /conta
  - status [ref=e363]
  - button "Open Next.js Dev Tools" [ref=e369] [cursor=pointer]
  - alert [ref=e373]
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | 
  3  | /** Entradas da planilha (fonte independente do app; ADR-0014: o simulador novo abre vazio). */
  4  | export const ENTRADAS_PLANILHA: Record<string, string> = {
  5  |   'Área pastável': '102',
  6  |   'Dias de recria': '270',
  7  |   Investimento: '122534,8',
  8  |   'R$ por cabeça (compra)': '2050',
  9  |   'Peso inicial': '188',
  10 |   'Peso final': '420',
  11 |   'Preço de venda': '325',
  12 |   'Consumo (% do peso vivo)': '0,3',
  13 |   Proteinado: '2',
  14 |   'Rendimento de carcaça': '52',
  15 |   'Imposto sobre a venda': '1,5',
  16 |   Sanidade: '2,5',
  17 |   Funcionário: '9000',
  18 |   Frete: '3000',
  19 | };
  20 | 
  21 | /** Digita as entradas da planilha na aba Simulador (valor de ouro: R$ 102.408,05). */
  22 | export async function preencherPlanilha(page: Page): Promise<void> {
  23 |   for (const [rotulo, valor] of Object.entries(ENTRADAS_PLANILHA)) {
> 24 |     await page.getByLabel(rotulo, { exact: true }).fill(valor);
     |                                                    ^ Error: locator.fill: Test timeout of 90000ms exceeded.
  25 |   }
  26 | }
  27 | 
```