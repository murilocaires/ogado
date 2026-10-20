import { describe, expect, it } from 'vitest';
import { normalizarCenarioSnapshot, recriaFormSchema, cenarioResultadoSchema } from './cenarios';
import { cenarioCreateSchema, cenarioListResponseSchema, loteListQuerySchema } from './dados';

const snapshot = {
  form: Object.fromEntries(Object.keys(recriaFormSchema.shape).map((key) => [key, '1'])),
  variantes: { lotacaoInicial: 'fixa80', faturamentoBruto: 'pesoVivo' },
  parametros: { arrobaVivoKg: '30', arrobaCarcacaKg: '15', uaKg: '450', lotacaoFixaHa: '80' },
  resultado: {
    ...Object.fromEntries(
      Object.keys(cenarioResultadoSchema.shape)
        .filter((key) => key !== 'custos')
        .map((key) => [key, null]),
    ),
    faturamentoLiquido: '-102408.0483317073170731707318',
    custos: ['supl', 'san', 'imp', 'frete', 'func'].map((id) => ({ id, nome: id, valor: '0' })),
  },
};

describe('RF-032/RN-023/RF-079: contrato versionado de cenário', () => {
  it('RF-032: legado completo migra sem arredondar o resultado nem ativar ceil', () => {
    const result = normalizarCenarioSnapshot(snapshot);
    expect(result?.variantes).toEqual({
      lotacaoInicial: 'fixa80',
      faturamentoBruto: 'pesoVivo',
      cabecasInteiras: false,
      schemaVersao: 1,
      calculoVersao: 'recria-1',
    });
    expect(result?.resultado.faturamentoLiquido).toBe('-102408.0483317073170731707318');
    expect(
      cenarioCreateSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        nome: 'A',
        criadoEm: '2026-10-18T00:00:00.000Z',
        entradas: snapshot.form,
        variantes: snapshot.variantes,
        parametros: snapshot.parametros,
        resultado: snapshot.resultado,
      }).success,
    ).toBe(true);
  });

  it('RF-079: recusa incompletos, versões futuras, decimais ilegíveis e custos duplicados', () => {
    expect(normalizarCenarioSnapshot({ ...snapshot, form: {} })).toBeNull();
    expect(
      normalizarCenarioSnapshot({
        ...snapshot,
        variantes: { ...snapshot.variantes, schemaVersao: 2 },
      }),
    ).toBeNull();
    for (const value of ['NaN', 'Infinity', '1e3', '1,5', 5]) {
      expect(
        normalizarCenarioSnapshot({
          ...snapshot,
          resultado: { ...snapshot.resultado, faturamentoLiquido: value },
        }),
      ).toBeNull();
    }
    expect(
      normalizarCenarioSnapshot({
        ...snapshot,
        resultado: {
          ...snapshot.resultado,
          custos: Array(5).fill({ id: 'supl', nome: 'Suplemento', valor: '0' }),
        },
      }),
    ).toBeNull();
  });

  it('RF-074: cursor exige o par completo e limita cada página a 200 itens', () => {
    expect(loteListQuerySchema.safeParse({ incremental: 'true', limit: '200' }).success).toBe(true);
    expect(loteListQuerySchema.safeParse({ incremental: 'true', limit: '201' }).success).toBe(
      false,
    );
    expect(
      loteListQuerySchema.safeParse({ cursorUpdatedAt: '2026-10-18T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('RF-079: leitura preserva o JSON histórico inválido para quarentena por item', () => {
    const dto = {
      id: '00000000-0000-4000-8000-000000000001',
      nome: 'Legado',
      criadoEm: '2026-10-18T00:00:00.000Z',
      version: 1,
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
      deletedAt: null,
      entradas: {},
      variantes: {},
      parametros: {},
      resultado: {},
    };
    const page = cenarioListResponseSchema.parse({ cenarios: [dto] });
    expect(page.cenarios[0]?.resultado).toEqual({});
    expect(
      normalizarCenarioSnapshot({
        form: dto.entradas,
        variantes: dto.variantes,
        parametros: dto.parametros,
        resultado: dto.resultado,
      }),
    ).toBeNull();
    expect(
      cenarioCreateSchema.safeParse({
        id: dto.id,
        nome: dto.nome,
        criadoEm: dto.criadoEm,
        entradas: dto.entradas,
        variantes: dto.variantes,
        parametros: dto.parametros,
        resultado: dto.resultado,
      }).success,
    ).toBe(false);
  });
});
