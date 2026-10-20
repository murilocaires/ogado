import { expect, test, type Page } from '@playwright/test';

async function salvar(page: Page, categoria: string) {
  await page.getByRole('button', { name: 'Nova compra', exact: true }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova compra' });
  await modal.getByLabel('Categoria', { exact: true }).fill(categoria);
  await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nova compra' })).toHaveCount(0);
}

test('RF-073/RNF-017 duas abas preservam lançamentos e fila após recarregar', async ({
  page,
  context,
}) => {
  await page.goto('/negocios');
  const outra = await context.newPage();
  await outra.goto('/negocios');
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  await expect(outra.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  await salvar(page, 'GARROTES');
  await salvar(outra, 'NOVILHAS');
  await expect(page.getByRole('row').filter({ hasText: 'Novilhas' })).toBeVisible();
  await expect(outra.getByRole('row').filter({ hasText: 'Garrotes' })).toBeVisible();
  await page.reload();
  await outra.reload();
  for (const aba of [page, outra]) {
    await expect(aba.getByRole('row').filter({ hasText: 'Garrotes' })).toBeVisible();
    await expect(aba.getByRole('row').filter({ hasText: 'Novilhas' })).toBeVisible();
  }
});
