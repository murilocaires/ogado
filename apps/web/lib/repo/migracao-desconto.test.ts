import { describe, expect, it } from 'vitest';
import { criarStorageMemoria } from '../../components/test-utils';
import {
  criarRepoLocal,
  migrarLoteDescontoKg,
  STORAGE_KEY,
  STORAGE_KEY_E1,
} from './local-repo';
import type { RecriaEntity } from './types';
import { recriaFormPlanilha } from './planilha.test-support';

const recria: RecriaEntity = {
  id: 'r-1',
  version: 1,
  updatedAt: '2026-10-01T10:00:00.000Z',
  deletedAt: null,
  form: recriaFormPlanilha(),
  lotacaoInicial: 'fixa80',
};

const lote = (extra: Record<string, unknown>) => ({
  version: 1,
  updatedAt: '2026-10-01T10:00:00.000Z',
  deletedAt: null,
  numero: 1,
  categoria: 'NOVILHAS',
  data: '2026-10-01',
  modo: 'total',
  qtd: '16',
  peso: '2920',
  pesos: [],
  preco: '290',
  ...extra,
});

describe('ADR-0013 migração do desconto da venda (descontoPct -> descontoKg)', () => {
  it('venda com desconto ligado (qualquer %) vira 10 kg/cab. e perde descontoPct', () => {
    const storage = criarStorageMemoria({
      [STORAGE_KEY]: JSON.stringify({
        schema: 2,
        lotes: [
          lote({ id: 'v-10', tipo: 'venda', aplicarDesconto: true, descontoPct: '10' }),
          lote({ id: 'v-25', tipo: 'venda', aplicarDesconto: true, descontoPct: '25,5' }),
          lote({ id: 'v-off', tipo: 'venda', aplicarDesconto: false, descontoPct: '10' }),
          lote({ id: 'c-1', tipo: 'compra' }),
        ],
        recria,
        cenarios: [],
      }),
    });
    const repo = criarRepoLocal({ storage: () => storage });
    const snap = repo.getSnapshot();
    if (snap.status !== 'pronto') throw new Error('repo não carregou');
    const por = (id: string) => snap.lotes.find((l) => l.id === id)!;
    expect(por('v-10')).toMatchObject({ aplicarDesconto: true, descontoKg: '10' });
    expect(por('v-25')).toMatchObject({ aplicarDesconto: true, descontoKg: '10' });
    expect(por('v-off')).toMatchObject({ aplicarDesconto: false, descontoKg: '' });
    expect(por('c-1')).not.toHaveProperty('descontoKg');
    for (const l of snap.lotes) expect(l).not.toHaveProperty('descontoPct');

    // a próxima gravação já sai no esquema 3, sem o campo antigo
    repo.excluirLote('c-1');
    const gravado = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      schema: number;
      lotes: object[];
    };
    expect(gravado.schema).toBe(3);
    expect(JSON.stringify(gravado.lotes)).not.toContain('descontoPct');
  });

  it('também converte lotes do esquema 1 (chave da E1)', () => {
    const storage = criarStorageMemoria({
      [STORAGE_KEY_E1]: JSON.stringify({
        schema: 1,
        lotes: [lote({ id: 'v-e1', tipo: 'venda', aplicarDesconto: true, descontoPct: '10' })],
        recria,
      }),
    });
    const snap = criarRepoLocal({ storage: () => storage }).getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes[0]).toMatchObject({ descontoKg: '10' });
  });

  it('não mexe em lote sem descontoPct nem em lixo', () => {
    const novo = lote({ id: 'n', tipo: 'venda', aplicarDesconto: true, descontoKg: '12' });
    expect(migrarLoteDescontoKg(novo)).toBe(novo);
    expect(migrarLoteDescontoKg(42)).toBe(42);
    expect(migrarLoteDescontoKg(null)).toBeNull();
  });
});
