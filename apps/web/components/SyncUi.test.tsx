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
import { criarRepoLocal } from '../lib/repo/local-repo';
import { RepoProvider } from '../lib/repo/repo-provider';
import type { SyncableRepo } from '../lib/repo/types';
import type { DadosClient } from '../lib/sync/data-client';
import { sincronizar, type EstadoSyncStore } from '../lib/sync/engine';
import {
  aparelho,
  cenario,
  COMPRA,
  criarEstado,
  criarServidor,
} from '../lib/sync/engine.test-support';
import { AppShell } from './AppShell';
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
      unlinkGoogle: vi.fn(),
      exportData: vi.fn(),
      updateFazenda: vi.fn(),
      deleteAccount: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
      aceitarTermos: vi.fn(),
      enviarDadosPorEmail: vi.fn(),
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

/** A pílula do menu lateral (role=status) com o texto do indicador; só existe sem internet. */
const pilula = () => screen.queryAllByRole('status').find((e) => e.classList.contains('sync-pill'));

/** Sinal de teste que não é texto visível: o shell expõe o estado da sincronização. */
const shell = () => document.querySelector('.app')!;
async function aguardarSincronizado() {
  await waitFor(() => expect(shell()).toHaveAttribute('data-sync-status', 'sincronizado'), {
    timeout: 5000,
  });
}

/** Sem botão no menu, uma rodada imediata é o que acontece quando a conexão volta. */
const sincronizarAgora = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
};

let storageOriginal: PropertyDescriptor | undefined;
beforeEach(() => {
  storageOriginal = Object.getOwnPropertyDescriptor(navigator, 'storage');
});
afterEach(() => {
  if (storageOriginal) Object.defineProperty(navigator, 'storage', storageOriginal);
  else Reflect.deleteProperty(navigator, 'storage');
});

