'use client';

import { useEffect } from 'react';
import { obterControladorAtualizacao } from '../lib/pwa/atualizacao';
import { iniciarCapturaInstalacao } from '../lib/pwa/instalacao';
import { haDialogoAberto } from './Dialog';

/** Id do build (muda a cada deploy): é a versão do service worker e dos caches (RF-077). */
const BUILD_ID = process.env['NEXT_PUBLIC_BUILD_ID'] ?? 'dev';
const VERIFICAR_ATUALIZACAO_MS = 60 * 60 * 1000;

/**
 * Raiz do app: registra o service worker (só em produção, que é HTTPS; em dev o cache atrapalharia)
 * e começa a capturar o `beforeinstallprompt` antes de qualquer tela pedir. O worker novo fica em
 * espera até o usuário aceitar a atualização (AtualizacaoBanner).
 */
export function PwaBootstrap() {
  useEffect(() => {
    iniciarCapturaInstalacao();
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const controlador = obterControladorAtualizacao(haDialogoAberto);
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const registrar = (): void => {
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`, { scope: '/' })
        .then((registro) => {
          controlador?.observar(registro);
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
