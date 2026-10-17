import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHealth } from './health';

afterEach(() => vi.unstubAllGlobals());

describe('fetchHealth', () => {
  it('valida a resposta com o schema compartilhado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', db: 'ok' }))),
    );
    expect(await fetchHealth('http://api')).toEqual({ ok: true, data: { status: 'ok', db: 'ok' } });
  });

  it('rejeita resposta fora do contrato', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ x: 1 }))));
    expect((await fetchHealth('http://api')).ok).toBe(false);
  });

  it('reporta API inacessível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await fetchHealth('http://api')).toEqual({ ok: false, reason: 'API inacessível' });
  });
});
