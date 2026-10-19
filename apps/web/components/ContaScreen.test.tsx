// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FazendaDto, SessionResponse } from '@ogado/contracts';
import type { ApiClient, ApiResult } from '../lib/auth/api-client';
import { sessionBody } from '../lib/auth/fixtures';
import { createSessionController, type LocalIdentity } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import { ContaScreen } from './ContaScreen';
import { RepoProvider } from '../lib/repo/repo-provider';
import { SyncContext, type SyncStatus } from './SyncProvider';
import { ToastProvider } from './Toast';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => '/conta',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const identity: LocalIdentity = {
  usuarioId: sessionBody.usuario.id,
  fazendaId: sessionBody.fazenda.id,
};
const SENHA_ATUAL = 'Segredo#2026';
const SENHA_NOVA = 'Nova#Senha2027';

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const sessao = (
  usuario: Partial<SessionResponse['usuario']> = {},
  fazenda: Partial<FazendaDto> = {},
): SessionResponse => ({
  usuario: { ...sessionBody.usuario, ...usuario },
  fazenda: { ...sessionBody.fazenda, ...fazenda },
});

interface Opcoes {
  api?: Partial<ApiClient>;
  stored?: LocalIdentity | null;
  getSession?: ApiResult<SessionResponse>;
  sync?: SyncStatus;
}

type Usuario = ReturnType<typeof userEvent.setup>;

