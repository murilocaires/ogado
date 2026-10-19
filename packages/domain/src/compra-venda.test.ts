import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  calcularCompra,
  calcularCompraVenda,
  calcularVenda,
  categoriaFeminina,
  type CompraVendaInput,
  type LoteInput,
} from './compra-venda';
import { formatarBRL } from './pt-br';

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
  perto(atual.porCab ?? new Decimal(NaN), esp.porCab);
}

describe('paridade com o ouro da planilha (compras e vendas, ADR-0013)', () => {
  // A venda da planilha é (kg − qtd×10) ÷ 15 (F11): base carcaça + 10 kg/cab. O golden.json guarda o
  // lote de venda sem `base`; a planilha equivale a base 'carcaca' (10 kg/cab é o padrão).
  const entrada: CompraVendaInput = {
    ...golden.compraVenda.entrada,
    vendas: golden.compraVenda.entrada.vendas.map((v) => ({ ...v, base: 'carcaca' as const })),
  };
  const r = calcularCompraVenda(entrada);
  const e = golden.compraVenda.esperado;

  it('RN-001/RN-004/RN-003: linhas de compra (modos total e médio)', () => {
    expect(r.compras).toHaveLength(2);
    r.compras.forEach((l, i) => linhaPerto(l, e.compras[i]!));
  });
  it('RN-002: venda da planilha F11/H11: (2.920 − 16×10) ÷ 15 = 184 @ → R$ 53.360; R$/cab. 3.335', () => {
    expect(r.vendas).toHaveLength(1);
    linhaPerto(r.vendas[0]!, e.vendas[0]!);
    expect(r.vendas[0]!.kgLiquido.toString()).toBe('2760');
    expect(r.vendas[0]!.descontoKgCab.toString()).toBe('10');
    expect(r.vendas[0]!.kgDescontado.toString()).toBe('160');
  });
  it('RN-006: totais, quantidades e saldo (−89.475,83) batem com a planilha', () => {
    perto(r.totalCompras, e.totalCompras);
    perto(r.totalVendas, e.totalVendas);
    perto(r.saldo, e.saldo);
    perto(r.cabCompra, e.cabCompra);
    perto(r.cabVenda, e.cabVenda);
    perto(r.arrCompra, e.arrCompra);
    perto(r.arrVenda, e.arrVenda);
  });
  it('RN-025: compra não tem desconto (kgLiquido = kg, descontoKgCab = 0)', () => {
    r.compras.forEach((l) => {
      expect(l.kgLiquido.eq(l.kg)).toBe(true);
      expect(l.descontoKgCab.isZero()).toBe(true);
      expect(l.kgDescontado.isZero()).toBe(true);
    });
  });
  it('RNF-001: resultados são Decimal, sem arredondar (precisão 28)', () => {
    expect(r.saldo).toBeInstanceOf(Decimal);
    expect(r.compras[0]!.arrobas.toString()).toBe('377.0333333333333333333333333');
  });
});

describe('RN-002/RN-024/RN-025: ouro da venda com base vivo do protótipo (origem nao-planilha, à mão)', () => {
  // Lote: 16 cab., 2.920 kg, R$ 290/@. Compras do ouro: R$ 142.835,8333… (≈ 142835 + 5/6).
  const comprasOuro = golden.compraVenda.entrada.compras;
  const saldoDe = (venda: LoteInput) =>
    calcularCompraVenda({ compras: comprasOuro, vendas: [venda] });
  const lote: LoteInput = { modo: 'total', qtd: 16, peso: 2920, preco: 290 };

  it('RN-024/RN-025: base carcaça + 10 kg/cab = 2.760 kg ÷ 15 = 184 @ → R$ 53.360; saldo −89.475,8333…', () => {
    const r = saldoDe({ ...lote, base: 'carcaca' });
    expect(r.vendas[0]!.kgLiquido.toString()).toBe('2760');
    expect(r.vendas[0]!.arrobas.toString()).toBe('184');
    expect(r.totalVendas.toString()).toBe('53360');
    expect(r.saldo.toDecimalPlaces(4).toString()).toBe('-89475.8333');
  });
  it('RN-024/RN-025: vivo sem desconto = 2.920 ÷ 30 @ → R$ 28.226,6667…; saldo −114.609,1667…', () => {
    const r = saldoDe({ ...lote, aplicarDesconto: false });
    expect(r.vendas[0]!.descontoKgCab.isZero()).toBe(true);
    expect(r.vendas[0]!.kgDescontado.isZero()).toBe(true);
    expect(r.totalVendas.toDecimalPlaces(4).toString()).toBe('28226.6667');
    expect(r.saldo.toDecimalPlaces(4).toString()).toBe('-114609.1667');
  });
  it('RN-024/RN-025: vivo (padrão) + 10 kg/cab = 2.760 ÷ 30 = 92 @ → R$ 26.680; saldo −116.155,8333…', () => {
    const r = saldoDe(lote);
    expect(r.vendas[0]!.arrobas.toString()).toBe('92');
    expect(r.vendas[0]!.descontoKgCab.toString()).toBe('10');
    expect(r.totalVendas.toString()).toBe('26680');
    expect(r.saldo.toDecimalPlaces(4).toString()).toBe('-116155.8333');
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
    // vivo, 10 kg/cab: 630 − 3×10 = 600 kg ÷ 30 = 20 @ ; × 300 = 6000 ; ÷ 3 = 2000
    expect(v.arrobas.toString()).toBe('20');
    expect(v.total.toString()).toBe('6000');
    expect(v.porCab?.toString()).toBe('2000');
  });
  it('RN-003: individual sem pesos resulta em lote vazio', () => {
    const c = calcularCompra({ modo: 'individual', preco: 300 });
    expect(c.qtd.toString()).toBe('0');
    expect(c.total.toString()).toBe('0');
    expect(c.porCab).toBeNull();
  });
});

