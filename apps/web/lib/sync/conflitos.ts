// Descrição dos dois lados de um conflito (RF-076) para a tela de decisão: o valor do aparelho e o
// do servidor, lado a lado. Puro e sem React.
import { cenarioSchema, loteSchema, recriaEntradaSchema } from '@ogado/contracts';
import { dataBR } from '../format';
import { RECRIA_CAMPOS, type DadosCompletos, type LoteEntity } from '../repo/types';
import type { Conflito, Rejeitado } from './engine';
import { cenarioDeDto, loteDeDto, recriaDeDto } from './mappers';

export interface LinhaComparacao {
  rotulo: string;
  meu: string;
  servidor: string;
  difere: boolean;
}

export interface DescricaoConflito {
  /** "Este lote foi alterado em outro aparelho" */
  titulo: string;
  /** "Lote 1 de compra" */
  item: string;
  linhas: LinhaComparacao[];
  /** O servidor excluiu o registro. */
  servidorExcluido: boolean;
  /** Este aparelho queria excluir. */
  meuExcluido: boolean;
  /** Texto de "Manter o meu". */
  explicaMeu: string;
  /** Texto de "Usar o do servidor". */
  explicaServidor: string;
}

const MODOS = { total: 'Total do lote', medio: 'Média × quantidade', individual: 'Peso a peso' };

const ROTULOS_RECRIA: Record<string, string> = {
  area: 'Área (ha)',
  dias: 'Dias',
  investimento: 'Investimento (R$)',
  rsCabCompra: 'Compra por cabeça (R$)',
  pesoIni: 'Peso inicial (kg)',
  pesoFin: 'Peso final (kg)',
  precoVenda: 'Preço de venda (R$/@)',
  consumoPct: 'Consumo (% do peso)',
  precoSuplKg: 'Suplemento (R$/kg)',
  rendCarcaca: 'Rendimento de carcaça (%)',
  imposto: 'Imposto (%)',
  sanidadeCabMes: 'Sanidade (R$/cab/mês)',
  funcionario: 'Funcionário (R$)',
  frete: 'Frete (R$)',
  lotacaoInicial: 'Lotação inicial',
};

function linha(rotulo: string, meu: string, servidor: string): LinhaComparacao {
  return { rotulo, meu, servidor, difere: meu !== servidor };
}

function valorOuTraco(v: string): string {
  return v.trim() === '' ? '—' : v;
}

export function nomeDoLote(tipo: string, numero: number): string {
  return `Lote ${numero} de ${tipo}`;
}

function linhasDoLote(local: LoteEntity, servidor: LoteEntity): LinhaComparacao[] {
  const pares: [string, (l: LoteEntity) => string][] = [
    ['Categoria', (l) => valorOuTraco(l.categoria)],
    ['Data', (l) => (l.data ? dataBR(l.data) : '—')],
    ['Modo de peso', (l) => MODOS[l.modo]],
    ['Quantidade', (l) => valorOuTraco(l.qtd)],
    ['Peso (kg)', (l) => (l.modo === 'individual' ? l.pesos.join(' + ') : valorOuTraco(l.peso))],
    ['Preço da arroba (R$)', (l) => valorOuTraco(l.preco)],
  ];
  if (local.tipo === 'venda') {
    pares.push(
      ['Base da arroba', (l) => (l.base === 'carcaca' ? 'Carcaça' : 'Peso vivo')],
      [
        'Desconto (%)',
        (l) => (l.aplicarDesconto ? valorOuTraco(l.descontoPct ?? '') : 'Sem desconto'),
      ],
    );
  }
  return pares.map(([rotulo, f]) => linha(rotulo, f(local), f(servidor)));
}

function linhaDeSituacao(meuExcluido: boolean, servidorExcluido: boolean): LinhaComparacao {
  return linha(
    'Situação',
    meuExcluido ? 'Excluído neste aparelho' : 'Existe',
    servidorExcluido ? 'Excluído em outro aparelho' : 'Existe',
  );
}

