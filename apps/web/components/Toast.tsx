'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Notificar = (mensagem: string) => void;

const ToastContext = createContext<Notificar | null>(null);

/** Avisos curtos de sucesso (região `status`, anunciada por leitores de tela). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagem, setMensagem] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notificar = useCallback<Notificar>((m) => {
    if (timer.current) clearTimeout(timer.current);
    setMensagem(m);
    timer.current = setTimeout(() => setMensagem(''), 2800);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const valor = useMemo(() => notificar, [notificar]);
  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div role="status" aria-live="polite" className={mensagem ? 'toast' : 'sr-only'}>
        {mensagem}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notificar {
  const notificar = useContext(ToastContext);
  if (!notificar) throw new Error('useToast fora do ToastProvider');
  return notificar;
}
