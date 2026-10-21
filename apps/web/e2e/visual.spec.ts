import { test } from '@playwright/test';

/**
 * Capturas para comparar com references/design (WebLogin 1440x900, AppLogin 390x844).
 * Saem em .scratch/web-v1/evidence/ (não são asserções: o design não renderiza fora do canvas).
 */
const OUT = '../../.scratch/web-v1/evidence';

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

for (const vp of viewports) {
  for (const rota of ['entrar', 'cadastrar']) {
    test(`captura /${rota} em ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${rota}`);
      await page
        .getByRole('button', { name: rota === 'entrar' ? 'Entrar' : 'Criar conta' })
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/${rota}-${vp.name}.png` });
    });
  }
}

test('captura /entrar com erro em 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill('ninguem@teste.bovaro.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('Errada#123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.locator('form [role="alert"]').waitFor();
  await page.screenshot({ path: `${OUT}/entrar-erro-390.png` });
});
