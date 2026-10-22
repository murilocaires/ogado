import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * E5-A: sincronização robusta, contra a API real + Postgres. Pendências no indicador global,
 * volta da rede e conflito entre dois aparelhos (RF-074…RF-079).
 */
const SENHA = 'Segredo#2026';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.bovaro.invalid`;
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
  await page.getByRole('button', { name: 'Nova compra' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova compra' });
  await modal.getByLabel('Quantidade', { exact: true }).fill(v.qtd);
  await modal.getByLabel('Peso total do lote', { exact: true }).fill(v.peso);
  await modal.getByLabel('Preço da arroba', { exact: true }).fill(v.preco);
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
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

test('RF-075 lançar offline mostra "1 pendente" sem selo no lote; ao voltar a rede some', async ({
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
  await expect(page.getByText('pendente', { exact: true })).toHaveCount(0);

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

test('RF-073 excluir offline some da nuvem ao reconectar e não volta', async ({
  page,
  context,
}) => {
  await cadastrar(page, uniqueEmail('exclui-off'));
  await irParaNegocios(page);
  await lancarCompra(page, { qtd: '12', peso: '3600', preco: '310' });
  await expect(sincronizado(page)).toBeAttached();
  await expect.poll(() => qtdNaNuvem(page)).toBe(12);

  await context.setOffline(true);
  await page
    .getByRole('button', { name: 'Excluir lote 1 de compra' })
    .filter({ visible: true })
    .click();
  const confirmacao = page.getByRole('alertdialog');
  await confirmacao.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmacao).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar lote 1 de compra' })).toHaveCount(0);
  await expect(page.getByText('Sem conexão · 1 pendente').filter({ visible: true })).toBeVisible();

  // A exclusão (tombstone) sobe sozinha e o lote não reaparece depois de recarregar.
  await context.setOffline(false);
  await expect(sincronizado(page)).toBeAttached({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const r = await page.request.get('/api/lotes?incluirExcluidos=true');
        const corpo = (await r.json()) as { lotes: { deletedAt: string | null }[] };
        return corpo.lotes.map((l) => l.deletedAt !== null);
      },
      { timeout: 30_000 },
    )
    .toEqual([true]);
  await expect(page.getByText(/Sem conexão/).filter({ visible: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
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

test('conflito no mesmo campo e resolvido sem perguntar e preserva historico', async ({
  browser,
}) => {
  const { a, b, ctxA, ctxB } = await doisAparelhos(browser, 'auto-mesmo');
  try {
    await ctxA.setOffline(true);
    await editarQuantidade(a, '20');
    await editarQuantidade(b, '30');
    await expect.poll(() => qtdNaNuvem(b)).toBe(30);
    await ctxA.setOffline(false);
    await expect.poll(() => qtdNaNuvem(a), { timeout: 30000 }).toBe(20);
    await expect(sincronizado(a)).toBeAttached();
    await expect(
      a.getByRole('button', { name: /Manter o meu|Usar o do servidor|Resolver/ }),
    ).toHaveCount(0);
    const resposta = await a.request.get('/api/historico-sync');
    expect(resposta.ok()).toBe(true);
    const dados = (await resposta.json()) as {
      registros: { local: { qtd: string }; servidor: { qtd: string } }[];
    };
    expect(dados.registros.some((h) => h.local.qtd === '20' && h.servidor.qtd === '30')).toBe(true);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test('edicoes em campos diferentes sao combinadas automaticamente', async ({ browser }) => {
  const { a, b, ctxA, ctxB } = await doisAparelhos(browser, 'auto-campos');
  try {
    await ctxA.setOffline(true);
    await editarQuantidade(a, '20');
    await b
      .getByRole('button', { name: 'Editar lote 1 de compra' })
      .filter({ visible: true })
      .click();
    const modal = b.getByRole('dialog', { name: /Editar lote de/ });
    await modal.getByLabel('Preço da arroba', { exact: true }).fill('400');
    await modal.getByRole('button', { name: 'Salvar lote' }).click();
    await expect(sincronizado(b)).toBeAttached();
    await ctxA.setOffline(false);
    await expect
      .poll(
        async () => {
          const res = await a.request.get('/api/lotes');
          const dados = (await res.json()) as { lotes: { qtd: string; preco: string }[] };
          return dados.lotes.map((l) => [Number(l.qtd), Number(l.preco)]);
        },
        { timeout: 30000 },
      )
      .toEqual([[20, 400]]);
    await expect(a.getByRole('alertdialog')).toHaveCount(0);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
