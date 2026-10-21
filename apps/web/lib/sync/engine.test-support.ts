import type { CenarioDto, LoteCreate, LoteDto, RecriaEntradaDto } from '@bovaro/contracts';
import { criarStorageMemoria } from '../../components/test-utils';
import { criarRepoLocal } from '../repo/local-repo';
import type { CenarioSalvar, LoteSalvar } from '../repo/types';
import type { DadosClient, DadosResult } from './data-client';
import type { EstadoSync, EstadoSyncStore } from './engine';

export const AGORA = '2026-10-19T10:00:00.000Z';

function ok<T>(data: T, created = false): DadosResult<T> {
  return { ok: true, data, created };
}

/** Servidor em memória com a mesma semântica da API (versão-base, 409 com `atual`, numero). */
export function criarServidor() {
  const lotes = new Map<string, LoteDto>();
  const cenarios = new Map<string, CenarioDto>();
  let recria: RecriaEntradaDto | null = null;
  const chamadas: string[] = [];

  const historico = new Map<string, import('@bovaro/contracts').HistoricoSync>();
  const api: DadosClient = {
    async arquivarHistorico(body) {
      const registro = historico.get(body.id) ?? { ...body, criadoEm: AGORA };
      historico.set(body.id, registro);
      return ok(registro);
    },
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
  return { api, lotes, cenarios, chamadas, historico, recria: () => recria };
}

export function criarEstado(): EstadoSyncStore & { atual: EstadoSync | null } {
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
export function aparelho() {
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

export const COMPRA: LoteSalvar = {
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

export function cenario(): CenarioSalvar {
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
      custos: [
        { id: 'supl', nome: 'Suplemento', valor: '1' },
        { id: 'san', nome: 'Sanidade', valor: '0' },
        { id: 'imp', nome: 'Imposto', valor: '0' },
        { id: 'frete', nome: 'Frete', valor: '0' },
        { id: 'func', nome: 'Funcionário', valor: '0' },
      ],
    },
  };
}