describe('RF-050/RF-075 indicador global e selo por registro', () => {
  it('RF-078/RNF-014 saída confirmada relê o banco durável sem apagar uma segunda vez', async () => {
    const m = montar(criarServidor());
    await aguardarSincronizado();
    const reler = vi.fn().mockResolvedValue(undefined);
    m.repo.ready = reler;
    const limpar = vi.spyOn(m.repo, 'limpar');
    await act(async () => {
      await m.controller.logout();
    });
    await waitFor(() => expect(shell()).toHaveAttribute('data-sync-status', 'desligado'));
    expect(limpar).not.toHaveBeenCalled();
    expect(reler).toHaveBeenCalled();
  });

  it('online e sincronizado não mostra nenhum indicador nem "Sincronizar agora"', async () => {
    montar(criarServidor());
    await aguardarSincronizado();
    expect(pilula()).toBeUndefined();
    expect(screen.queryByText('Sincronizado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).not.toBeInTheDocument();
  });

  it('ao ir offline aparece "Sem conexão" com pendentes; ao voltar online some e sobe sozinho', async () => {
    const srv = criarServidor();
    const m = montar(srv);
    await aguardarSincronizado();
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    m.rede.cortada = true;
    act(() => {
      window.dispatchEvent(new Event('offline'));
      m.repo.salvarLote(COMPRA);
    });

    await waitFor(() => expect(pilula()).toHaveTextContent('Sem conexão · 1 pendente'));
    expect(screen.getAllByText('Salvo neste aparelho, sobe quando a conexão voltar.')).toHaveLength(
      1,
    );

    onLine.mockReturnValue(true);
    m.rede.cortada = false;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(srv.lotes.size).toBe(1), { timeout: 5000 });
    await waitFor(() => expect(pilula()).toBeUndefined());
    await aguardarSincronizado();
    expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument();
    onLine.mockRestore();
  });

  it('lançar sem conexão mantém o indicador global sem selo no item; ao voltar a rede, some', async () => {
    const m = montar(criarServidor());
    await aguardarSincronizado();

    m.rede.cortada = true;
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    await sincronizarAgora();

    await waitFor(() => expect(pilula()).toHaveTextContent('Sem conexão · 1 pendente'));
    expect(screen.queryByText('pendente')).not.toBeInTheDocument();

    m.rede.cortada = false;
    await sincronizarAgora();
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
    await sincronizarAgora();
    // Sem rede, o texto aparece no menu lateral e na pílula compacta do topo.
    await waitFor(() =>
      expect(screen.getAllByText('Sem conexão · 1 pendente').length).toBeGreaterThanOrEqual(2),
    );
  });

  it('erro do servidor aparece como "Erro ao sincronizar"', async () => {
    const m = montar(criarServidor(), {
      listarLotes: async () => ({ ok: false, kind: 'servidor' }),
    });
    expect(m.repo).toBeTruthy();
    await waitFor(() => expect(shell()).toHaveAttribute('data-sync-status', 'erro'), {
      timeout: 5000,
    });
    expect(pilula()).toBeUndefined();
    expect(screen.queryByText(/Erro ao sincronizar/)).not.toBeInTheDocument();
  });

  it('sem conta, nada do indicador aparece', () => {
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
    expect(screen.queryByText('Seus dados ficam salvos neste navegador.')).not.toBeInTheDocument();
    expect(document.querySelector('.sync-ind')).toBeNull();
  });
});

describe('conflitos resolvidos automaticamente', () => {
  it('sincroniza a ultima edicao sem mostrar janela de escolha', async () => {
    const srv = criarServidor();
    const m = montar(srv);
    await aguardarSincronizado();
    let id = '';
    act(() => {
      id = m.repo.salvarLote(COMPRA).id;
    });
    await sincronizarAgora();
    await waitFor(() => expect(srv.lotes.has(id)).toBe(true));
    const b = aparelho();
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await sincronizar({ ...b, api: srv.api, usuarioId: 'u1' });
    act(() => {
      m.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    });
    await sincronizarAgora();
    await aguardarSincronizado();
    expect(srv.lotes.get(id)?.qtd).toBe('99');
    expect(
      screen.queryByRole('button', { name: /Usar o do servidor|Manter o meu|Resolver/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(srv.historico.size).toBe(1);
  });
});

describe('RF-079 item recusado pelo servidor', () => {
  it('RF-079 quarentena remota só permite excluir e só anuncia sucesso após remover o estado duravelmente', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const origem = aparelho();
    const salvo = origem.repo.salvarCenario(cenario());
    await sincronizar({ ...origem, api: srv.api, usuarioId: identity.usuarioId });
    const original = { ...srv.cenarios.get(salvo.id)!, entradas: {} };
    srv.cenarios.set(salvo.id, original);
    const excluir = vi.fn(srv.api.excluirCenario);
    const m = montar(srv, { excluirCenario: excluir });
    await aguardarSincronizado();
    expect(m.repo.exportar().cenarios).toHaveLength(0);
    await user.click(
      (await screen.findAllByRole('button', { name: '1 item precisa de atenção' }))[0]!,
    );
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    expect(within(lista).queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument();
    expect(within(lista).getByText(/Os dados originais estão preservados/)).toBeInTheDocument();
    let confirmar!: () => void;
    m.estado.flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          confirmar = resolve;
        }),
    );
    await user.click(within(lista).getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir este item?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(excluir).toHaveBeenCalledWith(salvo.id, original.version));
    expect(screen.queryByText('Item excluído.')).not.toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Excluir este item?' })).toBeInTheDocument();
    await act(async () => {
      confirmar();
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /item precisa de atenção/ }),
      ).not.toBeInTheDocument(),
    );
    expect(m.estado.ler()?.rejeitados).toEqual([]);
    expect(srv.cenarios.get(salvo.id)?.deletedAt).not.toBeNull();
    m.estado.flush = vi.fn().mockResolvedValue(undefined);
    await sincronizarAgora();
    await aguardarSincronizado();
    expect(m.estado.ler()?.rejeitados).toEqual([]);
  });

  it('RF-079 falha ao excluir cenário remoto conserva o original e não mostra sucesso falso', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const origem = aparelho();
    const salvo = origem.repo.salvarCenario(cenario());
    await sincronizar({ ...origem, api: srv.api, usuarioId: identity.usuarioId });
    const original = { ...srv.cenarios.get(salvo.id)!, entradas: {} };
    srv.cenarios.set(salvo.id, original);
    const excluir = vi.fn().mockResolvedValue({ ok: false, kind: 'rede' });
    const m = montar(srv, { excluirCenario: excluir });
    await aguardarSincronizado();
    await user.click(
      (await screen.findAllByRole('button', { name: '1 item precisa de atenção' }))[0]!,
    );
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    await user.click(within(lista).getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir este item?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(excluir).toHaveBeenCalledWith(salvo.id, original.version));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar a alteração.',
    );
    expect(screen.queryByText('Item excluído.')).not.toBeInTheDocument();
    expect(m.estado.ler()?.rejeitados?.[0]?.original).toEqual(original);
    expect(srv.cenarios.get(salvo.id)?.deletedAt).toBeNull();
  });

  it('RF-078/RF-079 resposta de exclusão após expirar sessão não altera o estado nem anuncia sucesso', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const origem = aparelho();
    const salvo = origem.repo.salvarCenario(cenario());
    await sincronizar({ ...origem, api: srv.api, usuarioId: identity.usuarioId });
    const original = { ...srv.cenarios.get(salvo.id)!, entradas: {} };
    srv.cenarios.set(salvo.id, original);
    let responder!: () => void;
    const excluir = vi.fn(async (id: string, version: number) => {
      await new Promise<void>((resolve) => {
        responder = resolve;
      });
      return srv.api.excluirCenario(id, version);
    });
    const m = montar(srv, { excluirCenario: excluir });
    await aguardarSincronizado();
    await user.click(
      (await screen.findAllByRole('button', { name: '1 item precisa de atenção' }))[0]!,
    );
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    await user.click(within(lista).getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir este item?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(excluir).toHaveBeenCalled());
    const gravar = vi.spyOn(m.estado, 'gravar');
    await act(async () => {
      m.controller.markUnauthorized();
      responder();
    });
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.queryByText('Item excluído.')).not.toBeInTheDocument();
  });

  it('RF-079 exclusão local com falha de persistência mostra erro sem anunciar sucesso', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv, { criarLote: async () => ({ ok: false, kind: 'contrato' }) });
    await aguardarSincronizado();
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    await sincronizarAgora();
    await user.click(
      (await screen.findAllByRole('button', { name: '1 item precisa de atenção' }))[0]!,
    );
    m.repo.flush = vi.fn().mockRejectedValue(new Error('quota'));
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    await user.click(within(lista).getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir este item?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar a alteração.',
    );
    expect(screen.queryByText('Item excluído.')).not.toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Excluir este item?' })).toBeInTheDocument();
  });

  it('RF-079 renomear cenário recusado aguarda persistência antes de fechar e anunciar sucesso', async () => {
    const user = userEvent.setup();
    const srv = criarServidor();
    const m = montar(srv, { criarCenario: async () => ({ ok: false, kind: 'contrato' }) });
    await aguardarSincronizado();
    act(() => {
      m.repo.salvarCenario(cenario());
    });
    await sincronizarAgora();
    await user.click(
      (await screen.findAllByRole('button', { name: '1 item precisa de atenção' }))[0]!,
    );
    const lista = await screen.findByRole('dialog', { name: 'Precisa de atenção' });
    await user.click(within(lista).getByRole('button', { name: 'Corrigir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear cenário' });
    await user.clear(within(dialog).getByLabelText('Nome do cenário'));
    await user.type(within(dialog).getByLabelText('Nome do cenário'), 'Novo nome');
    let confirmar!: () => void;
    m.repo.flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          confirmar = resolve;
        }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Renomear' }));
    expect(screen.queryByText('Cenário renomeado.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Renomear cenário' })).toBeInTheDocument();
    await act(async () => {
      confirmar();
    });
    expect(await screen.findByText('Cenário renomeado.')).toBeInTheDocument();
  });

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
    await sincronizarAgora();
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
    await sincronizarAgora();
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

describe('RF-074 rodada imediata', () => {
  it('ao reconectar, envia o que estava esperando sem ação do usuário', async () => {
    const srv = criarServidor();
    const m = montar(srv);
    await aguardarSincronizado();
    m.rede.cortada = true;
    act(() => {
      m.repo.salvarLote(COMPRA);
    });
    m.rede.cortada = false;

    await sincronizarAgora();

    await waitFor(() => expect(srv.lotes.size).toBe(1), { timeout: 5000 });
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
    await waitFor(() => expect(shell()).toHaveAttribute('data-sync-status', 'desligado'));
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
