import type { CenarioDto, LoteCreate, LoteDto, RecriaEntradaDto } from '@ogado/contracts';
import { describe, expect, it } from 'vitest';
import { criarStorageMemoria } from '../../components/test-utils';
import { criarRepoLocal } from '../repo/local-repo';
import type { CenarioSalvar, LoteSalvar } from '../repo/types';
import type { DadosClient, DadosResult } from './data-client';
import { sincronizar, type EstadoSync, type EstadoSyncStore } from './engine';
import { loteDeDto, loteParaCriar } from './mappers';

const AGORA = '2026-10-19T10:00:00.000Z';

function ok<T>(data: T, created = false): DadosResult<T> {
  return { ok: true, data, created };
}

/** Servidor em memória com a mesma semântica da API (versão-base, 409 com `atual`, numero). */
function criarServidor() {
  const lotes = new Map<string, LoteDto>();
  const cenarios = new Map<string, CenarioDto>();
  let recria: RecriaEntradaDto | null = null;
  const chamadas: string[] = [];

  const api: DadosClient = {
    async listarLotes() {
      return ok([...lotes.values()]);
    },
    async criarLote(body: LoteCreate) {
      chamadas.push('criarLote');
      const existente = lotes.get(body.id);
      if (existente) return ok(existente);
      const numero = [...lotes.values()].filter((l) => l.tipo === body.tipo).length + 1;
      const novo: LoteDto = {
        ...body,
        numero,
        version: 1,
        createdAt: AGORA,
        updatedAt: AGORA,
        deletedAt: null,
      };
      lotes.set(body.id, novo);
      return ok(novo, true);
    },
    async alterarLote(id, body) {
      chamadas.push('alterarLote');
      const atual = lotes.get(id);
      if (!atual) return { ok: false, kind: 'nao-encontrado' };
      if (atual.version !== body.version) return { ok: false, kind: 'conflito', atual };
      const campos: Partial<typeof body> = { ...body };
      delete campos.version;
      const novo = { ...atual, ...campos, version: atual.version + 1 } as LoteDto;
      lotes.set(id, novo);
      return ok(novo);
    },
    async excluirLote(id, version) {
      chamadas.push('excluirLote');
      const atual = lotes.get(id);
      if (!atual) return { ok: false, kind: 'nao-encontrado' };
      if (atual.version !== version) return { ok: false, kind: 'conflito', atual };
      const novo = { ...atual, version: atual.version + 1, deletedAt: AGORA };
      lotes.set(id, novo);
      return ok(novo);
    },
    async listarCenarios() {
      return ok([...cenarios.values()]);
    },
    async criarCenario(body) {
      chamadas.push('criarCenario');
      const existente = cenarios.get(body.id);
      if (existente) return ok(existente);
      const novo: CenarioDto = {
        ...body,
        version: 1,
        createdAt: AGORA,
        updatedAt: AGORA,
        deletedAt: null,
      };
      cenarios.set(body.id, novo);
      return ok(novo, true);
    },
    async renomearCenario(id, nome, version) {
      chamadas.push('renomearCenario');
      const atual = cenarios.get(id);
      if (!atual) return { ok: false, kind: 'nao-encontrado' };
      if (atual.version !== version) return { ok: false, kind: 'conflito', atual };
      const novo = { ...atual, nome, version: atual.version + 1 };
      cenarios.set(id, novo);
      return ok(novo);
    },
    async excluirCenario(id, version) {
      chamadas.push('excluirCenario');
      const atual = cenarios.get(id);
      if (!atual) return { ok: false, kind: 'nao-encontrado' };
      if (atual.version !== version) return { ok: false, kind: 'conflito', atual };
      const novo = { ...atual, version: atual.version + 1, deletedAt: AGORA };
      cenarios.set(id, novo);
      return ok(novo);
    },
    async lerRecria() {
      return recria ? ok(recria) : { ok: false, kind: 'nao-encontrado' };
    },
    async gravarRecria(body) {
      chamadas.push('gravarRecria');
      if (!recria) {
        recria = {
          id: body.id,
          entradas: body.entradas,
          lotacaoInicial: body.lotacaoInicial,
          version: 1,
          createdAt: AGORA,
          updatedAt: AGORA,
          deletedAt: null,
        };
        return ok(recria, true);
      }
      if (recria.version !== body.version) return { ok: false, kind: 'conflito', atual: recria };
      recria = {
        ...recria,
        entradas: body.entradas,
        lotacaoInicial: body.lotacaoInicial,
        version: recria.version + 1,
      };
      return ok(recria);
    },
  };
  return { api, lotes, cenarios, chamadas, recria: () => recria };
}

