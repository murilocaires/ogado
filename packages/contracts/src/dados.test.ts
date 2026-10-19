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

  it('RF-021: desconto é fração entre 0 e 1', () => {
    expect(loteCreateSchema.safeParse({ ...lote, desconto: '1' }).success).toBe(true);
    expect(loteCreateSchema.safeParse({ ...lote, desconto: '0.000001' }).success).toBe(true);
    expect(regras({ ...lote, desconto: '1.000001' })).toContain('faixa');
    expect(regras({ ...lote, desconto: '0.0000001' })).toContain('casas_decimais');
  });

  it('RF-020: PATCH exige version e ao menos um campo; chaves desconhecidas são recusadas', () => {
    expect(lotePatchSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(lotePatchSchema.safeParse({ categoria: 'X' }).success).toBe(false);
    expect(lotePatchSchema.safeParse({ version: 1, categoria: 'X' }).success).toBe(true);
    expect(lotePatchSchema.safeParse({ version: 1, numero: 3 }).success).toBe(false);
  });

  it('RF-032: cenário só aceita strings nas folhas e nome até 80', () => {
    const base = {
      id: lote.id,
      nome: 'A',
      criadoEm: '2026-10-18T00:00:00.000Z',
      entradas: { a: '1' },
      variantes: {},
      parametros: {},
      resultado: { x: null, custos: [{ id: 'a', valor: null }] },
    };
    expect(cenarioCreateSchema.safeParse(base).success).toBe(true);
    expect(cenarioCreateSchema.safeParse({ ...base, entradas: { a: 1 } }).success).toBe(false);
    expect(cenarioCreateSchema.safeParse({ ...base, nome: 'x'.repeat(81) }).success).toBe(false);
  });
});
