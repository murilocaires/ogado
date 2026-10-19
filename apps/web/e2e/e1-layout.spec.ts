import { expect, test, type Page } from '@playwright/test';

/**
 * RF-024/RF-040/RF-053: Negócios e Painel sem rolagem horizontal, botões de criar contextuais por
 * aba, Exportar discreto e "Últimas operações" com no máximo 3 itens. Salva capturas em
 * .scratch/web-v1/evidence/ (390x844 e 1440x900).
 */
const OUT = '../../.scratch/web-v1/evidence';

interface Lancamento {
  tipo: 'Compra' | 'Venda';
  categoria: string;
  qtd: string;
  peso: string;
  preco: string;
  data: string;
}

async function lancar(page: Page, v: Lancamento) {
  const nome = v.tipo === 'Compra' ? 'Nova compra' : 'Nova venda';
  await page.getByRole('button', { name: nome }).first().click();
  const modal = page.getByRole('dialog', { name: nome });
  await modal.getByLabel('Categoria', { exact: true }).fill(v.categoria);
  await modal.getByLabel('Quantidade', { exact: true }).fill(v.qtd);
  await modal.getByLabel('Peso total do lote', { exact: true }).fill(v.peso);
  await modal.getByLabel('Preço da arroba', { exact: true }).fill(v.preco);
  await modal.getByLabel('Data', { exact: true }).fill(v.data);
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lote salvo.' })).toBeVisible();
}

async function semRolagemHorizontal(page: Page): Promise<void> {
  const [sw, iw] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(sw, `scrollWidth ${sw} > innerWidth ${iw}`).toBeLessThanOrEqual(iw);
}

test('RF-024/RF-040 Negócios e Painel cabem em todas as larguras e os botões são contextuais', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/negocios');

  // estado vazio: botões contextuais também aqui
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  await expect(page.locator('.empty-acoes').getByRole('button', { name: 'Nova compra' })).toBeVisible();
  await expect(page.locator('.empty-acoes').getByRole('button', { name: 'Nova venda' })).toBeVisible();

  await lancar(page, { tipo: 'Compra', categoria: 'Bezerros', qtd: '10', peso: '3000', preco: '300', data: '2026-10-01' });
  await lancar(page, { tipo: 'Compra', categoria: 'Garrotes', qtd: '20', peso: '6400', preco: '310', data: '2026-10-02' });
  await lancar(page, { tipo: 'Venda', categoria: 'Bois', qtd: '10', peso: '4500', preco: '320', data: '2026-10-03' });
  await lancar(page, { tipo: 'Venda', categoria: 'Novilhas', qtd: '10', peso: '3000', preco: '300', data: '2026-10-04' });

  // Painel: 4 operações, só as 3 mais recentes aparecem
  await page.getByRole('link', { name: 'Painel' }).filter({ visible: true }).click();
  await expect(page.locator('.ops > div')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/ajustes-painel-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${OUT}/ajustes-painel-1440.png`, fullPage: true });

  for (const vp of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(vp);
    await page.goto('/negocios');
    // Exportar fica sozinho no topo e discreto (secundário, pequeno)
    const topo = page.locator('.top-actions');
    await expect(topo.getByRole('button')).toHaveCount(1);
    const exportar = topo.getByRole('button', { name: 'Exportar' });
    const caixa = (await exportar.boundingBox())!;
    expect(caixa.height).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeLessThanOrEqual(48);
    expect(caixa.width).toBeLessThanOrEqual(140);

    const barra = page.locator('.abas-barra');
    for (const [aba, botoes] of [
      ['Todas', ['Nova compra', 'Nova venda']],
      ['Compras', ['Nova compra']],
      ['Vendas', ['Nova venda']],
    ] as const) {
      await barra.getByRole('tab', { name: aba }).click();
      await expect(barra.getByRole('button')).toHaveCount(botoes.length);
      for (const b of botoes) {
        const botao = barra.getByRole('button', { name: b });
        await expect(botao).toBeVisible();
        expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      if (vp.width === 1440) {
        // mesma barra das abas, botões no canto oposto (direita)
        const abas = (await barra.getByRole('tablist').boundingBox())!;
        const ultimo = (await barra.getByRole('button').last().boundingBox())!;
        expect(ultimo.x).toBeGreaterThan(abas.x + abas.width);
      }
      await semRolagemHorizontal(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${OUT}/ajustes-negocios-${aba.toLowerCase()}-${vp.width}.png`,
        fullPage: true,
      });
    }
  }

  // sem rolagem horizontal da página em larguras de celular, tablet e desktop
  for (const largura of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width: largura, height: 844 });
    for (const rota of ['/negocios', '/painel']) {
      await page.goto(rota);
      await expect(page.getByTestId('saldo')).toBeVisible();
      await semRolagemHorizontal(page);
    }
  }
});

test('RF-024 abrir o modal pelo botão contextual já vem no tipo certo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/negocios');
  await page.getByRole('tab', { name: 'Vendas' }).click();
  await page.getByRole('button', { name: 'Nova venda' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova venda' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('group', { name: 'Tipo de lançamento' })).toHaveCount(0);
});
