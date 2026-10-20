import { describe, expect, it } from 'vitest';
import { cenarioCreateSchema, loteCreateSchema, lotePatchSchema } from './index';

const lote = {
  id: '2f1c6d6e-5b7a-4c1e-9d55-0d1c2b3a4f5e',
  tipo: 'compra',
  categoria: ' novilho ',
  modo: 'total',
  qtd: '100',
  peso: '12.500',
  preco: '300.00',
};

function regras(input: unknown): string[] {
  const r = loteCreateSchema.safeParse(input);
  if (r.success) return [];
  return r.error.issues.map((i) => String((i as { params?: { regra?: string } }).params?.regra));
}

describe('contratos de dados da nuvem', () => {
  it('RF-020: aceita lote válido, aplica padrões e normaliza a categoria', () => {
    const r = loteCreateSchema.parse(lote);
    expect(r).toMatchObject({
      categoria: 'novilho',
      base: 'vivo',
      aplicarDesconto: false,
      pesos: [],
    });
  });

  it('RF-020: recusa vírgula, expoente, sinal e número JSON; casas e capacidade da coluna', () => {
    expect(regras({ ...lote, qtd: '1,5' })).toContain('formato');
    expect(regras({ ...lote, qtd: '1e3' })).toContain('formato');
    expect(regras({ ...lote, qtd: '-1' })).toContain('formato');
    expect(loteCreateSchema.safeParse({ ...lote, qtd: 5 }).success).toBe(false);
    expect(regras({ ...lote, preco: '1.001' })).toContain('casas_decimais');
    expect(loteCreateSchema.safeParse({ ...lote, preco: '1.100' }).success).toBe(true);
    expect(regras({ ...lote, peso: '1234567890.5' })).toContain('faixa');
  });

  it('RF-021: descontoKg é kg por cabeça (0, 10, 12.5), com 3 casas e 5 inteiros', () => {
    for (const d of ['0', '10', '12.5', '99999.999', null]) {
      expect(loteCreateSchema.safeParse({ ...lote, descontoKg: d }).success).toBe(true);
    }
    expect(regras({ ...lote, descontoKg: '100000' })).toContain('faixa');
    expect(regras({ ...lote, descontoKg: '1.0001' })).toContain('casas_decimais');
    expect(regras({ ...lote, descontoKg: '-1' })).toContain('formato');
  });

  it('RF-021: o campo antigo "desconto" (fração) é recusado (strictObject, ADR-0013)', () => {
    expect(loteCreateSchema.safeParse({ ...lote, desconto: '0.1' }).success).toBe(false);
  });

  it('RF-020: PATCH exige version e ao menos um campo; chaves desconhecidas são recusadas', () => {
    expect(lotePatchSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(lotePatchSchema.safeParse({ categoria: 'X' }).success).toBe(false);
    expect(lotePatchSchema.safeParse({ version: 1, categoria: 'X' }).success).toBe(true);
    expect(lotePatchSchema.safeParse({ version: 1, numero: 3 }).success).toBe(false);
  });

  it('RF-032/RF-079: cenário incompleto é recusado na borda antes de entrar na sincronização', () => {
    const base = {
      id: lote.id,
      nome: 'A',
      criadoEm: '2026-10-18T00:00:00.000Z',
      entradas: { a: '1' },
      variantes: {},
      parametros: {},
      resultado: { x: null, custos: [{ id: 'a', valor: null }] },
    };
    expect(cenarioCreateSchema.safeParse(base).success).toBe(false);
    expect(cenarioCreateSchema.safeParse({ ...base, entradas: { a: 1 } }).success).toBe(false);
    expect(cenarioCreateSchema.safeParse({ ...base, nome: 'x'.repeat(81) }).success).toBe(false);
  });
});
