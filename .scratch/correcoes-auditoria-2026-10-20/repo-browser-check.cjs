const path = require('node:path');
const { createRequire } = require('node:module');
const { build } = createRequire(require.resolve('tsx', { paths: [path.resolve('apps/api')] }))('esbuild');
const { chromium } = require(path.resolve('apps/web/node_modules/@playwright/test'));
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve('.scratch/correcoes-auditoria-2026-10-20/repo-browser.bundle.js');
  await build({ stdin: { contents: "export {criarRepoDuravel} from './apps/web/lib/repo/durable-repo'; export {browserSyncStore} from './apps/web/lib/sync/storage';", resolveDir: process.cwd(), loader: 'ts' }, outfile: output,
    bundle: true, platform: 'browser', format: 'iife', globalName: 'RepoHarness' });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const compra = { tipo: 'compra', numero: 1, categoria: 'GARROTES', data: '2026-10-01', modo: 'total', qtd: '10', peso: '3000', pesos: [], preco: '300' };
    async function contexto() {
      const c = await browser.newContext();
      await c.route('http://localhost:43321/**', (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>Repo público</body></html>' }));
      return c;
    }
    async function pagina(context, semCanal = false, inicializar = true) {
      const p = await context.newPage();
      await p.goto('http://localhost:43321/');
      if (semCanal) await p.evaluate(() => { window.BroadcastChannel = undefined; });
      await p.addScriptTag({ path: output });
      if (inicializar) await p.evaluate(async () => {
        window.repo = RepoHarness.criarRepoDuravel();
        await Promise.race([repo.ready(), new Promise((_, reject) => setTimeout(() => reject(new Error('ready timeout')), 10000))]);
      });
      return p;
    }
    {
      const c = await contexto(), a = await pagina(c), b = await pagina(c);
      const ids = [];
      for (const [p, categoria] of [[a, 'GARROTES'], [b, 'NOVILHAS']]) {
        ids.push(await p.evaluate(async (entrada) => { const salvo = repo.salvarLote(entrada); await repo.flush(); return salvo.id; }, { ...compra, categoria }));
      }
      await new Promise((r) => setTimeout(r, 100));
      for (const p of [a, b]) {
        assert.deepEqual(await p.evaluate(() => repo.exportar().lotes.map((l) => l.id).sort()), [...ids].sort());
        await p.reload(); await p.addScriptTag({ path: output });
        await p.evaluate(async () => { window.repo = RepoHarness.criarRepoDuravel(); await repo.ready(); });
        assert.deepEqual(await p.evaluate(() => repo.exportar().lotes.map((l) => l.id).sort()), [...ids].sort());
      }
      await c.close(); console.log('PASS RF-073/RNF-017: duas abas, BroadcastChannel e recarga preservam ambos os IDs');
    }
    {
      const c = await contexto(), a = await pagina(c, true);
      const id = await a.evaluate(async (entrada) => { const salvo = repo.salvarLote(entrada); await repo.flush(); return salvo.id; }, compra);
      const b = await pagina(c, true);
      await Promise.all([
        a.evaluate(async (id) => { const l = repo.exportar().lotes.find((l) => l.id === id); repo.salvarLote({ ...l, categoria: 'NOVILHAS' }); await repo.flush(); }, id),
        b.evaluate(async (id) => { const l = repo.exportar().lotes.find((l) => l.id === id); repo.salvarLote({ ...l, preco: '350' }); await repo.flush(); }, id),
      ]);
      const terceiro = await pagina(c);
      const salvo = await terceiro.evaluate(() => repo.exportar().lotes[0]);
      assert.equal(salvo.categoria, 'NOVILHAS'); assert.equal(salvo.preco, '350');
      assert.equal(salvo.version, 3);
      await c.close(); console.log('PASS RF-073/RNF-017: edições concorrentes da mesma entidade conservam campos independentes');
    }
    {
      const c = await contexto(), a = await pagina(c);
      await a.evaluate(() => {
        window.putOriginal = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'outbox') throw new DOMException('quota simulada', 'QuotaExceededError');
          return putOriginal.apply(this, args);
        };
      });
      const falha = await a.evaluate(async (entrada) => {
        repo.salvarLote(entrada);
        try { await repo.flush(); return false; } catch { return repo.getSnapshot().persistencia === 'indisponivel'; }
      }, compra);
      assert.equal(falha, true);
      const b = await pagina(c);
      assert.equal(await b.evaluate(() => repo.exportar().lotes.length), 0);
      await a.evaluate(async () => { IDBObjectStore.prototype.put = putOriginal; await repo.flush(); });
      await b.evaluate(async () => { await repo.ready(); });
      assert.equal(await b.evaluate(() => repo.exportar().lotes.length), 1);
      await c.close(); console.log('PASS RF-073/RNF-017: quota na fila aborta entidade, informa erro e retry confirma sem duplicar');
    }
    {
      const c = await contexto(), a = await pagina(c, false, false);
      const id = '00000000-0000-4000-8000-000000000010';
      await a.evaluate(async ({ compra, id }) => {
        const form = Object.fromEntries(['area','dias','investimento','rsCabCompra','pesoIni','pesoFin','precoVenda','consumoPct','precoSuplKg','rendCarcaca','imposto','sanidadeCabMes','funcionario','frete'].map((k) => [k, '']));
        const meta = { version: 4, updatedAt: '2026-10-19T10:00:00.000Z', deletedAt: null };
        localStorage.setItem('ogado.e2.v2', JSON.stringify({ schema: 3, lotes: [{ ...compra, ...meta, id }], cenarios: [], recria: { ...meta, id: '00000000-0000-4000-8000-000000000001', form, lotacaoInicial: 'fixa80' } }));
        localStorage.setItem('ogado.sync.v1', JSON.stringify({ usuarioId: 'u1', versoes: { [id]: 3 } }));
        localStorage.setItem('ogado.identidade', JSON.stringify({ usuarioId: 'u1', fazendaId: 'f1' }));
        window.repo = RepoHarness.criarRepoDuravel(); await repo.ready();
        window.estado = RepoHarness.browserSyncStore(); await estado.ready();
      }, { compra, id });
      assert.deepEqual(await a.evaluate(() => ({ ids: repo.exportar().lotes.map((l) => [l.id, l.version]), estado: estado.ler(), identidade: JSON.parse(localStorage.getItem('ogado.identidade')) })), {
        ids: [[id, 4]], estado: { usuarioId: 'u1', versoes: { [id]: 3 } }, identidade: { usuarioId: 'u1', fazendaId: 'f1' },
      });
      await c.close(); console.log('PASS RF-078/RNF-017: migração conserva UUID, versão suja, controle de envio e identidade');
    }
    {
      const c = await contexto(), a = await pagina(c), b = await pagina(c, true);
      await a.evaluate(async (entrada) => { repo.salvarLote(entrada); await repo.flush(); }, compra);
      await b.evaluate(async () => { await repo.ready(); });
      await a.evaluate(async () => { repo.limpar(); await repo.flush(); });
      const negado = await b.evaluate(async () => {
        const antigo = repo.exportar().lotes[0]; repo.salvarLote({ ...antigo, categoria: 'OUTRA' });
        try { await repo.flush(); return false; } catch { return true; }
      });
      assert.equal(negado, true);
      const terceiro = await pagina(c);
      assert.equal(await terceiro.evaluate(() => repo.exportar().lotes.length), 0);
      await b.evaluate(async () => { await repo.ready(); });
      assert.equal(await b.evaluate(() => repo.exportar().lotes.length), 0);
      await c.close(); console.log('PASS RF-078/RNF-017: logout limpa aparelho e escrita de aba antiga não ressuscita dados');
    }
    {
      const c = await contexto(), a = await pagina(c);
      const id = await a.evaluate(async entrada => { const l = repo.salvarLote(entrada); await repo.flush(); return l.id; }, compra);
      const b = await pagina(c);
      await a.evaluate(async id => {
        window.putOriginal = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'outbox') throw new DOMException('quota simulada', 'QuotaExceededError');
          return putOriginal.apply(this, args);
        };
        repo.salvarLote({ ...repo.exportar().lotes.find(l => l.id === id), categoria: 'NOVILHAS' });
        try { await repo.flush(); } catch { /* erro esperado */ }
      }, id);
      await b.evaluate(async id => {
        repo.salvarLote({ ...repo.exportar().lotes.find(l => l.id === id), preco: '350' }); await repo.flush();
      }, id);
      // Aguardar a notificação real do outro contexto. A leitura de ready inclui uma releitura
      // do disco e não deve substituir a edição local que ainda precisa de retry.
      await a.evaluate(async () => { try { await repo.ready(); } catch { /* quota ainda cheia */ } });
      assert.equal(await a.evaluate(() => repo.exportar().lotes[0].categoria), 'NOVILHAS');
      await a.evaluate(async () => { IDBObjectStore.prototype.put = putOriginal; await repo.flush(); });
      const confirmado = await a.evaluate(() => repo.exportar().lotes[0]);
      assert.equal(confirmado.categoria, 'NOVILHAS'); assert.equal(confirmado.preco, '350');
      const terceiro = await pagina(c);
      assert.equal(await terceiro.evaluate(() => repo.exportar().lotes[0].categoria), 'NOVILHAS');
      await c.close(); console.log('PASS RF-073/RNF-017: releitura de outra aba preserva edição com quota falha e retry mescla os campos');
    }
    {
      const c = await contexto(), a = await pagina(c, false, false);
      const id = '00000000-0000-4000-8000-000000000099';
      const preservados = await a.evaluate(async ({ compra, id }) => {
        const form = Object.fromEntries(['area','dias','investimento','rsCabCompra','pesoIni','pesoFin','precoVenda','consumoPct','precoSuplKg','rendCarcaca','imposto','sanidadeCabMes','funcionario','frete'].map((k) => [k, '']));
        const meta = { version: 4, updatedAt: '2026-10-19T10:00:00.000Z', deletedAt: null };
        localStorage.setItem('ogado.e2.v2', JSON.stringify({ schema: 3, lotes: [{ ...compra, ...meta, id }], cenarios: [], recria: { ...meta, id: '00000000-0000-4000-8000-000000000001', form, lotacaoInicial: 'fixa80' } }));
        const ler = Storage.prototype.getItem;
        Storage.prototype.getItem = function () { throw new DOMException('leitura bloqueada temporariamente', 'SecurityError'); };
        const bloqueado = RepoHarness.criarRepoDuravel();
        try { await bloqueado.ready(); } catch { /* preservar legado e permitir nova tentativa noutra instância */ }
        Storage.prototype.getItem = ler;
        const recuperado = RepoHarness.criarRepoDuravel();
        await recuperado.ready();
        return recuperado.exportar().lotes.map((l) => [l.id, l.version]);
      }, { compra, id });
      assert.deepEqual(preservados, [[id, 4]]);
      await c.close(); console.log('PASS RF-073/RNF-017: leitura legada temporariamente bloqueada não conclui migração nem perde UUID/versão na tentativa seguinte');
    }
    {
      const c = await contexto(), a = await pagina(c);
      const estadoDepois = await a.evaluate(async () => {
        const estadoA = RepoHarness.browserSyncStore();
        await estadoA.ready();
        estadoA.gravar({ usuarioId: 'A', versoes: { 'registro-A': 4 }, rejeitados: [{ tipo: 'cenario', id: 'registro-A', versaoLocal: 4, motivo: 'inválido', detectadoEm: '2026-10-19T10:00:00.000Z', original: { nome: 'Histórico A' } }] });
        // Logout confirma uma nova geração enquanto a instância antiga ainda tem cache sujo.
        repo.limpar(); await repo.flush();
        await estadoA.ready();
        return estadoA.ler();
      });
      assert.equal(estadoDepois, null);
      await c.close(); console.log('PASS RF-078/RNF-017: geração nova descarta cache de sincronização sujo da sessão anterior');
    }
    console.log('8/8 verificações públicas de persistência aprovadas em IndexedDB real (Edge).');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
