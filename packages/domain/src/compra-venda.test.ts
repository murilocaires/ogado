import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  calcularCompra,
  calcularCompraVenda,
  calcularVenda,
  type CompraVendaInput,
  type LoteInput,
} from './compra-venda';

interface LinhaEsperada {
  qtd: number;
  kg: number;
  arrobas: number;
  preco: number;
  total: number;
  porCab: number;
}
interface CasoOuro {
  entrada: CompraVendaInput;
  esperado: {
    compras: LinhaEsperada[];
    vendas: LinhaEsperada[];
    totalCompras: number;
    totalVendas: number;
    saldo: number;
    cabCompra: number;
    cabVenda: number;
    arrCompra: number;
    arrVenda: number;
  };
}
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden.json', import.meta.url), 'utf8'),
) as { compraVenda: CasoOuro; compraVendaIndividual: CasoOuro };

const REL_TOL = 1e-6;
function perto(atual: Decimal, esperado: number): void {
  const diff = atual.minus(esperado).abs().toNumber();
  expect(diff).toBeLessThanOrEqual(REL_TOL * Math.abs(esperado));
}
function linhaPerto(atual: ReturnType<typeof calcularCompra>, esp: LinhaEsperada): void {
  perto(atual.qtd, esp.qtd);
  perto(atual.kg, esp.kg);
  perto(atual.arrobas, esp.arrobas);
  perto(atual.preco, esp.preco);
  perto(atual.total, esp.total);
  perto(atual.porCab, esp.porCab);
}

describe('paridade com o ouro (compraVenda)', () => {
  const r = calcularCompraVenda(golden.compraVenda.entrada);
  const e = golden.compraVenda.esperado;

  it('RN-001/RN-004/RN-003: linhas de compra (modos total e médio)', () => {
    expect(r.compras).toHaveLength(2);
    r.compras.forEach((l, i) => linhaPerto(l, e.compras[i]!));
  });
  it('RN-002/RN-005: linha de venda (desconto de 10 kg/cab., @ = 15 kg)', () => {
    linhaPerto(r.vendas[0]!, e.vendas[0]!);
  });
  it('RN-006: saldo = vendas − compras = −89.475,83', () => {
    perto(r.totalCompras, e.totalCompras);
    perto(r.totalVendas, e.totalVendas);
    perto(r.saldo, e.saldo);
    perto(r.cabCompra, e.cabCompra);
    perto(r.cabVenda, e.cabVenda);
    perto(r.arrCompra, e.arrCompra);
    perto(r.arrVenda, e.arrVenda);
  });
  it('RNF-001: resultados são Decimal, sem arredondar (precisão 28)', () => {
    expect(r.saldo).toBeInstanceOf(Decimal);
    expect(r.compras[0]!.arrobas.toString()).toBe('377.0333333333333333333333333');
  });
});

describe('RN-003: modo individual (soma dos pesos; qtd = nº de pesos)', () => {
  it('RN-003: 3 animais 200/210/220 a R$ 300/@ = 630 kg, 21 @, R$ 6.300, R$ 2.100/cab.', () => {
    const g = golden.compraVendaIndividual;
    const r = calcularCompraVenda(g.entrada);
    linhaPerto(r.compras[0]!, g.esperado.compras[0]!);
    perto(r.saldo, g.esperado.saldo);
    perto(r.cabVenda, 0);
  });
  it('RN-003: individual vale também na venda; ignora pesos não positivos e qtd informada', () => {
    const lote: LoteInput = { modo: 'individual', qtd: 99, pesos: [200, 210, 0, -5, 220], preco: 300 };
    const v = calcularVenda(lote);
    expect(v.qtd.toString()).toBe('3');
    expect(v.kg.toString()).toBe('630');
    // (630 - 3*10) / 15 = 40 @ ; 40 * 300 = 12000
    expect(v.arrobas.toString()).toBe('40');
    expect(v.total.toString()).toBe('12000');
    expect(v.porCab.toString()).toBe('4000');
  });
  it('RN-003: individual sem pesos resulta em lote vazio', () => {
    const c = calcularCompra({ modo: 'individual', preco: 300 });
    expect(c.qtd.toString()).toBe('0');
    expect(c.total.toString()).toBe('0');
    expect(c.porCab.toString()).toBe('0');
  });
});

