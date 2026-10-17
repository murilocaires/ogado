import { describe, expect, it } from 'vitest';
import { formatarBRL, formatarNumero, parseNumeroPtBr } from './pt-br';

const MENOS = '−'; // sinal tipográfico "−"

describe('RNF-007: parser pt-BR', () => {
  it('RNF-007: lê 1.234,56 como 1234.56', () => {
    expect(parseNumeroPtBr('1.234,56')?.toString()).toBe('1234.56');
  });
  it('RNF-007: lê moeda, espaços e percentual', () => {
    expect(parseNumeroPtBr(' R$ 1.234,50 ')?.toString()).toBe('1234.5');
    expect(parseNumeroPtBr('1,5%')?.toString()).toBe('1.5');
  });
  it('RNF-007: vírgula decimal simples e inteiros', () => {
    expect(parseNumeroPtBr('0,3')?.toString()).toBe('0.3');
    expect(parseNumeroPtBr('325')?.toString()).toBe('325');
  });
  // Decisão do humano: em campo de formulário só a VÍRGULA é decimal. O ponto só vale como milhar
  // com vírgula decimal (1.234,56) ou com 2+ grupos de 3 dígitos (1.234.567). Ponto único é ambíguo
  // (1.500 = 1500 ou 1,5?) e 1.5 / 0.25 também são tratados como inválidos: a UI pede a vírgula.
  it('RNF-007: ponto de milhar com vírgula decimal (1.234,56)', () => {
    expect(parseNumeroPtBr('1.234,56')?.toString()).toBe('1234.56');
  });
  it('RNF-007: dois ou mais grupos de milhar sem vírgula (1.234.567)', () => {
    expect(parseNumeroPtBr('1.234.567')?.toString()).toBe('1234567');
  });
  it('RNF-007: ponto único com 3 dígitos é ambíguo e retorna null (1.500, 10.000)', () => {
    expect(parseNumeroPtBr('1.500')).toBeNull();
    expect(parseNumeroPtBr('10.000')).toBeNull();
  });
  it('RNF-007: ponto único com 1-2 casas é rejeitado em formulário (1.5, 0.25, 12.5)', () => {
    expect(parseNumeroPtBr('1.5')).toBeNull();
    expect(parseNumeroPtBr('0.25')).toBeNull();
    expect(parseNumeroPtBr('12.5')).toBeNull();
  });
  it('RNF-007: vírgula decimal (1,5 e 0,5)', () => {
    expect(parseNumeroPtBr('1,5')?.toString()).toBe('1.5');
    expect(parseNumeroPtBr('0,5')?.toString()).toBe('0.5');
  });
  it("RNF-007: { ambiguoPonto: 'planilha' } reproduz o calc.js (colar da planilha)", () => {
    const o = { ambiguoPonto: 'planilha' } as const;
    expect(parseNumeroPtBr('1.500', o)?.toString()).toBe('1500');
    expect(parseNumeroPtBr('10.000', o)?.toString()).toBe('10000');
    expect(parseNumeroPtBr('1.234.567', o)?.toString()).toBe('1234567');
    expect(parseNumeroPtBr('1.5', o)?.toString()).toBe('1.5');
    expect(parseNumeroPtBr('0.25', o)?.toString()).toBe('0.25');
    expect(parseNumeroPtBr('12.5', o)?.toString()).toBe('12.5');
    expect(parseNumeroPtBr('1.234,56', o)?.toString()).toBe('1234.56');
    expect(parseNumeroPtBr('1.2.3', o)).toBeNull();
  });
  it('RNF-007: negativo com hífen ou sinal tipográfico', () => {
    expect(parseNumeroPtBr('-1.000,25')?.toString()).toBe('-1000.25');
    expect(parseNumeroPtBr(`${MENOS}10,5`)?.toString()).toBe('-10.5');
  });
  it('RNF-007: milhar mal posicionado antes da vírgula é inválido; ,5 vale 0,5', () => {
    expect(parseNumeroPtBr('1.2,5')).toBeNull();
    expect(parseNumeroPtBr(',5')?.toString()).toBe('0.5');
  });
  it('RNF-007: lixo e vazio retornam null; negativo preservado', () => {
    expect(parseNumeroPtBr('')).toBeNull();
    expect(parseNumeroPtBr('1a2')).toBeNull();
    expect(parseNumeroPtBr('--5')).toBeNull();
    expect(parseNumeroPtBr('-5')?.toString()).toBe('-5');
    expect(parseNumeroPtBr('-1.500')).toBeNull();
    expect(parseNumeroPtBr('-1.500,5')?.toString()).toBe('-1500.5');
  });
  it('RNF-007: aceita number finito', () => {
    expect(parseNumeroPtBr(12.5)?.toString()).toBe('12.5');
  });
  it('RNF-007: vazio, nulo e inválido retornam null', () => {
    const invalidos = ['', '   ', null, undefined, 'abc', '1,2,3', '1.2,3.4', 'R$', NaN, Infinity];
    for (const v of invalidos) {
      expect(parseNumeroPtBr(v)).toBeNull();
    }
  });
});

describe('RNF-007: formatação pt-BR', () => {
  it('RNF-007: BRL com 2 casas', () => {
    expect(formatarBRL('1234.5')).toBe('R$ 1.234,50');
    expect(formatarBRL(0)).toBe('R$ 0,00');
  });
  it('RNF-007: BRL negativo usa o sinal tipográfico', () => {
    expect(formatarBRL('-89475.83333333334')).toBe(`${MENOS}R$ 89.475,83`);
  });
  it('RNF-007: número com casas configuráveis (@ 2, kg 0)', () => {
    expect(formatarNumero('377.0333333', 2)).toBe('377,03');
    expect(formatarNumero('11311', 0)).toBe('11.311');
    expect(formatarNumero('1234.5')).toBe('1.234,50');
  });
  it('RNF-007: arredonda só na exibição (meio para cima)', () => {
    expect(formatarNumero('2.675', 2)).toBe('2,68');
  });
  it('RNF-007: zero negativo após arredondar não exibe sinal', () => {
    expect(formatarNumero('-0.001', 2)).toBe('0,00');
  });
  it('RNF-007: entrada inválida/vazia formata como traço', () => {
    expect(formatarBRL(null)).toBe('—');
    expect(formatarNumero(undefined)).toBe('—');
    expect(formatarNumero(NaN)).toBe('—');
    expect(formatarNumero('abc')).toBe('—');
  });
});
