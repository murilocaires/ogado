import { describe, expect, it, vi } from 'vitest';
import type { ApiClient, ApiResult } from './api-client';
import {
  createSessionController,
  type IdentityStore,
  type LocalIdentity,
} from './session-controller';
import { sessionBody } from './fixtures';
import type { SessionResponse } from '@ogado/contracts';

const identity: LocalIdentity = {
  usuarioId: sessionBody.usuario.id,
  fazendaId: sessionBody.fazenda.id,
};

function memoryStore(initial: LocalIdentity | null = null): IdentityStore & {
  current: LocalIdentity | null;
} {
  const store = {
    current: initial,
    read: () => store.current,
    write: (value: LocalIdentity) => {
      store.current = value;
    },
    clear: () => {
      store.current = null;
    },
  };
  return store;
}

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  const ok: ApiResult<SessionResponse> = { ok: true, data: sessionBody };
  return {
    signup: vi.fn().mockResolvedValue(ok),
    login: vi.fn().mockResolvedValue(ok),
    getSession: vi.fn().mockResolvedValue(ok),
    logout: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    ...overrides,
  };
}

describe('RF-002 máquina de estados da sessão', () => {
  it('RF-002 começa desconhecida e verificar com 200 vai para autenticado e guarda só a identidade', async () => {
    const store = memoryStore();
    const c = createSessionController({ api: fakeApi(), identity: store, clearLocalData: vi.fn() });
    expect(c.getState().status).toBe('verificando');

    await c.verify();

    expect(c.getState()).toEqual({
      status: 'autenticado',
      usuario: sessionBody.usuario,
      fazenda: sessionBody.fazenda,
    });
    expect(store.current).toEqual(identity);
  });

  it('RF-002 401 sem identidade local vai para anonimo', async () => {
    const api = fakeApi({
      getSession: vi.fn().mockResolvedValue({ ok: false, kind: 'nao-autenticado' }),
    });
    const c = createSessionController({ api, identity: memoryStore(), clearLocalData: vi.fn() });
    await c.verify();
    expect(c.getState()).toEqual({ status: 'anonimo' });
  });

  it('RF-002 401 com identidade local vai para expirada e NÃO apaga dados locais (RF-078/080)', async () => {
    const store = memoryStore(identity);
    const clearLocalData = vi.fn();
    const api = fakeApi({
      getSession: vi.fn().mockResolvedValue({ ok: false, kind: 'sessao-expirada' }),
    });
    const c = createSessionController({ api, identity: store, clearLocalData });

    await c.verify();

    expect(c.getState()).toEqual({ status: 'expirada', identity });
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(store.current).toEqual(identity);
  });

  it('RF-002 sem rede e com identidade local vai para offline-nao-verificado, sem apagar nada', async () => {
    const store = memoryStore(identity);
    const clearLocalData = vi.fn();
    const api = fakeApi({ getSession: vi.fn().mockResolvedValue({ ok: false, kind: 'rede' }) });
    const c = createSessionController({ api, identity: store, clearLocalData });
    await c.verify();
    expect(c.getState()).toEqual({ status: 'offline-nao-verificado', identity });
    expect(clearLocalData).not.toHaveBeenCalled();
  });

  it('RF-002 sem rede e sem identidade local fica anonimo (login exige internet)', async () => {
    const api = fakeApi({ getSession: vi.fn().mockResolvedValue({ ok: false, kind: 'rede' }) });
    const c = createSessionController({ api, identity: memoryStore(), clearLocalData: vi.fn() });
    await c.verify();
    expect(c.getState()).toEqual({ status: 'anonimo' });
  });

  it('RF-002 login com sucesso autentica; de expirada volta a autenticado com a mesma identidade', async () => {
    const store = memoryStore(identity);
    const api = fakeApi({
      getSession: vi.fn().mockResolvedValue({ ok: false, kind: 'sessao-expirada' }),
    });
    const c = createSessionController({ api, identity: store, clearLocalData: vi.fn() });
    await c.verify();
    expect(c.getState().status).toBe('expirada');

    const result = await c.login({ email: 'ana@fazenda.com', senha: 'Segredo#1' });

    expect(result.ok).toBe(true);
    expect(c.getState().status).toBe('autenticado');
  });

  it('RF-002 login com falha devolve o erro e não muda o estado', async () => {
    const api = fakeApi({ login: vi.fn().mockResolvedValue({ ok: false, kind: 'credenciais' }) });
    const c = createSessionController({ api, identity: memoryStore(), clearLocalData: vi.fn() });
    await c.verify();
    const before = c.getState();
    const result = await c.login({ email: 'a@b.co', senha: 'x' });
    expect(result).toEqual({ ok: false, kind: 'credenciais' });
    expect(c.getState()).toEqual(before);
  });

  it('RF-002 logout só limpa o aparelho depois do 204', async () => {
    const store = memoryStore(identity);
    const clearLocalData = vi.fn();
    const c = createSessionController({ api: fakeApi(), identity: store, clearLocalData });
    await c.verify();

    const result = await c.logout();

    expect(result.ok).toBe(true);
    expect(clearLocalData).toHaveBeenCalledTimes(1);
    expect(store.current).toBeNull();
    expect(c.getState()).toEqual({ status: 'anonimo' });
  });

  it('RF-002 logout que falha (rede ou 5xx) não limpa nada e mantém o estado', async () => {
    const store = memoryStore(identity);
    const clearLocalData = vi.fn();
    const api = fakeApi({ logout: vi.fn().mockResolvedValue({ ok: false, kind: 'rede' }) });
    const c = createSessionController({ api, identity: store, clearLocalData });
    await c.verify();
    const before = c.getState();

    const result = await c.logout();

    expect(result).toEqual({ ok: false, kind: 'rede' });
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(store.current).toEqual(identity);
    expect(c.getState()).toEqual(before);
  });

  it('RF-002 um 401 durante o uso (markUnauthorized) expira a sessão sem limpar dados', async () => {
    const store = memoryStore();
    const clearLocalData = vi.fn();
    const c = createSessionController({ api: fakeApi(), identity: store, clearLocalData });
    await c.verify();

    c.markUnauthorized();

    expect(c.getState()).toEqual({ status: 'expirada', identity });
    expect(clearLocalData).not.toHaveBeenCalled();
  });

  it('RNF-003 o controlador nunca grava token nem senha, só usuarioId e fazendaId', async () => {
    const store = memoryStore();
    const write = vi.spyOn(store, 'write');
    const c = createSessionController({ api: fakeApi(), identity: store, clearLocalData: vi.fn() });
    await c.login({ email: 'ana@fazenda.com', senha: 'Segredo#1' });
    expect(write).toHaveBeenCalledWith(identity);
    expect(JSON.stringify(write.mock.calls)).not.toContain('Segredo');
  });

  it('RF-002 notifica assinantes a cada mudança de estado', async () => {
    const c = createSessionController({
      api: fakeApi(),
      identity: memoryStore(),
      clearLocalData: vi.fn(),
    });
    const listener = vi.fn();
    const unsubscribe = c.subscribe(listener);
    await c.verify();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    c.markUnauthorized();
    expect(listener).not.toHaveBeenCalled();
  });

  it('RF-078 login de outra conta com identidade anterior guardada sinaliza a troca sem apagar nem sobrescrever nada', async () => {
    const previous: LocalIdentity = {
      usuarioId: '11111111-1111-4111-8111-111111111111',
      fazendaId: '22222222-2222-4222-8222-222222222222',
    };
    const store = memoryStore(previous);
    const clearLocalData = vi.fn();
    const onAccountMismatch = vi.fn();
    const c = createSessionController({
      api: fakeApi(),
      identity: store,
      clearLocalData,
      onAccountMismatch,
    });

    await c.login({ email: 'ana@fazenda.com', senha: 'Segredo#1' });

    expect(onAccountMismatch).toHaveBeenCalledWith(previous, identity);
    expect(c.getAccountMismatch()).toEqual({ previous, next: identity });
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(store.current).toEqual(previous);
  });

  it('RF-078 mesma conta não sinaliza troca', async () => {
    const onAccountMismatch = vi.fn();
    const c = createSessionController({
      api: fakeApi(),
      identity: memoryStore(identity),
      clearLocalData: vi.fn(),
      onAccountMismatch,
    });
    await c.verify();
    expect(onAccountMismatch).not.toHaveBeenCalled();
    expect(c.getAccountMismatch()).toBeNull();
  });

  it('RF-002 resposta antiga de verify() não sobrescreve um login mais novo', async () => {
    let resolveOld: (r: ApiResult<SessionResponse>) => void = () => undefined;
    const getSession = vi.fn().mockReturnValue(
      new Promise<ApiResult<SessionResponse>>((r) => {
        resolveOld = r;
      }),
    );
    const c = createSessionController({
      api: fakeApi({ getSession }),
      identity: memoryStore(),
      clearLocalData: vi.fn(),
    });
    const pending = c.verify();
    await c.login({ email: 'ana@fazenda.com', senha: 'Segredo#1' });
    expect(c.getState().status).toBe('autenticado');

    resolveOld({ ok: false, kind: 'nao-autenticado' });
    await pending;

    expect(c.getState().status).toBe('autenticado');
  });
});
