// Tradução entre as entidades do aparelho (texto pt-BR digitado) e os DTOs da API (ADR-0011 §6:
// decimais como string canônica com ponto). Só lotes precisam converter; cenários e entradas da
// recria guardam o texto como foi digitado.
import type {
  CenarioCreate,
  CenarioDto,
  LoteCreate,
  LoteDto,
  RecriaEntradaDto,
  RecriaEntradaPut,
} from '@ogado/contracts';
import { Decimal } from '@ogado/domain';
import { paraCampo, valorCampo } from '../format';
import { ehCenario, ehRecria } from '../repo/local-repo';
import type { CenarioEntity, LoteEntity, RecriaEntity } from '../repo/types';

function canonico(texto: string, escala: number): string {
  const v = valorCampo(texto);
  if (!v || v.isNegative()) return '0';
  return v.toDecimalPlaces(escala).toFixed();
}

function textoPtBr(canonicoStr: string): string {
  return paraCampo(canonicoStr);
}

/** Fração (`0.1`) -> percentual digitado (`10`). */
function percentualDeFracao(fracao: string): string {
  return paraCampo(new Decimal(fracao).times(100).toFixed());
}

export function loteParaCriar(l: LoteEntity): LoteCreate {
  const pct = valorCampo(l.descontoPct ?? '');
  const desconto =
    l.tipo === 'venda' && l.aplicarDesconto && pct && !pct.isNegative()
      ? pct.div(100).toDecimalPlaces(6).toFixed()
      : null;
  return {
    id: l.id,
    tipo: l.tipo,
    categoria: l.categoria.trim() === '' ? '—' : l.categoria,
    data: l.data === '' ? null : l.data,
    modo: l.modo,
    qtd: canonico(l.qtd, 3),
    peso: canonico(l.peso, 3),
    pesos: l.pesos.map((p) => canonico(p, 3)),
    preco: canonico(l.preco, 2),
    base: l.base ?? 'vivo',
    aplicarDesconto: l.tipo === 'venda' ? (l.aplicarDesconto ?? false) : false,
    desconto,
  };
}

export function lotePatchDe(l: LoteEntity): Omit<LoteCreate, 'id' | 'tipo'> {
  const completo: Partial<LoteCreate> = loteParaCriar(l);
  delete completo.id;
  delete completo.tipo;
  return completo as Omit<LoteCreate, 'id' | 'tipo'>;
}

export function loteDeDto(d: LoteDto): LoteEntity {
  const venda = d.tipo === 'venda';
  return {
    id: d.id,
    version: d.version,
    updatedAt: d.updatedAt,
    deletedAt: d.deletedAt,
    tipo: d.tipo,
    numero: d.numero,
    categoria: d.categoria,
    data: d.data ?? '',
    modo: d.modo,
    qtd: textoPtBr(d.qtd),
    peso: textoPtBr(d.peso),
    pesos: d.pesos.map(textoPtBr),
    preco: textoPtBr(d.preco),
    ...(venda
      ? {
          base: d.base,
          aplicarDesconto: d.aplicarDesconto,
          descontoPct: d.desconto === null ? '' : percentualDeFracao(d.desconto),
        }
      : {}),
  };
}

export function cenarioParaCriar(c: CenarioEntity): CenarioCreate {
  return {
    id: c.id,
    nome: c.nome,
    criadoEm: c.criadoEm,
    entradas: { ...c.form },
    variantes: { ...c.variantes },
    parametros: { ...c.parametros },
    resultado: { ...c.resultado, custos: c.resultado.custos.map((x) => ({ ...x })) },
  };
}

/** `null` se o DTO não tiver o formato que o aparelho entende (o item é ignorado, nunca apagado). */
export function cenarioDeDto(d: CenarioDto): CenarioEntity | null {
  const candidato = {
    id: d.id,
    version: d.version,
    updatedAt: d.updatedAt,
    deletedAt: d.deletedAt,
    nome: d.nome,
    criadoEm: d.criadoEm,
    form: d.entradas,
    variantes: d.variantes,
    parametros: d.parametros,
    resultado: d.resultado,
  };
  return ehCenario(candidato) ? candidato : null;
}

export function recriaParaPut(r: RecriaEntity, version?: number): RecriaEntradaPut {
  return {
    id: r.id,
    ...(version === undefined ? {} : { version }),
    entradas: { ...r.form },
    lotacaoInicial: r.lotacaoInicial,
  };
}

export function recriaDeDto(d: RecriaEntradaDto): RecriaEntity | null {
  const candidato = {
    id: d.id,
    version: d.version,
    updatedAt: d.updatedAt,
    deletedAt: d.deletedAt,
    form: d.entradas,
    lotacaoInicial: d.lotacaoInicial,
  };
  return ehRecria(candidato) ? candidato : null;
}
