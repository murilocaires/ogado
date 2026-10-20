import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import golden from '../../../tests/fixtures/golden.json';
import variantes from '../../../tests/fixtures/variantes.json';
import {
  calcularRecria,
  PARAMETROS_PADRAO,
  VARIANTES_PADRAO,
  type EntradaRecria,
  type ResultadoRecria,
  type VariantesRecria,
} from './recria';

const REL_TOL = 1e-6;
const ge = golden.recria.entrada;
const gx = golden.recria.esperado;

// Entrada do ouro; `areaLotacaoInicial` do ouro ('fixa80') vira a variante padrao (VARIANTES_PADRAO).
const entradaOuro: EntradaRecria = {
  area: ge.area,
  dias: ge.dias,
  investimento: ge.investimento,
  rsCabCompra: ge.rsCabCompra,
  pesoIni: ge.pesoIni,
  pesoFin: ge.pesoFin,
  precoVenda: ge.precoVenda,
  consumoPct: ge.consumoPct,
  precoSuplKg: ge.precoSuplKg,
  rendCarcaca: ge.rendCarcaca,
  imposto: ge.imposto,
  sanidadeCabMes: ge.sanidadeCabMes,
  funcionario: ge.funcionario,
  frete: ge.frete,
};

function perto(atual: Decimal | null, esperado: number): void {
  expect(atual).not.toBeNull();
  const a = (atual as Decimal).toNumber();
  expect(Math.abs(a - esperado)).toBeLessThanOrEqual(REL_TOL * Math.abs(esperado));
}

const camposEscalares = [
  'cabecas',
  'lotacaoTotalUA',
  'lotacaoHaInicial',
  'pesoMedio',
  'lotacaoFinal',
  'arrobasProduzidas',
  'consumoKgDia',
  'suplCabDia',
  'suplDia',
  'suplTotal',
  'arrobasCarcacaCab',
  'vendaCab',
  'impostoCab',
  'impostoTotal',
  'sanidadeTotal',
  'custoTotal',
  'faturamentoBruto',
  'faturamentoLiquido',
  'totalEmCaixa',
  'liquidoMes',
  'liquidoHa',
  'gmdImplicito',
] as const satisfies readonly (keyof ResultadoRecria & keyof typeof gx)[];

const RN_DO_CAMPO: Record<string, string> = {
  cabecas: 'RN-007',
  lotacaoTotalUA: 'RN-008',
  lotacaoHaInicial: 'RN-009',
  pesoMedio: 'RN-010',
  lotacaoFinal: 'RN-010',
  arrobasProduzidas: 'RN-011',
  consumoKgDia: 'RN-012',
  suplCabDia: 'RN-012',
  suplDia: 'RN-012',
  suplTotal: 'RN-012',
  arrobasCarcacaCab: 'RN-013',
  vendaCab: 'RN-013',
  impostoCab: 'RN-014',
  impostoTotal: 'RN-014',
  sanidadeTotal: 'RN-015',
  custoTotal: 'RN-016',
  faturamentoBruto: 'RN-017',
  faturamentoLiquido: 'RN-017',
  totalEmCaixa: 'RN-017',
  liquidoMes: 'RN-018',
  liquidoHa: 'RN-018',
  gmdImplicito: 'RN-019',
};

