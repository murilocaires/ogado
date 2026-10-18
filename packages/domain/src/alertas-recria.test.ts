import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { alertasRecria } from './alertas-recria';

const r = (cabecas: Decimal.Value | null, ini: Decimal.Value | null, fin: Decimal.Value | null) => ({
  cabecas: cabecas === null ? null : new Decimal(cabecas),
  lotacaoHaInicial: ini === null ? null : new Decimal(ini),
  lotacaoFinal: fin === null ? null : new Decimal(fin),
});
const codigos = (x: ReturnType<typeof r>) => alertasRecria(x).map((a) => a.codigo);

describe('RN-026: alertas da recria (não bloqueantes)', () => {
  it('RN-026: sem alertas dentro dos limites (cabeças inteiras, 4, 6 e 250 exatos)', () => {
    expect(codigos(r(250, 4, 6))).toEqual([]);
  });
  it('RN-026: cabeças fracionadas > 0,0001 trazem exato e arredondado', () => {
    const a = alertasRecria(r('59.76', 1, 1));
    expect(a).toHaveLength(1);
    const f = a[0]!;
    expect(f.codigo).toBe('cabecas_fracionadas');
    if (f.codigo === 'cabecas_fracionadas') {
      expect(f.cabecas.toString()).toBe('59.76');
      expect(f.cabecasArredondadas.toString()).toBe('60');
    }
  });
  it('RN-026: fração de exatamente 0,0001 não alerta; acima alerta', () => {
    expect(codigos(r('60.0001', 1, 1))).toEqual([]);
    expect(codigos(r('60.00011', 1, 1))).toEqual(['cabecas_fracionadas']);
  });
  it('RN-026: lotação inicial > 4 e final > 6', () => {
    expect(codigos(r(10, '4.01', 1))).toEqual(['lotacao_entrada_alta']);
    expect(codigos(r(10, 1, '6.01'))).toEqual(['lotacao_saida_alta']);
  });
  it('RN-026: mais de 250 cabeças traz o valor e o limite', () => {
    const a = alertasRecria(r(251, 1, 1));
    expect(a).toEqual([{ codigo: 'muitas_cabecas', cabecas: new Decimal(251), limite: 250 }]);
  });
  it('RN-026/RN-022: valores indefinidos não geram alerta nem lançam', () => {
    expect(alertasRecria(r(null, null, null))).toEqual([]);
  });
});
