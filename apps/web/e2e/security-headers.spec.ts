import { expect, test } from '@playwright/test';

test('RNF-003 HTML restringe frames, objetos, origens e referrer sem impedir a página', async ({
  page,
}) => {
  const response = await page.goto('/entrar');
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['content-security-policy']).toContain("worker-src 'self'");
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});

test('RNF-014 respostas de sessão não permitem armazenamento em caches intermediários', async ({
  request,
}) => {
  const response = await request.get('/api/auth/session');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toBe('no-store');
});