describe('recria: variantes padrao = ouro (RN-007..RN-019)', () => {
  const r = calcularRecria(entradaOuro);

  for (const campo of camposEscalares) {
    it(`${RN_DO_CAMPO[campo] ?? 'RN-007'}: ${campo} confere com o ouro`, () => {
      perto(r[campo], gx[campo]);
    });
  }

  it('RN-016: lista de custos na ordem da planilha e valores do ouro', () => {
    expect(r.custos.map((c) => c.id)).toEqual(gx.custos.map((c) => c.id));
    r.custos.forEach((c, i) => perto(c.valor, (gx.custos[i] as { valor: number }).valor));
  });

  it('RN-017: bruto 271.967,48 e liquido 102.408,05 (valores citados no ticket)', () => {
    expect((r.faturamentoBruto as Decimal).toFixed(2)).toBe('271967.48');
    expect((r.faturamentoLiquido as Decimal).toFixed(2)).toBe('102408.05');
  });

  it('RN-023: devolve a variante usada (padrao fixa80 + pesoVivo)', () => {
    expect(r.variantes).toEqual({
      lotacaoInicial: 'fixa80',
      faturamentoBruto: 'pesoVivo',
      cabecasInteiras: false,
    });
    expect(VARIANTES_PADRAO).toEqual(r.variantes);
  });

  it('RN-007: cabecas fracionarias sao exatas (sem arredondar)', () => {
    expect((r.cabecas as Decimal).decimalPlaces()).toBeGreaterThan(10);
  });

  it('RN-021: parametros padrao da planilha', () => {
    expect(PARAMETROS_PADRAO).toEqual({
      arrobaVivoKg: '30',
      arrobaCarcacaKg: '15',
      uaKg: '450',
      lotacaoFixaHa: '80',
    });
  });

  it('RN-021: parametro editavel altera o calculo (UA de 500 kg)', () => {
    const r2 = calcularRecria(entradaOuro, VARIANTES_PADRAO, { uaKg: 500 });
    perto(r2.lotacaoTotalUA, (gx.cabecas * 188) / 500);
    expect(r2.parametros.uaKg.toString()).toBe('500');
  });

  it('RN-020: valores duplicados da planilha sao um so campo (funcionario entra 1x no custo)', () => {
    const r2 = calcularRecria({ ...entradaOuro, funcionario: 10000 });
    perto(r2.custoTotal, gx.custoTotal + 1000);
    expect(r2.custos.find((c) => c.id === 'func')?.valor?.toString()).toBe('10000');
  });
});

describe('recria: variantes nao padrao (ADR-0008) - NAO planilha, PRECISA DE REVISAO HUMANA', () => {
  const entrada: EntradaRecria = variantes.entrada;
  const casos: [string, VariantesRecria, Record<string, string>][] = [
    [
      'areaPastavel',
      variantes.casos.areaPastavel.variantes as VariantesRecria,
      variantes.casos.areaPastavel.esperado,
    ],
    [
      'carcaca',
      variantes.casos.carcaca.variantes as VariantesRecria,
      variantes.casos.carcaca.esperado,
    ],
    ['ambas', variantes.casos.ambas.variantes as VariantesRecria, variantes.casos.ambas.esperado],
    ['padrao (mesma entrada)', VARIANTES_PADRAO, variantes.padraoComMesmaEntrada.esperado],
  ];

  it('fixture declara origem nao-planilha', () => {
    expect(variantes.origem).toBe('nao-planilha');
    for (const c of Object.values(variantes.casos)) expect(c.origem).toBe('nao-planilha');
  });

  for (const [nome, v, esperado] of casos) {
    it(`RN-023: ${nome} confere com a conta a mao (tests/fixtures/variantes.json)`, () => {
      const r = calcularRecria(entrada, v);
      expect(r.variantes).toEqual({ ...v, cabecasInteiras: v.cabecasInteiras ?? false });
      for (const [campo, valor] of Object.entries(esperado)) {
        const atual = r[campo as keyof ResultadoRecria] as Decimal | null;
        expect(atual?.toString(), campo).toBe(valor);
      }
    });
  }

  it('RN-009: areaPastavel so muda a lotacao inicial; resultado fica igual (ADR-0004)', () => {
    const a = calcularRecria(entradaOuro, {
      lotacaoInicial: 'fixa80',
      faturamentoBruto: 'pesoVivo',
    });
    const b = calcularRecria(entradaOuro, {
      lotacaoInicial: 'areaPastavel',
      faturamentoBruto: 'pesoVivo',
    });
    expect(b.faturamentoLiquido?.toString()).toBe(a.faturamentoLiquido?.toString());
    expect(b.lotacaoHaInicial?.toString()).not.toBe(a.lotacaoHaInicial?.toString());
  });

  it('RN-017: carcaca usa @ de carcaca/cab (RN-013) x cab x R$/@ e nao altera custos', () => {
    const r = calcularRecria(entradaOuro, {
      lotacaoInicial: 'fixa80',
      faturamentoBruto: 'carcaca',
    });
    const esperado = new Decimal(gx.arrobasCarcacaCab).times(gx.cabecas).times(ge.precoVenda);
    perto(r.faturamentoBruto, esperado.toNumber());
    perto(r.custoTotal, gx.custoTotal);
  });

  it('RN-023: sem estado global (chamadas alternadas nao se contaminam)', () => {
    const c = calcularRecria(entrada, { lotacaoInicial: 'fixa80', faturamentoBruto: 'carcaca' });
    const p = calcularRecria(entrada);
    expect(c.faturamentoBruto?.toString()).toBe('234000');
    expect(p.faturamentoBruto?.toString()).toBe('225000');
  });
});

