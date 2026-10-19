'use client';

import { useEffect } from 'react';
import { iniciarCapturaInstalacao } from '../lib/pwa/instalacao';

/**
 * Raiz do app: registra o service worker (só em produção, que é HTTPS; em dev o cache atrapalharia)
 * e começa a capturar o `beforeinstallprompt` antes de qualquer tela pedir.
 */
export function PwaBootstrap() {
  useEffect(() => {
    iniciarCapturaInstalacao();
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const registrar = (): void => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    };
    if (document.readyState === 'complete') registrar();
    else {
      window.addEventListener('load', registrar, { once: true });
      return () => window.removeEventListener('load', registrar);
    }
    return undefined;
  }, []);
  return null;
}
