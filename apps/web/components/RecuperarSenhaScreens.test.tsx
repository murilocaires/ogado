// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, ApiResult } from '../lib/auth/api-client';
import { EsqueciSenhaScreen } from './EsqueciSenhaScreen';
import { RedefinirSenhaScreen } from './RedefinirSenhaScreen';

const SENHA_BOA = 'Segredo#123';
const ok: ApiResult<void> = { ok: true, data: undefined };

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    forgotPassword: vi.fn().mockResolvedValue(ok),
    resetPassword: vi.fn().mockResolvedValue(ok),
    ...overrides,
  } as unknown as ApiClient;
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => setOnline(true));
afterEach(() => {
  setOnline(true);
  window.history.replaceState(null, '', '/');
});

describe('RF-002 tela Esqueci minha senha', () => {
  it('envia o e-mail normalizado e mostra a confirmação neutra com foco nela', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    render(<EsqueciSenhaScreen api={api} />);
    await user.type(screen.getByLabelText('E-mail'), ' Ana@Fazenda.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Se houver uma conta com este e-mail, enviamos um link');
    expect(status).toHaveTextContent('vale por 1 hora');
    expect(status).toHaveFocus();
    expect(api.forgotPassword).toHaveBeenCalledWith({ email: 'ana@fazenda.com' });
    expect(screen.getByRole('link', { name: 'Voltar para Entrar' })).toHaveAttribute(
      'href',
      '/entrar',
    );
  });

  it('e-mail vazio ou inválido mostra erro no campo, devolve o foco e não chama a API', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    render(<EsqueciSenhaScreen api={api} />);
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
    const campo = screen.getByLabelText('E-mail');
    expect(campo).toHaveFocus();
    expect(campo).toHaveAttribute('aria-invalid', 'true');

    await user.type(campo, 'sem-arroba');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(api.forgotPassword).not.toHaveBeenCalled();
  });

  it('429 mostra "Muitas tentativas, aguarde" em alerta com foco e mantém o formulário', async () => {
    const api = fakeApi({
      forgotPassword: vi
        .fn()
        .mockResolvedValue({ ok: false, kind: 'muitas-tentativas', retryAfterSeconds: null }),
    });
    const user = userEvent.setup();
    render(<EsqueciSenhaScreen api={api} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Muitas tentativas, aguarde');
    expect(alerta).toHaveFocus();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@fazenda.com');
  });

  it.each([
    ['rede', 'Não foi possível conectar'],
    ['servidor', 'Algo deu errado do nosso lado'],
  ] as const)('falha de %s mostra alerta e permite tentar de novo', async (kind, texto) => {
    const forgotPassword = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind })
      .mockResolvedValueOnce(ok);
    const user = userEvent.setup();
    render(<EsqueciSenhaScreen api={fakeApi({ forgotPassword })} />);
    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(texto);

    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se houver uma conta');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sem internet avisa e não chama a API', async () => {
    setOnline(false);
    const api = fakeApi();
    const user = userEvent.setup();
    render(<EsqueciSenhaScreen api={api} />);
    expect(screen.getByRole('alert')).toHaveTextContent('sem internet');
    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(api.forgotPassword).not.toHaveBeenCalled();
  });
});

describe('RF-002 tela Redefinir senha', () => {
  function abrir(search: string, api: ApiClient = fakeApi()) {
    window.history.replaceState(null, '', `/redefinir-senha${search}`);
    const user = userEvent.setup();
    render(<RedefinirSenhaScreen api={api} />);
    return { api, user };
  }

  it('lê o token, remove-o da URL e redefine; sucesso leva a Entrar', async () => {
    const { api, user } = abrir('?token=abc123');
    await user.type(await screen.findByLabelText('Nova senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Repita a nova senha'), SENHA_BOA);
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/redefinir-senha');

    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('entrar de novo');
    expect(status).toHaveFocus();
    expect(api.resetPassword).toHaveBeenCalledWith({ token: 'abc123', novaSenha: SENHA_BOA });
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('mostra os requisitos da senha em tempo real', async () => {
    const { user } = abrir('?token=abc');
    await user.type(await screen.findByLabelText('Nova senha'), 'a');
    expect(screen.getByText('Requisitos da senha')).toBeInTheDocument();
    expect(screen.getAllByText(/— pendente/).length).toBeGreaterThan(0);
  });

  it('senha fraca e confirmação diferente barram o envio, com foco no primeiro erro', async () => {
    const { api, user } = abrir('?token=abc');
    const nova = await screen.findByLabelText('Nova senha');
    await user.type(nova, 'fraca');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'fraca');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('A senha ainda não cumpre os requisitos abaixo.')).toBeVisible();
    expect(nova).toHaveFocus();

    await user.clear(nova);
    await user.type(nova, SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(screen.getByLabelText('Repita a nova senha')).toHaveFocus();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('token inválido ou expirado mostra o erro genérico com link para pedir novo', async () => {
    const api = fakeApi({
      resetPassword: vi.fn().mockResolvedValue({ ok: false, kind: 'link-invalido' }),
    });
    const { user } = abrir('?token=velho', api);
    await user.type(await screen.findByLabelText('Nova senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Repita a nova senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('inválido ou expirou');
    expect(alerta).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('sem token na URL mostra o mesmo estado de link inválido e não chama a API', async () => {
    const { api } = abrir('');
    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirou');
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toBeInTheDocument();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('429 e erro de rede mostram alerta e preservam o que foi digitado', async () => {
    const resetPassword = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: 'muitas-tentativas', retryAfterSeconds: 30 })
      .mockResolvedValueOnce({ ok: false, kind: 'rede' });
    const { user } = abrir('?token=abc', fakeApi({ resetPassword }));
    await user.type(await screen.findByLabelText('Nova senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Repita a nova senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('aguarde 30 segundos');
    expect(screen.getByLabelText('Nova senha')).toHaveValue(SENHA_BOA);

    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível conectar'),
    );
  });

  it('validação do servidor aparece no campo da nova senha', async () => {
    const resetPassword = vi.fn().mockResolvedValue({
      ok: false,
      kind: 'validacao',
      campos: [{ caminho: 'novaSenha', regra: 'simbolo', mensagem: 'Falta um símbolo.' }],
    });
    const { user } = abrir('?token=abc', fakeApi({ resetPassword }));
    await user.type(await screen.findByLabelText('Nova senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Repita a nova senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByText('Falta um símbolo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nova senha')).toHaveFocus();
  });

  it('Mostrar/Ocultar alterna as duas senhas', async () => {
    const { user } = abrir('?token=abc');
    await user.click(await screen.findByRole('button', { name: 'Mostrar senhas' }));
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Repita a nova senha')).toHaveAttribute('type', 'text');
  });
});