function criarEstado(): EstadoSyncStore & { atual: EstadoSync | null } {
  const s: EstadoSyncStore & { atual: EstadoSync | null } = {
    atual: null,
    ler: () => s.atual,
    gravar: (e) => {
      s.atual = e;
    },
    limpar: () => {
      s.atual = null;
    },
  };
  return s;
}

let aparelhos = 0;
function aparelho() {
  let n = 0;
  const prefixo = String(++aparelhos).padStart(4, '0');
  return {
    repo: criarRepoLocal({
      storage: () => criarStorageMemoria(),
      agora: () => new Date(AGORA),
      novoId: () => `0000${prefixo}-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    }),
    estado: criarEstado(),
  };
}

const COMPRA: LoteSalvar = {
  tipo: 'compra',
  numero: 1,
  categoria: 'BEZERRO',
  data: '2026-10-01',
  modo: 'total',
  qtd: '10',
  peso: '2.500,5'.replace('.', ''),
  pesos: [],
  preco: '300,5',
};

function cenario(): CenarioSalvar {
  return {
    nome: 'Base',
    form: {
      area: '100',
      dias: '365',
      investimento: '0',
      rsCabCompra: '1000',
      pesoIni: '200',
      pesoFin: '400',
      precoVenda: '300',
      consumoPct: '2',
      precoSuplKg: '2',
      rendCarcaca: '52',
      imposto: '1,5',
      sanidadeCabMes: '5',
      funcionario: '0',
      frete: '0',
    },
    variantes: { lotacaoInicial: 'fixa80', faturamentoBruto: 'pesoVivo' },
    parametros: { arrobaVivoKg: '30', arrobaCarcacaKg: '15', uaKg: '450', lotacaoFixaHa: '80' },
    resultado: {
      cabecas: '10',
      lotacaoTotalUA: null,
      lotacaoHaInicial: null,
      pesoMedio: null,
      lotacaoFinal: null,
      arrobasProduzidas: null,
      consumoKgDia: null,
      arrobasCarcacaCab: null,
      vendaCab: null,
      custoTotal: null,
      faturamentoBruto: null,
      faturamentoLiquido: null,
      totalEmCaixa: null,
      liquidoMes: null,
      liquidoHa: null,
      gmdImplicito: null,
      custos: [{ id: 'a', nome: 'Compra', valor: '1' }],
    },
  };
}

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

  it('desconto da venda: % digitado vira fração e volta', () => {
    const venda = {
      ...COMPRA,
      tipo: 'venda' as const,
      base: 'carcaca' as const,
      aplicarDesconto: true,
      descontoPct: '12,5',
      id: '00000000-0000-4000-8000-000000000002',
      version: 1,
      updatedAt: AGORA,
      deletedAt: null,
    };
    const criar = loteParaCriar(venda);
    expect(criar.desconto).toBe('0.125');
    const volta = loteDeDto({
      ...criar,
      numero: 1,
      version: 1,
      createdAt: AGORA,
      updatedAt: AGORA,
      deletedAt: null,
    });
    expect(volta.descontoPct).toBe('12,5');
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

  it('conflito: a nuvem vence e o aparelho adota o estado atual', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const lote = a.repo.salvarLote(COMPRA);
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });
    const b = aparelho();
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });

    b.repo.salvarLote({ ...COMPRA, id: lote.id, qtd: '50' });
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });
    a.repo.salvarLote({ ...COMPRA, id: lote.id, qtd: '99' });
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });

    expect(srv.lotes.get(lote.id)?.qtd).toBe('50');
    expect(a.repo.exportar().lotes[0]?.qtd).toBe('50');
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