describe('RN-001/RN-003/RN-004: compra', () => {
  it('RN-003: modo médio multiplica qtd × peso médio e aceita strings decimais', () => {
    const c = calcularCompra({ modo: 'medio', qtd: '10', peso: '210', preco: '290' });
    expect(c.kg.toString()).toBe('2100');
    expect(c.arrobas.toString()).toBe('70');
    expect(c.total.toString()).toBe('20300');
    expect(c.porCab.toString()).toBe('2030');
  });
  it('RN-004: R$/cab. com qtd 0 não divide por zero', () => {
    const c = calcularCompra({ modo: 'total', qtd: 0, peso: 300, preco: 300 });
    expect(c.porCab.toString()).toBe('0');
  });
  it('RN-003: valores não finitos valem zero', () => {
    const c = calcularCompra({ modo: 'total', qtd: 1, peso: Infinity, preco: 300 });
    expect(c.total.toString()).toBe('0');
  });
  it('RN-003: campos ausentes valem zero', () => {
    const c = calcularCompra({ modo: 'total' });
    expect(c.total.toString()).toBe('0');
  });
});

describe('RN-002/RN-005: venda', () => {
  it('RN-002: @ = (kg − qtd×10) ÷ 15 e total = @ × R$/@ (modo total)', () => {
    const v = calcularVenda({ modo: 'total', qtd: 16, peso: 2920, preco: 290 });
    expect(v.arrobas.toString()).toBe('184');
    expect(v.total.toString()).toBe('53360');
    expect(v.porCab.toString()).toBe('3335');
  });
  it('RN-002: modo médio na venda', () => {
    const v = calcularVenda({ modo: 'medio', qtd: 10, peso: 310, preco: 300 });
    expect(v.kg.toString()).toBe('3100');
    expect(v.arrobas.toString()).toBe('200');
  });
});

describe('RN-006: saldo', () => {
  it('RN-006: sem lotes o saldo é zero', () => {
    const r = calcularCompraVenda({ compras: [], vendas: [] });
    expect(r.saldo.toString()).toBe('0');
  });
  it('RN-006: parâmetros embutidos podem ser sobrescritos', () => {
    const r = calcularCompraVenda(
      { compras: [{ modo: 'total', qtd: 1, peso: 60, preco: 100 }], vendas: [] },
      { arrobaCompraKg: 20 },
    );
    expect(r.saldo.toString()).toBe('-300');
    expect(r.params.arrobaVendaKg.toString()).toBe('15');
  });
});

describe('RN-022: entrada vazia ou inválida não lança exceção em compra e venda', () => {
  it.each([
    ['string vazia', ''],
    ['texto', 'abc'],
    ['vírgula (a borda deve usar parseNumeroPtBr)', '1,5'],
    ['null', null],
  ])('RN-022: peso %s vale 0', (_nome, peso) => {
    const l = calcularCompra({ modo: 'total', qtd: 10, peso, preco: 300 });
    expect(l.kg.toString()).toBe('0');
    expect(l.total.toString()).toBe('0');
  });

  it('RN-022: qtd vazia e peso individual inválido não lançam', () => {
    expect(() => calcularVenda({ modo: 'medio', qtd: '', peso: 200, preco: 300 })).not.toThrow();
    const l = calcularVenda({ modo: 'individual', pesos: [210, '', 'x', null, 190], preco: 300 });
    expect(l.qtd.toString()).toBe('2');
    expect(l.kg.toString()).toBe('400');
  });

  it('RN-022: parâmetro sobrescrito vazio ou inválido cai no padrão da planilha', () => {
    const entrada: CompraVendaInput = {
      compras: [{ modo: 'total', qtd: 10, peso: 300, preco: 300 }],
      vendas: [],
    };
    const r = calcularCompraVenda(entrada, { arrobaCompraKg: '', descontoVendaKgCab: 'abc' });
    expect(r.params.arrobaCompraKg.toString()).toBe('30');
    expect(r.params.descontoVendaKgCab.toString()).toBe('10');
    expect(r.totalCompras.toString()).toBe('3000');
  });
});
