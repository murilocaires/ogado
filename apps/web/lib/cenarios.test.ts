import { describe, expect, it } from 'vitest';
import { idsMelhores, snapshotDaRecria } from './cenarios';
import { calcularRecriaEntidade } from './recria';
import { recriaFormPlanilha } from './repo/planilha.test-support';
import type { CenarioEntity, RecriaEntity } from './repo/types';

const recria: RecriaEntity = {
  id: 'r',
  version: 1,
  updatedAt: '2026-10-18T10:00:00.000Z',
  deletedAt: null,
  form: recriaFormPlanilha(),
  lotacaoInicial: 'fixa80',
};

describe('RF-032/RN-023: snapshot e replay', () => {
  it('RF-032: captura explicitamente a variante atual da UI sem alterar ceil', () => {
    const salvo = snapshotDaRecria(recria, 'Atual')!;
    expect(salvo.variantes).toMatchObject({
      schemaVersao: 1,
      calculoVersao: 'recria-2',
      cabecasInteiras: true,
    });
    expect(salvo.resultado.cabecas).toBe('60');
    expect(salvo.resultado.faturamentoLiquido).toBe('103307.6');
  });

  it('RF-035/RN-023: reabre legado fracionário com os parâmetros e variante salvos', () => {
    const reaberta: RecriaEntity = {
      ...recria,
      variantes: {
        lotacaoInicial: 'fixa80',
        faturamentoBruto: 'pesoVivo',
        cabecasInteiras: false,
        calculoVersao: 'recria-1',
        schemaVersao: 1,
      },
      parametros: { arrobaVivoKg: '30', arrobaCarcacaKg: '15', uaKg: '500', lotacaoFixaHa: '80' },
    };
    const { resultado } = calcularRecriaEntidade(reaberta);
    expect(resultado.cabecas?.toFixed()).toBe('59.77307317073170731707317073');
    expect(resultado.parametros.uaKg.toFixed()).toBe('500');
    expect(resultado.faturamentoLiquido?.toFixed(2)).toBe('102408.05');
  });

  it('RF-036: melhor líquido inclui empates e exige dois cenários', () => {
    const salvo = snapshotDaRecria(recria, 'A')!;
    const c = {
      ...salvo,
      id: 'a',
      version: 1,
      updatedAt: recria.updatedAt,
      deletedAt: null,
      criadoEm: recria.updatedAt,
    } satisfies CenarioEntity;
    expect(idsMelhores([c])).toEqual(new Set());
    expect(
      idsMelhores([
        c,
        { ...c, id: 'b' },
        {
          ...c,
          id: 'c',
          resultado: { ...c.resultado, faturamentoLiquido: '-1' },
        },
      ]),
    ).toEqual(new Set(['a', 'b']));
  });
});
