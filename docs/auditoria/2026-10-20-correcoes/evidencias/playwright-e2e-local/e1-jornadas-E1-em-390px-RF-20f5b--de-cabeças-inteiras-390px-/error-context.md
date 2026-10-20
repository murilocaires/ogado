# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e1-jornadas.spec.ts >> E1 em 390px >> RF-030 simular recria: abre vazio e calcula a variante de cabeças inteiras (390px)
- Location: e2e\e1-jornadas.spec.ts:65:5

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByRole('region', { name: 'Resultado da recria' }).locator('.hero .big')
Expected: "R$ 103.307,60"
Received: "R$ 269.014.178.987,60"
Timeout:  15000ms

Call log:
  - Expect "toHaveText" getByRole('region', { name: 'Resultado da recria' }).locator('.hero .big') with timeout 15000ms
  - waiting for getByRole('region', { name: 'Resultado da recria' }).locator('.hero .big')
    32 × locator resolved to <div class="big pos" aria-live="polite" aria-atomic="true">R$ 269.014.178.987,60</div>
       - unexpected value "R$ 269.014.178.987,60"

```

```yaml
- text: R$ 269.014.178.987,60
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import { preencherPlanilha, RESULTADO_CABECAS_INTEIRAS } from './planilha';
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
  65  |     test(`RF-030 simular recria: abre vazio e calcula a variante de cabeças inteiras (${vp.nome}px)`, async ({
  66  |       page,
  67  |     }) => {
  68  |       await page.goto('/recria');
  69  |       const resultado = page.getByRole('region', { name: 'Resultado da recria' });
  70  |       // ADR-0014: o simulador novo abre em branco, sem padrões nem seletor de lotação.
  71  |       await expect(page.getByLabel('Investimento (compra)', { exact: true })).toHaveValue('');
  72  |       await expect(resultado.locator('.hero .big')).toHaveText('—');
  73  |       await expect(page.getByRole('button', { name: 'Restaurar padrões' })).toHaveCount(0);
  74  |       await expect(page.getByRole('combobox')).toHaveCount(0);
  75  |       await page.evaluate(() => document.fonts.ready);
  76  |       await page.screenshot({ path: `${OUT}/e1-recria-vazio-${vp.nome}.png`, fullPage: true });
  77  | 
  78  |       await preencherPlanilha(page);
  79  |       await expect(resultado.locator('.hero .big')).toHaveText(RESULTADO_CABECAS_INTEIRAS);
  80  | 
  81  |       await page.getByLabel('R$/cab (venda)', { exact: true }).fill('330');
  82  |       await expect(resultado.locator('.hero .big')).not.toHaveText(RESULTADO_CABECAS_INTEIRAS);
  83  | 
  84  |       await page.getByLabel('Investimento (compra)', { exact: true }).fill('');
  85  |       await expect(resultado.locator('.hero .big')).toHaveText('—');
  86  | 
  87  |       await page.getByLabel('Investimento (compra)', { exact: true }).fill('122534,8');
  88  |       await page.getByLabel('R$/cab (venda)', { exact: true }).fill('325');
> 89  |       await expect(resultado.locator('.hero .big')).toHaveText(RESULTADO_CABECAS_INTEIRAS);
      |                                                     ^ Error: expect(locator).toHaveText(expected) failed
  90  |       await page.evaluate(() => document.fonts.ready);
  91  |       await page.screenshot({ path: `${OUT}/e1-recria-${vp.nome}.png`, fullPage: true });
  92  | 
  93  |       await page.getByRole('button', { name: 'Limpar Dados do lote', exact: true }).click();
  94  |       await expect(resultado.locator('.hero .big')).toHaveText('—');
  95  |     });
  96  |   });
  97  | }
  98  | 
  99  | test('RF-053 a navegação lateral some e a barra inferior aparece em 390 px', async ({ page }) => {
  100 |   await page.setViewportSize({ width: 390, height: 844 });
  101 |   await page.goto('/painel');
  102 |   const navs = page.getByRole('navigation', { name: 'Principal', includeHidden: true });
  103 |   const lateral = navs.first();
  104 |   const inferior = navs.last();
  105 |   await expect(lateral).toBeHidden();
  106 |   await expect(inferior).toBeVisible();
  107 |   await expect(inferior.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
  108 |   await expect(inferior.getByRole('link')).toHaveCount(4); // Painel, Negócios, Recria, Conta
  109 | });
  110 | 
  111 | test('RF-052 o botão "i" abre o balão e Esc fecha', async ({ page }) => {
  112 |   await page.goto('/painel');
  113 |   const botao = page.getByRole('button', { name: 'O que é: Saldo' }).first();
  114 |   await botao.click();
  115 |   await expect(botao).toHaveAttribute('aria-expanded', 'true');
  116 |   await expect(page.getByRole('dialog', { name: 'Saldo' })).toContainText('Como é calculado');
  117 |   await page.keyboard.press('Escape');
  118 |   await expect(botao).toHaveAttribute('aria-expanded', 'false');
  119 | });
  120 | 
  121 | test('RF-025/RF-026 modal de venda: desconto automático para fêmeas e pré-visualização', async ({
  122 |   page,
  123 | }) => {
  124 |   await page.setViewportSize({ width: 1440, height: 900 });
  125 |   await page.goto('/negocios?novo=venda');
  126 |   const modal = page.getByRole('dialog', { name: 'Nova venda' });
  127 |   await expect(modal).toBeVisible();
  128 |   await expect(page).toHaveURL(/\/negocios$/);
  129 |   await modal.getByLabel('Categoria', { exact: true }).fill('novilhas');
  130 |   await expect(modal.getByRole('checkbox', { name: /Aplicar desconto/ })).toBeChecked();
  131 |   await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  132 |   await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  133 |   await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  134 |   await expect(modal.getByRole('group', { name: 'Pré-visualização do lote' })).toContainText(
  135 |     'R$ 29.000,00',
  136 |   );
  137 |   await page.evaluate(() => document.fonts.ready);
  138 |   await page.screenshot({ path: `${OUT}/e1-modal-venda-1440.png` });
  139 | });
  140 | 
```