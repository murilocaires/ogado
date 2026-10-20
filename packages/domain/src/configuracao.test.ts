import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  calcularCompraVenda,
  PARAMETROS_COMPRA_VENDA,
  type CompraVendaInput,
} from './compra-venda';
import {
  CONFIGURACAO_PADRAO,
  PARAMETROS_FAZENDA_PADRAO,
  traduzirConfiguracao,
  type ConfiguracaoFazenda,
} from './configuracao';
import { calcularRecria, ENTRADA_PADRAO, PARAMETROS_PADRAO, VARIANTES_PADRAO } from './recria';

const golden = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/golden.json', import.meta.url), 'utf8'),
) as {
  compraVenda: { entrada: CompraVendaInput; esperado: { saldo: number } };
  recria: {
    entrada: Record<string, string | number>;
    esperado: { faturamentoLiquido: number; lotacaoHaInicial: number };
  };
};

const REL_TOL = 1e-6;
function perto(atual: Decimal | null, esperado: number): void {
  expect(atual).not.toBeNull();
  const diff = (atual as Decimal).minus(esperado).abs().toNumber();
  expect(diff).toBeLessThanOrEqual(REL_TOL * Math.abs(esperado));
}

const entradaOuro = {
  area: golden.recria.entrada['area'],
  dias: golden.recria.entrada['dias'],
  investimento: golden.recria.entrada['investimento'],
  rsCabCompra: golden.recria.entrada['rsCabCompra'],
  pesoIni: golden.recria.entrada['pesoIni'],
  pesoFin: golden.recria.entrada['pesoFin'],
  precoVenda: golden.recria.entrada['precoVenda'],
  consumoPct: golden.recria.entrada['consumoPct'],
  precoSuplKg: golden.recria.entrada['precoSuplKg'],
  rendCarcaca: golden.recria.entrada['rendCarcaca'],
  imposto: golden.recria.entrada['imposto'],
  sanidadeCabMes: golden.recria.entrada['sanidadeCabMes'],
  funcionario: golden.recria.entrada['funcionario'],
  frete: golden.recria.entrada['frete'],
};

function comParametros(parcial: Partial<ConfiguracaoFazenda['parametros']>): ConfiguracaoFazenda {
  return {
    parametros: { ...CONFIGURACAO_PADRAO.parametros, ...parcial },
    variantes: CONFIGURACAO_PADRAO.variantes,
  };
}

describe('configuração padrão da fazenda (RN-021, RN-023)', () => {
  it('RN-021: os 9 parâmetros padrão vêm dos padrões que já existem no domínio (sem números repetidos)', () => {
    expect(PARAMETROS_FAZENDA_PADRAO).toEqual({
      arrobaVivoKg: PARAMETROS_PADRAO.arrobaVivoKg,
      arrobaCarcacaKg: PARAMETROS_PADRAO.arrobaCarcacaKg,
      descontoVendaKgCab: PARAMETROS_COMPRA_VENDA.descontoVendaKgCab.toString(),
      uaKg: PARAMETROS_PADRAO.uaKg,
      rendCarcaca: ENTRADA_PADRAO.rendCarcaca,
      imposto: ENTRADA_PADRAO.imposto,
      consumoPct: ENTRADA_PADRAO.consumoPct,
      precoSuplKg: ENTRADA_PADRAO.precoSuplKg,
      sanidadeCabMes: ENTRADA_PADRAO.sanidadeCabMes,
    });
    expect(Object.keys(PARAMETROS_FAZENDA_PADRAO)).toHaveLength(9);
  });

  it('RN-020: a @ da compra é a da recria e a @ da venda é a de carcaça (um campo por valor)', () => {
    expect(PARAMETROS_FAZENDA_PADRAO.arrobaVivoKg).toBe(
      PARAMETROS_COMPRA_VENDA.arrobaVivoKg.toString(),
    );
    expect(PARAMETROS_FAZENDA_PADRAO.arrobaCarcacaKg).toBe(
      PARAMETROS_COMPRA_VENDA.arrobaCarcacaKg.toString(),
    );
  });

  it('RN-023: as variantes padrão são as da planilha', () => {
    expect(CONFIGURACAO_PADRAO.variantes).toEqual(VARIANTES_PADRAO);
  });
});

