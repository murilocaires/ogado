import { expect, test } from '@playwright/test';
import { preencherPlanilha } from './planilha';

/**
 * E2 (cenários da recria): jornada SEM API e SEM login, dados no navegador.
 * Simular -> salvar cenário -> salvar outro -> comparar. Capturas (1440 e 390 px) em
 * .scratch/web-v1/evidence/.
 */
const OUT = '../../.scratch/web-v1/evidence';

const viewports = [
  { nome: '1440', width: 1440, height: 900 },
  { nome: '390', width: 390, height: 844 },
];

for (const vp of viewports) {
  test.describe(`E2 em ${vp.nome}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`RF-032/RF-033 simular, salvar, salvar outro e comparar (${vp.nome}px)`, async ({
      page,
    }) => {
      const erros: string[] = [];
      page.on('pageerror', (e) => erros.push(e.message));

      await page.goto('/recria');
      const resultado = page.getByRole('region', { name: 'Resultado da recria' });
      await preencherPlanilha(page);
      await expect(resultado.locator('.hero .big')).toHaveText('R$ 102.408,05');

      // 1) salva o cenário com os padrões da planilha
      await page.getByRole('button', { name: 'Salvar como cenário' }).click();
      const nome = page.getByRole('dialog', { name: 'Salvar como cenário' });
      await expect(nome.getByLabel('Nome do cenário')).toHaveValue('Cenário 1');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/e2-salvar-dialogo-${vp.nome}.png` });
      await nome.getByLabel('Nome do cenário').fill('Safra 26/27 — base');
      await nome.getByLabel('Nome do cenário').press('Enter');
      await expect(page.getByRole('status').filter({ hasText: 'Cenário salvo.' })).toBeVisible();
      await expect(page.getByRole('tab', { name: /^Cenários\s*1$/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      // 2) volta ao simulador, muda o preço e salva outro
      await page.getByRole('tab', { name: 'Simulador' }).click();
      await page.getByLabel('Preço de venda', { exact: true }).fill('350');
      await page.getByRole('button', { name: 'Salvar como cenário' }).click();
      const nome2 = page.getByRole('dialog', { name: 'Salvar como cenário' });
      await nome2.getByLabel('Nome do cenário').fill('Safra 26/27 — preço otimista');
      await nome2.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(page.getByRole('tab', { name: /^Cenários\s*2$/ })).toBeVisible();

      // 3) compara os dois
      await page.getByRole('checkbox', { name: 'Comparar Safra 26/27 — base' }).check();
      await page.getByRole('checkbox', { name: 'Comparar Safra 26/27 — preço otimista' }).check();
      const barra = page.getByRole('region', { name: 'Comparação' });
      await expect(barra).toContainText('2 selecionados');
      await page.screenshot({ path: `${OUT}/e2-cenarios-lista-${vp.nome}.png`, fullPage: true });
      await barra.getByRole('button', { name: 'Comparar' }).click();
      const tabela = page.getByRole('table');
      await expect(tabela).toBeVisible();
      await expect(tabela.getByRole('row', { name: /^Faturamento líquido/ })).toContainText('★');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/e2-comparacao-${vp.nome}.png`, fullPage: true });

      // grade e Painel
      await page.getByRole('button', { name: 'Grade' }).click();
      await page.screenshot({ path: `${OUT}/e2-cenarios-grade-${vp.nome}.png`, fullPage: true });

      // os cenários ficam no navegador
      await page.reload();
      await expect(page.getByRole('tab', { name: /^Simulador/ })).toBeVisible();
      await page.getByRole('tab', { name: /^Cenários\s*2$/ }).click();
      await expect(page.getByRole('listitem')).toHaveCount(2);

      await page.getByRole('link', { name: 'Painel' }).filter({ visible: true }).click();
      const cartao = page.getByRole('region', { name: /Recria, último cenário salvo/ });
      await expect(cartao).toContainText('Safra 26/27 — preço otimista');
      await page.screenshot({ path: `${OUT}/e2-painel-${vp.nome}.png`, fullPage: true });

      expect(erros).toEqual([]);
    });
  });
}

test('RF-035 abrir no simulador substitui as entradas pelas do cenário', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/recria');
  await preencherPlanilha(page);
  await page.getByRole('button', { name: 'Salvar como cenário' }).click();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Simulador' }).click();
  await page.getByLabel('Preço de venda', { exact: true }).fill('400');
  await page.getByRole('tab', { name: /^Cenários/ }).click();
  await page.getByRole('button', { name: 'Abrir Cenário 1' }).click();
  await expect(page.getByLabel('Preço de venda', { exact: true })).toHaveValue('325');
});

test('RF-034 a lista de cenários em 390 px oculta colunas e mantém abrir e excluir', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/recria?aba=cenarios');
  await expect(page.getByRole('heading', { name: 'Nenhum cenário salvo' })).toBeVisible();
  await page.getByRole('button', { name: 'Ir para o Simulador' }).click();
  await preencherPlanilha(page);
  await page.getByRole('button', { name: 'Salvar como cenário' }).click();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Abrir Cenário 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excluir Cenário 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duplicar Cenário 1' })).toBeHidden();
  await expect(page.getByText('Por mês', { exact: true })).toBeHidden();
});
