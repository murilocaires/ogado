// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, ApiResult } from '../lib/auth/api-client';
import { sessionBody } from '../lib/auth/fixtures';
import { createSessionController, type LocalIdentity } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import type { SessionResponse } from '@bovaro/contracts';
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
    updatePerfil: vi.fn(),
    changePassword: vi.fn(),
    unlinkGoogle: vi.fn(),
    exportData: vi.fn(),
    updateFazenda: vi.fn(),
    deleteAccount: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    aceitarTermos: vi.fn(),
    enviarDadosPorEmail: vi.fn(),
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
  it('RF-002 oferece o link "Esqueci minha senha" para /esqueci-senha, só em Entrar', async () => {
    setup('entrar');
    expect(await screen.findByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
  });

  it('RF-002 Cadastrar não oferece o link de recuperação', async () => {
    setup('cadastrar');
    await screen.findByLabelText('E-mail');
    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).not.toBeInTheDocument();
  });

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
  it('RF-001 antes de tocar na senha mostra só uma linha discreta com os requisitos', async () => {
    setup('cadastrar');
    const senha = await screen.findByLabelText('Senha');
    expect(screen.getByText('Mín. 8 caracteres, com maiúscula, número e símbolo')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Requisitos da senha' })).not.toBeInTheDocument();
    expect(senha).toHaveAccessibleDescription(
      /Mín\. 8 caracteres, com maiúscula, número e símbolo/,
    );
  });

  it('RF-001 ao focar mostra os 4 requisitos como itens compactos, todos pendentes', async () => {
    const { user } = setup('cadastrar');
    await user.click(await screen.findByLabelText('Senha'));
    const list = screen.getByRole('list', { name: 'Requisitos da senha' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '8+ caracteres — pendente',
      'Maiúscula — pendente',
      'Número — pendente',
      'Símbolo — pendente',
    ]);
    expect(screen.queryByText(/Mín\. 8 caracteres, com maiúscula/)).not.toBeInTheDocument();
  });

  it('RF-001 marca cada requisito como cumprido conforme digita, com texto para leitor de tela', async () => {
    const { user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('Senha'), 'Abc');
    const items = screen.getAllByRole('listitem');
    const maiuscula = items.find((li) => li.textContent?.includes('Maiúscula'));
    const minimo = items.find((li) => li.textContent?.includes('8+ caracteres'));
    expect(maiuscula).toHaveTextContent('cumprido');
    expect(maiuscula).toHaveAttribute('data-ok', 'true');
    expect(minimo).toHaveTextContent('pendente');
    expect(minimo).toHaveAttribute('data-ok', 'false');
  });

  it('RF-001 com todos cumpridos colapsa para "Senha forte" e anuncia só isso (região educada)', async () => {
    const { user } = setup('cadastrar');
    const senha = await screen.findByLabelText('Senha');
    await user.type(senha, 'Abc123');
    const anuncio = (): string =>
      screen
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join('');
    expect(anuncio()).not.toContain('Senha forte'); // a cada tecla não fala nada
    await user.type(senha, '!x');
    expect(screen.queryByRole('list', { name: 'Requisitos da senha' })).not.toBeInTheDocument();
    expect(screen.getByText('Senha forte')).toBeVisible();
    expect(anuncio()).toContain('Senha forte.');
    // apagar volta aos itens
    await user.clear(senha);
    expect(screen.getByRole('list', { name: 'Requisitos da senha' })).toBeInTheDocument();
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

  it('RF-001 cadastro válido chama a API e vai à sessão (/painel)', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), ' Ana@Fazenda.com ');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Confirmar senha'), SENHA_BOA);
    await user.click(screen.getByLabelText(/Li e aceito/));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/painel'));
    expect(api.signup).toHaveBeenCalledWith({
      email: 'ana@fazenda.com',
      senha: SENHA_BOA,
      aceiteTermos: true,
    });
  });

  it('RF-001 e-mail já cadastrado mostra a mensagem do ADR-0010 Q4 com link para Entrar', async () => {
    const { user } = setup('cadastrar', {
      signup: vi.fn().mockResolvedValue({ ok: false, kind: 'conflito' }),
    });
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Confirmar senha'), SENHA_BOA);
    await user.click(screen.getByLabelText(/Li e aceito/));
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
    await user.type(screen.getByLabelText('Confirmar senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/criar a conta é preciso internet/i);
    expect(api.signup).not.toHaveBeenCalled();
  });
});

describe('RF-001 confirmação de senha no cadastro', () => {
  it('só existe em Cadastrar, não em Entrar', async () => {
    setup('entrar');
    await screen.findByLabelText('Senha');
    expect(screen.queryByLabelText('Confirmar senha')).not.toBeInTheDocument();
  });

  it('senhas diferentes não são enviadas: marca o campo, descreve o erro e foca', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    const confirmacao = screen.getByLabelText('Confirmar senha');
    await user.type(confirmacao, `${SENHA_BOA}x`);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(api.signup).not.toHaveBeenCalled();
    expect(await screen.findByText('As senhas não coincidem.')).toBeVisible();
    expect(confirmacao).toHaveAttribute('aria-invalid', 'true');
    expect(confirmacao).toHaveAccessibleDescription('As senhas não coincidem.');
    expect(confirmacao).toHaveFocus();
  });

  it('confirmação vazia também bloqueia o envio', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Repita a senha.')).toBeVisible();
    expect(screen.getByLabelText('Confirmar senha')).toHaveFocus();
    expect(api.signup).not.toHaveBeenCalled();
  });

  it('a confirmação não vai para a API', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Confirmar senha'), SENHA_BOA);
    await user.click(screen.getByLabelText(/Li e aceito/));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(api.signup).toHaveBeenCalledTimes(1));
    expect(api.signup).toHaveBeenCalledWith({
      email: 'ana@fazenda.com',
      senha: SENHA_BOA,
      aceiteTermos: true,
    });
  });

  it('Mostrar/Ocultar cobre os dois campos', async () => {
    const { user } = setup('cadastrar');
    const senha = await screen.findByLabelText('Senha');
    const confirmacao = screen.getByLabelText('Confirmar senha');
    await user.click(screen.getByRole('button', { name: 'Mostrar senhas' }));
    expect(senha).toHaveAttribute('type', 'text');
    expect(confirmacao).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar senhas' }));
    expect(senha).toHaveAttribute('type', 'password');
    expect(confirmacao).toHaveAttribute('type', 'password');
  });
});

