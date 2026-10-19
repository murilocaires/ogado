// @vitest-environment happy-dom
// UI da sincronização robusta (E5-A): indicador, selo por registro, "Sincronizar agora", conflito,
// item recusado, nova versão e cota. Usa o motor real e o servidor em memória do teste do motor.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionBody } from '../lib/auth/fixtures';
import { createSessionController } from '../lib/auth/session-controller';
import { SessionProvider } from '../lib/auth/session-provider';
import { criarControladorAtualizacao } from '../lib/pwa/atualizacao';
import { criarRepoLocal } from '../lib/repo/local-repo';
import { RepoProvider } from '../lib/repo/repo-provider';
import type { SyncableRepo } from '../lib/repo/types';
import type { DadosClient } from '../lib/sync/data-client';
import { sincronizar, type EstadoSyncStore } from '../lib/sync/engine';
import { aparelho, COMPRA, criarEstado, criarServidor } from '../lib/sync/engine.test-support';
import { AppShell } from './AppShell';
import { AtualizacaoBanner } from './AtualizacaoBanner';
import { Dialog } from './Dialog';
import { NegociosScreen } from './NegociosScreen';
import { SyncContext, SyncInfoContext, SyncProvider } from './SyncProvider';
import { ToastProvider } from './Toast';
import { criarStorageMemoria } from './test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/negocios',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const identity = { usuarioId: sessionBody.usuario.id, fazendaId: sessionBody.fazenda.id };

interface Montagem {
  repo: SyncableRepo;
  estado: EstadoSyncStore & { atual: unknown };
  /** Liga/desliga a rede entre o app e o servidor em memória. */
  rede: { cortada: boolean };
  api: DadosClient;
  controller: ReturnType<typeof createSessionController>;
}

function montar(srv: ReturnType<typeof criarServidor>, extra?: Partial<DadosClient>) {
  const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
  const estado = criarEstado();
  const rede = { cortada: false };
  const comRede =
    <A extends unknown[], R>(f: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> =>
      rede.cortada ? ({ ok: false, kind: 'rede' } as R) : f(...a);
  const api = Object.fromEntries(
    Object.entries({ ...srv.api, ...extra }).map(([k, f]) => [
      k,
      comRede(f as (...a: unknown[]) => Promise<unknown>),
    ]),
  ) as unknown as DadosClient;
  const controller = createSessionController({
    api: {
      signup: vi.fn(),
      login: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ ok: true, data: sessionBody }),
      logout: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      updatePerfil: vi.fn(),
      changePassword: vi.fn(),
      updateFazenda: vi.fn(),
      deleteAccount: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    },
    identity: { read: () => identity, write: () => undefined, clear: () => undefined },
    clearLocalData: vi.fn(),
  });
  const m: Montagem = { repo, estado, rede, api, controller };
  render(
    <SessionProvider controller={controller}>
      <RepoProvider repo={repo}>
        <SyncProvider api={api} estado={estado}>
          <ToastProvider>
            <AppShell>
              <NegociosScreen />
            </AppShell>
          </ToastProvider>
        </SyncProvider>
      </RepoProvider>
    </SessionProvider>,
  );
  return m;
}

/** A pílula do menu lateral (role=status) com o texto do indicador. */
const pilula = () => screen.getAllByRole('status').find((e) => e.classList.contains('sync-pill'));

async function aguardarSincronizado() {
  await waitFor(() => expect(pilula()).toHaveTextContent('Sincronizado'), { timeout: 5000 });
}

const sincronizarAgora = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getAllByRole('button', { name: 'Sincronizar agora' })[0]!);

let storageOriginal: PropertyDescriptor | undefined;
beforeEach(() => {
  storageOriginal = Object.getOwnPropertyDescriptor(navigator, 'storage');
});
afterEach(() => {
  if (storageOriginal) Object.defineProperty(navigator, 'storage', storageOriginal);
  else Reflect.deleteProperty(navigator, 'storage');
});

