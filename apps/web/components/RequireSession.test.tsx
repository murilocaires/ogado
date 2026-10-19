// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TERMOS_VERSAO } from '@ogado/contracts';
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

describe('RNF-009 gate de aceite dos termos', () => {
  const autenticado = (
    aceiteVigente: boolean,
    versao: string | null = '2020-01-01',
  ): SessionState => ({
    status: 'autenticado',
    usuario: { ...sessionBody.usuario, aceiteVigente, aceiteTermosVersao: versao },
    fazenda: sessionBody.fazenda,
  });

  it('aceite vigente: mostra o produto, sem gate', () => {
    renderCom(autenticado(true));
    expect(screen.getByText('conteúdo protegido')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Termos atualizados/ })).toBeNull();
  });

  it('aceite desatualizado: bloqueia, não renderiza o produto e foca o título', async () => {
    renderCom(autenticado(false));
    const titulo = screen.getByRole('heading', {
      name: 'Termos atualizados — aceite para continuar',
    });
    expect(screen.queryByText('conteúdo protegido')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    const termos = screen.getByRole('link', { name: /Termos de Uso/ });
    expect(termos.getAttribute('href')).toBe('/termos');
    expect(termos.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: /Política de Privacidade/ }).getAttribute('href')).toBe(
      '/privacidade',
    );
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apagar minha conta' })).toBeTruthy();
  });

  it('conta que nunca aceitou (ex.: nova pelo Google) vê o texto de primeiro aceite', () => {
    renderCom(autenticado(false, null));
    expect(screen.getByRole('heading', { name: 'Aceite os termos para continuar' })).toBeTruthy();
  });

  it('Aceitar chama a API com a versão vigente', async () => {
    const acceptTerms = vi.fn().mockResolvedValue({ ok: true, data: sessionBody });
    renderCom(autenticado(false), { acceptTerms });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Li e aceito' }));
    expect(acceptTerms).toHaveBeenCalledWith(TERMOS_VERSAO);
  });

  it('falha ao aceitar mostra o erro e mantém o bloqueio', async () => {
    const acceptTerms = vi.fn().mockResolvedValue({ ok: false, kind: 'rede' });
    renderCom(autenticado(false), { acceptTerms });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Li e aceito' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível conectar/);
    expect(screen.queryByText('conteúdo protegido')).toBeNull();
  });

  it('Sair encerra a sessão e vai para /entrar', async () => {
    replace.mockClear();
    const logout = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    renderCom(autenticado(false), { logout });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/entrar'));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('Apagar minha conta abre a confirmação de apagar', async () => {
    renderCom(autenticado(false));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Apagar minha conta' }));
    expect(await screen.findByRole('alertdialog', { name: 'Apagar sua conta?' })).toBeTruthy();
  });

  it('offline com identidade conhecida não bloqueia (o gate só vale com sessão verificada)', () => {
    renderCom({ status: 'offline-nao-verificado', identity: { usuarioId: 'u', fazendaId: 'f' } });
    expect(screen.getByText('conteúdo protegido')).toBeTruthy();
  });
});
