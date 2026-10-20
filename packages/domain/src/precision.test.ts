import DecimalBase from 'decimal.js';
import { afterEach, expect, it } from 'vitest';
import { calcularCompra } from './compra-venda';
import { parseNumeroPtBr } from './pt-br';

const precision = DecimalBase.precision;
afterEach(() => DecimalBase.set({ precision }));

it('RNF-017/RN-001: consumidor externo não reduz a precisão de Compra e Venda', () => {
  DecimalBase.set({ precision: 5 });
  expect(
    calcularCompra({ modo: 'total', qtd: '1', peso: '100', preco: '1' }).arrobas.toFixed(),
  ).toBe('3.333333333333333333333333333');
});

it('RNF-017/RNF-007: parser mantém precisão independente para percentuais', () => {
  DecimalBase.set({ precision: 5 });
  expect(parseNumeroPtBr('12,3456789')?.div(100).toFixed()).toBe('0.123456789');
});
