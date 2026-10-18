// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, ApiResult } from '../lib/auth/api-client';
import { sessionBody } from '../lib/auth/fixtures';
import { createSessionController, type LocalIdentity } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import type { SessionResponse } from '@ogado/contracts';
import { AuthScreen } from './AuthScreen';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: replace }) }));

const SENHA_BOA = 'Segredo#123';
const identity: LocalIdentity = {
  usuarioId: sessionBody.usuario.id,
  fazendaId: sessionBody.fazenda.id,
};

function setup(
  mode: 'entrar' | 'cadastrar',
  apiOverrides: Partial<ApiClient> = {},
  stored: LocalIdentity | null = null,
) {
  const ok: ApiResult<SessionResponse> = { ok: true, data: sessionBody };
  const api: ApiClient = {
    signup: vi.fn().mockResolvedValue(ok),
    login: vi.fn().mockResolvedValue(ok),
    getSession: vi.fn().mockResolvedValue({ ok: false, kind: 'nao-autenticado' }),
    logout: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    ...apiOverrides,
  };
  let current = stored;
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
    clearLocalData: vi.fn(),
  });
  const user = userEvent.setup();
  render(
    <SessionProvider controller={controller}>
      <AuthScreen mode={mode} />
    </SessionProvider>,
  );
  return { api, user, controller };
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  replace.mockClear();
  setOnline(true);
});
afterEach(() => setOnline(true));

describe('RF-001 tela de entrar (CA-20)', () => {
  it('RF-001 credenciais válidas levam ao painel', async () => {
    const { api, user } = setup('entrar');
    await user.type(await screen.findByLabelText('E-mail'), 'Ana@Fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/painel'));
    expect(api.login).toHaveBeenCalledWith({ email: 'ana@fazenda.com', senha: SENHA_BOA });
  });

  it('RNF-003 credenciais inválidas mostram a mensagem genérica e movem o foco para o erro', async () => {
    const { user } = setup('entrar', {
      login: vi.fn().mockResolvedValue({ ok: false, kind: 'credenciais' }),
    });
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), 'qualquer');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(replace).not.toHaveBeenCalled();
  });

  it('RF-001 e-mail inválido bloqueia o envio, marca o campo e foca nele', async () => {
    const { api, user } = setup('entrar');
    const email = await screen.findByLabelText('E-mail');
    await user.type(email, 'sem-arroba');
    await user.type(screen.getByLabelText('Senha'), 'x');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(api.login).not.toHaveBeenCalled();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription('Informe um e-mail válido.');
  });

  it('RF-001 mostra carregando e ignora segundo envio enquanto espera', async () => {
    let resolve: (r: ApiResult<SessionResponse>) => void = () => undefined;
    const login = vi.fn().mockReturnValue(
      new Promise<ApiResult<SessionResponse>>((r) => {
        resolve = r;
      }),
    );
    const { user } = setup('entrar', { login });
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const busy = await screen.findByRole('button', { name: 'Entrando…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy);
    expect(login).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: sessionBody });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/painel'));
  });

  it('RNF-003 sem internet avisa que entrar exige conexão e não chama a API', async () => {
    setOnline(false);
    const { api, user } = setup('entrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sem internet/i);
    expect(api.login).not.toHaveBeenCalled();
  });

  it('RNF-003 falha de rede durante o envio mostra o aviso de conexão e preserva o que foi digitado', async () => {
    const { user } = setup('entrar', {
      login: vi.fn().mockResolvedValue({ ok: false, kind: 'rede' }),
    });
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/conexão/i);
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@fazenda.com');
    expect(screen.getByLabelText('Senha')).toHaveValue(SENHA_BOA);
  });

  it('RNF-003 429 mostra o tempo de espera', async () => {
    const { user } = setup('entrar', {
      login: vi
        .fn()
        .mockResolvedValue({ ok: false, kind: 'muitas-tentativas', retryAfterSeconds: 30 }),
    });
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/30 segundos/);
  });

  it('RNF-003 o botão Mostrar alterna a visibilidade da senha com rótulo acessível', async () => {
    const { user } = setup('entrar');
    const senha = await screen.findByLabelText('Senha');
    expect(senha).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(senha).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument();
  });
});

describe('RF-002 sessão expirada na tela de entrar (CA-21)', () => {
  it('RF-002 com 401 e identidade local mostra "Entre de novo" e garante que os dados ficam', async () => {
    const getSession = vi.fn().mockResolvedValue({ ok: false, kind: 'sessao-expirada' });
    const { controller } = setup('entrar', { getSession }, identity);
    expect(await screen.findByText(/Entre de novo/)).toBeInTheDocument();
    expect(screen.getByText(/continuam salvos neste aparelho/i)).toBeInTheDocument();
    expect(controller.getState().status).toBe('expirada');
  });
});

describe('RF-001 tela de cadastro (CA-06, parte de tela)', () => {
  it('RF-001 lista os requisitos da senha antes de qualquer envio', async () => {
    setup('cadastrar');
    const list = await screen.findByRole('list', { name: 'Requisitos da senha' });
    expect(list).toHaveTextContent('pelo menos 8 caracteres');
    expect(list).toHaveTextContent('letra maiúscula');
    expect(list).toHaveTextContent('um número');
    expect(list).toHaveTextContent('um símbolo');
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(/Requisitos da senha/);
  });

  it('RF-001 marca cada requisito como cumprido conforme digita, com texto para leitor de tela', async () => {
    const { user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('Senha'), 'Abc');
    const items = screen.getAllByRole('listitem');
    const maiuscula = items.find((li) => li.textContent?.includes('maiúscula'));
    const minimo = items.find((li) => li.textContent?.includes('8 caracteres'));
    expect(maiuscula).toHaveTextContent('cumprido');
    expect(minimo).toHaveTextContent('pendente');
  });

  it('RF-001 senha fraca não é enviada, marca o campo e foca nele', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    const senha = screen.getByLabelText('Senha');
    await user.type(senha, 'fraca');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(api.signup).not.toHaveBeenCalled();
    expect(senha).toHaveAttribute('aria-invalid', 'true');
    expect(senha).toHaveFocus();
  });

  it('RF-001 cadastro válido chama a API e vai ao painel', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), ' Ana@Fazenda.com ');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/painel'));
    expect(api.signup).toHaveBeenCalledWith({ email: 'ana@fazenda.com', senha: SENHA_BOA });
  });

  it('RF-001 e-mail já cadastrado mostra a mensagem do ADR-0010 Q4 com link para Entrar', async () => {
    const { user } = setup('cadastrar', {
      signup: vi.fn().mockResolvedValue({ ok: false, kind: 'conflito' }),
    });
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível criar a conta com este e-mail.');
    expect(within(alert).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('RF-001 sem internet o cadastro avisa claramente e não chama a API', async () => {
    setOnline(false);
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/criar a conta é preciso internet/i);
    expect(api.signup).not.toHaveBeenCalled();
  });
});
