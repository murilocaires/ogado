import { describe, expect, it, vi } from 'vitest';
import { cotaQuaseCheia, pedirPersistencia, verificarCota } from './armazenamento';

describe('cota do armazenamento (RNF-015)', () => {
  it('avisa só acima de 80%', () => {
    expect(cotaQuaseCheia({ usage: 79, quota: 100 })).toBeNull();
    expect(cotaQuaseCheia({ usage: 80, quota: 100 })).toBeNull();
    expect(cotaQuaseCheia({ usage: 81, quota: 100 })).toBeCloseTo(0.81);
    expect(cotaQuaseCheia({ usage: 100, quota: 100 })).toBe(1);
  });

  it('sem dados confiáveis, não avisa', () => {
    expect(cotaQuaseCheia(null)).toBeNull();
    expect(cotaQuaseCheia({})).toBeNull();
    expect(cotaQuaseCheia({ usage: 5, quota: 0 })).toBeNull();
  });

  it('verificarCota usa navigator.storage.estimate', async () => {
    expect(await verificarCota({ estimate: async () => ({ usage: 90, quota: 100 }) })).toBeCloseTo(
      0.9,
    );
    expect(await verificarCota({ estimate: async () => ({ usage: 10, quota: 100 }) })).toBeNull();
    expect(
      await verificarCota({
        estimate: async () => {
          throw new Error('x');
        },
      }),
    ).toBeNull();
    expect(await verificarCota(null)).toBeNull();
  });

  it('pedirPersistencia chama persist() se ainda não for persistente', async () => {
    const persist = vi.fn(async () => true);
    expect(await pedirPersistencia({ persist, persisted: async () => false })).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('pedirPersistencia não repete o pedido se já for persistente e tolera falhas', async () => {
    const persist = vi.fn(async () => true);
    expect(await pedirPersistencia({ persist, persisted: async () => true })).toBe(true);
    expect(persist).not.toHaveBeenCalled();
    expect(
      await pedirPersistencia({
        persist: async () => {
          throw new Error('x');
        },
        persisted: async () => false,
      }),
    ).toBe(false);
    expect(await pedirPersistencia(null)).toBe(false);
  });
});
