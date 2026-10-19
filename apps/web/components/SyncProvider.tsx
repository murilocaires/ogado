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
import { criarDadosClient, type DadosClient } from '../lib/sync/data-client';
import {
  pendentes as calcularPendentes,
  resolverConflito,
  sincronizar,
  type Conflito,
  type EscolhaConflito,
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
  /** Aplica a decisão do usuário sobre um conflito e sincroniza (RF-076). */
  resolver: (id: string, escolha: EscolhaConflito) => void;
}

const INFO_VAZIA: SyncInfo = {
  pendentes: new Set(),
  totalPendentes: 0,
  conflitos: [],
  rejeitados: [],
  cotaQuaseCheia: null,
  sincronizarAgora: () => undefined,
  resolver: () => undefined,
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
    resolver: (id: string, escolha: EscolhaConflito) => void;
  } | null>(null);

  const usuarioId = sessao.status === 'autenticado' ? sessao.usuario.id : null;

  useEffect(() => {
    if (!controller || !ehSincronizavel(repo)) return;
    if (usuarioId === null) {
      // Saiu (logout confirmado): zera a memória do app; o disco já foi limpo pelo controlador.
      if (sessao.status === 'anonimo' && estavaLogado.current) {
        estavaLogado.current = false;
        repo.limpar();
      }
      setStatus('desligado');
      setLeitura({ carregado: false, estado: null });
      setCota(null);
      return;
    }
    estavaLogado.current = true;
    setLeitura({ carregado: true, estado: armazem.ler() });

    let ativo = true;
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
        const resultado = await sincronizar({ repo, api: cliente, estado: armazem, usuarioId });
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

    acoes.current = {
      agora: () => {
        if (timer) clearTimeout(timer);
        void rodar();
      },
      resolver: (id, escolha) => {
        void (async () => {
          // A decisão mexe no estado de sincronização: espera qualquer rodada em curso terminar.
          while (rodando) await atual;
          if (!ativo) return;
          resolverConflito({ repo, estado: armazem, usuarioId, id, escolha });
          setLeitura({ carregado: true, estado: armazem.ler() });
          void rodar();
        })();
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
      window.removeEventListener('online', aoVoltarRede);
    };
  }, [repo, controller, cliente, armazem, usuarioId, sessao.status]);

  const sincronizarAgora = useCallback(() => acoes.current?.agora(), []);
  const resolver = useCallback(
    (id: string, escolha: EscolhaConflito) => acoes.current?.resolver(id, escolha),
    [],
  );

  const info = useMemo<SyncInfo>(() => {
    const logado = usuarioId !== null && leitura.carregado && ehSincronizavel(repo);
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
      rejeitados = (leitura.estado?.rejeitados ?? []).filter((r) => vivos.has(r.id));
      conflitos = leitura.estado?.conflitos ?? [];
    }
    return {
      pendentes: ids,
      totalPendentes: ids.size,
      conflitos,
      rejeitados,
      cotaQuaseCheia: cota,
      sincronizarAgora,
      resolver,
    };
  }, [dados, leitura, repo, usuarioId, cota, sincronizarAgora, resolver]);

  return (
    <SyncContext.Provider value={status}>
      <SyncInfoContext.Provider value={info}>{children}</SyncInfoContext.Provider>
    </SyncContext.Provider>
  );
}
