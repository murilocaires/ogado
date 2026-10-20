'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useOptionalSessionController } from '../lib/auth/session-provider';
import type { SessionState } from '../lib/auth/session-controller';
import { pedirPersistencia, verificarCota } from '../lib/pwa/armazenamento';
import { useRepo, useRepoState } from '../lib/repo/repo-provider';
import type { OGadoRepo, SyncableRepo } from '../lib/repo/types';
import { cenarioSchema } from '@ogado/contracts';
import { criarDadosClient, type DadosClient } from '../lib/sync/data-client';
import {
  pendentes as calcularPendentes,
  sincronizar,
  type Conflito,
  type EstadoSync,
  type EstadoSyncStore,
  type Rejeitado,
} from '../lib/sync/engine';
import { browserSyncStore } from '../lib/sync/storage';

/** `desligado`: sem conta (dados só neste aparelho). */
export type SyncStatus = 'desligado' | 'sincronizando' | 'sincronizado' | 'offline' | 'erro';

/** Exportado para os testes das telas informarem o estado da sincronização. */
export const SyncContext = createContext<SyncStatus>('desligado');

export function useSyncStatus(): SyncStatus {
  return useContext(SyncContext);
}

/** O que as telas precisam saber além do status: pendências, atenção e ações (RF-074…RF-079). */
export interface SyncInfo {
  /** ids de lotes, cenários e entradas da recria que o aparelho ainda não enviou. */
  pendentes: ReadonlySet<string>;
  totalPendentes: number;
  conflitos: readonly Conflito[];
  rejeitados: readonly Rejeitado[];
  /** Fração da cota do navegador em uso, se passou de 80%; senão `null` (RNF-015). */
  cotaQuaseCheia: number | null;
  /** Força uma rodada agora (RF-074). */
  sincronizarAgora: () => void;
  /** RF-079: exclui snapshot remoto em quarentena e confirma a remoção da atenção no aparelho. */
  excluirRejeitado?: (rejeitado: Rejeitado) => Promise<void>;
}

const INFO_VAZIA: SyncInfo = {
  pendentes: new Set(),
  totalPendentes: 0,
  conflitos: [],
  rejeitados: [],
  cotaQuaseCheia: null,
  sincronizarAgora: () => undefined,
};

/** Exportado para os testes das telas informarem pendências e itens de atenção. */
export const SyncInfoContext = createContext<SyncInfo>(INFO_VAZIA);

export function useSyncInfo(): SyncInfo {
  return useContext(SyncInfoContext);
}

function ehSincronizavel(repo: OGadoRepo): repo is SyncableRepo {
  return 'exportar' in repo && 'aplicar' in repo;
}

const ESPERA_MS = 1500;
/** Depois de falha de rede/servidor, tenta de novo sozinho (RF-074, repetição). */
const REPETIR_APOS_FALHA_MS = 30_000;
const SEM_SESSAO: SessionState = { status: 'anonimo' };
const semAssinatura = (): (() => void) => () => undefined;

interface LeituraEstado {
  carregado: boolean;
  estado: EstadoSync | null;
}

