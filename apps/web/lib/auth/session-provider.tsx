'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createApiClient } from './api-client';
import {
  browserIdentityStore,
  createSessionController,
  type SessionController,
  type SessionState,
} from './session-controller';

const SessionContext = createContext<SessionController | null>(null);

const SERVER_STATE: SessionState = { status: 'verificando' };

function createBrowserController(): SessionController {
  return createSessionController({
    api: createApiClient(),
    identity: browserIdentityStore(),
    // O banco local entra com o T-14; até lá não há nada a apagar além da identidade.
    clearLocalData: () => undefined,
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
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [value]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionController(): SessionController {
  const controller = useContext(SessionContext);
  if (!controller) throw new Error('useSessionController fora do SessionProvider');
  return controller;
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
