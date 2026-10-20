import { expect, it } from 'vitest';
import { calcularRecriaEntidade } from './recria';
import { recriaFormVazio } from './repo/local-repo';
import type { RecriaEntity } from './repo/types';

const entrada: RecriaEntity = {
  id: 'simulacao',
  version: 1,
  updatedAt: '2026-10-20T00:00:00.000Z',
  deletedAt: null,
  // Rascunhos/cenários antigos podiam trazer o divisor de 80; a tela atual usa a área digitada.
  lotacaoInicial: 'fixa80',
  form: {
    ...recriaFormVazio(),
    area: '20',
    investimento: '100000',
    rsCabCompra: '1000',
    pesoIni: '450',
  },
};

it('RN-009 lotação da simulação é UA total dividida pela área informada, inclusive no legado fixa80', () => {
  const { resultado } = calcularRecriaEntidade(entrada);
  expect(resultado.lotacaoTotalUA?.toFixed()).toBe('100');
  expect(resultado.lotacaoHaInicial?.toFixed()).toBe('5');
  expect(resultado.variantes.lotacaoInicial).toBe('areaPastavel');
  const alterada = calcularRecriaEntidade({ ...entrada, form: { ...entrada.form, area: '50' } });
  expect(alterada.resultado.lotacaoHaInicial?.toFixed()).toBe('2');
});

it.each(['', '0'])('RN-009/RN-022 área %j mantém lotação por hectare indefinida', (area) => {
  const { resultado } = calcularRecriaEntidade({ ...entrada, form: { ...entrada.form, area } });
  expect(resultado.lotacaoTotalUA?.toFixed()).toBe('100');
  expect(resultado.lotacaoHaInicial).toBeNull();
});