/** Sincroniza o repositório local com a nuvem enquanto houver sessão (E3). Sem sessão, não faz nada. */
export function SyncProvider({
  children,
  api,
  estado,
}: {
  children: ReactNode;
  api?: DadosClient;
  estado?: EstadoSyncStore;
}) {
  const repo = useRepo();
  const dados = useRepoState();
  const controller = useOptionalSessionController();
  const sessao = useSyncExternalStore(
    controller ? controller.subscribe : semAssinatura,
    () => controller?.getState() ?? SEM_SESSAO,
    () => SEM_SESSAO,
  );
  const [status, setStatus] = useState<SyncStatus>('desligado');
  const [cliente] = useState(() => api ?? criarDadosClient());
  const [armazem] = useState(() => estado ?? browserSyncStore());
  const [leitura, setLeitura] = useState<LeituraEstado>({ carregado: false, estado: null });
  const [cota, setCota] = useState<number | null>(null);
  const estavaLogado = useRef(false);
  const acoes = useRef<{
    agora: () => void;
    excluir: (rejeitado: Rejeitado) => Promise<void>;
  } | null>(null);

  const usuarioId = sessao.status === 'autenticado' ? sessao.usuario.id : null;

  useEffect(() => {
    if (!controller || !ehSincronizavel(repo)) return;
    if (usuarioId === null) {
      // O controlador já limpou o disco. Outra aba pode ter entrado novamente nesse intervalo:
      // reler a geração atual atualiza a memória sem apagar os dados da nova sessão.
      if (sessao.status === 'anonimo' && estavaLogado.current) {
        estavaLogado.current = false;
        if (repo.ready) void repo.ready().catch(() => undefined);
        else repo.limpar();
      }
      setStatus('desligado');
      setLeitura({ carregado: false, estado: null });
      setCota(null);
      return;
    }
    estavaLogado.current = true;
    setLeitura({ carregado: false, estado: null });

    let ativo = true;
    // O controlador muda antes do cleanup do React. Cancelar nessa notificação fecha a janela
    // em que uma resposta antiga poderia adotar dados após uma troca de sessão já confirmada.
    const cancelarSessao = controller.subscribe(() => {
      if (controller.getState() !== sessao) ativo = false;
    });
    let rodando = false;
    let repetir = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retentativa: ReturnType<typeof setTimeout> | undefined;
    let atual: Promise<void> = Promise.resolve();

    const atualizarCota = async (): Promise<void> => {
      const fracao = await verificarCota();
      if (ativo) setCota(fracao);
    };

    const rodar = (): Promise<void> => {
      if (!ativo) return Promise.resolve();
      if (rodando) {
        repetir = true;
        return atual;
      }
      rodando = true;
      if (retentativa) clearTimeout(retentativa);
      setStatus('sincronizando');
      atual = (async () => {
        const resultado = await sincronizar({
          repo,
          api: cliente,
          estado: armazem,
          usuarioId,
          ativo: () => ativo,
        });
        rodando = false;
        if (!ativo) return;
        setLeitura({ carregado: true, estado: armazem.ler() });
        void atualizarCota();
        if (resultado === 'nao-autenticado') {
          controller.markUnauthorized();
          return;
        }
        setStatus(resultado === 'ok' ? 'sincronizado' : resultado === 'rede' ? 'offline' : 'erro');
        if (resultado !== 'ok') {
          retentativa = setTimeout(() => void rodar(), REPETIR_APOS_FALHA_MS);
        } else if (repetir) {
          repetir = false;
          agendar();
        }
      })();
      return atual;
    };
    const agendar = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void rodar(), ESPERA_MS);
    };

    const excluirRejeitadoDaSessao = async (r: Rejeitado): Promise<void> => {
      if (r.tipo !== 'cenario' || r.original === undefined) throw new Error('item_invalido');
      if (rodando) await atual;
      const origem = controller.getState();
      if (origem.status !== 'autenticado' || origem.usuario.id !== usuarioId)
        throw new Error('sessao_alterada');
      const vigente = () => {
        const sessaoAtual = controller.getState();
        return (
          ativo &&
          sessaoAtual.status === 'autenticado' &&
          sessaoAtual.usuario.id === usuarioId &&
          sessaoAtual.fazenda.id === origem.fazenda.id &&
          !controller.getAccountMismatch()
        );
      };
      const exigirAtivo = () => {
        if (!vigente()) throw new Error('sessao_alterada');
      };
      const excluir = async (): Promise<void> => {
        exigirAtivo();
        await repo.ready?.();
        exigirAtivo();
        await repo.flush?.();
        exigirAtivo();
        await armazem.ready?.();
        exigirAtivo();
        const anterior = armazem.ler();
        if (!anterior || anterior.usuarioId !== usuarioId) throw new Error('sessao_alterada');
        const preservado = anterior.rejeitados?.find(
          (item) =>
            item.id === r.id &&
            item.tipo === 'cenario' &&
            item.versaoLocal === r.versaoLocal &&
            item.original !== undefined,
        );
        const original = cenarioSchema.safeParse(preservado?.original);
        if (
          !original.success ||
          original.data.id !== r.id ||
          original.data.version !== r.versaoLocal
        )
          throw new Error('item_alterado');
        const vinculado = cliente.paraUsuario?.(usuarioId) ?? cliente;
        exigirAtivo();
        const resposta = await vinculado.excluirCenario(r.id, r.versaoLocal);
        exigirAtivo();
        if (!resposta.ok) {
          if (resposta.kind === 'nao-autenticado') controller.markUnauthorized();
          throw new Error('exclusao_nao_confirmada');
        }
        if (resposta.data.id !== r.id || resposta.data.deletedAt === null)
          throw new Error('exclusao_nao_confirmada');
        const proximo: EstadoSync = {
          ...anterior,
          versoes: { ...anterior.versoes, [r.id]: resposta.data.version },
          bases: { ...anterior.bases, [r.id]: resposta.data },
          rejeitados: (anterior.rejeitados ?? []).filter((item) => item.id !== r.id),
        };
        exigirAtivo();
        armazem.gravar(proximo);
        try {
          await armazem.flush?.();
        } catch (erro) {
          // O servidor pode já ter excluído; preservar o original permite recuperar/repetir o pull.
          if (vigente()) armazem.gravar(anterior);
          throw erro;
        }
        exigirAtivo();
        setLeitura({ carregado: true, estado: armazem.ler() });
      };
      if (timer) clearTimeout(timer);
      rodando = true;
      const operacao =
        typeof navigator !== 'undefined' && navigator.locks
          ? navigator.locks.request('ogado.sync', excluir)
          : excluir();
      atual = operacao.catch(() => undefined);
      try {
        await operacao;
      } finally {
        rodando = false;
        if (ativo && repetir) {
          repetir = false;
          agendar();
        }
      }
    };

    acoes.current = {
      excluir: excluirRejeitadoDaSessao,
      agora: () => {
        if (timer) clearTimeout(timer);
        void rodar();
      },
    };

    void pedirPersistencia(); // RNF-015: depois do login, pede para o navegador não apagar os dados
    void atualizarCota();
    void rodar();
    const cancelar = repo.subscribe(agendar);
    const aoVoltarRede = (): void => {
      if (timer) clearTimeout(timer);
      void rodar();
    };
    window.addEventListener('online', aoVoltarRede);
    return () => {
      ativo = false;
      acoes.current = null;
      if (timer) clearTimeout(timer);
      if (retentativa) clearTimeout(retentativa);
      cancelar();
      cancelarSessao();
      window.removeEventListener('online', aoVoltarRede);
    };
  }, [repo, controller, cliente, armazem, usuarioId, sessao]);

  const sincronizarAgora = useCallback(() => acoes.current?.agora(), []);
  const excluirRejeitado = useCallback(async (r: Rejeitado) => {
    const acao = acoes.current;
    if (!acao) throw new Error('sessao_indisponivel');
    await acao.excluir(r);
  }, []);
  const info = useMemo<SyncInfo>(() => {
    const logado =
      usuarioId !== null &&
      leitura.carregado &&
      ehSincronizavel(repo) &&
      (!leitura.estado || leitura.estado.usuarioId === usuarioId);
    const ids = new Set<string>();
    let conflitos: readonly Conflito[] = [];
    let rejeitados: readonly Rejeitado[] = [];
    if (logado && dados.status === 'pronto') {
      const completos = repo.exportar();
      const versoes = leitura.estado?.versoes ?? {};
      for (const p of calcularPendentes(completos, versoes)) ids.add(p.id);
      // Excluir o item recusado o tira da lista na hora, sem esperar a próxima rodada.
      const vivos = new Set<string>([
        completos.recria.id,
        ...completos.lotes.filter((l) => l.deletedAt === null).map((l) => l.id),
        ...completos.cenarios.filter((c) => c.deletedAt === null).map((c) => c.id),
      ]);
      rejeitados = (leitura.estado?.rejeitados ?? []).filter(
        (r) => vivos.has(r.id) || r.original !== undefined,
      );
      conflitos = [];
    }
    return {
      pendentes: ids,
      totalPendentes: ids.size,
      conflitos,
      rejeitados,
      cotaQuaseCheia: cota,
      sincronizarAgora,
      excluirRejeitado,
    };
  }, [dados, leitura, repo, usuarioId, cota, sincronizarAgora, excluirRejeitado]);

  return (
    <SyncContext.Provider value={status}>
      <SyncInfoContext.Provider value={info}>{children}</SyncInfoContext.Provider>
    </SyncContext.Provider>
  );
}
