// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionController, SessionState } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import { sessionBody } from '../lib/auth/fixtures';
import { RequireSession } from './RequireSession';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function controller(
  state: SessionState,
  extra: Partial<SessionController> = {},
): SessionController {
  return {
    getState: () => state,
    getAccountMismatch: () => null,
    subscribe: () => () => undefined,
    verify: async () => undefined,
    ...extra,
  } as unknown as SessionController;
}

function renderCom(state: SessionState, extra: Partial<SessionController> = {}) {
  return render(
    <SessionProvider controller={controller(state, extra)}>
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

describe('acesso direto depois do login', () => {
  it.each([true, false, null])('nao pede novo aceite: estado %s', (aceite) => {
    const acceptTerms = vi.fn();
    renderCom(
      {
        status: 'autenticado',
        usuario: {
          ...sessionBody.usuario,
          aceiteVigente: aceite === true,
          aceiteTermosVersao: aceite === null ? null : '2020-01-01',
        },
        fazenda: sessionBody.fazenda,
      },
      { acceptTerms },
    );
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Li e aceito' })).not.toBeInTheDocument();
    expect(acceptTerms).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