async function setup({
  api = {},
  stored = identity,
  getSession,
  sync = 'sincronizado',
}: Opcoes = {}) {
  let current = stored;
  const clearLocalData = vi.fn();
  const cliente: ApiClient = {
    signup: vi.fn(),
    login: vi.fn(),
    getSession: vi.fn().mockResolvedValue(getSession ?? ok(sessao({ nome: 'Ana Souza' }))),
    logout: vi.fn().mockResolvedValue(ok(undefined)),
    updatePerfil: vi.fn(),
    changePassword: vi.fn(),
    updateFazenda: vi.fn(),
    deleteAccount: vi.fn().mockResolvedValue(ok(undefined)),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    ...api,
  };
  const controller = createSessionController({
    api: cliente,
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
      <RepoProvider>
        <SyncContext.Provider value={sync}>
          <ToastProvider>
            <ContaScreen />
          </ToastProvider>
        </SyncContext.Provider>
      </RepoProvider>
    </SessionProvider>,
  );
  return { user, api: cliente, controller, clearLocalData, getIdentity: () => current };
}

async function pronto() {
  return screen.findByRole('heading', { name: 'Perfil' });
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

/** Clica em "Salvar" do diálogo de confirmação que acabou de abrir. */
async function confirmar(user: Usuario, botao = 'Salvar') {
  const dialogo = await screen.findByRole('alertdialog');
  await user.click(within(dialogo).getByRole('button', { name: botao }));
}

beforeEach(() => {
  replace.mockClear();
  setOnline(true);
});
afterEach(() => setOnline(true));

describe('RF-004 estados da tela Conta', () => {
  it('sem sessão mostra o convite para entrar ou criar conta', async () => {
    await setup({ stored: null, getSession: { ok: false, kind: 'nao-autenticado' } });
    expect(
      await screen.findByRole('heading', { name: 'Guarde seus dados na nuvem' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastrar');
    expect(screen.queryByRole('heading', { name: 'Perfil' })).not.toBeInTheDocument();
  });

  it('enquanto verifica a sessão mostra o estado de carregamento', async () => {
    const pendente = new Promise<ApiResult<SessionResponse>>(() => undefined);
    await setup({ api: { getSession: vi.fn().mockReturnValue(pendente) } });
    expect(screen.getByText('Carregando seus dados…')).toBeInTheDocument();
  });

  it('sessão expirada convida a entrar de novo e garante que os dados ficam no aparelho', async () => {
    await setup({ getSession: { ok: false, kind: 'sessao-expirada' } });
    expect(await screen.findByRole('heading', { name: 'Entre de novo' })).toBeVisible();
    expect(screen.getByText(/continuam salvos neste aparelho/)).toBeVisible();
  });

  it('sem internet e sem verificar a sessão avisa que a conta precisa de internet', async () => {
    await setup({ getSession: { ok: false, kind: 'rede' } });
    expect(await screen.findByText(/Você está sem internet/)).toBeVisible();
  });

  it('autenticado mostra nome, e-mail, fazenda e o selo "Senha definida"', async () => {
    await setup({
      getSession: ok(sessao({ nome: 'Ana Souza' }, { nome: 'Boa Vista', areaHa: '250.5' })),
    });
    await pronto();
    const hero = screen.getByRole('region', { name: 'Minha conta' });
    expect(within(hero).getByRole('heading', { name: 'Ana Souza' })).toBeVisible();
    expect(within(hero).getByText('ana@fazenda.com')).toBeVisible();
    expect(within(hero).getByText('Boa Vista · 250,5 ha')).toBeVisible();
    expect(within(hero).getByText('Senha definida')).toBeVisible();
    expect(screen.getByLabelText('Nome da fazenda')).toHaveValue('Boa Vista');
    expect(screen.getByLabelText('Área pastável')).toHaveValue('250,5');
  });
});

describe('RF-004 perfil', () => {
  it('nome vazio avisa no campo, move o foco e não chama a API', async () => {
    const { user, api } = await setup();
    await pronto();
    await user.clear(screen.getByLabelText('Nome'));
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));

    expect(await screen.findByText('Informe o nome.')).toBeVisible();
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.updatePerfil).not.toHaveBeenCalled();
  });

  it('e-mail inválido avisa e não salva', async () => {
    const { user, api } = await setup();
    await pronto();
    const email = screen.getByLabelText('E-mail');
    await user.clear(email);
    await user.type(email, 'ana@');
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeVisible();
    expect(email).toHaveFocus();
    expect(api.updatePerfil).not.toHaveBeenCalled();
  });

  it('pede confirmação, salva com o e-mail normalizado e atualiza a tela', async () => {
    const updatePerfil = vi
      .fn()
      .mockResolvedValue(ok(sessao({ nome: 'Ana Maria', email: 'ana.maria@fazenda.com' })));
    const { user } = await setup({ api: { updatePerfil } });
    await pronto();
    const nome = screen.getByLabelText('Nome');
    await user.clear(nome);
    await user.type(nome, 'Ana Maria');
    const email = screen.getByLabelText('E-mail');
    await user.clear(email);
    await user.type(email, ' Ana.Maria@Fazenda.com ');
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));

    await screen.findByRole('alertdialog', { name: 'Salvar alterações?' });
    expect(updatePerfil).not.toHaveBeenCalled();
    await confirmar(user);

    await waitFor(() =>
      expect(updatePerfil).toHaveBeenCalledWith({
        nome: 'Ana Maria',
        email: 'ana.maria@fazenda.com',
      }),
    );
    expect(await screen.findByText('Dados atualizados.')).toBeVisible();
    const hero = screen.getByRole('region', { name: 'Minha conta' });
    expect(within(hero).getByRole('heading', { name: 'Ana Maria' })).toBeVisible();
    expect(within(hero).getByText('ana.maria@fazenda.com')).toBeVisible();
  });

  it('cancelar a confirmação não chama a API', async () => {
    const { user, api } = await setup();
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));
    await confirmar(user, 'Cancelar');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.updatePerfil).not.toHaveBeenCalled();
  });

  it('e-mail já em uso (409) mostra mensagem genérica no campo', async () => {
    const updatePerfil = vi.fn().mockResolvedValue({ ok: false, kind: 'conflito' });
    const { user } = await setup({ api: { updatePerfil } });
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));
    await confirmar(user);

    expect(await screen.findByText('Não foi possível salvar com este e-mail.')).toBeVisible();
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
  });

  it('falha de rede mostra alerta e mantém o que foi digitado', async () => {
    const updatePerfil = vi.fn().mockResolvedValue({ ok: false, kind: 'rede' });
    const { user } = await setup({ api: { updatePerfil } });
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));
    await confirmar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível conectar/);
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana Souza');
  });

  it('sem internet não envia e avisa', async () => {
    const { user, api } = await setup();
    await pronto();
    setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));
    await confirmar(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/sem internet/);
    expect(api.updatePerfil).not.toHaveBeenCalled();
  });
});

