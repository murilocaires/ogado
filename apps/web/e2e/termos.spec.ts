import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * RNF-009: Termos de Uso, Política de Privacidade e aceite versionado. API real + Postgres.
 */
const SENHA = 'Segredo#2026';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.bovaro.invalid`;
}

/** Simula "termos atualizados": muda a versão aceita direto no banco. */
function definirVersaoAceita(email: string, versao: string): void {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../api/node_modules/tsx/dist/cli.mjs', import.meta.url)),
      fileURLToPath(new URL('../../api/scripts/set-aceite-termos.ts', import.meta.url)),
      email,
      versao,
    ],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: 'pipe',
      env: process.env,
    },
  );
}

test.describe('páginas públicas', () => {
  test('/termos e /privacidade abrem sem sessão, com h1 único e título próprio', async ({
    page,
  }) => {
    await page.goto('/termos');
    await expect(page).toHaveTitle('Termos de Uso · Bovaro');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Termos de Uso');
    await expect(
      page.getByText('[IDENTIFICAÇÃO DO CONTROLADOR — preencher]').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/termos$/);

    await page.goto('/privacidade');
    await expect(page).toHaveTitle('Política de Privacidade · Bovaro');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de Privacidade');
    await expect(
      page.getByRole('heading', { level: 2, name: /Quais dados coletamos/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/privacidade$/);
  });

  test('a tela de cadastro leva aos textos em nova aba', async ({ page, context }) => {
    await page.goto('/cadastrar');
    const aba = context.waitForEvent('page');
    await page.locator('.check').getByRole('link', { name: 'Termos de Uso' }).click();
    const nova = await aba;
    await nova.waitForLoadState();
    await expect(nova).toHaveURL(/\/termos$/);
  });
});

test.describe('aceite apenas no cadastro', () => {
  test('o cadastro exige o checkbox; marcado, cria a conta e a Conta mostra a versão aceita', async ({
    page,
  }) => {
    const email = uniqueEmail('termos');
    await page.goto('/cadastrar');
    let signupCalls = 0;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/auth/signup')) signupCalls += 1;
    });
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: 'Criar conta' }).click();

    const caixa = page.getByLabel(/Li e aceito/);
    await expect(
      page.getByText('Marque que leu e aceita os Termos de Uso e a Política de Privacidade.'),
    ).toBeVisible();
    await expect(caixa).toBeFocused();
    await expect(caixa).toHaveAttribute('aria-invalid', 'true');
    expect(signupCalls).toBe(0);

    const corpo = page.waitForRequest((r) => r.url().endsWith('/api/auth/signup'));
    await caixa.check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    expect(JSON.parse((await corpo).postData() ?? '{}')).toMatchObject({ aceiteTermos: true });
    await expect(page).toHaveURL(/\/painel$/);

    await page
      .getByRole('navigation', { name: 'Principal' })
      .first()
      .getByRole('link', { name: 'Conta' })
      .click();
    const secao = page.getByRole('region', { name: 'Termos e privacidade' });
    await expect(secao.getByTestId('aceite-atual')).toContainText(
      /Você aceitou a versão \d{4}-\d{2}-\d{2} em /,
    );
  });

  test('termos atualizados pedem aceite em dialogo sem substituir o painel', async ({ page }) => {
    const email = uniqueEmail('gate');
    await page.goto('/cadastrar');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/painel$/);

    await expect(page.getByRole('dialog', { name: 'Termos atualizados' })).toHaveCount(0);
    definirVersaoAceita(email, '2020-01-01');
    await page.reload();
    const dialogo = page.getByRole('dialog', { name: 'Termos atualizados' });
    await expect(dialogo).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' }).first()).toBeVisible();
    await dialogo.getByRole('button', { name: 'Li e aceito' }).click();
    await expect(dialogo).toHaveCount(0);
    await page.reload();
    await expect(dialogo).toHaveCount(0);
  });
});

test('RNF-009 Conta: "Enviar meus dados por e-mail" pede o envio e avisa', async ({ page }) => {
  const email = uniqueEmail('enviar');
  await page.goto('/cadastrar');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await page
    .getByRole('navigation', { name: 'Principal' })
    .first()
    .getByRole('link', { name: 'Conta' })
    .click();

  const resposta = page.waitForResponse((r) => r.url().endsWith('/api/conta/exportar/enviar'));
  await page
    .getByRole('region', { name: 'Meus dados' })
    .getByRole('button', { name: 'Enviar meus dados por e-mail' })
    .click();
  expect((await resposta).status()).toBe(202);
  await expect(page.getByText(/Pedido enviado/)).toContainText(email);
});
