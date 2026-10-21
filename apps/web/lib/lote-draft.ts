// Rascunho do modal de lote: retém o que foi digitado em cada modo de peso (RN-027) e valida.
import {
  categoriaFeminina,
  type LinhaCalculada,
  type LoteInput,
  type ModoPeso,
} from '@bovaro/domain';
import { hojeISO, lerCampo, valorCampo } from './format';
import { pesosValidos, separarPesos } from './negocios';
import type { BaseArroba, LoteEntity, LoteSalvar, LoteTipo } from './repo/types';

export interface LoteDraft {
  id?: string;
  tipo: LoteTipo;
  numero: number;
  categoria: string;
  data: string;
  modo: ModoPeso;
  qtd: string;
  /** Retido por modo: só o modo ativo entra na conta. */
  pesoTotal: string;
  pesoMedio: string;
  pesosTxt: string;
  preco: string;
  base: BaseArroba;
  aplicarDesconto: boolean;
  /** kg descontados por cabeça (texto pt-BR). */
  descontoKg: string;
  /** Depois que o usuário mexe no desconto, a categoria deixa de ligá-lo sozinha. */
  descontoTocado: boolean;
  /** Quantidade e preço da @ dos modos que NÃO estão ativos: cada modo tem os seus campos. */
  guardado: Partial<Record<ModoPeso, { qtd: string; preco: string }>>;
}

const CATEGORIA_PADRAO: Record<LoteTipo, string> = { compra: 'BEZERROS', venda: 'BOIS' };
export const CATEGORIAS_SUGERIDAS = [
  'BEZERROS',
  'BEZERRAS',
  'GARROTES',
  'NOVILHAS',
  'BOIS',
  'VACAS',
];
export const DESCONTO_PADRAO_KG = '10';
/** Capacidade da coluna do servidor (Decimal 8,3): 5 inteiros. */
const DESCONTO_MAX_KG = 99999.999;

export function novoRascunho(tipo: LoteTipo, numero: number, hoje = hojeISO()): LoteDraft {
  const categoria = CATEGORIA_PADRAO[tipo];
  return {
    tipo,
    numero,
    categoria,
    data: hoje,
    modo: 'total',
    qtd: '',
    pesoTotal: '',
    pesoMedio: '',
    pesosTxt: '',
    preco: '',
    base: 'vivo',
    aplicarDesconto: tipo === 'venda' && categoriaFeminina(categoria),
    descontoKg: DESCONTO_PADRAO_KG,
    descontoTocado: false,
    guardado: {},
  };
}

export function rascunhoDeLote(lote: LoteEntity): LoteDraft {
  return {
    id: lote.id,
    tipo: lote.tipo,
    numero: lote.numero,
    categoria: lote.categoria,
    data: lote.data,
    modo: lote.modo,
    qtd: lote.modo === 'individual' ? '' : lote.qtd,
    pesoTotal: lote.modo === 'total' ? lote.peso : '',
    pesoMedio: lote.modo === 'medio' ? lote.peso : '',
    pesosTxt: lote.pesos.join('\n'),
    preco: lote.preco,
    base: lote.base ?? 'vivo',
    aplicarDesconto: lote.aplicarDesconto ?? false,
    descontoKg: lote.descontoKg || DESCONTO_PADRAO_KG,
    descontoTocado: true,
    guardado: {},
  };
}

/** Troca Compra/Venda num lote novo: renumera e ajusta a categoria padrão e o desconto. */
export function trocarTipo(d: LoteDraft, tipo: LoteTipo, numero: number): LoteDraft {
  const usavaPadrao = d.categoria === CATEGORIA_PADRAO[d.tipo];
  const categoria = usavaPadrao ? CATEGORIA_PADRAO[tipo] : d.categoria;
  const aplicarDesconto =
    tipo === 'venda' && !d.descontoTocado ? categoriaFeminina(categoria) : d.aplicarDesconto;
  return { ...d, tipo, numero, categoria, aplicarDesconto };
}

export function mudarCategoria(d: LoteDraft, categoria: string): LoteDraft {
  if (d.tipo === 'venda' && !d.descontoTocado) {
    return { ...d, categoria, aplicarDesconto: categoriaFeminina(categoria) };
  }
  return { ...d, categoria };
}

/**
 * Troca o modo de peso (RN-027): cada modo tem os seus campos (quantidade, peso e preço da @). O que
 * foi digitado no modo que sai fica guardado; o modo que entra volta com o que já tinha, ou vazio.
 */
export function trocarModo(d: LoteDraft, modo: ModoPeso): LoteDraft {
  if (modo === d.modo) return d;
  const guardado = { ...d.guardado, [d.modo]: { qtd: d.qtd, preco: d.preco } };
  const entrada = guardado[modo] ?? { qtd: '', preco: '' };
  delete guardado[modo];
  return { ...d, modo, qtd: entrada.qtd, preco: entrada.preco, guardado };
}

export function pesoDoModo(d: LoteDraft): string {
  return d.modo === 'medio' ? d.pesoMedio : d.pesoTotal;
}