export function descreverConflito(c: Conflito, dados: DadosCompletos): DescricaoConflito {
  const servidorExcluido = c.motivo === 'excluido-no-servidor';
  const meuExcluido = c.acao === 'excluir';
  const verbo = servidorExcluido ? 'excluído' : 'alterado';
  const explicaMeu = servidorExcluido
    ? 'Recria o registro com o que está neste aparelho, como um novo lançamento.'
    : meuExcluido
      ? 'Exclui o registro, mesmo com a mudança feita no outro aparelho.'
      : 'O que está neste aparelho substitui o que está no servidor.';
  const explicaServidor = servidorExcluido
    ? 'Mantém a exclusão e descarta o que você mudou neste aparelho.'
    : 'Descarta o que você mudou neste aparelho e adota o que está no servidor.';
  const base = { servidorExcluido, meuExcluido, explicaMeu, explicaServidor };

  if (c.tipo === 'lote') {
    const local = dados.lotes.find((l) => l.id === c.id);
    const dto = loteSchema.safeParse(c.atual);
    const servidor = dto.success ? loteDeDto(dto.data) : undefined;
    const ref = local ?? servidor;
    const linhas: LinhaComparacao[] = [];
    if (meuExcluido || servidorExcluido)
      linhas.push(linhaDeSituacao(meuExcluido, servidorExcluido));
    if (local && servidor && !meuExcluido && !servidorExcluido) {
      linhas.push(...linhasDoLote(local, servidor));
    }
    return {
      ...base,
      titulo: `Este lote foi ${verbo} em outro aparelho`,
      item: ref ? nomeDoLote(ref.tipo, ref.numero) : 'Lote',
      linhas,
    };
  }

  if (c.tipo === 'cenario') {
    const local = dados.cenarios.find((x) => x.id === c.id);
    const dto = cenarioSchema.safeParse(c.atual);
    const servidor = dto.success ? cenarioDeDto(dto.data) : null;
    const linhas: LinhaComparacao[] = [];
    if (meuExcluido || servidorExcluido)
      linhas.push(linhaDeSituacao(meuExcluido, servidorExcluido));
    linhas.push(linha('Nome', local?.nome ?? '—', servidor?.nome ?? '—'));
    return {
      ...base,
      titulo: `Este cenário foi ${verbo} em outro aparelho`,
      item: `Cenário “${local?.nome ?? servidor?.nome ?? ''}”`,
      linhas,
    };
  }

  const dto = recriaEntradaSchema.safeParse(c.atual);
  const servidor = dto.success ? recriaDeDto(dto.data) : null;
  const local = dados.recria;
  const linhas: LinhaComparacao[] = [];
  if (servidor) {
    for (const campo of RECRIA_CAMPOS) {
      const l = linha(
        ROTULOS_RECRIA[campo] ?? campo,
        valorOuTraco(local.form[campo]),
        valorOuTraco(servidor.form[campo]),
      );
      if (l.difere) linhas.push(l);
    }
    if (local.lotacaoInicial !== servidor.lotacaoInicial) {
      const nome = (v: string): string => (v === 'fixa80' ? 'Fixa (80 UA/ha)' : 'Área pastável');
      linhas.push(
        linha(
          ROTULOS_RECRIA['lotacaoInicial'] ?? '',
          nome(local.lotacaoInicial),
          nome(servidor.lotacaoInicial),
        ),
      );
    }
  }
  return {
    ...base,
    titulo: 'As entradas da Recria foram alteradas em outro aparelho',
    item: 'Entradas da Recria',
    linhas,
  };
}

/** Nome do item recusado para a lista "Precisa de atenção". */
export function nomeDoRejeitado(r: Rejeitado, dados: DadosCompletos): string {
  if (r.tipo === 'lote') {
    const l = dados.lotes.find((x) => x.id === r.id);
    return l ? nomeDoLote(l.tipo, l.numero) : 'Lote';
  }
  if (r.tipo === 'cenario') {
    const c = dados.cenarios.find((x) => x.id === r.id);
    return c ? `Cenário “${c.nome}”` : 'Cenário';
  }
  return 'Entradas da Recria';
}
