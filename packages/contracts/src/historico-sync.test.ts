import { describe, expect, it } from 'vitest';
import { historicoSyncCreateSchema } from './historico-sync';
const id = '00000000-0000-4000-8000-000000000001';
const base = {
  id,
  entidadeId: id,
  tipo: 'lote',
  motivo: 'mesclagem',
  local: { id, preco: '123.45' },
  servidor: { id },
  resultado: { id },
};
describe('historico de sincronizacao', () => {
  it('preserva strings decimais e identifica as tres versoes', () => {
    expect(historicoSyncCreateSchema.parse(base).local['preco']).toBe('123.45');
  });
  it('rejeita snapshots de registros diferentes', () => {
    expect(historicoSyncCreateSchema.safeParse({ ...base, local: { id: 'outro' } }).success).toBe(
      false,
    );
  });
});
