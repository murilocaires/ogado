# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e1-jornadas.spec.ts >> E1 em 1440px >> RF-030 simular recria: abre vazio, digita a planilha e chega ao valor de ouro (1440px)
- Location: apps\web\e2e\e1-jornadas.spec.ts:65:5

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: getByLabel('Investimento', { exact: true })
Expected: ""
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" getByLabel('Investimento', { exact: true }) with timeout 15000ms
  - waiting for getByLabel('Investimento', { exact: true })

```

```yaml
- link "Pular para o conteúdo":
  - /url: "#conteudo"
- complementary:
  - text: O Gado
  - navigation "Principal":
    - link "Painel":
      - /url: /painel
    - link "Negócios":
      - /url: /negocios
    - link "Recria":
      - /url: /recria
    - link "Conta":
      - /url: /conta
  - text: Cada arroba na ponta do lápis.
  - link "Entrar para guardar na nuvem":
    - /url: /entrar
- main:
  - heading "Cálculos Recria" [level=1]
  - paragraph: Mude os números e veja o resultado na hora.
  - tablist "Recria":
    - tab "Simulador" [selected]
    - tab "Cenários 0"
  - tabpanel "Simulador":
    - region "Dados do lote":
      - heading "Dados do lote" [level=2]
      - button "Limpar Dados do lote": Limpar
      - text: Área Pastável
      - textbox "Área Pastável"
      - text: Preencha este campo para calcular. Dias de Recria
      - textbox "Dias de Recria"
      - text: Preencha este campo para calcular. Investimento (compra)
      - textbox "Investimento (compra)"
      - text: Preencha este campo para calcular. R$/cab (compra)
      - textbox "R$/cab (compra)"
      - text: Preencha este campo para calcular. Total de cabeças
      - 'button "O que é: Cabeças"'
      - 'group "Total de cabeças O que é: Cabeças"':
        - status: —
      - text: Peso inicial
      - textbox "Peso inicial"
      - text: Preencha este campo para calcular. Lotação Total
      - 'button "O que é: Lotação total"'
      - 'group "Lotação Total O que é: Lotação total"':
        - status: —
      - text: Lotação/ha
      - 'button "O que é: Lotação inicial"'
      - 'group "Lotação/ha O que é: Lotação inicial"':
        - status: —
      - text: Peso Final
      - textbox "Peso Final"
      - text: Preencha este campo para calcular. Peso Médio
      - 'button "O que é: Peso médio"'
      - 'group "Peso Médio O que é: Peso médio"':
        - status: —
      - text: Lotação Final
      - 'button "O que é: Lotação final"'
      - 'group "Lotação Final O que é: Lotação final"':
        - status: —
      - text: GMD implícito
      - 'button "O que é: GMD implícito"'
      - 'group "GMD implícito O que é: GMD implícito"':
        - status: —
      - text: R$/cab (venda)
      - textbox "R$/cab (venda)"
      - text: Preencha este campo para calcular. Produzidas
      - 'button "O que é: @ na venda (peso vivo)"'
      - 'group "Produzidas O que é: @ na venda (peso vivo)"':
        - status: —
    - region "Cálculo do Suplemento":
      - heading "Cálculo do Suplemento" [level=2]
      - button "Limpar Cálculo do Suplemento": Limpar
      - text: Proteinado
      - textbox "Proteinado"
      - text: Preencha este campo para calcular. R$/Kg
      - textbox "R$/Kg"
      - text: Preencha este campo para calcular. GMD
      - 'button "O que é: Consumo por cabeça"'
      - 'group "GMD O que é: Consumo por cabeça"':
        - status: —
      - text: R$/cab/dia
      - group "R$/cab/dia":
        - status: —
      - text: R$/dia
      - group "R$/dia":
        - status: —
      - text: Custo total
      - 'button "O que é: Suplemento"'
      - 'group "Custo total O que é: Suplemento"':
        - status: —
    - region "Cálculo do Imposto":
      - heading "Cálculo do Imposto" [level=2]
      - button "Limpar Cálculo do Imposto": Limpar
      - text: Se
      - textbox "Se"
      - text: Preencha este campo para calcular. @ /cab
      - 'button "O que é: @ de carcaça por cabeça"'
      - 'group "@ /cab O que é: @ de carcaça por cabeça"':
        - status: —
      - text: R$/cab
      - 'button "O que é: Venda por cabeça"'
      - 'group "R$/cab O que é: Venda por cabeça"':
        - status: —
      - text: Imposto
      - textbox "Imposto"
      - text: Preencha este campo para calcular. Imposto (R$/cab)
      - group "Imposto (R$/cab)":
        - status: —
      - text: Total
      - 'button "O que é: Imposto"'
      - 'group "Total O que é: Imposto"':
        - status: —
    - region "Cálculo da Sanidade":
      - heading "Cálculo da Sanidade" [level=2]
      - button "Limpar Cálculo da Sanidade": Limpar
      - text: Sanidade
      - textbox "Sanidade"
      - text: Preencha este campo para calcular. Total
      - 'button "O que é: Sanidade"'
      - 'group "Total O que é: Sanidade"':
        - status: —
      - text: Funcionário
      - textbox "Funcionário"
      - text: Preencha este campo para calcular. Transporte (frete)
      - textbox "Transporte (frete)"
      - text: Preencha este campo para calcular.
    - region "Resultado da recria":
      - text: Faturamento líquido
      - 'button "O que é: Faturamento líquido"'
      - text: — Faturamento bruto
      - 'button "O que é: Faturamento bruto"'
      - text: — (−) Custo operacional
      - 'button "O que é: Custo operacional"'
      - text: — (−) Investimento
      - 'button "O que é: Investimento"'
      - text: — Por mês
      - 'button "O que é: Líquido por mês"'
      - text: — Por hectare
      - 'button "O que é: Líquido por hectare"'
      - text: — Total em caixa
      - 'button "O que é: Total em caixa"'
      - text: —
      - paragraph: Preencha todos os campos com números válidos para ver o resultado completo (faltam 14).
      - 'region "Custo operacional O que é: Custo operacional"':
        - 'heading "Custo operacional O que é: Custo operacional" [level=2]':
          - text: Custo operacional
          - 'button "O que é: Custo operacional"'
        - text: — Suplemento
        - 'button "O que é: Suplemento"'
        - emphasis: —
        - text: — Sanidade
        - 'button "O que é: Sanidade"'
        - emphasis: —
        - text: — Imposto
        - 'button "O que é: Imposto"'
        - emphasis: —
        - text: — Transporte (frete)
        - 'button "O que é: Transporte (frete)"'
        - emphasis: —
        - text: — Funcionário
        - 'button "O que é: Funcionário"'
        - emphasis: —
        - text: —
      - button "Salvar como cenário"
