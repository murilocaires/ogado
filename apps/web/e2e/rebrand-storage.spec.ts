import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('../lib/repo/indexed-db.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;

test.beforeEach(async ({ page }) => {
  await page.route('https://rebrand.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Rebrand</title>' }),
  );
  await page.goto('https://rebrand.test/');
});

test('migra dados e fila sem alterar a origem; logout não ressuscita o legado', async ({
  page,
}) => {
  const result = await page.evaluate(async (code) => {
    const api = (await import(
      URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    )) as typeof import('../lib/repo/indexed-db');
    const request = indexedDB.open('ogado.local.v1', 1);
    request.onupgradeneeded = () => {
      for (const name of api.STORES) request.result.createObjectStore(name);
    };
    const legacy = await api.resultado(request);
    await api.transacionar(legacy, [...api.STORES], (tx) => {
      tx.objectStore('entidades').put({ id: 'lote-1', valor: 123 }, 'lote:lote-1');
      tx.objectStore('outbox').put({ id: 'lote-1', version: 4 }, 'lote:lote-1');
      tx.objectStore('meta').put({ usuarioId: 'usuario-1' }, 'identidade');
      tx.objectStore('meta').put({ cursor: 'cursor-1' }, 'ogado.sync.v1');
    });
    const db = await api.abrirBancoLocal();
    const tx = db.transaction([...api.STORES]);
    const migrated = await Promise.all([
      api.resultado(tx.objectStore('entidades').get('lote:lote-1')),
      api.resultado(tx.objectStore('outbox').get('lote:lote-1')),
      api.resultado(tx.objectStore('meta').get('identidade')),
      api.resultado(tx.objectStore('meta').get('bovaro.sync.v1')),
    ]);
    const original = await api.resultado(
      legacy.transaction('entidades').objectStore('entidades').get('lote:lote-1'),
    );
    await api.apagarBancoLocal();
    // Novo módulo reproduz outra aba/reabertura, sem reutilizar a promise em memória.
    const reopened = (await import(
      URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    )) as typeof api;
    const clean = await reopened.abrirBancoLocal();
    const count = await api.resultado(
      clean.transaction('entidades').objectStore('entidades').count(),
    );
    legacy.close();
    clean.close();
    db.close();
    return { migrated, original, count };
  }, source);
  expect(result.migrated).toEqual([
    { id: 'lote-1', valor: 123 },
    { id: 'lote-1', version: 4 },
    { usuarioId: 'usuario-1' },
    { cursor: 'cursor-1' },
  ]);
  expect(result.original).toEqual(result.migrated[0]);
  expect(result.count).toBe(0);
});

test('instalação nova não cria banco legado', async ({ page }) => {
  const names = await page.evaluate(async (code) => {
    const api = (await import(
      URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    )) as typeof import('../lib/repo/indexed-db');
    const db = await api.abrirBancoLocal();
    db.close();
    return (await indexedDB.databases()).map((entry) => entry.name);
  }, source);
  expect(names).toEqual(['bovaro.local.v1']);
});

test('recusa misturar banco Bovaro existente com dados legados', async ({ page }) => {
  const result = await page.evaluate(async (code) => {
    const api = (await import(
      URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    )) as typeof import('../lib/repo/indexed-db');
    for (const name of ['ogado.local.v1', 'bovaro.local.v1']) {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const store of api.STORES) request.result.createObjectStore(store);
      };
      const db = await api.resultado(request);
      await api.transacionar(db, ['meta'], (tx) => {
        tx.objectStore('meta').put({ usuarioId: name }, 'identidade');
      });
      db.close();
    }
    try {
      await api.abrirBancoLocal();
      return 'migrou indevidamente';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, source);
  expect(result).toContain('já contém dados');
});
