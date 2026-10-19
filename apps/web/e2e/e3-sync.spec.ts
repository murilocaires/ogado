import { expect, test, type Page } from '@playwright/test';

/**
 * E3: os dados seguem o usuário. Aparelho A cadastra e lança um lote; aparelho B (outro contexto,
 * sem nada no armazenamento) entra e vê o mesmo lote. Contra a API real + Postgres.
 */
const SENHA = 'Segredo#2026';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.ogado.invalid`;
}

async function lancarCompra(page: Page, v: { qtd: string; peso: string; preco: string }) {
  await page.getByRole('button', { name: 'Novo lote' }).first().click();
  const modal = page.getByRole('dialog', { name: /Novo lote de/ });
  await modal.getByRole('button', { name: 'Compra', exact: true }).click();
  await modal.getByLabel('Quantidade', { exact: true }).fill(v.qtd);
  await modal.getByLabel('Peso total do lote', { exact: true }).fill(v.peso);
  await modal.getByLabel('Preço da arroba', { exact: true }).fill(v.preco);
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lote salvo.' })).toBeVisible();
}

test('telas do produto sem login levam a /entrar', async ({ page }) => {
  for (const rota of ['/painel', '/negocios', '/recria', '/conta']) {
    await page.goto(rota);
    await expect(page).toHaveURL(/\/entrar$/);
  }
});

test('o lote lançado no aparelho A aparece no aparelho B', async ({ browser }) => {
  const email = uniqueEmail('sync');

  const a = await (await browser.newContext()).newPage();
  await a.goto('/cadastrar');
  await a.getByLabel('E-mail', { exact: true }).fill(email);
  await a.getByLabel('Senha', { exact: true }).fill(SENHA);
  await a.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
  await a.getByRole('button', { name: 'Criar conta' }).click();
  await expect(a).toHaveURL(/\/painel$/);
  await a.getByRole('link', { name: 'Negócios' }).filter({ visible: true }).click();
  await lancarCompra(a, { qtd: '10', peso: '3000', preco: '300' });
  await expect(a.locator('[data-sync-status="sincronizado"]')).toBeAttached();

  const b = await (await browser.newContext()).newPage();
  await b.goto('/entrar');
  await b.getByLabel('E-mail', { exact: true }).fill(email);
  await b.getByLabel('Senha', { exact: true }).fill(SENHA);
  await b.getByRole('button', { name: 'Entrar' }).click();
  await expect(b).toHaveURL(/\/painel$/);
  await b.getByRole('link', { name: 'Negócios' }).filter({ visible: true }).click();
  await expect(b.getByRole('heading', { name: 'Nenhum lote' })).toBeHidden();
  await expect(b.getByText('Lote 1')).toBeVisible();
});