describe('RF-005 senha', () => {
  async function preencher(user: Usuario, atual: string, nova: string, confirmacao: string) {
    await user.type(screen.getByLabelText('Senha atual'), atual);
    await user.type(screen.getByLabelText('Nova senha'), nova);
    await user.type(screen.getByLabelText('Confirmar nova senha'), confirmacao);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
  }

  it('exige a senha atual e lista os requisitos da nova senha', async () => {
    const { user, api } = await setup();
    await pronto();
    expect(screen.getByRole('list', { name: 'Requisitos da senha' })).toBeVisible();
    await user.type(screen.getByLabelText('Nova senha'), 'fraca');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('Informe a senha atual.')).toBeVisible();
    expect(screen.getByText('A senha ainda não cumpre os requisitos abaixo.')).toBeVisible();
    expect(screen.getByText('A confirmação não confere com a nova senha.')).toBeVisible();
    expect(screen.getByLabelText('Senha atual')).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('confirmação diferente da nova senha não altera', async () => {
    const { user, api } = await setup();
    await pronto();
    await preencher(user, SENHA_ATUAL, SENHA_NOVA, `${SENHA_NOVA}x`);
    expect(await screen.findByText('A confirmação não confere com a nova senha.')).toBeVisible();
    expect(screen.getByLabelText('Confirmar nova senha')).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('altera a senha após confirmar e limpa os campos', async () => {
    const changePassword = vi.fn().mockResolvedValue(ok(undefined));
    const { user } = await setup({ api: { changePassword } });
    await pronto();
    await preencher(user, SENHA_ATUAL, SENHA_NOVA, SENHA_NOVA);
    await screen.findByRole('alertdialog', { name: 'Alterar senha?' });
    await confirmar(user, 'Confirmar');

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        senhaAtual: SENHA_ATUAL,
        novaSenha: SENHA_NOVA,
      }),
    );
    expect(await screen.findByText('Senha atualizada.')).toBeVisible();
    expect(screen.getByLabelText('Senha atual')).toHaveValue('');
    expect(screen.getByLabelText('Nova senha')).toHaveValue('');
  });

  it('senha atual incorreta (400 credenciais_invalidas) avisa no campo e devolve o foco', async () => {
    const changePassword = vi.fn().mockResolvedValue({ ok: false, kind: 'credenciais' });
    const { user } = await setup({ api: { changePassword } });
    await pronto();
    await preencher(user, 'errada', SENHA_NOVA, SENHA_NOVA);
    await confirmar(user, 'Confirmar');

    expect(await screen.findByText('A senha atual está incorreta.')).toBeVisible();
    expect(screen.getByLabelText('Senha atual')).toHaveFocus();
    expect(screen.getByLabelText('Nova senha')).toHaveValue(SENHA_NOVA);
  });

  it('muitas tentativas (429) pede para aguardar', async () => {
    const changePassword = vi
      .fn()
      .mockResolvedValue({ ok: false, kind: 'muitas-tentativas', retryAfterSeconds: null });
    const { user } = await setup({ api: { changePassword } });
    await pronto();
    await preencher(user, SENHA_ATUAL, SENHA_NOVA, SENHA_NOVA);
    await confirmar(user, 'Confirmar');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Aguarde um pouco/);
  });
});

