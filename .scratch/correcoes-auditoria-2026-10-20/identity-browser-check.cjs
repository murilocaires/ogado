const path = require('node:path');
const { createRequire } = require('node:module');
const { build } = createRequire(require.resolve('tsx', { paths: [path.resolve('apps/api')] }))('esbuild');
const { chromium } = require(path.resolve('apps/web/node_modules/@playwright/test'));
const assert = require('node:assert/strict');

(async () => {
  const legacy = process.env.IDENTITY_LEGACY === '1';
  const output = path.resolve('.scratch/correcoes-auditoria-2026-10-20/identity-browser.bundle.js');
  await build({
    stdin: { contents: `${legacy
      ? "export {browserIdentityStore as criarIdentidadeDuravel} from './apps/web/lib/auth/session-controller';"
      : "export {criarIdentidadeDuravel} from './apps/web/lib/auth/durable-identity';"}
      export {createSessionController} from './apps/web/lib/auth/session-controller';
      export {abrirBancoLocal,apagarBancoLocal} from './apps/web/lib/repo/indexed-db';`,
      resolveDir: process.cwd(), loader: 'ts' },
    outfile: output, bundle: true, platform: 'browser', format: 'iife', globalName: 'IdentityHarness',
  });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const A = { usuarioId: '00000000-0000-4000-8000-000000000001', fazendaId: '00000000-0000-4000-8000-000000000011' };
  const B = { usuarioId: '00000000-0000-4000-8000-000000000002', fazendaId: '00000000-0000-4000-8000-000000000012' };
  async function context() {
    const c = await browser.newContext();
    await c.route('http://localhost:43322/**', (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>Identidade pública</body></html>' }));
    return c;
  }
  async function page(c) {
    const p = await c.newPage();
    await p.goto('http://localhost:43322/');
    await p.addScriptTag({ path: output });
    return p;
  }
  async function seed(p, owner, withData = true) {
    await p.evaluate(async ({ owner, withData }) => {
      const db = await IdentityHarness.abrirBancoLocal();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['meta', 'entidades'], 'readwrite');
        tx.objectStore('meta').put(true, 'migrado');
        if (owner) tx.objectStore('meta').put(owner, 'identidade');
        else tx.objectStore('meta').delete('identidade');
        if (withData) tx.objectStore('entidades').put({ fixture: 'preservar' }, 'lote:original');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
    }, { owner, withData });
  }
  async function failStorage(p) {
    await p.evaluate(() => {
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        Storage.prototype[method] = () => { throw new DOMException('Storage indisponível', 'SecurityError'); };
      }
    });
  }
  try {
    {
      const c = await context(); const p = await page(c);
      await seed(p, A); await failStorage(p);
      const result = await p.evaluate(async ({ A, B }) => {
        window.ownerStore = IdentityHarness.criarIdentidadeDuravel();
        await ownerStore.ready?.();
        const before = ownerStore.read();
        const controller = IdentityHarness.createSessionController({ identity: ownerStore,
          api: { login: async () => ({ ok: true, data: { usuario: { id: B.usuarioId }, fazenda: { id: B.fazendaId } } }) },
          clearLocalData: async () => IdentityHarness.apagarBancoLocal(),
        });
        await controller.login({ email: 'b@teste.ogado.invalid', senha: 'NaoUsada#2026' });
        let rejected = false;
        try { await ownerStore.write(B); } catch { rejected = true; }
        const reaberto = IdentityHarness.criarIdentidadeDuravel(); await reaberto.ready?.();
        const state = controller.getState();
        return { before, after: ownerStore.read(), confirmado: reaberto.read(), rejected,
          showsB: state.status === 'autenticado' && state.usuario.id === B.usuarioId };
      }, { A, B });
      assert.deepEqual(result.before, A); assert.deepEqual(result.after, A);
      assert.deepEqual(result.confirmado, A);
      assert.equal(result.rejected, true); assert.equal(result.showsB, false);
      // O logout apaga o proprietário junto aos dados, mesmo sem espelho localStorage.
      const cleared = await p.evaluate(async (B) => {
        await IdentityHarness.apagarBancoLocal(); ownerStore.clear();
        await ownerStore.ready?.(); await ownerStore.write(B);
        return ownerStore.read();
      }, B);
      assert.deepEqual(cleared, B);
      await c.close(); console.log('PASS RF-078: IndexedDB conserva dono A com get/set/remove falhando; login B bloqueado; B só após limpeza');
    }
    {
      const c = await context(); const p = await page(c);
      await seed(p, null); await failStorage(p);
      const result = await p.evaluate(async (B) => {
        const store = IdentityHarness.criarIdentidadeDuravel();
        let readyRejected = false, writeRejected = false;
        try { await store.ready?.(); } catch { readyRejected = true; }
        try { await store.write(B); } catch { writeRejected = true; }
        const db = await IdentityHarness.abrirBancoLocal();
        const count = await new Promise((resolve, reject) => {
          const req = db.transaction('entidades').objectStore('entidades').count();
          req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
        });
        return { readyRejected, writeRejected, count };
      }, B);
      assert.deepEqual(result, { readyRejected: true, writeRejected: true, count: 1 });
      await c.close(); console.log('PASS RF-078: dados sem proprietário conhecido bloqueiam autenticação e não são apagados');
    }
    {
      const c = await context(); const p = await page(c);
      await seed(p, null);
      await p.evaluate((A) => localStorage.setItem('ogado.identidade', JSON.stringify(A)), A);
      assert.deepEqual(await p.evaluate(async () => {
        window.ownerStore = IdentityHarness.criarIdentidadeDuravel(); await ownerStore.ready?.();
        return ownerStore.read();
      }), A);
      const q = await page(c); await failStorage(q);
      assert.deepEqual(await q.evaluate(async () => {
        window.ownerStore = IdentityHarness.criarIdentidadeDuravel(); await ownerStore.ready?.();
        return ownerStore.read();
      }), A);
      await p.evaluate(async (B) => {
        await IdentityHarness.apagarBancoLocal(); ownerStore.clear(); await ownerStore.write(B);
      }, B);
      assert.deepEqual(await q.evaluate(async () => { await ownerStore.ready?.(); return ownerStore.read(); }), B);
      await c.close(); console.log('PASS RF-078: migração do espelho confirma dono no IndexedDB; segunda aba relê novo dono após logout');
    }
    {
      const c = await context(); const p = await page(c); await seed(p, A, false);
      assert.equal(await p.evaluate(async (A) => {
        const store = IdentityHarness.criarIdentidadeDuravel(); await store.ready?.();
        let messages = 0; const channel = new BroadcastChannel('ogado.local.changes');
        channel.onmessage = () => { messages++; };
        await store.write(A); await store.write(A);
        await new Promise((resolve) => setTimeout(resolve, 50)); channel.close();
        return messages;
      }, A), 0);
      await c.close(); console.log('PASS RF-078: confirmar o mesmo dono não transmite BroadcastChannel em laço');
    }
    {
      const c = await context(); const p = await page(c);
      await seed(p, A, false);
      const afterLogout = await p.evaluate(async (A) => {
        localStorage.setItem('ogado.identidade', JSON.stringify(A));
        await IdentityHarness.apagarBancoLocal();
        // Outra aba lê antes de o espelho antigo ter sido removido: não deve ressuscitá-lo.
        const store = IdentityHarness.criarIdentidadeDuravel(); await store.ready?.();
        return store.read();
      }, A);
      assert.equal(afterLogout, null);
      await c.close(); console.log('PASS RF-078: tombstone de limpeza impede espelho atrasado de ressuscitar dono anterior');
    }
    {
      const c = await context(); const p = await page(c);
      const result = await p.evaluate(async (B) => {
        localStorage.setItem('ogado.e2.v2', JSON.stringify({ schema: 3, lotes: [], cenarios: [] }));
        const store = IdentityHarness.criarIdentidadeDuravel(); await store.ready?.();
        const before = store.read(); await store.write(B);
        return { before, after: store.read() };
      }, B);
      assert.equal(result.before, null); assert.deepEqual(result.after, B);
      await c.close(); console.log('PASS RF-078: envelope legado vazio sem dono não impede primeiro login');
    }
    {
      const c = await context(); const p = await page(c); await seed(p, null, false);
      await p.evaluate(async (A) => {
        const db = await IdentityHarness.abrirBancoLocal();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ usuarioId: A.usuarioId, versoes: {},
            bases: { original: { nome: 'Cenário preservado de A' } }, rejeitados: [], historicoPendente: [] }, 'ogado.sync.v1');
          tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        });
      }, A);
      await failStorage(p);
      const result = await p.evaluate(async (B) => {
        const store = IdentityHarness.criarIdentidadeDuravel();
        let readyRejected = false, writeRejected = false;
        try { await store.ready?.(); } catch { readyRejected = true; }
        try { await store.write(B); } catch { writeRejected = true; }
        return { readyRejected, writeRejected, owner: store.read() };
      }, B);
      assert.deepEqual(result, { readyRejected: true, writeRejected: true, owner: null });
      await c.close(); console.log('PASS RF-078/RNF-014: histórico e bases sem proprietário bloqueiam nova conta mesmo sem entidades');
    }
    console.log('7/7 verificações públicas de identidade durável aprovadas com IndexedDB real (Edge).');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