- status
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import { preencherPlanilha } from './planilha';
  3   | 
  4   | /**
  5   |  * E1 (produto navegável): jornadas SEM API e SEM login, dados no navegador.
  6   |  * Também salva capturas (1440 e 390 px) em .scratch/web-v1/evidence/ para revisão visual.
  7   |  */
  8   | const OUT = '../../.scratch/web-v1/evidence';
  9   | 
  10  | const viewports = [
  11  |   { nome: '1440', width: 1440, height: 900 },
  12  |   { nome: '390', width: 390, height: 844 },
  13  | ];
  14  | 
  15  | async function lancar(page: Page, tipo: 'Compra' | 'Venda', v: { qtd: string; peso: string; preco: string }) {
  16  |   const nome = tipo === 'Compra' ? 'Nova compra' : 'Nova venda';
  17  |   await page.getByRole('button', { name: nome }).first().click();
  18  |   const modal = page.getByRole('dialog', { name: nome });
  19  |   await modal.getByLabel('Quantidade', { exact: true }).fill(v.qtd);
  20  |   await modal.getByLabel('Peso total do lote', { exact: true }).fill(v.peso);
  21  |   await modal.getByLabel('Preço da arroba', { exact: true }).fill(v.preco);
  22  |   await modal.getByRole('button', { name: 'Salvar lote' }).click();
  23  |   await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  24  |   await expect(page.getByRole('status').filter({ hasText: 'Lote salvo.' })).toBeVisible();
  25  | }
  26  | 
  27  | for (const vp of viewports) {
  28  |   test.describe(`E1 em ${vp.nome}px`, () => {
  29  |     test.use({ viewport: { width: vp.width, height: vp.height } });
  30  | 
  31  |     test(`RF-024 cadastrar compra e venda leva ao saldo (${vp.nome}px)`, async ({ page }) => {
  32  |       const erros: string[] = [];
  33  |       page.on('pageerror', (e) => erros.push(e.message));
  34  | 
  35  |       await page.goto('/');
  36  |       await expect(page).toHaveURL(/\/painel$/);
  37  |       await expect(page.getByText('Nenhuma operação ainda')).toBeVisible();
  38  |       await page.evaluate(() => document.fonts.ready);
  39  |       await page.screenshot({ path: `${OUT}/e1-painel-vazio-${vp.nome}.png`, fullPage: true });
  40  | 
  41  |       await page.getByRole('link', { name: 'Negócios' }).filter({ visible: true }).click();
  42  |       await expect(page).toHaveURL(/\/negocios$/);
  43  |       await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  44  | 
  45  |       await lancar(page, 'Compra', { qtd: '10', peso: '3000', preco: '300' });
  46  |       await lancar(page, 'Venda', { qtd: '10', peso: '4500', preco: '320' });
  47  | 
  48  |       // 100 @ x R$ 300 = 30.000 comprados; 150 @ x R$ 320 = 48.000 vendidos
  49  |       await expect(page.getByTestId('saldo')).toHaveText('+R$ 18.000,00');
  50  |       await page.screenshot({ path: `${OUT}/e1-negocios-${vp.nome}.png`, fullPage: true });
  51  | 
  52  |       // Os dados ficam no navegador: recarregar não perde nada.
  53  |       await page.reload();
  54  |       await expect(page.getByTestId('saldo')).toHaveText('+R$ 18.000,00');
  55  | 
  56  |       // Painel reflete os lançamentos.
  57  |       await page.getByRole('link', { name: 'Painel' }).filter({ visible: true }).click();
  58  |       await expect(page.getByTestId('saldo')).toHaveText('+R$ 18.000,00');
  59  |       await expect(page.getByText('Lote 1 · Bezerros')).toBeVisible();
  60  |       await page.screenshot({ path: `${OUT}/e1-painel-${vp.nome}.png`, fullPage: true });
  61  | 
  62  |       expect(erros).toEqual([]);
  63  |     });
  64  | 
  65  |     test(`RF-030 simular recria: abre vazio, digita a planilha e chega ao valor de ouro (${vp.nome}px)`, async ({
  66  |       page,
  67  |     }) => {
  68  |       await page.goto('/recria');
  69  |       const resultado = page.getByRole('region', { name: 'Resultado da recria' });
  70  |       // ADR-0014: o simulador novo abre em branco, sem padrões nem seletor de lotação.
> 71  |       await expect(page.getByLabel('Investimento', { exact: true })).toHaveValue('');
      |                                                                      ^ Error: expect(locator).toHaveValue(expected) failed
  72  |       await expect(resultado.locator('.hero .big')).toHaveText('—');
  73  |       await expect(page.getByRole('button', { name: 'Restaurar padrões' })).toHaveCount(0);
  74  |       await expect(page.getByRole('combobox')).toHaveCount(0);
  75  |       await page.evaluate(() => document.fonts.ready);
  76  |       await page.screenshot({ path: `${OUT}/e1-recria-vazio-${vp.nome}.png`, fullPage: true });
  77  | 
  78  |       await preencherPlanilha(page);
  79  |       await expect(resultado.locator('.hero .big')).toHaveText('R$ 102.408,05');
  80  | 
  81  |       await page.getByLabel('Preço de venda', { exact: true }).fill('330');
  82  |       await expect(resultado.locator('.hero .big')).not.toHaveText('R$ 102.408,05');
  83  | 
  84  |       await page.getByLabel('Investimento', { exact: true }).fill('');
  85  |       await expect(resultado.locator('.hero .big')).toHaveText('—');
  86  | 
  87  |       await page.getByLabel('Investimento', { exact: true }).fill('122534,8');
  88  |       await page.getByLabel('Preço de venda', { exact: true }).fill('325');
  89  |       await expect(resultado.locator('.hero .big')).toHaveText('R$ 102.408,05');
  90  |       await page.evaluate(() => document.fonts.ready);
  91  |       await page.screenshot({ path: `${OUT}/e1-recria-${vp.nome}.png`, fullPage: true });
  92  | 
  93  |       await page.getByRole('button', { name: 'Limpar campos' }).click();
  94  |       await page.getByRole('alertdialog').getByRole('button', { name: 'Limpar' }).click();
  95  |       await expect(resultado.locator('.hero .big')).toHaveText('—');
  96  |     });
  97  |   });
  98  | }
  99  | 
  100 | test('RF-053 a navegação lateral some e a barra inferior aparece em 390 px', async ({ page }) => {
  101 |   await page.setViewportSize({ width: 390, height: 844 });
  102 |   await page.goto('/painel');
  103 |   const navs = page.getByRole('navigation', { name: 'Principal', includeHidden: true });
  104 |   const lateral = navs.first();
  105 |   const inferior = navs.last();
  106 |   await expect(lateral).toBeHidden();
  107 |   await expect(inferior).toBeVisible();
  108 |   await expect(inferior.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
  109 |   await expect(inferior.getByRole('link')).toHaveCount(4); // Painel, Negócios, Recria, Conta
  110 | });
  111 | 
  112 | test('RF-052 o botão "i" abre o balão e Esc fecha', async ({ page }) => {
  113 |   await page.goto('/painel');
  114 |   const botao = page.getByRole('button', { name: 'O que é: Saldo' }).first();
  115 |   await botao.click();
  116 |   await expect(botao).toHaveAttribute('aria-expanded', 'true');
  117 |   await expect(page.getByRole('dialog', { name: 'Saldo' })).toContainText('Como é calculado');
  118 |   await page.keyboard.press('Escape');
  119 |   await expect(botao).toHaveAttribute('aria-expanded', 'false');
  120 | });
  121 | 
  122 | test('RF-025/RF-026 modal de venda: desconto automático para fêmeas e pré-visualização', async ({
  123 |   page,
  124 | }) => {
  125 |   await page.setViewportSize({ width: 1440, height: 900 });
  126 |   await page.goto('/negocios?novo=venda');
  127 |   const modal = page.getByRole('dialog', { name: 'Nova venda' });
  128 |   await expect(modal).toBeVisible();
  129 |   await expect(page).toHaveURL(/\/negocios$/);
  130 |   await modal.getByLabel('Categoria', { exact: true }).fill('novilhas');
  131 |   await expect(modal.getByRole('checkbox', { name: /Aplicar desconto/ })).toBeChecked();
  132 |   await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  133 |   await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  134 |   await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  135 |   await expect(modal.getByRole('group', { name: 'Pré-visualização do lote' })).toContainText(
  136 |     'R$ 29.000,00',
  137 |   );
  138 |   await page.evaluate(() => document.fonts.ready);
  139 |   await page.screenshot({ path: `${OUT}/e1-modal-venda-1440.png` });
  140 | });
  141 | 
```