describe('RF-011 fazenda', () => {
  it('converte a área pt-BR para string canônica e envia a versão lida', async () => {
    const atualizada = sessao(
      { nome: 'Ana Souza' },
      { nome: 'Boa Vista', areaHa: '1234.5', version: 3 },
    );
    const updateFazenda = vi.fn().mockResolvedValue(ok(atualizada));
    const { user } = await setup({
      api: { updateFazenda },
      getSession: ok(sessao({ nome: 'Ana Souza' }, { version: 2 })),
    });
    await pronto();
    await user.type(screen.getByLabelText('Nome da fazenda'), '  Boa Vista ');
    await user.type(screen.getByLabelText('Área pastável'), '1.234,5');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('alertdialog', { name: 'Salvar alterações?' });
    await confirmar(user);

    await waitFor(() =>
      expect(updateFazenda).toHaveBeenCalledWith({
        nome: 'Boa Vista',
        areaHa: '1234.5',
        version: 2,
      }),
    );
    expect(await screen.findByText('Fazenda atualizada.')).toBeVisible();
    expect(screen.getByLabelText('Área pastável')).toHaveValue('1234,5');
  });

  it('área vazia limpa a área (null)', async () => {
    const updateFazenda = vi.fn().mockResolvedValue(ok(sessao({}, { nome: 'Sítio' })));
    const { user } = await setup({
      api: { updateFazenda },
      getSession: ok(sessao({ nome: 'Ana' }, { nome: 'Sítio', areaHa: '10' })),
    });
    await pronto();
    await user.clear(screen.getByLabelText('Área pastável'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await confirmar(user);
    await waitFor(() =>
      expect(updateFazenda).toHaveBeenCalledWith({ nome: 'Sítio', areaHa: null, version: 1 }),
    );
  });

  it('valida nome obrigatório e área com casas demais sem chamar a API', async () => {
    const { user, api } = await setup();
    await pronto();
    await user.type(screen.getByLabelText('Área pastável'), '1,234');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe o nome da fazenda.')).toBeVisible();
    expect(screen.getByText(/no máximo 2 casas decimais/)).toBeVisible();
    expect(screen.getByLabelText('Nome da fazenda')).toHaveFocus();
    expect(api.updateFazenda).not.toHaveBeenCalled();
  });

  it('ponto como decimal é recusado com a dica de vírgula', async () => {
    const { user, api } = await setup({
      getSession: ok(sessao({ nome: 'Ana' }, { nome: 'Sítio' })),
    });
    await pronto();
    await user.type(screen.getByLabelText('Área pastável'), '1.5');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Use vírgula para os decimais/)).toBeVisible();
    expect(api.updateFazenda).not.toHaveBeenCalled();
  });

  it('conflito de versão (409) recarrega o valor atual e avisa', async () => {
    const atual: FazendaDto = {
      ...sessionBody.fazenda,
      nome: 'Nome do outro aparelho',
      areaHa: '99.9',
      version: 5,
    };
    const updateFazenda = vi.fn().mockResolvedValue({ ok: false, kind: 'conflito', atual });
    const { user, api } = await setup({
      api: { updateFazenda },
      getSession: ok(sessao({ nome: 'Ana' }, { nome: 'Sítio' })),
    });
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await confirmar(user);

    expect(await screen.findByText(/alterada em outro aparelho/)).toBeVisible();
    expect(screen.getByLabelText('Nome da fazenda')).toHaveValue('Nome do outro aparelho');
    expect(screen.getByLabelText('Área pastável')).toHaveValue('99,9');
    await waitFor(() => expect(api.getSession).toHaveBeenCalledTimes(2));
  });
});

