'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { obterAtualizadorSilencioso } from '../lib/pwa/atualizacao';
import { iniciarCapturaInstalacao } from '../lib/pwa/instalacao';
import { haDialogoAberto } from './Dialog';

/** Id do build (muda a cada deploy): é a versão do service worker e dos caches (RF-077). */
const BUILD_ID = process.env['NEXT_PUBLIC_BUILD_ID'] ?? 'dev';
const VERIFICAR_ATUALIZACAO_MS = 60 * 60 * 1000;

/**
 * Raiz do app: registra o service worker (só em produção, que é HTTPS; em dev o cache atrapalharia)
 * e começa a capturar o `beforeinstallprompt` antes de qualquer tela pedir. Atualização silenciosa
 * (ADR-0014): o worker novo assume sozinho e a página recarrega em momento seguro, sem aviso; cada
 * navegação entre telas é um desses momentos.
 */
export function PwaBootstrap() {
  const pathname = usePathname();
  useEffect(() => {
    obterAtualizadorSilencioso(haDialogoAberto)?.aoNavegar();
  }, [pathname]);

  useEffect(() => {
    iniciarCapturaInstalacao();
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    obterAtualizadorSilencioso(haDialogoAberto); // escuta o controllerchange desde já
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const registrar = (): void => {
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`, { scope: '/' })
        .then((registro) => {
          intervalo = setInterval(
            () => void registro.update().catch(() => undefined),
            VERIFICAR_ATUALIZACAO_MS,
          );
        })
        .catch(() => undefined);
    };
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
    return () => {
      window.removeEventListener('load', registrar);
      if (intervalo) clearInterval(intervalo);
    };
  }, []);
  return null;
}
