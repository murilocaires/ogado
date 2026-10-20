import { expect, it } from 'vitest';
import { sincronizar } from './engine';
import { aparelho, COMPRA, criarServidor, cenario } from './engine.test-support';
import type { SyncCursor } from './data-client';

it('RF-078/RNF-017: troca de identidade durante leitura impede envio da fila antiga', async () => {
  const a = aparelho();
  const servidor = criarServidor();
  const lote = a.repo.salvarLote(COMPRA);
  let ativo = true;
  let liberar!: () => void;
  let avisarLeitura!: () => void;
  const resposta = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const lendo = new Promise<void>((resolve) => {
    avisarLeitura = resolve;
  });
  servidor.api.listarLotes = async () => {
    avisarLeitura();
    await resposta;
    return { ok: true, created: false, data: [] };
  };
  const deps = { ...a, api: servidor.api, usuarioId: 'u1', ativo: () => ativo };
  const rodada = sincronizar(deps);
  await lendo;
  ativo = false;
  liberar();
  expect(await rodada).not.toBe('ok');
  expect(servidor.chamadas).toEqual([]);
  expect(servidor.lotes.size).toBe(0);
  expect(a.repo.exportar().lotes.map((l) => l.id)).toEqual([lote.id]);
  expect(a.estado.atual).toBeNull();
});

it('RF-078/RNF-017: resposta de envio anterior ao logout não repõe dados nem checkpoint', async () => {
  const a = aparelho();
  const servidor = criarServidor();
  a.repo.salvarLote(COMPRA);
  let ativo = true;
  let liberar!: () => void;
  let avisarEnvio!: () => void;
  const resposta = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const enviando = new Promise<void>((resolve) => {
    avisarEnvio = resolve;
  });
  const criar = servidor.api.criarLote;
  servidor.api.criarLote = async (body) => {
    const confirmado = await criar(body);
    avisarEnvio();
    await resposta;
    return confirmado;
  };
  const deps = { ...a, api: servidor.api, usuarioId: 'u1', ativo: () => ativo };
  const rodada = sincronizar(deps);
  await enviando;
  ativo = false;
  a.repo.limpar();
  a.estado.limpar();
  liberar();
  expect(await rodada).not.toBe('ok');
  expect(a.repo.exportar().lotes).toEqual([]);
  expect(a.estado.atual).toBeNull();
  expect(servidor.chamadas).toEqual(['criarLote']);
});

