// Monta as tabelas exportadas (RF-041) a partir do que a tela já calcula pelo domínio
// (`resumirNegocios`, snapshot dos cenários). Nenhuma fórmula nova; só rótulos e escrita final.
import { Decimal } from '@bovaro/domain';
import { LINHAS_COMPARACAO } from '../cenarios';
import { capitalizar, valorCampo } from '../format';
import { ordenarPorData, resumirNegocios, type ItemNegocio } from '../negocios';
import type { CenarioEntity, LoteEntity, LoteTipo } from '../repo/types';
import { dataFinal, numeroFinal, type Celula, type Coluna, type Tabela } from './tabela';

const MODO: Record<LoteEntity['modo'], string> = {
  total: 'Peso total',
  medio: 'Peso médio',
  individual: 'Peso a peso',
};

export const COLUNAS_NEGOCIOS: readonly Coluna[] = [
  { titulo: 'Tipo', tipo: 'texto' },
  { titulo: 'Lote', tipo: 'numero', casas: 0 },
  { titulo: 'Data', tipo: 'data' },
  { titulo: 'Categoria', tipo: 'texto' },
  { titulo: 'Modo de peso', tipo: 'texto' },
  { titulo: 'Cabeças', tipo: 'numero', casas: 0 },
  { titulo: 'Peso (kg)', tipo: 'numero', casas: 2 },
  { titulo: 'Base da @', tipo: 'texto' },
  { titulo: 'Desconto (kg/cab.)', tipo: 'numero', casas: 2 },
  { titulo: 'kg líquido', tipo: 'numero', casas: 2 },
  { titulo: 'Arrobas (@)', tipo: 'numero', casas: 2 },
  { titulo: 'Preço (R$/@)', tipo: 'numero', casas: 2 },
  { titulo: 'Total (R$)', tipo: 'numero', casas: 2 },
  { titulo: 'R$/cabeça', tipo: 'numero', casas: 2 },
];

function linhaDeNegocio(x: ItemNegocio): Celula[] {
  const venda = x.tipo === 'venda';
  return [
    venda ? 'Venda' : 'Compra',
    x.lote.numero,
    dataFinal(x.lote.data),
    capitalizar(x.lote.categoria),
    MODO[x.lote.modo],
    numeroFinal(x.linha.qtd, 0),
    numeroFinal(x.linha.kg, 2),
    venda ? (x.lote.base === 'carcaca' ? 'Carcaça' : 'Peso vivo') : null,
    venda ? numeroFinal(x.linha.descontoKgCab, 2) : null,
    venda ? numeroFinal(x.linha.kgLiquido, 2) : null,
    numeroFinal(x.linha.arrobas, 2),
    numeroFinal(x.linha.preco, 2),
    numeroFinal(x.linha.total, 2),
    numeroFinal(x.linha.porCab, 2),
  ];
}

/** Uma tabela de compras ou de vendas, na ordem da tela (data decrescente, RF-024). */
export function tabelaDeNegocios(lotes: readonly LoteEntity[], tipo: LoteTipo): Tabela {
  const itens = ordenarPorData(resumirNegocios(lotes).itens.filter((x) => x.tipo === tipo));
  return {
    nome: tipo === 'compra' ? 'Compras' : 'Vendas',
    colunas: COLUNAS_NEGOCIOS,
    linhas: itens.map(linhaDeNegocio),
  };
}

/** Compras e vendas numa tabela só (CSV), com a coluna Tipo. */
export function tabelaDeNegociosJuntos(lotes: readonly LoteEntity[]): Tabela {
  const itens = ordenarPorData(resumirNegocios(lotes).itens);
  return { nome: 'Negócios', colunas: COLUNAS_NEGOCIOS, linhas: itens.map(linhaDeNegocio) };
}

export type ConteudoNegocios = 'compras' | 'vendas' | 'ambos';

/**
 * Tabelas e nome-base do arquivo de Negócios. "Ambos" vira uma tabela com a coluna Tipo no CSV
 * (um arquivo só) e duas abas, Compras e Vendas, no XLSX.
 */
export function prepararNegocios(
  lotes: readonly LoteEntity[],
  conteudo: ConteudoNegocios,
  formato: 'csv' | 'xlsx',
): { tabelas: Tabela[]; nomeBase: string } {
  if (conteudo === 'compras') {
    return { tabelas: [tabelaDeNegocios(lotes, 'compra')], nomeBase: 'compras' };
  }
  if (conteudo === 'vendas') {
    return { tabelas: [tabelaDeNegocios(lotes, 'venda')], nomeBase: 'vendas' };
  }
  return {
    tabelas:
      formato === 'csv'
        ? [tabelaDeNegociosJuntos(lotes)]
        : [tabelaDeNegocios(lotes, 'compra'), tabelaDeNegocios(lotes, 'venda')],
    nomeBase: 'negocios',
  };
}

const MOEDA = 2;

function colunasDeCenarios(): { coluna: Coluna; valor: (c: CenarioEntity) => Decimal | null }[] {
  const casasDe: Record<string, number> = { cab: 2, dias: 0, lotfin: 2 };
  const doSnapshot = LINHAS_COMPARACAO.map((l) => ({
    coluna: {
      titulo: l.id === 'preco' ? 'Preço de venda (R$/@)' : l.rotulo,
      tipo: 'numero' as const,
      casas: casasDe[l.id] ?? MOEDA,
    },
    valor: l.valor,
  }));
  return [
    ...doSnapshot,
    {
      coluna: { titulo: 'Peso inicial (kg)', tipo: 'numero', casas: 2 },
      valor: (c) => valorCampo(c.form.pesoIni),
    },
    {
      coluna: { titulo: 'Peso final (kg)', tipo: 'numero', casas: 2 },
      valor: (c) => valorCampo(c.form.pesoFin),
    },
  ];
}

/** Cenários (simulações da recria) com os indicadores do snapshot salvo, sem recalcular. */
export function tabelaDeCenarios(cenarios: readonly CenarioEntity[]): Tabela {
  const numericas = colunasDeCenarios();
  const ordenados = [...cenarios].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  return {
    nome: 'Cenários',
    colunas: [
      { titulo: 'Cenário', tipo: 'texto' },
      { titulo: 'Criado em', tipo: 'data' },
      ...numericas.map((n) => n.coluna),
    ],
    linhas: ordenados.map((c) => [
      c.nome,
      dataFinal(c.criadoEm.slice(0, 10)),
      ...numericas.map((n) => numeroFinal(n.valor(c), n.coluna.casas ?? MOEDA)),
    ]),
  };
}
