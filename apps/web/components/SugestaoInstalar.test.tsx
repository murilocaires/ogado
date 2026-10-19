// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionController, SessionState } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import { iniciarCapturaInstalacao, resetarCapturaInstalacao } from '../lib/pwa/instalacao';
import { CHAVE_DISPENSADO, SugestaoInstalar } from './SugestaoInstalar';

const AUTENTICADO = {
  status: 'autenticado',
  usuario: { id: 'u', email: 'a@b.c', nome: null },
  fazenda: { id: 'f', nome: null },
} as unknown as SessionState;

function controller(state: SessionState): SessionController {
  return {
    getState: () => state,
    getAccountMismatch: () => null,
    subscribe: () => () => undefined,
    verify: async () => undefined,
  } as unknown as SessionController;
}

function montar(state: SessionState) {
  return render(
    <SessionProvider controller={controller(state)}>
      <SugestaoInstalar />
    </SessionProvider>,
  );
}

function disparaPrompt() {
  const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
  });
  act(() => {
    window.dispatchEvent(e);
  });
}

function simulaModoApp(standalone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: standalone && q.includes('standalone'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('RF-070 sugestão de instalar depois do login', () => {
  beforeEach(() => {
    window.localStorage.clear();
    simulaModoApp(false);
    resetarCapturaInstalacao();
    iniciarCapturaInstalacao();
  });
  afterEach(() => vi.restoreAllMocks());

  it('logado e instalável: mostra a sugestão com Instalar e Agora não', () => {
    montar(AUTENTICADO);
    disparaPrompt();
    expect(screen.getByRole('region', { name: 'Instalar o app' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instalar o app' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
  });

  it('"Agora não" some e não volta nos próximos 14 dias', async () => {
    const user = userEvent.setup();
    const a = montar(AUTENTICADO);
    disparaPrompt();
    await user.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
    expect(window.localStorage.getItem(CHAVE_DISPENSADO)).not.toBeNull();

    a.unmount();
    montar(AUTENTICADO);
    disparaPrompt();
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('depois de 14 dias volta a sugerir', () => {
    window.localStorage.setItem(CHAVE_DISPENSADO, String(Date.now() - 15 * 86_400_000));
    montar(AUTENTICADO);
    disparaPrompt();
    expect(screen.getByRole('region', { name: 'Instalar o app' })).toBeInTheDocument();
  });

  it('sem sessão: não aparece', () => {
    montar({ status: 'anonimo' });
    disparaPrompt();
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });

  it('já instalado (modo app): não aparece', () => {
    simulaModoApp(true);
    montar(AUTENTICADO);
    disparaPrompt();
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
  });
});