describe('RN-001/RN-003/RN-004: compra', () => {
  it('RN-003: modo médio multiplica qtd × peso médio e aceita strings decimais', () => {
    const c = calcularCompra({ modo: 'medio', qtd: '10', peso: '210', preco: '290' });
    expect(c.kg.toString()).toBe('2100');
    expect(c.arrobas.toString()).toBe('70');
    expect(c.total.toString()).toBe('20300');
    expect(c.porCab?.toString()).toBe('2030');
  });
  it('RN-004/RN-022: R$/cab. com qtd 0 é indefinido (null), não 0', () => {
    const c = calcularCompra({ modo: 'total', qtd: 0, peso: 300, preco: 300 });
    expect(c.porCab).toBeNull();
    expect(formatarBRL(c.porCab)).toBe('—');
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

describe('RN-002/RN-024/RN-025: venda', () => {
  it('RN-002: padrão = base vivo, desconto 10 kg/cab: 2.920 − 16×10 = 2.760 kg ÷ 30 = 92 @', () => {
    const v = calcularVenda({ modo: 'total', qtd: 16, peso: 2920, preco: 290 });
    expect(v.arrobas.toString()).toBe('92');
    expect(v.total.toString()).toBe('26680');
    expect(v.porCab?.toString()).toBe('1667.5');
  });
  it('RN-003: modo médio na venda (carcaça, sem desconto): 3.100 kg ÷ 15 = 206,67 @', () => {
    const v = calcularVenda({
      modo: 'medio',
      qtd: 10,
      peso: 310,
      preco: 300,
      base: 'carcaca',
      aplicarDesconto: false,
    });
    expect(v.kg.toString()).toBe('3100');
    expect(v.arrobas.toDecimalPlaces(4).toString()).toBe('206.6667');
  });
  it('RN-003: modo individual na venda (carcaça, 10 kg/cab): 630 − 3×10 = 600 kg ÷ 15 = 40 @', () => {
    const v = calcularVenda({
      modo: 'individual',
      pesos: [200, 210, 220],
      preco: 300,
      base: 'carcaca',
    });
    expect(v.qtd.toString()).toBe('3');
    expect(v.arrobas.toString()).toBe('40');
    expect(v.total.toString()).toBe('12000');
  });
  it('RN-025: só aplicarDesconto === false desliga; undefined mantém ligado', () => {
    const base: LoteInput = { modo: 'total', qtd: 1, peso: 300, preco: 100 };
    expect(calcularVenda({ ...base, aplicarDesconto: false }).kgLiquido.toString()).toBe('300');
    expect(calcularVenda({ ...base, aplicarDesconto: true }).kgLiquido.toString()).toBe('290');
    expect(calcularVenda(base).kgLiquido.toString()).toBe('290');
  });
  it('RN-025: desconto do lote (kg/cab.) difere do padrão; vazio/null/inválido usa o padrão', () => {
    const base: LoteInput = { modo: 'total', qtd: 1, peso: 300, preco: 100 };
    const v = calcularVenda({ ...base, desconto: '25' });
    expect(v.descontoKgCab.toString()).toBe('25');
    expect(v.kgLiquido.toString()).toBe('275');
    for (const d of ['', null, 'abc', undefined]) {
      expect(calcularVenda({ ...base, desconto: d }).descontoKgCab.toString()).toBe('10');
    }
    expect(calcularVenda({ ...base, desconto: 0 }).kgLiquido.toString()).toBe('300');
  });
  it('RN-025: o padrão vem de params.descontoVendaKgCab', () => {
    const r = calcularCompraVenda(
      { compras: [], vendas: [{ modo: 'total', qtd: 1, peso: 300, preco: 30 }] },
      { descontoVendaKgCab: '50' },
    );
    expect(r.vendas[0]!.kgLiquido.toString()).toBe('250');
    expect(r.totalVendas.toString()).toBe('250');
  });
  it('RN-004/RN-022: venda com qtd 0 tem R$/cab. indefinido (null)', () => {
    const v = calcularVenda({ modo: 'total', qtd: 0, peso: 300, preco: 100 });
    expect(v.porCab).toBeNull();
    expect(v.total.toString()).toBe('1000'); // qtd 0 → sem desconto: 300 kg ÷ 30 = 10 @ × R$ 100
  });
});

describe('RN-025: bordas do desconto em kg por cabeça', () => {
  it('RN-025: desconto 0 explícito não desconta nada (diferente de vazio, que usa o padrão)', () => {
    const v = calcularVenda({ modo: 'total', qtd: 5, peso: 300, preco: 100, desconto: 0 });
    expect(v.kgLiquido.toString()).toBe('300');
    expect(v.kgDescontado.toString()).toBe('0');
  });
  it('RN-025: kg líquido negativo é limitado a 0 (sem @ nem total negativos); kgDescontado = kg', () => {
    const v = calcularVenda({ modo: 'total', qtd: 10, peso: 50, preco: 300 }); // 50 − 10×10 < 0
    expect(v.kgLiquido.toString()).toBe('0');
    expect(v.arrobas.toString()).toBe('0');
    expect(v.total.toString()).toBe('0');
    expect(v.kgDescontado.toString()).toBe('50');
    expect(v.porCab?.toString()).toBe('0');
  });
  it('RN-025: desconto negativo informado é tratado como 0 (não soma kg)', () => {
    const v = calcularVenda({ modo: 'total', qtd: 2, peso: 300, preco: 100, desconto: -5 });
    expect(v.descontoKgCab.toString()).toBe('0');
    expect(v.kgLiquido.toString()).toBe('300');
  });
  it('RN-025: o desconto escala com a quantidade (modo médio): 3.100 − 10×10 = 3.000 kg ÷ 15 = 200 @', () => {
    const v = calcularVenda({ modo: 'medio', qtd: 10, peso: 310, preco: 300, base: 'carcaca' });
    expect(v.kgLiquido.toString()).toBe('3000');
    expect(v.arrobas.toString()).toBe('200');
  });
});

describe('RN-025: categoriaFeminina', () => {
  it.each(['Bezerra', 'NOVILHAS', 'vaca de descarte', 'Fêmea', 'femea', 'Matriz', 'garrota'])(
    'RN-025: %s é feminina',
    (c) => expect(categoriaFeminina(c)).toBe(true),
  );
  it.each(['Bezerro', 'Boi gordo', 'Garrote', 'Novilho', ''])('RN-025: %s não é feminina', (c) =>
    expect(categoriaFeminina(c)).toBe(false),
  );
});

describe('RN-027: o modo ativo é o único que entra no cálculo', () => {
  it('RN-027: valores dos outros modos no mesmo lote são ignorados', () => {
    const lote: LoteInput = { modo: 'medio', qtd: 10, peso: 200, pesos: [999, 999], preco: 30 };
    expect(calcularCompra(lote).kg.toString()).toBe('2000');
    expect(calcularCompra({ ...lote, modo: 'total' }).kg.toString()).toBe('200');
    expect(calcularCompra({ ...lote, modo: 'individual' }).kg.toString()).toBe('1998');
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
      { arrobaVivoKg: 20 },
    );
    expect(r.saldo.toString()).toBe('-300');
    expect(r.params.arrobaCarcacaKg.toString()).toBe('15');
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
    const r = calcularCompraVenda(entrada, { arrobaVivoKg: '', descontoVendaKgCab: 'abc' });
    expect(r.params.arrobaVivoKg.toString()).toBe('30');
    expect(r.params.descontoVendaKgCab.toString()).toBe('10');
    expect(r.totalCompras.toString()).toBe('3000');
  });
});
