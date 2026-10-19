import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * E5-A: sincronização robusta, contra a API real + Postgres. Pendências visíveis (indicador e selo),
 * volta da rede e conflito entre dois aparelhos (RF-074…RF-079).
 */
const SENHA = 'Segredo#2026';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.ogado.invalid`;
}

async function cadastrar(page: Page, email: string): Promise<void> {
  await page.goto('/cadastrar');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

async function entrar(page: Page, email: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

async function irParaNegocios(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Negócios' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Compra e Venda' })).toBeVisible();
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

async function editarQuantidade(page: Page, qtd: string) {
  await page
    .getByRole('button', { name: 'Editar lote 1 de compra' })
    .filter({ visible: true })
    .click();
  const modal = page.getByRole('dialog', { name: /Editar lote de/ });
  await modal.getByLabel('Quantidade', { exact: true }).fill(qtd);
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible();
}

/** Quantidade do primeiro lote na nuvem, como número. */
async function qtdNaNuvem(page: Page): Promise<number> {
  const r = await page.request.get('/api/lotes');
  const corpo = (await r.json()) as { lotes: { qtd: string }[] };
  return Number(corpo.lotes[0]?.qtd);
}

/** Sinal de "rodada concluída": o indicador some quando tudo está certo, então o shell expõe o estado. */
const sincronizado = (page: Page) => page.locator('[data-sync-status="sincronizado"]');

test('RF-075 lançar offline mostra "1 pendente" e o selo; ao voltar a rede some', async ({
  page,
  context,
}) => {
  await cadastrar(page, uniqueEmail('pend'));
  await irParaNegocios(page);
  await expect(sincronizado(page)).toBeAttached();
  // Online e sincronizado: nenhum indicador visível, nem botão "Sincronizar agora".
  await expect(page.getByText('Sincronizado', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Sem conexão/).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);

  await context.setOffline(true);
  await lancarCompra(page, { qtd: '12', peso: '3600', preco: '310' });

  await expect(page.getByText('Sem conexão · 1 pendente').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('pendente', { exact: true }).filter({ visible: true })).toBeVisible();

  // Ao voltar a rede sobe sozinho, sem clicar em nada, e o indicador some.
  await context.setOffline(false);
  await expect(sincronizado(page)).toBeAttached({ timeout: 30_000 });
  await expect(page.getByText(/Sem conexão/).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText('pendente', { exact: true })).toHaveCount(0);
  expect(await qtdNaNuvem(page)).toBe(12);
});

test('RF-075 o indicador também aparece em tela estreita', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await cadastrar(page, uniqueEmail('estreita'));
  await irParaNegocios(page);
  await expect(sincronizado(page)).toBeAttached();

  await context.setOffline(true);
  await lancarCompra(page, { qtd: '5', peso: '1500', preco: '300' });

  await expect(page.getByText('Sem conexão · 1 pendente').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0);
  await context.setOffline(false);
});

/** A e B na mesma conta, com o Lote 1 sincronizado nos dois. */
async function doisAparelhos(browser: Browser, prefixo: string) {
  const email = uniqueEmail(prefixo);
  const ctxA: BrowserContext = await browser.newContext();
  const a = await ctxA.newPage();
  await cadastrar(a, email);
  await irParaNegocios(a);
  await lancarCompra(a, { qtd: '10', peso: '3000', preco: '300' });
  await expect(sincronizado(a)).toBeAttached();
  await expect.poll(() => qtdNaNuvem(a)).toBe(10);

  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await entrar(b, email);
  await irParaNegocios(b);
  await expect(b.getByText('Lote 1').first()).toBeVisible();
  await expect(sincronizado(b)).toBeAttached();
  return { a, b, ctxA, ctxB };
}

/** A edita sem conexão (20) enquanto B edita e sobe (30); A volta e encontra o conflito. */
async function provocarConflito(browser: Browser, prefixo: string) {
  const t = await doisAparelhos(browser, prefixo);
  await t.ctxA.setOffline(true);
  await editarQuantidade(t.a, '20');
  await expect(t.a.getByText('Sem conexão · 1 pendente').filter({ visible: true })).toBeVisible();

  await editarQuantidade(t.b, '30');
  await expect.poll(() => qtdNaNuvem(t.b)).toBe(30);

  await t.ctxA.setOffline(false);
  await t.a
    .getByRole('button', { name: '1 item precisa de atenção' })
    .filter({ visible: true })
    .click();
  const lista = t.a.getByRole('dialog', { name: 'Precisa de atenção' });
  await lista.getByRole('button', { name: 'Resolver' }).click();
  const decisao = t.a.getByRole('alertdialog', {
    name: 'Este lote foi alterado em outro aparelho',
  });
  await expect(decisao).toBeVisible();
  // Os dois valores lado a lado; a nuvem ainda não foi sobrescrita.
  const linha = decisao.getByRole('row', { name: /Quantidade/ });
  await expect(linha.getByRole('cell').first()).toHaveText('20');
  await expect(linha.getByRole('cell').nth(1)).toContainText('30');
  expect(await qtdNaNuvem(t.b)).toBe(30);
  return { ...t, decisao };
}

test('RF-076 conflito entre aparelhos: "Manter o meu" envia o valor do aparelho', async ({
  browser,
}) => {
  const { a, b, decisao, ctxA, ctxB } = await provocarConflito(browser, 'conf-meu');

  await decisao.getByRole('button', { name: 'Manter o meu' }).click();

  await expect.poll(() => qtdNaNuvem(b), { timeout: 30_000 }).toBe(20);
  await expect(a.getByRole('button', { name: /precisa de atenção/ })).toHaveCount(0);
  await expect(sincronizado(a)).toBeAttached();
  await ctxA.close();
  await ctxB.close();
});

test('RF-076 conflito entre aparelhos: "Usar o do servidor" adota o valor da nuvem', async ({
  browser,
}) => {
  const { a, b, decisao, ctxA, ctxB } = await provocarConflito(browser, 'conf-srv');

  await decisao.getByRole('button', { name: 'Usar o do servidor' }).click();

  await expect(
    a
      .getByRole('row', { name: /Lote 1/ })
      .getByRole('cell')
      .nth(1),
  ).toHaveText('30', {
    timeout: 30_000,
  });
  expect(await qtdNaNuvem(b)).toBe(30);
  await expect(a.getByRole('button', { name: /precisa de atenção/ })).toHaveCount(0);
  await expect(sincronizado(a)).toBeAttached();
  await ctxA.close();
  await ctxB.close();
});