describe('recria: indefinido sem excecao (RN-022)', () => {
  it('RN-022: divisao por zero (R$/cab = 0) devolve null e nao lanca', () => {
    const r = calcularRecria({ ...entradaOuro, rsCabCompra: 0 });
    expect(r.cabecas).toBeNull();
    expect(r.faturamentoLiquido).toBeNull();
    expect(r.custoTotal).toBeNull();
    expect(r.pesoMedio?.toString()).toBe('304');
  });

  it('RN-022: area zero deixa so as razoes por ha indefinidas', () => {
    const r = calcularRecria({ ...entradaOuro, area: 0 });
    expect(r.liquidoHa).toBeNull();
    expect(r.lotacaoFinal).toBeNull();
    expect(r.lotacaoHaInicial).not.toBeNull();
    expect(r.faturamentoLiquido).not.toBeNull();
  });

  it('RN-022: area zero com areaPastavel deixa a lotacao inicial indefinida', () => {
    const r = calcularRecria(
      { ...entradaOuro, area: 0 },
      { lotacaoInicial: 'areaPastavel', faturamentoBruto: 'pesoVivo' },
    );
    expect(r.lotacaoHaInicial).toBeNull();
  });

  it('RN-022: dias zero indefine liquido/mes e GMD, mas nao o resto', () => {
    const r = calcularRecria({ ...entradaOuro, dias: 0 });
    expect(r.liquidoMes).toBeNull();
    expect(r.gmdImplicito).toBeNull();
    expect(r.suplTotal?.toString()).toBe('0');
  });

  it('RN-022: campo vazio (null, undefined, "", texto invalido, NaN) propaga indefinido', () => {
    for (const vazio of [null, undefined, '', '  ', 'abc', Number.NaN]) {
      const r = calcularRecria({ ...entradaOuro, pesoFin: vazio });
      expect(r.pesoMedio).toBeNull();
      expect(r.arrobasProduzidas).toBeNull();
      expect(r.faturamentoLiquido).toBeNull();
      expect(r.cabecas).not.toBeNull();
    }
  });

  it('RN-022: entrada totalmente vazia nao lanca', () => {
    const r = calcularRecria({});
    expect(r.cabecas).toBeNull();
    expect(r.custos.every((c) => c.valor === null)).toBe(true);
    expect(r.variantes).toEqual(VARIANTES_PADRAO);
  });

  it('RN-022: carcaca com rendimento vazio indefine o bruto; pesoVivo nao depende dele', () => {
    const entrada = { ...entradaOuro, rendCarcaca: null };
    const c = calcularRecria(entrada, { lotacaoInicial: 'fixa80', faturamentoBruto: 'carcaca' });
    const p = calcularRecria(entrada);
    expect(c.faturamentoBruto).toBeNull();
    expect(p.faturamentoBruto).not.toBeNull();
    expect(p.faturamentoLiquido).toBeNull(); // rendimento tambem entra no imposto -> custo -> liquido
  });

  it('RN-022: parametro invalido ou zero em divisor nao lanca', () => {
    const r = calcularRecria(entradaOuro, VARIANTES_PADRAO, { uaKg: 0, arrobaVivoKg: '' });
    expect(r.lotacaoTotalUA).toBeNull();
    expect(r.arrobasProduzidas).not.toBeNull(); // parametro vazio cai no padrao (30)
    expect(r.parametros.arrobaVivoKg.toString()).toBe('30');
  });

  it('RN-022: aceita Decimal e string na entrada', () => {
    const r = calcularRecria({
      ...entradaOuro,
      investimento: new Decimal('122534.8'),
      dias: '270',
    });
    perto(r.faturamentoLiquido, gx.faturamentoLiquido);
  });
});
