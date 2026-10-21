import {
  cenarioSchema,
  recriaEntradaSchema,
  type CenarioDto,
  type FazendaDto,
  type LoteDto,
  type RecriaEntradaDto,
} from '@bovaro/contracts';
import type { CenarioRecord } from '../repositories/cenario-repository';
import type { FazendaRecord } from '../repositories/fazenda-repository';
import type { LoteRecord } from '../repositories/lote-repository';
import type { RecriaEntradaRecord } from '../repositories/recria-repository';

export function toFazendaDto(f: FazendaRecord): FazendaDto {
  return {
    id: f.id,
    nome: f.nome,
    areaHa: f.areaHa ? f.areaHa.toFixed() : null,
    version: f.version,
    updatedAt: f.updatedAt.toISOString(),
    deletedAt: f.deletedAt ? f.deletedAt.toISOString() : null,
  };
}

const iso = (d: Date): string => d.toISOString();

/** Decimal canônico: `toFixed()` do decimal.js não usa expoente e não guarda zeros à direita. */
export function toLoteDto(l: LoteRecord): LoteDto {
  return {
    id: l.id,
    tipo: l.tipo,
    numero: l.numero,
    categoria: l.categoria,
    data: l.data ? l.data.toISOString().slice(0, 10) : null,
    modo: l.modo,
    qtd: l.qtd.toFixed(),
    peso: l.peso.toFixed(),
    pesos: l.pesos.map((p) => p.toFixed()),
    preco: l.preco.toFixed(),
    base: l.base,
    aplicarDesconto: l.aplicarDesconto,
    descontoKg: l.descontoKg ? l.descontoKg.toFixed() : null,
    version: l.version,
    createdAt: iso(l.createdAt),
    updatedAt: iso(l.updatedAt),
    deletedAt: l.deletedAt ? iso(l.deletedAt) : null,
  };
}

/** Os JSON do banco passam pelo schema de saída: nada fora de "strings" sai da API. */
export function toCenarioDto(c: CenarioRecord): CenarioDto {
  return cenarioSchema.parse({
    id: c.id,
    nome: c.nome,
    criadoEm: iso(c.criadoEm),
    entradas: c.entradas,
    variantes: c.variantes,
    parametros: c.parametros,
    resultado: c.resultado,
    version: c.version,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
    deletedAt: c.deletedAt ? iso(c.deletedAt) : null,
  });
}

export function toRecriaEntradaDto(r: RecriaEntradaRecord): RecriaEntradaDto {
  return recriaEntradaSchema.parse({
    id: r.id,
    entradas: r.entradas,
    lotacaoInicial: r.lotacaoInicial,
    version: r.version,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    deletedAt: r.deletedAt ? iso(r.deletedAt) : null,
  });
}
