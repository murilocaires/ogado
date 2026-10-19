import { expect, test, type Page } from '@playwright/test';
import { preencherPlanilha } from './planilha';

/**
 * E1 (produto navegável): jornadas SEM API e SEM login, dados no navegador.
 * Também salva capturas (1440 e 390 px) em .scratch/web-v1/evidence/ para revisão visual.
 */
const OUT = '../../.scratch/web-v1/evidence';

const viewports = [
  { nome: '1440', width: 1440, height: 900 },
  { nome: '390', width: 390, height: 844 },
];

async function lancar(page: Page, tipo: 'Compra' | 'Venda', v: { qtd: string; peso: string; preco: string }) {
  const nome = tipo === 'Compra' ? 'Nova compra' : 'Nova venda';
  await page.getByRole('button', { name: nome }).first().click();
  const modal = page.getByRole('dialog', { name: nome });
  await modal.getByLabel('Quantidade', { exact: true }).fill(v.qtd);
  await modal.getByLabel('Peso total do lote', { exact: true }).fill(v.peso);
  await modal.getByLabel('Preço da arroba', { exact: true }).fill(v.preco);
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lote salvo.' })).toBeVisible();
}

for (const vp of viewports) {
  test.describe(`E1 em ${vp.nome}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`RF-024 cadastrar compra e venda leva ao saldo (${vp.nome}px)`, async ({ page }) => {
      const erros: string[] = [];
      page.on('pageerror', (e) => erros.push(e.message));

      await page.goto('/');
      await expect(page).toHaveURL(/\/painel$/);
      await expect(page.getByText('Nenhuma operação ainda')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/e1-painel-vazio-${vp.nome}.png`, fullPage: true });

      await page.getByRole('link', { name: 'Negócios' }).filter({ visible: true }).click();
      await expect(page).toHaveURL(/\/negocios$/);
      await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();

      await lancar(page, 'Compra', { qtd: '10', peso: '3000', preco: '300' });
      await lancar(page, 'Venda', { qtd: '10', peso: '4500', preco: '320' });

      // 100 @ x R$ 300 = 30.000 comprados; 150 @ x R$ 320 = 48.000 vendidos
      await expect(page.getByTestId('saldo')).toHaveText('+R$ 18.000,00');
      await page.screenshot({ path: `${OUT}/e1-negocios-${vp.nome}.png`, fullPage: true });

      // Os dados ficam no navegador: recarregar não perde nada.
      await page.reload();
      await expect(page.getByTestId('saldo')).toHaveText('+R$ 18.000,00');

      // Painel reflete os lançamentos.
      await page.getByRole('link', { name: 'Painel' }).filter({ visible: true }).click();
      await expect(page.getByTestId('saldo')).toHaveText('+R$ 18.000,00');
      await expect(page.getByText('Lote 1 · Bezerros')).toBeVisible();
      await page.screenshot({ path: `${OUT}/e1-painel-${vp.nome}.png`, fullPage: true });

      expect(erros).toEqual([]);
    });

    test(`RF-030 simular recria: abre vazio, digita a planilha e chega ao valor de ouro (${vp.nome}px)`, async ({
      page,
    }) => {
      await page.goto('/recria');
      const resultado = page.getByRole('region', { name: 'Resultado da recria' });
      // ADR-0014: o simulador novo abre em branco, sem padrões nem seletor de lotação.
      await expect(page.getByLabel('Investimento', { exact: true })).toHaveValue('');
      await expect(resultado.locator('.hero .big')).toHaveText('—');
      await expect(page.getByRole('button', { name: 'Restaurar padrões' })).toHaveCount(0);
      await expect(page.getByLabel(/Lotação inicial/)).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/e1-recria-vazio-${vp.nome}.png`, fullPage: true });

      await preencherPlanilha(page);
      await expect(resultado.locator('.hero .big')).toHaveText('R$ 102.408,05');

      await page.getByLabel('Preço de venda', { exact: true }).fill('330');
      await expect(resultado.locator('.hero .big')).not.toHaveText('R$ 102.408,05');

      await page.getByLabel('Investimento', { exact: true }).fill('');
      await expect(resultado.locator('.hero .big')).toHaveText('—');

      await page.getByLabel('Investimento', { exact: true }).fill('122534,8');
      await page.getByLabel('Preço de venda', { exact: true }).fill('325');
      await expect(resultado.locator('.hero .big')).toHaveText('R$ 102.408,05');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/e1-recria-${vp.nome}.png`, fullPage: true });

      await page.getByRole('button', { name: 'Limpar campos' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Limpar' }).click();
      await expect(resultado.locator('.hero .big')).toHaveText('—');
    });
  });
}

test('RF-053 a navegação lateral some e a barra inferior aparece em 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/painel');
  const navs = page.getByRole('navigation', { name: 'Principal', includeHidden: true });
  const lateral = navs.first();
  const inferior = navs.last();
  await expect(lateral).toBeHidden();
  await expect(inferior).toBeVisible();
  await expect(inferior.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
  await expect(inferior.getByRole('link')).toHaveCount(4); // Painel, Negócios, Recria, Conta
});

test('RF-052 o botão "i" abre o balão e Esc fecha', async ({ page }) => {
  await page.goto('/painel');
  const botao = page.getByRole('button', { name: 'O que é: Saldo' }).first();
  await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog', { name: 'Saldo' })).toContainText('Como é calculado');
  await page.keyboard.press('Escape');
  await expect(botao).toHaveAttribute('aria-expanded', 'false');
});

test('RF-025/RF-026 modal de venda: desconto automático para fêmeas e pré-visualização', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/negocios?novo=venda');
  const modal = page.getByRole('dialog', { name: 'Nova venda' });
  await expect(modal).toBeVisible();
  await expect(page).toHaveURL(/\/negocios$/);
  await modal.getByLabel('Categoria', { exact: true }).fill('novilhas');
  await expect(modal.getByRole('checkbox', { name: /Aplicar desconto/ })).toBeChecked();
  await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  await expect(modal.getByRole('group', { name: 'Pré-visualização do lote' })).toContainText(
    'R$ 29.000,00',
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/e1-modal-venda-1440.png` });
});
