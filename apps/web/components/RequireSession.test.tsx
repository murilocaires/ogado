// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionController, SessionState } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import { RequireSession } from './RequireSession';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

function controller(state: SessionState): SessionController {
  return {
    getState: () => state,
    getAccountMismatch: () => null,
    subscribe: () => () => undefined,
    verify: async () => undefined,
  } as unknown as SessionController;
}

function renderCom(state: SessionState) {
  return render(
    <SessionProvider controller={controller(state)}>
      <RequireSession>
        <p>conteúdo protegido</p>
      </RequireSession>
    </SessionProvider>,
  );
}

describe('RequireSession', () => {
  beforeEach(() => replace.mockClear());

  it('anônimo: não mostra o conteúdo e vai para /entrar', async () => {
    renderCom({ status: 'anonimo' });
    expect(screen.queryByText('conteúdo protegido')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/entrar'));
  });

  it('sessão expirada: também vai para /entrar', async () => {
    renderCom({ status: 'expirada', identity: { usuarioId: 'u', fazendaId: 'f' } });
    expect(screen.queryByText('conteúdo protegido')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/entrar'));
  });

  it('verificando: espera sem mostrar o conteúdo nem redirecionar', () => {
    renderCom({ status: 'verificando' });
    expect(screen.queryByText('conteúdo protegido')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('offline com identidade conhecida: mostra o conteúdo', () => {
    renderCom({
      status: 'offline-nao-verificado',
      identity: { usuarioId: 'u', fazendaId: 'f' },
    });
    expect(screen.getByText('conteúdo protegido')).toBeTruthy();
  });
});