describe('tradução da configuração em argumentos de cálculo (RN-023, RN-009, RN-017)', () => {
  it('CA-18: com a configuração padrão, recria e compra e venda batem com o ouro', () => {
    const t = traduzirConfiguracao(CONFIGURACAO_PADRAO);

    const recria = calcularRecria(entradaOuro, t.variantes, t.parametrosRecria);
    perto(recria.faturamentoLiquido, golden.recria.esperado.faturamentoLiquido);
    expect(recria.faturamentoLiquido?.toNumber()).toBeCloseTo(102408.0529717073, 6);
    perto(recria.lotacaoHaInicial, golden.recria.esperado.lotacaoHaInicial);

    // Venda da planilha = base carcaça + 10 kg/cab (ADR-0013): saldo −89.475,8333… do ouro.
    const entrada = {
      ...golden.compraVenda.entrada,
      vendas: golden.compraVenda.entrada.vendas.map((v) => ({ ...v, base: 'carcaca' as const })),
    };
    const cv = calcularCompraVenda(entrada, t.parametrosCompraVenda);
    expect(cv.totalCompras.toNumber()).toBeCloseTo(142835.8333333, 4);
    expect(cv.saldo.toNumber()).toBeCloseTo(-89475.8333333, 4);
  });

  it('RN-021: as entradas iniciais do simulador vêm dos 5 parâmetros de valor inicial', () => {
    const config = comParametros({
      rendCarcaca: '0.5',
      imposto: '0.02',
      consumoPct: '0.004',
      precoSuplKg: '2.5',
      sanidadeCabMes: '3',
    });
    expect(traduzirConfiguracao(config).entradaInicialRecria).toEqual({
      rendCarcaca: '0.5',
      imposto: '0.02',
      consumoPct: '0.004',
      precoSuplKg: '2.5',
      sanidadeCabMes: '3',
    });
  });

  it('RN-020: arrobaVivoKg alimenta a compra e a @ do peso vivo da recria; o divisor fixo de 80 ha não é parâmetro da fazenda', () => {
    const t = traduzirConfiguracao(comParametros({ arrobaVivoKg: '32' }));
    expect(t.parametrosCompraVenda.arrobaVivoKg?.toString()).toBe('32');
    expect(t.parametrosRecria.arrobaVivoKg?.toString()).toBe('32');
    expect(t.parametrosRecria).not.toHaveProperty('lotacaoFixaHa');
  });

  it('CA-19: arrobaCarcacaKg = 16 faz a venda do ouro (base carcaça, 10 kg/cab) dar 2.760 ÷ 16 = 172,5 @ e alimenta a @ de carcaça (origem: nao-planilha)', () => {
    const t = traduzirConfiguracao(comParametros({ arrobaCarcacaKg: '16' }));

    const venda = { ...golden.compraVenda.entrada.vendas[0]!, base: 'carcaca' as const };
    const cv = calcularCompraVenda(
      { ...golden.compraVenda.entrada, vendas: [venda] },
      t.parametrosCompraVenda,
    );
    expect(cv.vendas[0]?.arrobas.toString()).toBe('172.5');

    const recria = calcularRecria(entradaOuro, t.variantes, t.parametrosRecria);
    // 420 kg x 0,52 ÷ 16 = 13,65 @ por cabeça
    expect(recria.arrobasCarcacaCab?.toString()).toBe('13.65');
  });

  it('RN-009/RN-017: as variantes da configuração chegam ao cálculo e voltam no snapshot', () => {
    const config: ConfiguracaoFazenda = {
      parametros: CONFIGURACAO_PADRAO.parametros,
      variantes: { lotacaoInicial: 'areaPastavel', faturamentoBruto: 'carcaca' },
    };
    const t = traduzirConfiguracao(config);
    const recria = calcularRecria(entradaOuro, t.variantes, t.parametrosRecria);
    expect(recria.variantes).toEqual({ ...config.variantes, cabecasInteiras: false });
  });

  it('CA-20: X, depois Y, depois X de novo dá o mesmo resultado; cada resultado devolve os parâmetros usados; nada de estado global', () => {
    const x = CONFIGURACAO_PADRAO;
    const y: ConfiguracaoFazenda = {
      parametros: { ...x.parametros, uaKg: '500', arrobaCarcacaKg: '16', rendCarcaca: '0.5' },
      variantes: { lotacaoInicial: 'areaPastavel', faturamentoBruto: 'carcaca' },
    };
    const rodar = (c: ConfiguracaoFazenda) => {
      const t = traduzirConfiguracao(c);
      return {
        recria: calcularRecria(entradaOuro, t.variantes, t.parametrosRecria),
        cv: calcularCompraVenda(golden.compraVenda.entrada, t.parametrosCompraVenda),
      };
    };

    const primeiro = rodar(x);
    const segundo = rodar(y);
    const terceiro = rodar(x);

    expect(terceiro.recria.faturamentoLiquido?.toString()).toBe(
      primeiro.recria.faturamentoLiquido?.toString(),
    );
    expect(terceiro.recria.lotacaoHaInicial?.toString()).toBe(
      primeiro.recria.lotacaoHaInicial?.toString(),
    );
    expect(terceiro.cv.saldo.toString()).toBe(primeiro.cv.saldo.toString());
    expect(segundo.recria.faturamentoLiquido?.toString()).not.toBe(
      primeiro.recria.faturamentoLiquido?.toString(),
    );

    // snapshot (T-08): variantes e parâmetros efetivamente usados
    expect(segundo.recria.variantes).toEqual({ ...y.variantes, cabecasInteiras: false });
    expect(segundo.recria.parametros.uaKg.toString()).toBe('500');
    expect(segundo.recria.parametros.arrobaCarcacaKg.toString()).toBe('16');
    expect(segundo.cv.params.arrobaCarcacaKg.toString()).toBe('16');
    expect(primeiro.recria.parametros.uaKg.toString()).toBe('450');
  });

  it('a tradução não altera a configuração recebida nem o padrão exportado', () => {
    const antes = JSON.stringify(CONFIGURACAO_PADRAO);
    traduzirConfiguracao(comParametros({ uaKg: '500' }));
    expect(JSON.stringify(CONFIGURACAO_PADRAO)).toBe(antes);
  });
});
