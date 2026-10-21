import { expect, test } from '@playwright/test';

/**
 * RF-002, lado "esqueci". API real + Postgres (ver playwright.config.ts). O fluxo com token não é
 * testável aqui (o e-mail não é capturável); ele é coberto pelos testes da API.
 */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.bovaro.invalid`;
}

test('RF-002 a tela Entrar leva a Esqueci minha senha', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
});

test('RF-002 e-mail sem conta recebe a mesma confirmação neutra', async ({ page }) => {
  await page.goto('/esqueci-senha');
  await page.getByLabel('E-mail').fill(uniqueEmail('inexistente'));
  await page.getByRole('button', { name: 'Enviar link' }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('Se houver uma conta com este e-mail, enviamos um link');
  await expect(status).toContainText('vale por 1 hora');
  await expect(page.locator('.notice-error')).toHaveCount(0);
});

test('RF-002 redefinir sem token mostra o link inválido e leva a pedir novo', async ({ page }) => {
  await page.goto('/redefinir-senha');
  await expect(page.locator('.notice-error')).toContainText('inválido ou expirou');
  await page.getByRole('link', { name: 'Pedir novo link' }).click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
});