describe('RF-078 sair', () => {
  it('abre com o foco em "Continuar logado", prende o Tab e fecha com Esc devolvendo o foco', async () => {
    const { user } = await setup();
    await pronto();
    const abrir = screen.getByRole('button', { name: 'Sair da conta' });
    await user.click(abrir);

    const dialogo = await screen.findByRole('alertdialog', { name: 'Sair deste aparelho?' });
    const continuar = within(dialogo).getByRole('button', { name: 'Continuar logado' });
    await waitFor(() => expect(continuar).toHaveFocus());
    await user.tab();
    expect(within(dialogo).getByRole('button', { name: 'Sair' })).toHaveFocus();
    await user.tab();
    expect(continuar).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(abrir).toHaveFocus();
  });

  it('com tudo sincronizado não mostra aviso de pendências', async () => {
    const { user } = await setup({ sync: 'sincronizado' });
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each<SyncStatus>(['sincronizando', 'offline', 'erro'])(
    'RF-078 com a sincronização em "%s" avisa que alterações podem se perder',
    async (sync) => {
      const { user } = await setup({ sync });
      await pronto();
      await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
      const dialogo = await screen.findByRole('alertdialog');
      expect(within(dialogo).getByRole('alert')).toHaveTextContent(/ainda não foram sincronizadas/);
    },
  );

  it('durante o logout o botão usa aria-disabled (continua focável) e ignora cliques', async () => {
    let resolver: (r: ApiResult<void>) => void = () => undefined;
    const logout = vi.fn().mockReturnValue(
      new Promise<ApiResult<void>>((r) => {
        resolver = r;
      }),
    );
    const { user } = await setup({ api: { logout } });
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    const dialogo = await screen.findByRole('alertdialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Sair' }));

    const ocupado = await within(dialogo).findByRole('button', { name: 'Saindo…' });
    expect(ocupado).toHaveAttribute('aria-disabled', 'true');
    expect(ocupado).not.toBeDisabled();
    await user.click(ocupado);
    expect(logout).toHaveBeenCalledTimes(1);
    resolver(ok(undefined));
  });

  it('logout confirmado limpa o aparelho e vai para /entrar', async () => {
    const { user, clearLocalData, getIdentity } = await setup();
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    await confirmar(user, 'Sair');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/entrar'));
    expect(clearLocalData).toHaveBeenCalledTimes(1);
    expect(getIdentity()).toBeNull();
  });

  it('logout rejeitado mostra o erro, não apaga nada e fecha o diálogo', async () => {
    const logout = vi.fn().mockResolvedValue({ ok: false, kind: 'rede' });
    const { user, clearLocalData, getIdentity } = await setup({ api: { logout } });
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    await confirmar(user, 'Sair');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Nada foi apagado/);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(getIdentity()).toEqual(identity);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('RF-007 apagar conta', () => {
  async function abrirApagar(user: Usuario) {
    await pronto();
    await user.click(screen.getByRole('button', { name: 'Apagar conta' }));
    return screen.findByRole('alertdialog', { name: 'Apagar sua conta?' });
  }

  it('o botão só habilita depois de digitar "deletar"', async () => {
    const { user } = await setup();
    const dialogo = await abrirApagar(user);
    const botao = within(dialogo).getByRole('button', { name: 'Apagar conta' });
    const campo = within(dialogo).getByLabelText(/Para confirmar, escreva/);
    expect(campo).toHaveFocus();
    expect(botao).toBeDisabled();

    await user.type(campo, 'delet');
    expect(botao).toBeDisabled();
    await user.type(campo, 'ar');
    expect(botao).toBeEnabled();
  });

  it('texto diferente de "deletar" mantém o botão desabilitado', async () => {
    const { user, api } = await setup();
    const dialogo = await abrirApagar(user);
    await user.type(within(dialogo).getByLabelText(/Para confirmar/), 'apagar');
    expect(within(dialogo).getByRole('button', { name: 'Apagar conta' })).toBeDisabled();
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('apaga no servidor, limpa o aparelho e leva a /entrar', async () => {
    const { user, api, clearLocalData, getIdentity } = await setup();
    const dialogo = await abrirApagar(user);
    await user.type(within(dialogo).getByLabelText(/Para confirmar/), 'deletar');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar conta' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/entrar'));
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(clearLocalData).toHaveBeenCalledTimes(1);
    expect(getIdentity()).toBeNull();
  });

  it('falha ao apagar mantém o diálogo aberto com o erro e não limpa o aparelho', async () => {
    const deleteAccount = vi.fn().mockResolvedValue({ ok: false, kind: 'servidor' });
    const { user, clearLocalData, getIdentity } = await setup({ api: { deleteAccount } });
    const dialogo = await abrirApagar(user);
    await user.type(within(dialogo).getByLabelText(/Para confirmar/), 'deletar');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar conta' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/Nada foi apagado/);
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(clearLocalData).not.toHaveBeenCalled();
    expect(getIdentity()).toEqual(identity);
    expect(replace).not.toHaveBeenCalled();
  });

  it('sem internet não envia e avisa dentro do diálogo', async () => {
    const { user, api } = await setup();
    const dialogo = await abrirApagar(user);
    await user.type(within(dialogo).getByLabelText(/Para confirmar/), 'deletar');
    setOnline(false);
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar conta' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/sem internet/);
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });
});
