# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2-cenarios.spec.ts >> E2 em 1440px >> RF-032/RF-033 simular, salvar, salvar outro e comparar (1440px)
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
      - complementary [ref=e5]:
        - generic [ref=e6]: O Gado
        - navigation "Principal" [ref=e13]:
          - link "Painel" [ref=e14] [cursor=pointer]:
            - /url: /painel
          - link "Negócios" [ref=e17] [cursor=pointer]:
            - /url: /negocios
          - link "Recria" [ref=e20] [cursor=pointer]:
            - /url: /recria
          - link "Conta" [ref=e24] [cursor=pointer]:
            - /url: /conta
        - generic [ref=e28]:
          - generic [ref=e29]: Cada arroba na ponta do lápis.
          - link "Entrar para guardar na nuvem" [ref=e31] [cursor=pointer]:
            - /url: /entrar
      - main [ref=e32]:
        - generic [ref=e34]:
          - heading "Cálculos Recria" [level=1] [ref=e35]
          - paragraph [ref=e36]: Mude os números e veja o resultado na hora.
        - tablist "Recria" [ref=e37]:
          - tab "Simulador" [selected] [ref=e38] [cursor=pointer]
          - tab "Cenários 0" [ref=e39] [cursor=pointer]:
            - text: Cenários
            - generic [ref=e40]: "0"
        - tabpanel "Simulador" [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]:
              - region [ref=e44]:
                - generic [ref=e45]:
                  - heading "Dados do lote" [level=2] [ref=e46]
                  - button "Limpar Dados do lote" [ref=e47] [cursor=pointer]: Limpar
                - generic [ref=e48]:
                  - generic [ref=e49]:
                    - generic [ref=e50]: Área Pastável
                    - generic [ref=e51]:
                      - textbox "Área Pastável" [ref=e52]
                      - generic [aria-hidden] [ref=e53]: ha
                    - generic [ref=e54]: Preencha este campo para calcular.
                  - generic [ref=e55]:
                    - generic [ref=e56]: Dias de Recria
                    - generic [ref=e57]:
                      - textbox "Dias de Recria" [ref=e58]
                      - generic [aria-hidden] [ref=e59]: dias
                    - generic [ref=e60]: Preencha este campo para calcular.
                  - generic [ref=e61]:
                    - generic [ref=e62]: Investimento (compra)
                    - generic [ref=e63]:
                      - generic [aria-hidden] [ref=e64]: R$
                      - textbox "Investimento (compra)" [ref=e65]
                    - generic [ref=e66]: Preencha este campo para calcular.
                  - generic [ref=e67]:
                    - generic [ref=e68]: R$/cab (compra)
                    - generic [ref=e69]:
                      - generic [aria-hidden] [ref=e70]: R$
                      - textbox "R$/cab (compra)" [ref=e71]
                    - generic [ref=e72]: Preencha este campo para calcular.
                  - generic [ref=e73]:
                    - generic [ref=e74]:
                      - text: Total de cabeças
                      - 'button "O que é: Cabeças" [ref=e75] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e76]: i
                    - 'group "Total de cabeças O que é: Cabeças" [ref=e77]':
                      - status [ref=e81]: —
                  - generic [ref=e82]:
                    - generic [ref=e83]: Peso inicial
                    - generic [ref=e84]:
                      - textbox "Peso inicial" [ref=e85]
                      - generic [aria-hidden] [ref=e86]: kg
                    - generic [ref=e87]: Preencha este campo para calcular.
                  - generic [ref=e88]:
                    - generic [ref=e89]:
                      - text: Lotação Total
                      - 'button "O que é: Lotação total" [ref=e90] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e91]: i
                    - 'group "Lotação Total O que é: Lotação total" [ref=e92]':
                      - status [ref=e96]: —
                  - generic [ref=e97]:
                    - generic [ref=e98]:
                      - text: Lotação/ha
                      - 'button "O que é: Lotação inicial" [ref=e99] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e100]: i
                    - 'group "Lotação/ha O que é: Lotação inicial" [ref=e101]':
                      - status [ref=e105]: —
                  - generic [ref=e106]:
                    - generic [ref=e107]: Peso Final
                    - generic [ref=e108]:
                      - textbox "Peso Final" [ref=e109]
                      - generic [aria-hidden] [ref=e110]: kg
                    - generic [ref=e111]: Preencha este campo para calcular.
                  - generic [ref=e112]:
                    - generic [ref=e113]:
                      - text: Peso Médio
                      - 'button "O que é: Peso médio" [ref=e114] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e115]: i
                    - 'group "Peso Médio O que é: Peso médio" [ref=e116]':
                      - status [ref=e120]: —
                  - generic [ref=e121]:
                    - generic [ref=e122]:
                      - text: Lotação Final
                      - 'button "O que é: Lotação final" [ref=e123] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e124]: i
                    - 'group "Lotação Final O que é: Lotação final" [ref=e125]':
                      - status [ref=e129]: —
                  - generic [ref=e130]:
                    - generic [ref=e131]:
                      - text: GMD implícito
                      - 'button "O que é: GMD implícito" [ref=e132] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e133]: i
                    - 'group "GMD implícito O que é: GMD implícito" [ref=e134]':
                      - status [ref=e138]: —
                  - generic [ref=e139]:
                    - generic [ref=e140]: R$/cab (venda)
                    - generic [ref=e141]:
                      - generic [aria-hidden] [ref=e142]: R$
                      - textbox "R$/cab (venda)" [ref=e143]
                      - generic [aria-hidden] [ref=e144]: /@
                    - generic [ref=e145]: Preencha este campo para calcular.
                  - generic [ref=e146]:
                    - generic [ref=e147]:
                      - text: Produzidas
                      - 'button "O que é: @ na venda (peso vivo)" [ref=e148] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e149]: i
                    - 'group "Produzidas O que é: @ na venda (peso vivo)" [ref=e150]':
                      - status [ref=e154]: —
              - region [ref=e155]:
                - generic [ref=e156]:
                  - heading "Cálculo do Suplemento" [level=2] [ref=e157]
                  - button "Limpar Cálculo do Suplemento" [ref=e158] [cursor=pointer]: Limpar
                - generic [ref=e159]:
                  - generic [ref=e160]:
                    - generic [ref=e161]: Proteinado
                    - generic [ref=e162]:
                      - textbox "Proteinado" [ref=e163]
                      - generic [aria-hidden] [ref=e164]: "%"
                    - generic [ref=e165]: Preencha este campo para calcular.
                  - generic [ref=e166]:
                    - generic [ref=e167]: R$/Kg
                    - generic [ref=e168]:
                      - generic [aria-hidden] [ref=e169]: R$
                      - textbox "R$/Kg" [ref=e170]
                      - generic [aria-hidden] [ref=e171]: /kg
                    - generic [ref=e172]: Preencha este campo para calcular.
                  - generic [ref=e173]:
                    - generic [ref=e174]:
                      - text: GMD
                      - 'button "O que é: Consumo por cabeça" [ref=e175] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e176]: i
                    - 'group "GMD O que é: Consumo por cabeça" [ref=e177]':
                      - status [ref=e181]: —
                  - generic [ref=e182]:
                    - generic [ref=e183]: R$/cab/dia
                    - group "R$/cab/dia" [ref=e184]:
                      - status [ref=e188]: —
                  - generic [ref=e189]:
                    - generic [ref=e190]: R$/dia
                    - group "R$/dia" [ref=e191]:
                      - status [ref=e195]: —
                  - generic [ref=e196]:
                    - generic [ref=e197]:
                      - text: Custo total
                      - 'button "O que é: Suplemento" [ref=e198] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e199]: i
                    - 'group "Custo total O que é: Suplemento" [ref=e200]':
                      - status [ref=e204]: —
              - region [ref=e205]:
                - generic [ref=e206]:
                  - heading "Cálculo do Imposto" [level=2] [ref=e207]
                  - button "Limpar Cálculo do Imposto" [ref=e208] [cursor=pointer]: Limpar
                - generic [ref=e209]:
                  - generic [ref=e210]:
                    - generic [ref=e211]: Se
                    - generic [ref=e212]:
                      - textbox "Se" [ref=e213]
                      - generic [aria-hidden] [ref=e214]: "% da carcaça"
                    - generic [ref=e215]: Preencha este campo para calcular.
                  - generic [ref=e216]:
                    - generic [ref=e217]:
                      - text: "@ /cab"
                      - 'button "O que é: @ de carcaça por cabeça" [ref=e218] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e219]: i
                    - 'group "@ /cab O que é: @ de carcaça por cabeça" [ref=e220]':
                      - status [ref=e224]: —
                  - generic [ref=e225]:
                    - generic [ref=e226]:
                      - text: R$/cab
                      - 'button "O que é: Venda por cabeça" [ref=e227] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e228]: i
                    - 'group "R$/cab O que é: Venda por cabeça" [ref=e229]':
                      - status [ref=e233]: —
                  - generic [ref=e234]:
                    - generic [ref=e235]: Imposto
                    - generic [ref=e236]:
                      - textbox "Imposto" [ref=e237]
                      - generic [aria-hidden] [ref=e238]: "%"
                    - generic [ref=e239]: Preencha este campo para calcular.
                  - generic [ref=e240]:
                    - generic [ref=e241]: Imposto (R$/cab)
                    - group "Imposto (R$/cab)" [ref=e242]:
                      - status [ref=e246]: —
                  - generic [ref=e247]:
                    - generic [ref=e248]:
                      - text: Total
                      - 'button "O que é: Imposto" [ref=e249] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e250]: i
                    - 'group "Total O que é: Imposto" [ref=e251]':
                      - status [ref=e255]: —
              - region [ref=e256]:
                - generic [ref=e257]:
                  - heading "Cálculo da Sanidade" [level=2] [ref=e258]
                  - button "Limpar Cálculo da Sanidade" [ref=e259] [cursor=pointer]: Limpar
                - generic [ref=e260]:
                  - generic [ref=e261]:
                    - generic [ref=e262]: Sanidade
                    - generic [ref=e263]:
                      - generic [aria-hidden] [ref=e264]: R$
                      - textbox "Sanidade" [ref=e265]
                      - generic [aria-hidden] [ref=e266]: /cab./mês
                    - generic [ref=e267]: Preencha este campo para calcular.
                  - generic [ref=e268]:
                    - generic [ref=e269]:
                      - text: Total
                      - 'button "O que é: Sanidade" [ref=e270] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e271]: i
                    - 'group "Total O que é: Sanidade" [ref=e272]':
                      - status [ref=e276]: —
                  - generic [ref=e277]:
                    - generic [ref=e278]: Funcionário
                    - generic [ref=e279]:
                      - generic [aria-hidden] [ref=e280]: R$
                      - textbox "Funcionário" [ref=e281]
                    - generic [ref=e282]: Preencha este campo para calcular.
                  - generic [ref=e283]:
                    - generic [ref=e284]: Transporte (frete)
                    - generic [ref=e285]:
                      - generic [aria-hidden] [ref=e286]: R$
                      - textbox "Transporte (frete)" [ref=e287]
                    - generic [ref=e288]: Preencha este campo para calcular.
            - region "Resultado da recria" [ref=e289]:
              - generic [ref=e290]:
                - generic [ref=e291]:
                  - text: Faturamento líquido
                  - 'button "O que é: Faturamento líquido" [ref=e292] [cursor=pointer]':
                    - generic [aria-hidden] [ref=e293]: i
                - generic [ref=e294]: —
                - generic [ref=e295]:
                  - generic [ref=e296]:
                    - generic [ref=e297]:
                      - text: Faturamento bruto
                      - 'button "O que é: Faturamento bruto" [ref=e298] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e299]: i
                    - generic [ref=e300]: —
                  - generic [ref=e301]:
                    - generic [ref=e302]:
                      - text: (−) Custo operacional
                      - 'button "O que é: Custo operacional" [ref=e303] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e304]: i
                    - generic [ref=e305]: —
                  - generic [ref=e306]:
                    - generic [ref=e307]:
                      - text: (−) Investimento
                      - 'button "O que é: Investimento" [ref=e308] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e309]: i
                    - generic [ref=e310]: —
                - generic [ref=e311]:
                  - generic [ref=e312]:
                    - generic [ref=e313]:
                      - text: Por mês
                      - 'button "O que é: Líquido por mês" [ref=e314] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e315]: i
                    - generic [ref=e316]: —
                  - generic [ref=e317]:
                    - generic [ref=e318]:
                      - text: Por hectare
                      - 'button "O que é: Líquido por hectare" [ref=e319] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e320]: i
                    - generic [ref=e321]: —
                  - generic [ref=e322]:
                    - generic [ref=e323]:
                      - text: Total em caixa
                      - 'button "O que é: Total em caixa" [ref=e324] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e325]: i
                    - generic [ref=e326]: —
                - paragraph [ref=e327]: Preencha todos os campos com números válidos para ver o resultado completo (faltam 14).
              - region [ref=e328]:
                - heading [level=2] [ref=e329]:
                  - text: Custo operacional
                  - 'button "O que é: Custo operacional" [ref=e330] [cursor=pointer]':
                    - generic [aria-hidden] [ref=e331]: i
                - generic [ref=e332]: —
                - generic [ref=e334]:
                  - generic [ref=e335]:
                    - generic [ref=e337]:
                      - text: Suplemento
                      - 'button "O que é: Suplemento" [ref=e338] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e339]: i
                    - emphasis [ref=e340]: —
                    - generic [ref=e341]: —
                  - generic [ref=e342]:
                    - generic [ref=e344]:
                      - text: Sanidade
                      - 'button "O que é: Sanidade" [ref=e345] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e346]: i
                    - emphasis [ref=e347]: —
                    - generic [ref=e348]: —
                  - generic [ref=e349]:
                    - generic [ref=e351]:
                      - text: Imposto
                      - 'button "O que é: Imposto" [ref=e352] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e353]: i
                    - emphasis [ref=e354]: —
                    - generic [ref=e355]: —
                  - generic [ref=e356]:
                    - generic [ref=e358]:
                      - text: Transporte (frete)
                      - 'button "O que é: Transporte (frete)" [ref=e359] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e360]: i
                    - emphasis [ref=e361]: —
                    - generic [ref=e362]: —
                  - generic [ref=e363]:
                    - generic [ref=e365]:
                      - text: Funcionário
                      - 'button "O que é: Funcionário" [ref=e366] [cursor=pointer]':
                        - generic [aria-hidden] [ref=e367]: i
                    - emphasis [ref=e368]: —
                    - generic [ref=e369]: —
              - button "Salvar como cenário" [ref=e370] [cursor=pointer]
  - status [ref=e371]
  - button "Open Next.js Dev Tools" [ref=e377] [cursor=pointer]
  - alert [ref=e381]
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