/** Modos (exceto o ativo) que têm algo digitado e guardado: marcados com ● na tela. */
export function modosGuardados(d: LoteDraft): ModoPeso[] {
  const outros = (m: ModoPeso): boolean => {
    const g = d.guardado[m];
    return !!g && (g.qtd.trim() !== '' || g.preco.trim() !== '');
  };
  const tem: Record<ModoPeso, boolean> = {
    total: (valorCampo(d.pesoTotal)?.gt(0) ?? false) || outros('total'),
    medio: (valorCampo(d.pesoMedio)?.gt(0) ?? false) || outros('medio'),
    individual: separarPesos(d.pesosTxt).length > 0 || outros('individual'),
  };
  return (['total', 'medio', 'individual'] as const).filter((m) => m !== d.modo && tem[m]);
}

export interface CampoErro {
  campo: 'qtd' | 'peso' | 'pesos' | 'preco' | 'desconto';
  mensagem: string;
}

/** Erros dos campos de peso/preço/desconto (vazios não são "erro" aqui: o resultado mostra "—"). */
export function errosDoRascunho(d: LoteDraft): CampoErro[] {
  const erros: CampoErro[] = [];
  const checar = (campo: CampoErro['campo'], texto: string): void => {
    const l = lerCampo(texto);
    if (l.tipo === 'invalido') erros.push({ campo, mensagem: l.dica });
    else if (l.tipo === 'ok' && l.valor.isNegative()) {
      erros.push({ campo, mensagem: 'Use um valor maior que zero.' });
    }
  };
  if (d.modo === 'individual') {
    const ruins = separarPesos(d.pesosTxt).filter((p) => lerCampo(p).tipo === 'invalido');
    if (ruins.length) {
      erros.push({
        campo: 'pesos',
        mensagem: `Peso inválido: ${ruins.slice(0, 3).join('; ')}. Use vírgula para os decimais (ex.: 450,5).`,
      });
    }
  } else {
    checar('qtd', d.qtd);
    checar('peso', pesoDoModo(d));
  }
  checar('preco', d.preco);
  if (d.tipo === 'venda' && d.aplicarDesconto) {
    const l = lerCampo(d.descontoKg);
    if (l.tipo !== 'ok') {
      erros.push({ campo: 'desconto', mensagem: 'Informe o desconto em kg por cabeça (ex.: 10).' });
    } else if (l.valor.isNegative() || l.valor.gt(DESCONTO_MAX_KG)) {
      erros.push({
        campo: 'desconto',
        mensagem: 'O desconto deve ficar entre 0 e 99.999 kg por cabeça.',
      });
    }
  }
  return erros;
}

/** Entrada do domínio para a pré-visualização (valores vazios/inválidos = indefinido). */
export function rascunhoParaDominio(d: LoteDraft): LoteInput {
  const base: LoteInput = {
    modo: d.modo,
    qtd: valorCampo(d.qtd),
    peso: valorCampo(pesoDoModo(d)),
    pesos: d.modo === 'individual' ? separarPesos(d.pesosTxt).map(valorCampo) : [],
    preco: valorCampo(d.preco),
  };
  if (d.tipo === 'compra') return base;
  return {
    ...base,
    base: d.base,
    aplicarDesconto: d.aplicarDesconto,
    desconto: d.aplicarDesconto ? valorCampo(d.descontoKg) : null,
  };
}

/** A pré-visualização só mostra números com peso e (para o total) preço válidos; senão, "—". */
export function previaPronta(
  d: LoteDraft,
  linha: LinhaCalculada,
): { peso: boolean; total: boolean } {
  const peso = linha.kg.gt(0) && linha.qtd.gt(0);
  const precoOk = valorCampo(d.preco)?.gt(0) ?? false;
  const descontoOk = d.tipo === 'compra' || !d.aplicarDesconto || valorCampo(d.descontoKg) !== null;
  return { peso: peso && descontoOk, total: peso && precoOk && descontoOk };
}

export type ResultadoValidacao = { ok: true; lote: LoteSalvar } | { ok: false; mensagem: string };

/** Valida para salvar (RF-025): exige quantidade/peso e preço da @. */
export function validarRascunho(d: LoteDraft): ResultadoValidacao {
  const erros = errosDoRascunho(d);
  if (erros.length) return { ok: false, mensagem: erros[0]!.mensagem };

  const pesos = d.modo === 'individual' ? pesosValidos(separarPesos(d.pesosTxt)) : [];
  const qtd = valorCampo(d.qtd);
  const peso = valorCampo(pesoDoModo(d));
  const pesoOk = d.modo === 'individual' ? pesos.length > 0 : !!qtd?.gt(0) && !!peso?.gt(0);
  if (!pesoOk) return { ok: false, mensagem: 'Preencha quantidade e peso do lote.' };
  if (!valorCampo(d.preco)?.gt(0)) return { ok: false, mensagem: 'Informe o preço da arroba.' };

  const lote: LoteSalvar = {
    ...(d.id ? { id: d.id } : {}),
    tipo: d.tipo,
    numero: d.numero,
    categoria: d.categoria.trim().toUpperCase() || 'SEM CATEGORIA',
    data: d.data,
    modo: d.modo,
    qtd: d.modo === 'individual' ? String(pesos.length) : d.qtd.trim(),
    peso: d.modo === 'individual' ? '' : pesoDoModo(d).trim(),
    pesos: d.modo === 'individual' ? separarPesos(d.pesosTxt) : [],
    preco: d.preco.trim(),
    ...(d.tipo === 'venda'
      ? {
          base: d.base,
          aplicarDesconto: d.aplicarDesconto,
          descontoKg: d.aplicarDesconto ? d.descontoKg.trim() : '',
        }
      : {}),
  };
  return { ok: true, lote };
}