describe('RF-075 indicador global e selo por registro', () => {
  it('lançar sem conexão mostra "1 pendente" e o selo; ao voltar a rede, some', async () => {
    const user = userEvent.setup();
    const m = montar(criarServidor());
    await aguardarSincronizado();

    m.rede.cortada = true;
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    await sincronizarAgora(user);

    await waitFor(() => expect(pilula()).toHaveTextContent('Sem conexão · 1 pendente'));
    expect(screen.getAllByText('pendente').length).toBeGreaterThan(0);

    m.rede.cortada = false;
    await sincronizarAgora(user);
    await aguardarSincronizado();
    expect(screen.queryByText('pendente')).not.toBeInTheDocument();
  });

  it('o indicador compacto (tela estreita) repete o estado', async () => {
    const m = montar(criarServidor());
    await aguardarSincronizado();
    m.rede.cortada = true;
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    // O texto aparece no menu lateral e na pílula compacta do topo.
    await waitFor(() => expect(screen.getAllByText('1 pendente').length).toBeGreaterThanOrEqual(2));
  });

  it('erro do servidor aparece como "Erro ao sincronizar"', async () => {
    const m = montar(criarServidor(), {
      listarLotes: async () => ({ ok: false, kind: 'servidor' }),
    });
    expect(m.repo).toBeTruthy();
    await waitFor(() => expect(pilula()).toHaveTextContent('Erro ao sincronizar'), {
      timeout: 5000,
    });
  });

  it('sem conta, o indicador não oferece "Sincronizar agora"', () => {
    render(
      <RepoProvider repo={criarRepoLocal({ storage: () => criarStorageMemoria() })}>
        <ToastProvider>
          <AppShell>
            <p>conteúdo</p>
          </AppShell>
        </ToastProvider>
      </RepoProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).not.toBeInTheDocument();
    expect(screen.getByText('Seus dados ficam salvos neste navegador.')).toBeInTheDocument();
  });
});

describe('RF-076 conflito entre aparelhos', () => {
  async function prepararConflito() {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv);
    await aguardarSincronizado();
    let id = '';
    act(() => {
      id = m.repo.salvarLote(COMPRA).id;
    });
    await sincronizarAgora(user);
    await waitFor(() => expect(srv.lotes.has(id)).toBe(true));
    await aguardarSincronizado();

    // O aparelho B edita o mesmo lote e sobe.
    const b = aparelho();
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });

    // O A edita sem saber.
    act(() => {
      m.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    });
    await sincronizarAgora(user);
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('button', { name: '1 item precisa de atenção' }).length,
        ).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    return { user, srv, m, id };
  }

  async function abrirDecisao(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getAllByRole('button', { name: '1 item precisa de atenção' })[0]!);
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    await user.click(within(lista).getByRole('button', { name: 'Resolver' }));
    return screen.findByRole('alertdialog', { name: 'Este lote foi alterado em outro aparelho' });
  }

  it('abre a decisão mostrando os dois valores; nada foi trocado em silêncio', async () => {
    const { user, srv, id } = await prepararConflito();
    expect(srv.lotes.get(id)?.qtd).toBe('50');

    const decisao = await abrirDecisao(user);

    const tabela = within(decisao).getByRole('table');
    const linha = within(tabela).getByRole('row', { name: /Quantidade/ });
    expect(
      within(linha)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['99', '50 (diferente)']);
    expect(within(decisao).getByRole('button', { name: 'Manter o meu' })).toBeInTheDocument();
    expect(within(decisao).getByRole('button', { name: 'Usar o do servidor' })).toBeInTheDocument();
    // O lote tem o selo de atenção, não o de pendente comum.
    expect(screen.getAllByText('precisa de atenção').length).toBeGreaterThan(0);
  });

  it('"Manter o meu" envia o valor do aparelho', async () => {
    const { user, srv, id } = await prepararConflito();
    const decisao = await abrirDecisao(user);

    await user.click(within(decisao).getByRole('button', { name: 'Manter o meu' }));

    await waitFor(() => expect(srv.lotes.get(id)?.qtd).toBe('99'), { timeout: 5000 });
    await aguardarSincronizado();
    expect(screen.queryByRole('button', { name: /precisa de atenção/ })).not.toBeInTheDocument();
  });

  it('"Usar o do servidor" adota o valor da nuvem', async () => {
    const { user, srv, m, id } = await prepararConflito();
    const decisao = await abrirDecisao(user);

    await user.click(within(decisao).getByRole('button', { name: 'Usar o do servidor' }));

    await waitFor(() => expect(m.repo.exportar().lotes.find((l) => l.id === id)?.qtd).toBe('50'), {
      timeout: 5000,
    });
    expect(srv.lotes.get(id)?.qtd).toBe('50');
    await aguardarSincronizado();
  });

  it('"Decidir depois" fecha sem mexer em nada e o aviso continua', async () => {
    const { user, m, id } = await prepararConflito();
    const decisao = await abrirDecisao(user);

    await user.click(within(decisao).getByRole('button', { name: 'Decidir depois' }));

    expect(m.repo.exportar().lotes.find((l) => l.id === id)?.qtd).toBe('99');
    expect(
      screen.getAllByRole('button', { name: '1 item precisa de atenção' }).length,
    ).toBeGreaterThan(0);
  });
});