it('RF-074/RNF-017 pull incremental adota tombstone, envia edição ausente da página e retoma checkpoint', async () => {
  const a = aparelho();
  const servidor = criarServidor();
  const um = a.repo.salvarLote(COMPRA);
  const dois = a.repo.salvarLote({ ...COMPRA, categoria: 'GARROTES' });
  await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' });
  a.repo.salvarLote({ ...COMPRA, id: dois.id, categoria: 'NOVILHAS' });
  const dto = servidor.lotes.get(um.id)!;
  const removido = {
    ...dto,
    deletedAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    version: 2,
  };
  servidor.lotes.set(um.id, removido);
  const cursores: (SyncCursor | undefined)[] = [];
  servidor.api.paginaLotes = async (cursor) => {
    cursores.push(cursor);
    return { ok: true, created: false, data: { itens: [removido], proximoCursor: null } };
  };
  expect(await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' })).toBe('ok');
  expect(cursores).toHaveLength(1);
  expect(servidor.lotes.get(dois.id)?.categoria).toBe('NOVILHAS');
  expect(a.repo.exportar().lotes.find((l) => l.id === um.id)?.deletedAt).toBe(
    '2026-10-20T10:00:00.000Z',
  );
  expect(a.estado.atual?.cursores?.lote?.updatedAt).toBe('2026-10-20T10:00:00.000Z');
  await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' });
  expect(cursores[1]?.updatedAt).toBe('2026-10-20T10:00:00.000Z');
});

it('RF-074/RNF-017 interrupção entre páginas confirma só a página aplicada e retoma sem listagem completa', async () => {
  const origem = aparelho();
  const servidor = criarServidor();
  const um = origem.repo.salvarLote(COMPRA);
  const dois = origem.repo.salvarLote({ ...COMPRA, categoria: 'GARROTES' });
  await sincronizar({ ...origem, api: servidor.api, usuarioId: 'u1' });
  const dtoUm = servidor.lotes.get(um.id)!;
  const dtoDois = servidor.lotes.get(dois.id)!;
  const a = aparelho();
  let conectado = false;
  const cursores: (SyncCursor | undefined)[] = [];
  servidor.api.paginaLotes = async (cursor) => {
    cursores.push(cursor);
    if (!cursor)
      return {
        ok: true,
        created: false,
        data: { itens: [dtoUm], proximoCursor: { updatedAt: dtoUm.updatedAt, id: dtoUm.id } },
      };
    if (!conectado) return { ok: false, kind: 'rede' };
    return { ok: true, created: false, data: { itens: [dtoDois], proximoCursor: null } };
  };
  servidor.api.listarLotes = async () => {
    throw new Error('Não deve baixar a listagem completa');
  };
  expect(await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' })).toBe('rede');
  expect(a.repo.exportar().lotes.map((l) => l.id)).toEqual([um.id]);
  expect(a.estado.atual?.cursores?.lote).toEqual({ updatedAt: dtoUm.updatedAt, id: um.id });
  conectado = true;
  expect(await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' })).toBe('ok');
  expect(cursores[2]).toEqual({ updatedAt: dtoUm.updatedAt, id: um.id });
  expect(a.repo.exportar().lotes.map((l) => l.id)).toEqual([um.id, dois.id]);
});

it('RF-079 cenário local inválido recebe atenção e o cenário válido seguinte é enviado', async () => {
  const a = aparelho();
  const servidor = criarServidor();
  const dados = cenario();
  const invalido = a.repo.salvarCenario({
    ...dados,
    resultado: { ...dados.resultado, custos: [] },
  });
  const valido = a.repo.salvarCenario(cenario());
  expect(await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' })).toBe('ok');
  expect([...servidor.cenarios.keys()]).toEqual([valido.id]);
  expect(a.estado.atual?.rejeitados?.map((r) => r.id)).toEqual([invalido.id]);
  expect(a.repo.exportar().cenarios.map((c) => c.id)).toEqual([invalido.id, valido.id]);
});

it('RF-079 cenário remoto inválido fica em quarentena recuperável e não bloqueia o cursor nem os válidos', async () => {
  const origem = aparelho();
  const servidor = criarServidor();
  const um = origem.repo.salvarCenario(cenario());
  const dois = origem.repo.salvarCenario(cenario());
  await sincronizar({ ...origem, api: servidor.api, usuarioId: 'u1' });
  const invalido = { ...servidor.cenarios.get(um.id)!, entradas: {} };
  servidor.cenarios.set(um.id, invalido);
  servidor.api.paginaCenarios = async () => ({
    ok: true,
    created: false,
    data: { itens: [...servidor.cenarios.values()], proximoCursor: null },
  });
  const a = aparelho();
  expect(await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' })).toBe('ok');
  expect(a.repo.exportar().cenarios.map((c) => c.id)).toEqual([dois.id]);
  expect(a.estado.atual?.rejeitados?.[0]).toMatchObject({ id: um.id, original: invalido });
  expect(a.estado.atual?.cursores?.cenario?.updatedAt).toBe(invalido.updatedAt);
  const exclusao = await servidor.api.excluirCenario(um.id, invalido.version);
  expect(exclusao.ok).toBe(true);
  expect(await sincronizar({ ...a, api: servidor.api, usuarioId: 'u1' })).toBe('ok');
  expect(a.estado.atual?.rejeitados).toEqual([]);
  expect(a.repo.exportar().cenarios.map((c) => c.id)).toEqual([dois.id]);
});
