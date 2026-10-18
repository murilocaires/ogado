import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * T-04 etapa 2 (front). API real + Postgres + Next com rewrite /api (ver playwright.config.ts).
 * Contas usam o domínio reservado dos testes da API para a limpeza por domínio.
 */
const SENHA = 'Segredo#2026';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.ogado.invalid`;
}

async function dumpBrowserStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = [];
    parts.push(JSON.stringify({ ...window.localStorage }));
    parts.push(JSON.stringify({ ...window.sessionStorage }));
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const storeName of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const req = db.transaction(storeName).objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        parts.push(JSON.stringify({ db: info.name, store: storeName, rows }));
      }
      db.close();
    }
    parts.push(document.cookie);
    return parts.join('\n');
  });
}

async function sessionCookie(context: BrowserContext): Promise<{ name: string; value: string }> {
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.httpOnly);
  expect(session, 'cookie de sessão HttpOnly presente').toBeDefined();
  return { name: session?.name ?? '', value: session?.value ?? '' };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A identidade local guarda só os dois UUIDs (ADR-0010 f), nunca token nem senha. */
async function expectOnlyUuidIdentity(page: Page): Promise<void> {
  const raw = await page.evaluate(() => window.localStorage.getItem('ogado.identidade'));
  expect(raw).not.toBeNull();
  const parsed = JSON.parse(raw ?? '{}') as Record<string, unknown>;
  expect(Object.keys(parsed).sort()).toEqual(['fazendaId', 'usuarioId']);
  expect(String(parsed['usuarioId'])).toMatch(UUID);
  expect(String(parsed['fazendaId'])).toMatch(UUID);
}

test.describe('CA-22 jornada completa: cadastrar, sair, entrar', () => {
  test('cadastra, sai e entra de novo sem deixar token no navegador', async ({
    page,
    context,
    request,
  }) => {
    const email = uniqueEmail('jornada');

    // Cadastro: requisitos visíveis antes de digitar/enviar (CA-06, parte de tela).
    await page.goto('/cadastrar');
    const regras = page.getByRole('list', { name: 'Requisitos da senha' });
    await expect(regras).toBeVisible();
    await expect(regras).toContainText('pelo menos 8 caracteres');

    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/conta$/);
    await expect(page.getByText(email)).toBeVisible();

    const first = await sessionCookie(context);
    const token = first.value;
    await expectOnlyUuidIdentity(page);
    expect(token.length).toBeGreaterThan(20);
    let storage = await dumpBrowserStorage(page);
    expect(storage).not.toContain(token);
    expect(storage).not.toContain(SENHA);

    // Sair (confirmação) apaga a sessão no servidor e leva a /entrar.
    await page.getByRole('button', { name: 'Sair' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sair deste aparelho?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/entrar$/);

    // Após o 204: identidade local sumiu e o mesmo cookie reenviado já não vale (401).
    expect(await page.evaluate(() => window.localStorage.getItem('ogado.identidade'))).toBeNull();
    const replay = await request.get('/api/auth/session', {
      headers: { Cookie: `${first.name}=${first.value}` },
    });
    expect(replay.status()).toBe(401);

    // Entrar de novo.
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/conta$/);
    await expect(page.getByText(email)).toBeVisible();

    await expectOnlyUuidIdentity(page);
    const secondToken = (await sessionCookie(context)).value;
    expect(secondToken).not.toBe(token); // sessão nova a cada login
    storage = await dumpBrowserStorage(page);
    expect(storage).not.toContain(secondToken);
    expect(storage).not.toContain(token);
    expect(storage).not.toContain(SENHA);
  });

  test('CA-20 credenciais inválidas: mensagem genérica com o foco no erro', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByLabel('E-mail', { exact: true }).fill(uniqueEmail('inexistente'));
    await page.getByLabel('Senha', { exact: true }).fill('Errada#123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    const alert = page.locator('form [role="alert"]');
    await expect(alert).toContainText('E-mail ou senha incorretos.');
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('CA-20 cadastro com senha fraca não é enviado e foca no campo', async ({ page }) => {
    await page.goto('/cadastrar');
    let signupCalls = 0;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/auth/signup')) signupCalls += 1;
    });
    await page.getByLabel('E-mail', { exact: true }).fill(uniqueEmail('fraca'));
    await page.getByLabel('Senha', { exact: true }).fill('fraca');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect(signupCalls).toBe(0);
  });

  test('CA-21 sessão expirada mostra "Entre de novo" e não apaga o que há no aparelho', async ({
    page,
    context,
  }) => {
    const email = uniqueEmail('expira');
    await page.goto('/cadastrar');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/conta$/);

    // Dado local do aparelho (simula a fila do T-14) que nenhum 401 pode apagar.
    await page.evaluate(() => window.localStorage.setItem('fila-teste', 'lancamento-pendente'));
    const antes = await page.evaluate(() => window.localStorage.getItem('ogado.identidade'));
    expect(antes).not.toBeNull();

    // Servidor deixa de reconhecer a sessão (cookie some): a próxima verificação dá 401.
    await context.clearCookies();
    await page.reload();

    await expect(page.getByText('Entre de novo')).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('fila-teste'))).toBe(
      'lancamento-pendente',
    );
    expect(await page.evaluate(() => window.localStorage.getItem('ogado.identidade'))).toBe(antes);

    // Entrar de novo retoma o uso.
    await page.getByRole('link', { name: 'Entrar' }).click();
    await expect(page.getByText(/Entre de novo/)).toBeVisible();
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/conta$/);
    expect(await page.evaluate(() => window.localStorage.getItem('fila-teste'))).toBe(
      'lancamento-pendente',
    );
  });

  test('CA-21 401 no meio do uso (sem recarregar) expira a sessão e não apaga nada local', async ({
    page,
  }) => {
    const email = uniqueEmail('meio');
    await page.goto('/cadastrar');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/conta$/);
    await page.evaluate(() => window.localStorage.setItem('fila-teste', 'lancamento-pendente'));
    const identidade = await page.evaluate(() => window.localStorage.getItem('ogado.identidade'));

    // O painel ainda não tem chamada de dados: a reverificação (evento "online") é a chamada
    // autenticada do meio do uso, e o servidor passa a responder 401.
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ erro: { codigo: 'sessao_expirada', mensagem: 'x' } }),
      }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await expect(page.getByText('Entre de novo')).toBeVisible();
    await expect(page).toHaveURL(/\/conta$/);
    expect(await page.evaluate(() => window.localStorage.getItem('fila-teste'))).toBe(
      'lancamento-pendente',
    );
    expect(await page.evaluate(() => window.localStorage.getItem('ogado.identidade'))).toBe(
      identidade,
    );
  });
});