describe('RF-079 item recusado pelo servidor', () => {
  it('aparece em "Precisa de atenção" com o motivo e permite excluir; as outras entidades seguem', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv, {
      criarLote: async (body) =>
        body.qtd === '1'
          ? {
              ok: false,
              kind: 'validacao',
              mensagem: 'Confira os campos informados.',
              campos: [{ caminho: 'qtd', mensagem: 'Informe uma quantidade válida.' }],
            }
          : srv.api.criarLote(body),
    });
    await aguardarSincronizado();
    act(() => {
      m.repo.salvarLote({ ...COMPRA, qtd: '1' });
      m.repo.salvarLote({ ...COMPRA, qtd: '8' });
    });
    await sincronizarAgora(user);
    await waitFor(() => expect(srv.lotes.size).toBe(1), { timeout: 5000 });

    await user.click(
      await screen
        .findAllByRole('button', { name: '1 item precisa de atenção' })
        .then((b) => b[0]!),
    );
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    expect(
      within(lista).getByText(/Quantidade: Informe uma quantidade válida\./),
    ).toBeInTheDocument();

    await user.click(within(lista).getByRole('button', { name: 'Excluir' }));
    const confirmacao = await screen.findByRole('alertdialog', { name: 'Excluir este item?' });
    await user.click(within(confirmacao).getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(m.repo.exportar().lotes.filter((l) => l.deletedAt === null)).toHaveLength(1),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /precisa de atenção/ })).not.toBeInTheDocument(),
    );
  });

  it('"Corrigir" abre o mesmo modal de edição do lote', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv, {
      criarLote: async () => ({
        ok: false,
        kind: 'validacao',
        mensagem: 'x',
        campos: [{ caminho: 'preco', mensagem: 'Valor inválido.' }],
      }),
    });
    await aguardarSincronizado();
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    await sincronizarAgora(user);
    await user.click(
      await screen
        .findAllByRole('button', { name: '1 item precisa de atenção' })
        .then((b) => b[0]!),
    );
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    expect(within(lista).getByText(/Preço da arroba: Valor inválido\./)).toBeInTheDocument();

    await user.click(within(lista).getByRole('button', { name: 'Corrigir' }));

    expect(await screen.findByRole('dialog', { name: /Editar lote/i })).toBeInTheDocument();
  });
});

describe('RF-074 Sincronizar agora', () => {
  it('força uma rodada e envia o que estava esperando', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv);
    await aguardarSincronizado();
    m.rede.cortada = true;
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    m.rede.cortada = false;

    await sincronizarAgora(user);

    await waitFor(() => expect(srv.lotes.size).toBe(1), { timeout: 5000 });
  });
});

