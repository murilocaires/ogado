import { expect, test, type Page } from '@playwright/test';

/**
 * Persistência no aparelho em tela de celular (RF-073/RNF-017): a confirmação só fecha o
 * diálogo/modal depois que o IndexedDB confirmou a gravação. Quando o sistema suspende o banco
 * (app em segundo plano no celular), a tela não pode ficar presa: a conexão é descartada, uma
 * nova é aberta e, se ainda falhar, o erro aparece no próprio diálogo para repetir.
 */

async function abrirNegocios(page: Page): Promise<void> {
  await page.goto('/negocios');
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
}

async function lancarCompra(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nova compra' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova compra' });
  await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await expect(modal).toHaveCount(0);
}

function botaoExcluir(page: Page) {
  return page
    .getByRole('button', { name: 'Excluir lote 1 de compra' })
    .filter({ visible: true })
    .first();
}

async function confirmarExclusao(page: Page): Promise<void> {
  await botaoExcluir(page).click();
  const confirmacao = page.getByRole('alertdialog');
  await expect(confirmacao).toBeVisible();
  await confirmacao.getByRole('button', { name: 'Excluir', exact: true }).click();
}

/**
 * Simula a conexão que o sistema encerra quando o app volta do segundo plano: a conexão atual
 * falha para sempre, mas abrir uma conexão nova (o que a recuperação faz) funciona.
 */
async function simularConexaoPerdida(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as {
      __quebrarConexaoAtual?: () => void;
    };
    let ultima: IDBDatabase | null = null;
    const abrir = indexedDB.open.bind(indexedDB);
    indexedDB.open = ((...args: Parameters<IDBFactory['open']>) => {
      const pedido = abrir(...args);
      pedido.addEventListener('success', () => {
        if (pedido.result.name === 'bovaro.local.v1') ultima = pedido.result;
      });
      return pedido;
    }) as IDBFactory['open'];
    alvo.__quebrarConexaoAtual = () => {
      if (ultima) (ultima as IDBDatabase & { __quebrada?: boolean }).__quebrada = true;
    };
    const transacao = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase & { __quebrada?: boolean },
      ...args: Parameters<IDBDatabase['transaction']>
    ) {
      if (this.__quebrada) {
        throw new DOMException('Connection to Indexed Database server lost.', 'InvalidStateError');
      }
      return transacao.apply(this, args);
    } as IDBDatabase['transaction'];
  });
}

/** Transação que nunca termina: reproduz o banco suspenso que prendia o modal em "Salvando…". */
async function simularBancoTravado(page: Page): Promise<void> {
  await page.evaluate(() => {
    const alvo = window as unknown as { __restaurarIdb?: () => void };
    const original = IDBDatabase.prototype.transaction;
    alvo.__restaurarIdb = () => {
      IDBDatabase.prototype.transaction = original;
    };
    const pedido = () => {
      const p: Record<string, unknown> = {};
      Object.defineProperty(p, 'onsuccess', { get: () => null, set: () => undefined });
      Object.defineProperty(p, 'onerror', { get: () => null, set: () => undefined });
      return p;
    };
    const store = {
      get: pedido,
      getAll: pedido,
      getAllKeys: pedido,
      count: pedido,
      put: pedido,
      delete: pedido,
      clear: pedido,
    };
    const tx: Record<string, unknown> = {
      objectStore: () => store,
      abort: () => undefined,
    };
    Object.defineProperty(tx, 'oncomplete', { get: () => null, set: () => undefined });
    Object.defineProperty(tx, 'onabort', { get: () => null, set: () => undefined });
    Object.defineProperty(tx, 'onerror', { get: () => null, set: () => undefined });
    IDBDatabase.prototype.transaction = function () {
      return tx;
    } as unknown as IDBDatabase['transaction'];
  });
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('no celular, excluir fecha a confirmação e some depois de recarregar', async ({ page }) => {
  await abrirNegocios(page);
  await lancarCompra(page);
  await confirmarExclusao(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar lote 1 de compra' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
});

test('sem internet, salvar fecha o modal e mantém o lote na lista', async ({ page, context }) => {
  await abrirNegocios(page);
  await context.setOffline(true);
  await lancarCompra(page);
  await expect(
    page.getByRole('button', { name: 'Editar lote 1 de compra' }).filter({ visible: true }).first(),
  ).toBeVisible();
});

test('conexão do banco perdida pelo sistema: a próxima gravação se recupera sozinha', async ({
  page,
}) => {
  await simularConexaoPerdida(page);
  await abrirNegocios(page);
  await lancarCompra(page);
  await page.evaluate(() => {
    (window as unknown as { __quebrarConexaoAtual: () => void }).__quebrarConexaoAtual();
  });
  await confirmarExclusao(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Editar lote 1 de compra' })).toHaveCount(0);
  await expect(page.getByText(/não está deixando salvar/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
});

test('banco travado: o salvamento não fica preso e repete com sucesso', async ({ page }) => {
  await abrirNegocios(page);
  await simularBancoTravado(page);
  await page.getByRole('button', { name: 'Nova compra' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova compra' });
  await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await expect(modal.getByText(/Não foi possível confirmar o salvamento/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(modal).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __restaurarIdb: () => void }).__restaurarIdb();
  });
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await expect(modal).toHaveCount(0, { timeout: 20_000 });
  await expect(
    page.getByRole('button', { name: 'Editar lote 1 de compra' }).filter({ visible: true }).first(),
  ).toBeVisible();
});
