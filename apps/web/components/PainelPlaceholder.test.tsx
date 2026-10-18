// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionResponse } from '@ogado/contracts';
import type { ApiClient, ApiResult } from '../lib/auth/api-client';
import { sessionBody } from '../lib/auth/fixtures';
import { createSessionController, type LocalIdentity } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import { PainelPlaceholder } from './PainelPlaceholder';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: replace }) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const identity: LocalIdentity = {
  usuarioId: sessionBody.usuario.id,
  fazendaId: sessionBody.fazenda.id,
};

async function setup(logout: ApiClient['logout']) {
  const ok: ApiResult<SessionResponse> = { ok: true, data: sessionBody };
  const api: ApiClient = {
    signup: vi.fn().mockResolvedValue(ok),
    login: vi.fn().mockResolvedValue(ok),
    getSession: vi.fn().mockResolvedValue(ok),
    logout,
  };
  let current: LocalIdentity | null = identity;
  const clearLocalData = vi.fn();
  const controller = createSessionController({
    api,
    identity: {
      read: () => current,
      write: (v) => {
        current = v;
      },
      clear: () => {
        current = null;
      },
    },
    clearLocalData,
  });
  const user = userEvent.setup();
  render(
    <SessionProvider controller={controller}>
      <PainelPlaceholder />
    </SessionProvider>,
  );
  const sair = await screen.findByRole('button', { name: 'Sair' });
  return { user, sair, clearLocalData, getIdentity: () => current };
}

const logoutOk = () => vi.fn().mockResolvedValue({ ok: true, data: undefined });

beforeEach(() => replace.mockClear());

describe('RF-002 diálogo de saída do painel', () => {
  it('RF-002 abre com o foco em "Continuar logado" e prende o Tab dentro do diálogo', async () => {
    const { user, sair } = await setup(logoutOk());
    await user.click(sair);

    const dialog = await screen.findByRole('dialog', { name: 'Sair deste aparelho?' });
    const continuar = screen.getByRole('button', { name: 'Continuar logado' });
    await waitFor(() => expect(continuar).toHaveFocus());

    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Sair' })).toHaveFocus();
    await user.tab();
    expect(continuar).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Sair' })).toHaveFocus();
  });

  it('RF-002 o fundo fica inerte enquanto o diálogo está aberto', async () => {
    const { user, sair } = await setup(logoutOk());
    await user.click(sair);
    const dialog = await screen.findByRole('dialog');
    const inert = document.querySelector('[inert]');
    expect(inert).not.toBeNull();
    expect(inert?.contains(dialog)).toBe(false);
  });

  it('RF-002 Esc no documento fecha e devolve o foco ao botão que abriu', async () => {
    const { user, sair } = await setup(logoutOk());
    await user.click(sair);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sair' })).toHaveFocus();
  });

  it('RF-002 durante o logout o botão usa aria-disabled (continua focável) e ignora cliques', async () => {
    let resolve: (r: ApiResult<void>) => void = () => undefined;
    const logout = vi.fn().mockReturnValue(
      new Promise<ApiResult<void>>((r) => {
        resolve = r;
      }),
    );
    const { user, sair } = await setup(logout);
    await user.click(sair);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sair' }));

    const busy = await within(dialog).findByRole('button', { name: 'Saindo…' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).not.toBeDisabled();
    await user.click(busy);
    expect(logout).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: undefined });
  });

  it('RF-078 logout confirmado (204) limpa o aparelho e vai para /entrar', async () => {
    const { user, sair, clearLocalData, getIdentity } = await setup(logoutOk());
    await user.click(sair);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/entrar'));
    expect(clearLocalData).toHaveBeenCalledTimes(1);
    expect(getIdentity()).toBeNull();
  });

  it('RF-078 logout rejeitado mostra o erro, não apaga nada e devolve o foco', async () => {
    const { user, sair, clearLocalData, getIdentity } = await setup(
      vi.fn().mockResolvedValue({ ok: false, kind: 'rede' }),
    );
    await user.click(sair);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Nada foi apagado/);
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(getIdentity()).toEqual(identity);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toHaveFocus();
  });
});
