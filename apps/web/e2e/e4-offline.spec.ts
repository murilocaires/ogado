import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { preencherPlanilha, RESULTADO_CABECAS_INTEIRAS } from './planilha';

/**
 * E4: o app abre e calcula sem internet depois da primeira visita, e o que se lança offline sobe
 * quando a conexão volta. Roda em BUILD DE PRODUÇÃO (service worker) com a API real, pelo
 * playwright.offline.config.ts. O login real (em vez de NEXT_PUBLIC_ACESSO_LIVRE) prova a jornada
 * completa: a sessão não pode ser verificada offline e o app segue com a identidade do aparelho.
 */
const SENHA = 'Segredo#2026';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.ogado.invalid`;
}

async function cadastrar(page: Page, prefix: string): Promise<void> {
  await page.goto('/cadastrar');
  await page.getByLabel('E-mail', { exact: true }).fill(uniqueEmail(prefix));
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

/** Espera o service worker assumir a página e o pré-carregamento das telas terminar. */
async function esperarOffline(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          // A versão do cache é o id do build (RF-077): procura pelo prefixo.
          const nome = (await caches.keys()).find((k) => k.startsWith('ogado-paginas-'));
          if (!nome) return 0;
          return (await (await caches.open(nome)).keys()).length;
        }),
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(6);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

async function irPara(page: Page, nome: string): Promise<void> {
  await page.getByRole('link', { name: nome, exact: true }).filter({ visible: true }).click();
}

/** Confirma que o isolamento de rede vale também para o service worker (senão o teste mentiria). */
async function swSemRede(context: BrowserContext): Promise<boolean> {
  const sw = context.serviceWorkers()[0];
  if (!sw) return false;
  return sw.evaluate(() =>
    fetch('/api/auth/session').then(
      () => false,
      () => true,
    ),
  );
}

test('RNF-012 manifest instalável: pt-BR, standalone, ícones 192/512/maskable que existem', async ({
  page,
  request,
}) => {
  await page.goto('/entrar');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href as string)).json();
  expect(manifest).toMatchObject({
    lang: 'pt-BR',
    display: 'standalone',
    start_url: '/painel',
  });
  const icones = manifest.icons as { src: string; sizes: string; purpose?: string }[];
  expect(icones.some((i) => i.sizes === '192x192')).toBe(true);
  expect(icones.some((i) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
  expect(icones.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const i of icones) {
    const r = await request.get(i.src);
    expect(r.ok(), i.src).toBe(true);
    expect(r.headers()['content-type']).toContain('image/png');
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
});

test('RF-072/RF-071 abre sem internet e calcula a mesma variante de cabeças inteiras', async ({
  page,
  context,
}) => {
  await cadastrar(page, 'off-calc');
  await esperarOffline(page);

  await context.setOffline(true);
  expect(await swSemRede(context)).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Olá' })).toBeVisible();

  await irPara(page, 'Negócios');
  await expect(page).toHaveURL(/\/negocios$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Compra e Venda' })).toBeVisible();

  await irPara(page, 'Recria');
  await expect(page).toHaveURL(/\/recria$/);
  const resultado = page.getByRole('region', { name: 'Resultado da recria' });
  // ADR-0014: o simulador abre vazio; as entradas da planilha são digitadas sem internet.
  await expect(resultado.locator('.hero .big')).toHaveText('—');
  await preencherPlanilha(page);
  await expect(resultado.locator('.hero .big')).toHaveText(RESULTADO_CABECAS_INTEIRAS);

  await irPara(page, 'Conta');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();

  // Recarregar direto numa tela que não é a inicial também funciona.
  await page.goto('/recria');
  await expect(
    page.getByRole('region', { name: 'Resultado da recria' }).locator('.hero .big'),
  ).toHaveText(RESULTADO_CABECAS_INTEIRAS);
});

test('RF-071 nenhuma requisição /api/* entra no cache do service worker', async ({
  page,
  context,
}) => {
  await cadastrar(page, 'off-cache');
  await esperarOffline(page);
  await irPara(page, 'Negócios');
  await expect(page.getByRole('heading', { level: 1, name: 'Compra e Venda' })).toBeVisible();
  await page.evaluate(() => fetch('/api/auth/session').then(() => undefined));
  await expect(context.serviceWorkers()).not.toHaveLength(0);

  const urls = await page.evaluate(async () => {
    const todas: string[] = [];
    for (const nome of await caches.keys()) {
      const c = await caches.open(nome);
      for (const r of await c.keys()) todas.push(r.url);
    }
    return todas;
  });
  expect(urls.length).toBeGreaterThan(6);
  expect(urls.filter((u) => new URL(u).pathname.startsWith('/api'))).toEqual([]);
});

test('RF-073 lançar lote offline aparece na lista e sobe quando a conexão volta', async ({
  page,
  context,
}) => {
  await cadastrar(page, 'off-sync');
  await esperarOffline(page);
  await irPara(page, 'Negócios');
  await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  await expect(page.locator('[data-sync-status="sincronizado"]')).toBeAttached();

  await context.setOffline(true);
  await expect(page.getByText(/sem internet/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Nova compra' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova compra' });
  await modal.getByLabel('Quantidade', { exact: true }).fill('12');
  await modal.getByLabel('Peso total do lote', { exact: true }).fill('3600');
  await modal.getByLabel('Preço da arroba', { exact: true }).fill('310');
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lote salvo.' })).toBeVisible();
  await expect(page.getByText('Lote 1', { exact: true })).toBeVisible();

  // Reconectado, o motor de sincronização (E3) envia o lote guardado no aparelho.
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const r = await page.request.get('/api/lotes');
        if (!r.ok()) return -1;
        return ((await r.json()) as { lotes: unknown[] }).lotes.length;
      },
      { timeout: 60_000 },
    )
    .toBe(1);
  await expect(page.locator('[data-sync-status="sincronizado"]')).toBeAttached();
});
