# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e4-offline.spec.ts >> RF-072/RF-071 abre sem internet após a primeira visita e a Recria calcula o valor de ouro
- Location: apps\web\e2e\e4-offline.spec.ts:88:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.fill: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByLabel('Área pastável', { exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - alert [ref=f3e2]
  - generic [ref=f3e3]:
    - link "Pular para o conteúdo" [ref=f3e4] [cursor=pointer]:
      - /url: "#conteudo"
    - generic [ref=f3e5]:
      - complementary [ref=f3e6]:
        - generic [ref=f3e7]: O Gado
        - navigation "Principal" [ref=f3e14]:
          - link "Painel" [ref=f3e15] [cursor=pointer]:
            - /url: /painel
          - link "Negócios" [ref=f3e18] [cursor=pointer]:
            - /url: /negocios
          - link "Recria" [ref=f3e21] [cursor=pointer]:
            - /url: /recria
          - link "Conta" [ref=f3e25] [cursor=pointer]:
            - /url: /conta
        - generic [ref=f3e29]:
          - generic [ref=f3e30]: Cada arroba na ponta do lápis.
          - link "Entrar para guardar na nuvem" [ref=f3e32] [cursor=pointer]:
            - /url: /entrar
      - main [ref=f3e33]:
        - status [ref=f3e34]: "Você está sem internet. Pode continuar: tudo funciona e fica salvo neste aparelho."
        - generic [ref=f3e36]:
          - heading "Cálculos Recria" [level=1] [ref=f3e37]
          - paragraph [ref=f3e38]: Mude os números e veja o resultado na hora.
        - tablist "Recria" [ref=f3e39]:
          - tab "Simulador" [selected] [ref=f3e40] [cursor=pointer]
          - tab "Cenários 0" [ref=f3e41] [cursor=pointer]:
            - text: Cenários
            - generic [ref=f3e42]: "0"
        - tabpanel "Simulador" [ref=f3e43]:
          - generic [ref=f3e44]:
            - generic [ref=f3e45]:
              - region [ref=f3e46]:
                - generic [ref=f3e47]:
                  - heading "Dados do lote" [level=2] [ref=f3e48]
                  - button "Limpar Dados do lote" [ref=f3e49] [cursor=pointer]: Limpar
                - generic [ref=f3e50]:
                  - generic [ref=f3e51]:
                    - generic [ref=f3e52]: Área Pastável
                    - generic [ref=f3e53]:
                      - textbox "Área Pastável" [ref=f3e54]
                      - generic [aria-hidden] [ref=f3e55]: ha
                    - generic [ref=f3e56]: Preencha este campo para calcular.
                  - generic [ref=f3e57]:
                    - generic [ref=f3e58]: Dias de Recria
                    - generic [ref=f3e59]:
                      - textbox "Dias de Recria" [ref=f3e60]
                      - generic [aria-hidden] [ref=f3e61]: dias
                    - generic [ref=f3e62]: Preencha este campo para calcular.
                  - generic [ref=f3e63]:
                    - generic [ref=f3e64]: Investimento (compra)
                    - generic [ref=f3e65]:
                      - generic [aria-hidden] [ref=f3e66]: R$
                      - textbox "Investimento (compra)" [ref=f3e67]
                    - generic [ref=f3e68]: Preencha este campo para calcular.
                  - generic [ref=f3e69]:
                    - generic [ref=f3e70]: R$/cab (compra)
                    - generic [ref=f3e71]:
                      - generic [aria-hidden] [ref=f3e72]: R$
                      - textbox "R$/cab (compra)" [ref=f3e73]
                    - generic [ref=f3e74]: Preencha este campo para calcular.
                  - generic [ref=f3e75]:
                    - generic [ref=f3e76]:
                      - text: Total de cabeças
                      - 'button "O que é: Cabeças" [ref=f3e77] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e78]: i
                    - 'group "Total de cabeças O que é: Cabeças" [ref=f3e79]':
                      - status [ref=f3e83]: —
                  - generic [ref=f3e84]:
                    - generic [ref=f3e85]: Peso inicial
                    - generic [ref=f3e86]:
                      - textbox "Peso inicial" [ref=f3e87]
                      - generic [aria-hidden] [ref=f3e88]: kg
                    - generic [ref=f3e89]: Preencha este campo para calcular.
                  - generic [ref=f3e90]:
                    - generic [ref=f3e91]:
                      - text: Lotação Total
                      - 'button "O que é: Lotação total" [ref=f3e92] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e93]: i
                    - 'group "Lotação Total O que é: Lotação total" [ref=f3e94]':
                      - status [ref=f3e98]: —
                  - generic [ref=f3e99]:
                    - generic [ref=f3e100]:
                      - text: Lotação/ha
                      - 'button "O que é: Lotação inicial" [ref=f3e101] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e102]: i
                    - 'group "Lotação/ha O que é: Lotação inicial" [ref=f3e103]':
                      - status [ref=f3e107]: —
                  - generic [ref=f3e108]:
                    - generic [ref=f3e109]: Peso Final
                    - generic [ref=f3e110]:
                      - textbox "Peso Final" [ref=f3e111]
                      - generic [aria-hidden] [ref=f3e112]: kg
                    - generic [ref=f3e113]: Preencha este campo para calcular.
                  - generic [ref=f3e114]:
                    - generic [ref=f3e115]:
                      - text: Peso Médio
                      - 'button "O que é: Peso médio" [ref=f3e116] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e117]: i
                    - 'group "Peso Médio O que é: Peso médio" [ref=f3e118]':
                      - status [ref=f3e122]: —
                  - generic [ref=f3e123]:
                    - generic [ref=f3e124]:
                      - text: Lotação Final
                      - 'button "O que é: Lotação final" [ref=f3e125] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e126]: i
                    - 'group "Lotação Final O que é: Lotação final" [ref=f3e127]':
                      - status [ref=f3e131]: —
                  - generic [ref=f3e132]:
                    - generic [ref=f3e133]:
                      - text: GMD implícito
                      - 'button "O que é: GMD implícito" [ref=f3e134] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e135]: i
                    - 'group "GMD implícito O que é: GMD implícito" [ref=f3e136]':
                      - status [ref=f3e140]: —
                  - generic [ref=f3e141]:
                    - generic [ref=f3e142]: R$/cab (venda)
                    - generic [ref=f3e143]:
                      - generic [aria-hidden] [ref=f3e144]: R$
                      - textbox "R$/cab (venda)" [ref=f3e145]
                      - generic [aria-hidden] [ref=f3e146]: /@
                    - generic [ref=f3e147]: Preencha este campo para calcular.
                  - generic [ref=f3e148]:
                    - generic [ref=f3e149]:
                      - text: Produzidas
                      - 'button "O que é: @ na venda (peso vivo)" [ref=f3e150] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e151]: i
                    - 'group "Produzidas O que é: @ na venda (peso vivo)" [ref=f3e152]':
                      - status [ref=f3e156]: —
              - region [ref=f3e157]:
                - generic [ref=f3e158]:
                  - heading "Cálculo do Suplemento" [level=2] [ref=f3e159]
                  - button "Limpar Cálculo do Suplemento" [ref=f3e160] [cursor=pointer]: Limpar
                - generic [ref=f3e161]:
                  - generic [ref=f3e162]:
                    - generic [ref=f3e163]: Proteinado
                    - generic [ref=f3e164]:
                      - textbox "Proteinado" [ref=f3e165]
                      - generic [aria-hidden] [ref=f3e166]: "%"
                    - generic [ref=f3e167]: Preencha este campo para calcular.
                  - generic [ref=f3e168]:
                    - generic [ref=f3e169]: R$/Kg
                    - generic [ref=f3e170]:
                      - generic [aria-hidden] [ref=f3e171]: R$
                      - textbox "R$/Kg" [ref=f3e172]
                      - generic [aria-hidden] [ref=f3e173]: /kg
                    - generic [ref=f3e174]: Preencha este campo para calcular.
                  - generic [ref=f3e175]:
                    - generic [ref=f3e176]:
                      - text: GMD
                      - 'button "O que é: Consumo por cabeça" [ref=f3e177] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e178]: i
                    - 'group "GMD O que é: Consumo por cabeça" [ref=f3e179]':
                      - status [ref=f3e183]: —
                  - generic [ref=f3e184]:
                    - generic [ref=f3e185]: R$/cab/dia
                    - group "R$/cab/dia" [ref=f3e186]:
                      - status [ref=f3e190]: —
                  - generic [ref=f3e191]:
                    - generic [ref=f3e192]: R$/dia
                    - group "R$/dia" [ref=f3e193]:
                      - status [ref=f3e197]: —
                  - generic [ref=f3e198]:
                    - generic [ref=f3e199]:
                      - text: Custo total
                      - 'button "O que é: Suplemento" [ref=f3e200] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e201]: i
                    - 'group "Custo total O que é: Suplemento" [ref=f3e202]':
                      - status [ref=f3e206]: —
              - region [ref=f3e207]:
                - generic [ref=f3e208]:
                  - heading "Cálculo do Imposto" [level=2] [ref=f3e209]
                  - button "Limpar Cálculo do Imposto" [ref=f3e210] [cursor=pointer]: Limpar
                - generic [ref=f3e211]:
                  - generic [ref=f3e212]:
                    - generic [ref=f3e213]: Se
                    - generic [ref=f3e214]:
                      - textbox "Se" [ref=f3e215]
                      - generic [aria-hidden] [ref=f3e216]: "% da carcaça"
                    - generic [ref=f3e217]: Preencha este campo para calcular.
                  - generic [ref=f3e218]:
                    - generic [ref=f3e219]:
                      - text: "@ /cab"
                      - 'button "O que é: @ de carcaça por cabeça" [ref=f3e220] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e221]: i
                    - 'group "@ /cab O que é: @ de carcaça por cabeça" [ref=f3e222]':
                      - status [ref=f3e226]: —
                  - generic [ref=f3e227]:
                    - generic [ref=f3e228]:
                      - text: R$/cab
                      - 'button "O que é: Venda por cabeça" [ref=f3e229] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e230]: i
                    - 'group "R$/cab O que é: Venda por cabeça" [ref=f3e231]':
                      - status [ref=f3e235]: —
                  - generic [ref=f3e236]:
                    - generic [ref=f3e237]: Imposto
                    - generic [ref=f3e238]:
                      - textbox "Imposto" [ref=f3e239]
                      - generic [aria-hidden] [ref=f3e240]: "%"
                    - generic [ref=f3e241]: Preencha este campo para calcular.
                  - generic [ref=f3e242]:
                    - generic [ref=f3e243]: Imposto (R$/cab)
                    - group "Imposto (R$/cab)" [ref=f3e244]:
                      - status [ref=f3e248]: —
                  - generic [ref=f3e249]:
                    - generic [ref=f3e250]:
                      - text: Total
                      - 'button "O que é: Imposto" [ref=f3e251] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e252]: i
                    - 'group "Total O que é: Imposto" [ref=f3e253]':
                      - status [ref=f3e257]: —
              - region [ref=f3e258]:
                - generic [ref=f3e259]:
                  - heading "Cálculo da Sanidade" [level=2] [ref=f3e260]
                  - button "Limpar Cálculo da Sanidade" [ref=f3e261] [cursor=pointer]: Limpar
                - generic [ref=f3e262]:
                  - generic [ref=f3e263]:
                    - generic [ref=f3e264]: Sanidade
                    - generic [ref=f3e265]:
                      - generic [aria-hidden] [ref=f3e266]: R$
                      - textbox "Sanidade" [ref=f3e267]
                      - generic [aria-hidden] [ref=f3e268]: /cab./mês
                    - generic [ref=f3e269]: Preencha este campo para calcular.
                  - generic [ref=f3e270]:
                    - generic [ref=f3e271]:
                      - text: Total
                      - 'button "O que é: Sanidade" [ref=f3e272] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e273]: i
                    - 'group "Total O que é: Sanidade" [ref=f3e274]':
                      - status [ref=f3e278]: —
                  - generic [ref=f3e279]:
                    - generic [ref=f3e280]: Funcionário
                    - generic [ref=f3e281]:
                      - generic [aria-hidden] [ref=f3e282]: R$
                      - textbox "Funcionário" [ref=f3e283]
                    - generic [ref=f3e284]: Preencha este campo para calcular.
                  - generic [ref=f3e285]:
                    - generic [ref=f3e286]: Transporte (frete)
                    - generic [ref=f3e287]:
                      - generic [aria-hidden] [ref=f3e288]: R$
                      - textbox "Transporte (frete)" [ref=f3e289]
                    - generic [ref=f3e290]: Preencha este campo para calcular.
            - region "Resultado da recria" [ref=f3e291]:
              - generic [ref=f3e292]:
                - generic [ref=f3e293]:
                  - text: Faturamento líquido
                  - 'button "O que é: Faturamento líquido" [ref=f3e294] [cursor=pointer]':
                    - generic [aria-hidden] [ref=f3e295]: i
                - generic [ref=f3e296]: —
                - generic [ref=f3e297]:
                  - generic [ref=f3e298]:
                    - generic [ref=f3e299]:
                      - text: Faturamento bruto
                      - 'button "O que é: Faturamento bruto" [ref=f3e300] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e301]: i
                    - generic [ref=f3e302]: —
                  - generic [ref=f3e303]:
                    - generic [ref=f3e304]:
                      - text: (−) Custo operacional
                      - 'button "O que é: Custo operacional" [ref=f3e305] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e306]: i
                    - generic [ref=f3e307]: —
                  - generic [ref=f3e308]:
                    - generic [ref=f3e309]:
                      - text: (−) Investimento
                      - 'button "O que é: Investimento" [ref=f3e310] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e311]: i
                    - generic [ref=f3e312]: —
                - generic [ref=f3e313]:
                  - generic [ref=f3e314]:
                    - generic [ref=f3e315]:
                      - text: Por mês
                      - 'button "O que é: Líquido por mês" [ref=f3e316] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e317]: i
                    - generic [ref=f3e318]: —
                  - generic [ref=f3e319]:
                    - generic [ref=f3e320]:
                      - text: Por hectare
                      - 'button "O que é: Líquido por hectare" [ref=f3e321] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e322]: i
                    - generic [ref=f3e323]: —
                  - generic [ref=f3e324]:
                    - generic [ref=f3e325]:
                      - text: Total em caixa
                      - 'button "O que é: Total em caixa" [ref=f3e326] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e327]: i
                    - generic [ref=f3e328]: —
                - paragraph [ref=f3e329]: Preencha todos os campos com números válidos para ver o resultado completo (faltam 14).
              - region [ref=f3e330]:
                - heading [level=2] [ref=f3e331]:
                  - text: Custo operacional
                  - 'button "O que é: Custo operacional" [ref=f3e332] [cursor=pointer]':
                    - generic [aria-hidden] [ref=f3e333]: i
                - generic [ref=f3e334]: —
                - generic [ref=f3e336]:
                  - generic [ref=f3e337]:
                    - generic [ref=f3e339]:
                      - text: Suplemento
                      - 'button "O que é: Suplemento" [ref=f3e340] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e341]: i
                    - emphasis [ref=f3e342]: —
                    - generic [ref=f3e343]: —
                  - generic [ref=f3e344]:
                    - generic [ref=f3e346]:
                      - text: Sanidade
                      - 'button "O que é: Sanidade" [ref=f3e347] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e348]: i
                    - emphasis [ref=f3e349]: —
                    - generic [ref=f3e350]: —
                  - generic [ref=f3e351]:
                    - generic [ref=f3e353]:
                      - text: Imposto
                      - 'button "O que é: Imposto" [ref=f3e354] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e355]: i
                    - emphasis [ref=f3e356]: —
                    - generic [ref=f3e357]: —
                  - generic [ref=f3e358]:
                    - generic [ref=f3e360]:
                      - text: Transporte (frete)
                      - 'button "O que é: Transporte (frete)" [ref=f3e361] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e362]: i
                    - emphasis [ref=f3e363]: —
                    - generic [ref=f3e364]: —
                  - generic [ref=f3e365]:
                    - generic [ref=f3e367]:
                      - text: Funcionário
                      - 'button "O que é: Funcionário" [ref=f3e368] [cursor=pointer]':
                        - generic [aria-hidden] [ref=f3e369]: i
                    - emphasis [ref=f3e370]: —
                    - generic [ref=f3e371]: —
              - button "Salvar como cenário" [ref=f3e372] [cursor=pointer]
  - status [ref=f3e373]
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
     |                                                    ^ Error: locator.fill: Test timeout of 120000ms exceeded.
  25 |   }
  26 | }
  27 | 
```