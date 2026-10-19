'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useOptionalSessionController } from '../lib/auth/session-provider';
import type { SessionState } from '../lib/auth/session-controller';
import { useRepo } from '../lib/repo/repo-provider';
import type { OGadoRepo, SyncableRepo } from '../lib/repo/types';
import { criarDadosClient, type DadosClient } from '../lib/sync/data-client';
import { sincronizar, type EstadoSyncStore } from '../lib/sync/engine';
import { browserSyncStore } from '../lib/sync/storage';

/** `desligado`: sem conta (dados só neste aparelho). */
export type SyncStatus = 'desligado' | 'sincronizando' | 'sincronizado' | 'offline' | 'erro';

const SyncContext = createContext<SyncStatus>('desligado');

export function useSyncStatus(): SyncStatus {
  return useContext(SyncContext);
}

function ehSincronizavel(repo: OGadoRepo): repo is SyncableRepo {
  return 'exportar' in repo && 'aplicar' in repo;
}

const ESPERA_MS = 1500;
const SEM_SESSAO: SessionState = { status: 'anonimo' };
const semAssinatura = (): (() => void) => () => undefined;

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
  const controller = useOptionalSessionController();
  const sessao = useSyncExternalStore(
    controller ? controller.subscribe : semAssinatura,
    () => controller?.getState() ?? SEM_SESSAO,
    () => SEM_SESSAO,
  );
  const [status, setStatus] = useState<SyncStatus>('desligado');
  const [cliente] = useState(() => api ?? criarDadosClient());
  const [armazem] = useState(() => estado ?? browserSyncStore());
  const estavaLogado = useRef(false);

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
      return;
    }
    estavaLogado.current = true;

    let ativo = true;
    let rodando = false;
    let repetir = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const rodar = async (): Promise<void> => {
      if (!ativo) return;
      if (rodando) {
        repetir = true;
        return;
      }
      rodando = true;
      setStatus('sincronizando');
      const resultado = await sincronizar({ repo, api: cliente, estado: armazem, usuarioId });
      rodando = false;
      if (!ativo) return;
      if (resultado === 'nao-autenticado') {
        controller.markUnauthorized();
        return;
      }
      setStatus(resultado === 'ok' ? 'sincronizado' : resultado === 'rede' ? 'offline' : 'erro');
      if (repetir && resultado === 'ok') {
        repetir = false;
        agendar();
      }
    };
    const agendar = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void rodar(), ESPERA_MS);
    };

    void rodar();
    const cancelar = repo.subscribe(agendar);
    const aoVoltarRede = (): void => void rodar();
    window.addEventListener('online', aoVoltarRede);
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
      cancelar();
      window.removeEventListener('online', aoVoltarRede);
    };
  }, [repo, controller, cliente, armazem, usuarioId, sessao.status]);

  return <SyncContext.Provider value={status}>{children}</SyncContext.Provider>;
}
