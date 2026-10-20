import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

for (const width of [390, 1440]) {
  test(`RNF-005/RNF-006 WCAG automático das telas públicas em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/entrar', '/cadastrar', '/termos', '/privacidade']) {
      await page.goto(route);
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: typeof import('axe-core') }).axe;
        const scan = await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
        return {
          violations: scan.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            targets: v.nodes.map((n) => n.target),
          })),
          incomplete: scan.incomplete.map((v) => v.id),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      await test.info().attach(`axe-${route.slice(1)}-${width}.json`, {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      });
      expect(result.violations, `${route} ${width}px`).toEqual([]);
      expect(result.overflow, `${route} não deve rolar horizontalmente`).toBe(false);
    }
  });
}
