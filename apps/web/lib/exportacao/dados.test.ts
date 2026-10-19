import { calcularCompraVenda } from '@ogado/domain';
import { describe, expect, it } from 'vitest';
import { criarStorageMemoria } from '../../components/test-utils';
import { snapshotDaRecria } from '../cenarios';
import { loteParaDominio } from '../negocios';
import { criarRepoLocal, recriaFormPadrao } from '../repo/local-repo';
import type { LoteSalvar, RecriaEntity } from '../repo/types';
import { BOM, tabelaParaCsv } from './csv';
import { prepararNegocios, tabelaDeCenarios, tabelaDeNegocios } from './dados';

const compra = (extra: Partial<LoteSalvar> = {}): LoteSalvar => ({
  tipo: 'compra',
  numero: 1,
  categoria: 'BEZERROS',
  data: '2026-10-01',
  modo: 'total',
  qtd: '10',
  peso: '3000',
  pesos: [],
  preco: '300',
  ...extra,
});
const venda = (extra: Partial<LoteSalvar> = {}): LoteSalvar => ({
  ...compra(),
  tipo: 'venda',
  numero: 1,
  categoria: 'BOIS',
  data: '2026-10-15',
  qtd: '10',
  peso: '4500',
  preco: '320',
  base: 'vivo',
  aplicarDesconto: true,
  descontoPct: '10',
  ...extra,
});

function repoComLotes(...lotes: LoteSalvar[]) {
  const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
  for (const l of lotes) repo.salvarLote(l);
  const snap = repo.getSnapshot();
  if (snap.status !== 'pronto') throw new Error('repo não carregou');
  return { repo, snap };
}

describe('RF-041 tabelas de Negócios saem do domínio', () => {
  it('os números exportados são os do domínio (calcularCompraVenda), sem fórmula nova', () => {
    const { snap } = repoComLotes(compra(), venda());
    const esperado = calcularCompraVenda({
      compras: snap.lotes.filter((l) => l.tipo === 'compra').map(loteParaDominio),
      vendas: snap.lotes.filter((l) => l.tipo === 'venda').map(loteParaDominio),
    });

    const c = tabelaDeNegocios(snap.lotes, 'compra');
    expect(c.nome).toBe('Compras');
    expect(c.linhas).toHaveLength(1);
    const lc = c.linhas[0]!;
    expect(lc[0]).toBe('Compra');
    expect(lc[1]).toBe(1);
    expect(lc[2]).toBe('2026-10-01');
    expect(lc[3]).toBe('Bezerros');
    expect(lc[4]).toBe('Peso total');
    expect(lc[5]).toBe(10);
    expect(lc[7]).toBeNull(); // base só na venda
    expect(lc[8]).toBeNull(); // desconto só na venda
    expect(lc[9]).toBe(Number(esperado.compras[0]!.arrobas.toFixed(2)));
    expect(lc[11]).toBe(Number(esperado.compras[0]!.total.toFixed(2)));

    const v = tabelaDeNegocios(snap.lotes, 'venda');
    const lv = v.linhas[0]!;
    expect(lv[0]).toBe('Venda');
    expect(lv[7]).toBe('Peso vivo');
    expect(lv[8]).toBe(10);
    expect(lv[11]).toBe(Number(esperado.vendas[0]!.total.toFixed(2)));
    expect(lv[12]).toBe(Number(esperado.vendas[0]!.porCab!.toFixed(2)));
  });

  it('ordena por data decrescente e deixa lote sem data por último', () => {
    const { snap } = repoComLotes(
      compra({ numero: 1, data: '2026-01-01' }),
      compra({ numero: 2, data: '' }),
      compra({ numero: 3, data: '2026-05-01' }),
    );
    const lotes = tabelaDeNegocios(snap.lotes, 'compra').linhas.map((l) => l[1]);
    expect(lotes).toEqual([3, 1, 2]);
  });

  it('CSV de ambos traz a coluna Tipo; XLSX separa em duas abas; nome-base por conteúdo', () => {
    const { snap } = repoComLotes(compra(), venda());
    const csv = prepararNegocios(snap.lotes, 'ambos', 'csv');
    expect(csv.nomeBase).toBe('negocios');
    expect(csv.tabelas).toHaveLength(1);
    const texto = tabelaParaCsv(csv.tabelas[0]!);
    expect(texto.startsWith(`${BOM}Tipo;Lote;Data;`)).toBe(true);
    expect(texto).toContain('Venda;1;15/10/2026;Bois;Peso total;10;4500,00;Peso vivo;10,00;');
    expect(texto).toContain('Compra;1;01/10/2026;Bezerros;Peso total;10;3000,00;;;');

    const xlsx = prepararNegocios(snap.lotes, 'ambos', 'xlsx');
    expect(xlsx.tabelas.map((t) => t.nome)).toEqual(['Compras', 'Vendas']);
    expect(prepararNegocios(snap.lotes, 'compras', 'csv').nomeBase).toBe('compras');
    expect(prepararNegocios(snap.lotes, 'vendas', 'csv').nomeBase).toBe('vendas');
  });

  it('sem lotes: tabela vazia (a tela trata o estado vazio)', () => {
    const { snap } = repoComLotes();
    expect(tabelaDeNegocios(snap.lotes, 'compra').linhas).toEqual([]);
  });
});

describe('RF-041 tabela de Cenários vem do snapshot salvo', () => {
  it('exporta os indicadores do snapshot, sem recalcular, e deixa indefinido vazio', () => {
    const { repo } = repoComLotes();
    const recria: RecriaEntity = {
      id: 'r',
      version: 1,
      updatedAt: '2026-10-18T10:00:00.000Z',
      deletedAt: null,
      form: recriaFormPadrao(),
      lotacaoInicial: 'fixa80',
    };
    const snapshot = snapshotDaRecria(recria, 'Safra; "otimista"');
    if (!snapshot) throw new Error('snapshot indefinido');
    const salvo = repo.salvarCenario(snapshot);
    const snap = repo.getSnapshot();
    if (snap.status !== 'pronto') throw new Error('repo não carregou');

    const t = tabelaDeCenarios(snap.cenarios);
    expect(t.nome).toBe('Cenários');
    expect(t.colunas.map((c) => c.titulo)).toEqual(
      expect.arrayContaining([
        'Cenário',
        'Criado em',
        'Faturamento líquido',
        'Líquido por mês',
        'Preço de venda (R$/@)',
        'Peso inicial (kg)',
        'Peso final (kg)',
      ]),
    );
    const linha = t.linhas[0]!;
    expect(linha[0]).toBe('Safra; "otimista"');
    expect(linha[1]).toBe(salvo.criadoEm.slice(0, 10));
    const liq = t.colunas.findIndex((c) => c.titulo === 'Faturamento líquido');
    expect(linha[liq]).toBe(Number(Number(salvo.resultado.faturamentoLiquido).toFixed(2)));
    // texto do nome com ; e aspas sai escapado no CSV
    expect(tabelaParaCsv(t)).toContain('"Safra; ""otimista"""');
  });
});