describe('RF-001 entrar com Google', () => {
  it('Entrar tem o botão como link de navegação completa para a API', async () => {
    setup('entrar');
    const link = await screen.findByRole('link', { name: 'Entrar com Google' });
    expect(link).toHaveAttribute('href', '/api/auth/google/start');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('Cadastrar chama "Cadastrar com Google" e usa a mesma rota', async () => {
    setup('cadastrar');
    expect(await screen.findByRole('link', { name: 'Cadastrar com Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start',
    );
  });

  it.each([
    [
      'google-conta-existente',
      'Já existe uma conta com este e-mail. Entre com a senha e vincule o Google em Conta.',
    ],
    ['google', 'Não foi possível entrar com o Google. Tente de novo.'],
  ])('?erro=%s mostra o alerta com foco e limpa a URL', async (codigo, texto) => {
    window.history.replaceState(null, '', `/entrar?erro=${codigo}&x=1`);
    setup('entrar');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(texto);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(window.location.search).toBe('?x=1');
    window.history.replaceState(null, '', '/');
  });

  it('erro desconhecido na URL é ignorado', async () => {
    window.history.replaceState(null, '', '/entrar?erro=outro');
    setup('entrar');
    await screen.findByLabelText('Senha');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    window.history.replaceState(null, '', '/');
  });
});

describe('RNF-009 aceite dos termos na tela de cadastro', () => {
  it('Cadastrar mostra o checkbox obrigatório com links que abrem em nova aba; Entrar não', async () => {
    setup('cadastrar');
    const caixa = await screen.findByLabelText(/Li e aceito/);
    expect(caixa).not.toBeChecked();
    const rotulo = caixa.closest('.check') as HTMLElement;
    const termos = within(rotulo).getByRole('link', { name: 'Termos de Uso' });
    const privacidade = within(rotulo).getByRole('link', { name: 'Política de Privacidade' });
    expect(termos).toHaveAttribute('href', '/termos');
    expect(termos).toHaveAttribute('target', '_blank');
    expect(termos.getAttribute('rel')).toContain('noopener');
    expect(privacidade).toHaveAttribute('href', '/privacidade');
    expect(privacidade).toHaveAttribute('target', '_blank');
  });

  it('os links de Termos e Privacidade não se repetem no rodapé: só o aviso contextual', async () => {
    setup('entrar');
    await screen.findByLabelText('Senha');
    expect(screen.queryByRole('navigation', { name: 'Documentos legais' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Termos de Uso' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Política de Privacidade' })).toHaveLength(1);
  });

  it('Cadastrar tem o aviso do Google e o checkbox, e nada no rodapé', async () => {
    setup('cadastrar');
    await screen.findByLabelText('Senha');
    expect(screen.queryByRole('navigation', { name: 'Documentos legais' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Termos de Uso' })).toHaveLength(2);
  });

  it('Entrar não pede o checkbox', async () => {
    setup('entrar');
    await screen.findByLabelText('Senha');
    expect(screen.queryByLabelText(/Li e aceito/)).not.toBeInTheDocument();
  });

  it('desmarcado: não envia, mostra erro acessível, marca o campo e leva o foco', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Confirmar senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(api.signup).not.toHaveBeenCalled();
    const caixa = screen.getByLabelText(/Li e aceito/);
    const erro = 'Marque que leu e aceita os Termos de Uso e a Política de Privacidade.';
    expect(await screen.findByText(erro)).toBeVisible();
    expect(caixa).toHaveAttribute('aria-invalid', 'true');
    expect(caixa).toHaveAccessibleDescription(erro);
    expect(caixa).toHaveFocus();
  });

  it('marcado: envia aceiteTermos true e o erro some', async () => {
    const { api, user } = setup('cadastrar');
    await user.type(await screen.findByLabelText('E-mail'), 'ana@fazenda.com');
    await user.type(screen.getByLabelText('Senha'), SENHA_BOA);
    await user.type(screen.getByLabelText('Confirmar senha'), SENHA_BOA);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await user.click(screen.getByLabelText(/Li e aceito/));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(api.signup).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Marque que leu/)).not.toBeInTheDocument();
  });

  it('o aviso do Google (com links) aparece em Entrar e em Cadastrar, sem checkbox próprio', async () => {
    for (const modo of ['entrar', 'cadastrar'] as const) {
      const { unmount } = (() => {
        setup(modo);
        return { unmount: () => undefined };
      })();
      const aviso = await screen.findByText(/Ao continuar com o Google você aceita/);
      expect(within(aviso).getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute(
        'target',
        '_blank',
      );
      expect(within(aviso).getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
        'href',
        '/privacidade',
      );
      unmount();
      document.body.innerHTML = '';
    }
  });
});
