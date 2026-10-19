import { describe, expect, it } from 'vitest';
import type { DadosClient } from './data-client';
import { sincronizar } from './engine';
import { loteDeDto, loteParaCriar } from './mappers';
import { AGORA, aparelho, COMPRA, cenario, criarServidor } from './engine.test-support';

describe('mapeadores de lote', () => {
  it('converte texto pt-BR em decimal canônico e volta', () => {
    const lote = {
      ...COMPRA,
      id: '00000000-0000-4000-8000-000000000001',
      version: 1,
      updatedAt: AGORA,
      deletedAt: null,
    };
    const criar = loteParaCriar(lote);
    expect(criar).toMatchObject({ qtd: '10', peso: '2500.5', preco: '300.5', data: '2026-10-01' });
    const volta = loteDeDto({
      ...criar,
      numero: 1,
      version: 1,
      createdAt: AGORA,
      updatedAt: AGORA,
      deletedAt: null,
    });
    expect(volta).toMatchObject({ qtd: '10', peso: '2500,5', preco: '300,5' });
  });

  it('desconto da venda: kg por cabeça digitado vai ao contrato e volta', () => {
    const venda = {
      ...COMPRA,
      tipo: 'venda' as const,
      base: 'carcaca' as const,
      aplicarDesconto: true,
      descontoKg: '12,5',
      id: '00000000-0000-4000-8000-000000000002',
      version: 1,
      updatedAt: AGORA,
      deletedAt: null,
    };
    const criar = loteParaCriar(venda);
    expect(criar.descontoKg).toBe('12.5');
    const volta = loteDeDto({
      ...criar,
      numero: 1,
      version: 1,
      createdAt: AGORA,
      updatedAt: AGORA,
      deletedAt: null,
    });
    expect(volta.descontoKg).toBe('12,5');
    expect(volta.base).toBe('carcaca');
  });
});

describe('sincronizar', () => {
  it('primeiro login: envia o que existia no aparelho e adota o número do servidor', async () => {
    const srv = criarServidor();
    const a = aparelho();
    a.repo.salvarLote(COMPRA);
    a.repo.salvarCenario(cenario());

    expect(await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' })).toBe('ok');

    expect(srv.lotes.size).toBe(1);
    expect(srv.cenarios.size).toBe(1);
    expect(srv.recria()).not.toBeNull();
    expect(a.estado.atual?.usuarioId).toBe('u1');
  });

  it('segunda rodada sem mudanças não chama a API de escrita', async () => {
    const srv = criarServidor();
    const a = aparelho();
    a.repo.salvarLote(COMPRA);
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });
    srv.chamadas.length = 0;

    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });

    expect(srv.chamadas).toEqual([]);
  });

  it('outro aparelho recebe lotes, cenários e entradas da recria', async () => {
    const srv = criarServidor();
    const a = aparelho();
    a.repo.salvarLote(COMPRA);
    a.repo.salvarCenario(cenario());
    a.repo.atualizarRecria({ form: { area: '777' } });
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });

    const b = aparelho();
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });

    const dados = b.repo.exportar();
    expect(dados.lotes).toHaveLength(1);
    expect(dados.lotes[0]?.preco).toBe('300,5');
    expect(dados.cenarios[0]?.nome).toBe('Base');
    expect(dados.recria.form.area).toBe('777');
  });

  it('edição e exclusão locais sobem com a versão-base', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const lote = a.repo.salvarLote(COMPRA);
    const c = a.repo.salvarCenario(cenario());
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });

    a.repo.salvarLote({ ...COMPRA, id: lote.id, qtd: '20' });
    a.repo.renomearCenario(c.id, 'Novo nome');
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });
    expect(srv.lotes.get(lote.id)?.qtd).toBe('20');
    expect(srv.cenarios.get(c.id)?.nome).toBe('Novo nome');

    a.repo.excluirLote(lote.id);
    a.repo.excluirCenario(c.id);
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });
    expect(srv.lotes.get(lote.id)?.deletedAt).not.toBeNull();
    expect(srv.cenarios.get(c.id)?.deletedAt).not.toBeNull();
  });

  it('mudança vinda da nuvem chega ao aparelho limpo', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const lote = a.repo.salvarLote(COMPRA);
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });

    const b = aparelho();
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });
    b.repo.salvarLote({ ...COMPRA, id: lote.id, qtd: '33' });
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });

    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });
    expect(a.repo.exportar().lotes[0]?.qtd).toBe('33');
  });

  it('sem rede: devolve "rede" e mantém tudo no aparelho para a próxima rodada', async () => {
    const srv = criarServidor();
    const a = aparelho();
    a.repo.salvarLote(COMPRA);
    const semRede: DadosClient = {
      ...srv.api,
      listarLotes: async () => ({ ok: false, kind: 'rede' }),
    };

    expect(await sincronizar({ ...a, api: semRede, usuarioId: 'u1' })).toBe('rede');
    expect(a.repo.exportar().lotes).toHaveLength(1);
    expect(await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' })).toBe('ok');
    expect(srv.lotes.size).toBe(1);
  });

  it('401 interrompe com "nao-autenticado"', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const expirada: DadosClient = {
      ...srv.api,
      listarLotes: async () => ({ ok: false, kind: 'nao-autenticado' }),
    };
    expect(await sincronizar({ ...a, api: expirada, usuarioId: 'u1' })).toBe('nao-autenticado');
  });

  it('dados de outra conta no aparelho: não mistura', async () => {
    const srv = criarServidor();
    const a = aparelho();
    a.estado.gravar({ usuarioId: 'u1', versoes: {} });
    a.repo.salvarLote(COMPRA);

    expect(await sincronizar({ ...a, api: srv.api, usuarioId: 'u2' })).toBe('erro');
    expect(srv.lotes.size).toBe(0);
  });

  it('entradas da recria editadas antes do login vencem uma nuvem intocada', async () => {
    const srv = criarServidor();
    const intocado = aparelho();
    await sincronizar({ ...intocado, api: srv.api, usuarioId: 'u1' });

    const novo = aparelho();
    novo.repo.atualizarRecria({ form: { area: '555' } });
    await sincronizar({ ...novo, api: srv.api, usuarioId: 'u1' });

    expect(srv.recria()?.entradas['area']).toBe('555');
    expect(novo.repo.exportar().recria.id).toBe(srv.recria()?.id);
  });
});
