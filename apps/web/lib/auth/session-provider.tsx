'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { limparDadosDoAparelho } from '../sync/storage';
import { canalLocal, LOCAL_ORIGIN } from '../repo/indexed-db';
import { createApiClient } from './api-client';
import { criarIdentidadeDuravel } from './durable-identity';
import {
  createSessionController,
  type SessionController,
  type SessionState,
} from './session-controller';

const SessionContext = createContext<SessionController | null>(null);

const SERVER_STATE: SessionState = { status: 'verificando' };

function createBrowserController(): SessionController {
  return createSessionController({
    api: createApiClient(),
    identity: criarIdentidadeDuravel(),
    // Logout confirmado (RF-078): apaga os dados do aparelho e o controle de sincronização.
    clearLocalData: limparDadosDoAparelho,
  });
}

export function SessionProvider({
  children,
  controller,
}: {
  children: ReactNode;
  controller?: SessionController;
}) {
  const [value] = useState(() => controller ?? createBrowserController());
  useEffect(() => {
    void value.verify();
    // Voltou a rede: reverifica (sai de offline-nao-verificado ou descobre que expirou).
    const onOnline = (): void => void value.verify();
    const onIdentity = (event: StorageEvent): void => {
      if (event.key === 'ogado.identidade' || event.key === null) void value.identityChanged();
    };
    const canal = canalLocal();
    if (canal)
      canal.onmessage = (event: MessageEvent<{ tipo?: string; origem?: string }>) => {
        if (
          event.data.origem !== LOCAL_ORIGIN &&
          ['identidade', 'limpar'].includes(event.data.tipo ?? '')
        )
          void value.identityChanged();
      };
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onIdentity);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', onIdentity);
      canal?.close();
    };
  }, [value]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionController(): SessionController {
  const controller = useContext(SessionContext);
  if (!controller) throw new Error('useSessionController fora do SessionProvider');
  return controller;
}

/** Para telas que funcionam com ou sem conta (o produto é usável sem entrar). */
export function useOptionalSessionController(): SessionController | null {
  return useContext(SessionContext);
}

export function useSessionState(): SessionState {
  const controller = useSessionController();
  return useSyncExternalStore(controller.subscribe, controller.getState, () => SERVER_STATE);
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** `navigator.onLine`; no servidor assume online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
