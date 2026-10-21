// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { TERMOS_VERSAO } from '@bovaro/contracts';
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
  it.each([true, null])('nao pede novo aceite: estado %s', (aceite) => {
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

describe('dialogo de termos atualizados', () => {
  beforeEach(() => replace.mockClear());
  function renderAtualizacao(
    acceptTerms = vi.fn().mockResolvedValue({ ok: true, data: sessionBody }),
  ) {
    renderCom(
      {
        status: 'autenticado',
        usuario: { ...sessionBody.usuario, aceiteVigente: false, aceiteTermosVersao: '2020-01-01' },
        fazenda: sessionBody.fazenda,
      },
      { acceptTerms },
    );
    return acceptTerms;
  }
  it('mostra apenas um dialogo pequeno com o produto ao fundo e links para leitura', () => {
    const aceitar = renderAtualizacao();
    expect(screen.getByRole('dialog', { name: 'Termos atualizados' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos');
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(aceitar).not.toHaveBeenCalled();
  });
  it('registra a versao vigente somente ao clicar em aceitar e fecha no sucesso', async () => {
    const aceitar = renderAtualizacao();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Li e aceito' }));
    expect(aceitar).toHaveBeenCalledExactlyOnceWith(TERMOS_VERSAO);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
  });
  it('permite adiar sem registrar aceite e sem sair do produto', async () => {
    const aceitar = renderAtualizacao();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aceitar).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it('Escape fecha sem aceitar', async () => {
    const aceitar = renderAtualizacao();
    await userEvent.setup().keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aceitar).not.toHaveBeenCalled();
  });
  it('falha de rede mostra erro e permite tentar novamente', async () => {
    const aceitar = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: 'rede' })
      .mockResolvedValueOnce({ ok: true, data: sessionBody });
    renderAtualizacao(aceitar);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Li e aceito' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/conectar/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Li e aceito' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