describe('RF-077 nova versão', () => {
  function bannerComWorker(edicaoAberta: () => boolean) {
    const container = Object.assign(new EventTarget(), { controller: {} });
    const w = Object.assign(new EventTarget(), { state: 'installed', postMessage: vi.fn() });
    const reg = Object.assign(new EventTarget(), {
      waiting: w,
      installing: null,
      update: async () => undefined,
    });
    const controlador = criarControladorAtualizacao({
      container,
      haEdicaoAberta: edicaoAberta,
      recarregar: vi.fn(),
    });
    controlador.observar(reg as never);
    return { controlador, w };
  }

  it('mostra "Nova versão disponível" e aplica ao clicar em Atualizar', async () => {
    const user = userEvent.setup();
    const { controlador, w } = bannerComWorker(() => false);
    render(<AtualizacaoBanner controlador={controlador} />);

    expect(screen.getByRole('status')).toHaveTextContent('Nova versão disponível');
    await user.click(screen.getByRole('button', { name: 'Atualizar' }));

    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('com modal aberto não aplica e explica; nada é perdido', async () => {
    const user = userEvent.setup();
    const { haDialogoAberto } = await import('./Dialog');
    const { controlador, w } = bannerComWorker(haDialogoAberto);
    render(
      <>
        <AtualizacaoBanner controlador={controlador} />
        <Dialog titulo="Editando" onClose={() => undefined}>
          <input aria-label="campo" />
        </Dialog>
      </>,
    );

    // O diálogo é modal; o clique vai direto no botão como faria a tecnologia assistiva.
    screen.getByRole('button', { name: 'Atualizar', hidden: true }).click();

    expect(w.postMessage).not.toHaveBeenCalled();
    expect(await screen.findByText(/Termine o que está aberto/)).toBeInTheDocument();
    void user;
  });

  it('sem versão nova em espera, não mostra nada', () => {
    const container = Object.assign(new EventTarget(), { controller: {} });
    const controlador = criarControladorAtualizacao({
      container,
      haEdicaoAberta: () => false,
      recarregar: vi.fn(),
    });
    render(<AtualizacaoBanner controlador={controlador} />);
    expect(screen.queryByText(/Nova versão/)).not.toBeInTheDocument();
  });
});

describe('RNF-015 armazenamento', () => {
  it('pede persistência depois do login', async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist,
        persisted: async () => false,
        estimate: async () => ({ usage: 10, quota: 100 }),
      },
    });
    montar(criarServidor());
    await waitFor(() => expect(persist).toHaveBeenCalled());
  });

  it('avisa quando a cota passa de 80%', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 85, quota: 100 }),
      },
    });
    montar(criarServidor());
    expect(
      await screen.findByText(/armazenamento deste aparelho está quase cheio \(85/),
    ).toBeInTheDocument();
  });

  it('não avisa com a cota folgada', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 20, quota: 100 }),
      },
    });
    montar(criarServidor());
    await aguardarSincronizado();
    expect(screen.queryByText(/quase cheio/)).not.toBeInTheDocument();
  });
});

describe('RF-080 sessão expirada', () => {
  it('expirar não apaga a fila; entrar de novo (mesma conta) retoma o envio', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv);
    await aguardarSincronizado();
    m.rede.cortada = true;
    act(() => {
      m.repo.salvarLote(COMPRA);
    });

    act(() => m.controller.markUnauthorized());

    expect(m.repo.exportar().lotes).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByText('Seus dados ficam salvos neste navegador.')).toBeInTheDocument(),
    );
    expect(m.repo.exportar().lotes).toHaveLength(1);

    // Novo login: a sessão volta e a fila sobe.
    m.rede.cortada = false;
    await act(async () => {
      await m.controller.verify();
    });
    await waitFor(() => expect(srv.lotes.size).toBe(1), { timeout: 5000 });
    void user;
  });
});

describe('SyncInfoContext padrão', () => {
  it('telas fora do provider não quebram e não mostram selo', () => {
    render(
      <SyncContext.Provider value="sincronizado">
        <SyncInfoContext.Consumer>
          {(info) => <span>{info.totalPendentes}</span>}
        </SyncInfoContext.Consumer>
      </SyncContext.Provider>,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
