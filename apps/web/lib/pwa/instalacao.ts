'use client';

import { useSyncExternalStore } from 'react';

/**
 * Estado de instalação do app (RF-070). O evento `beforeinstallprompt` dispara uma vez, talvez antes
 * de a tela de Conta existir; por isso a captura fica num módulo, não num componente.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let adiado: BeforeInstallPromptEvent | null = null;
let capturando = false;
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const o of ouvintes) o();
}

function aoPreparar(e: Event): void {
  e.preventDefault();
  adiado = e as BeforeInstallPromptEvent;
  avisar();
}

function aoInstalar(): void {
  adiado = null;
  avisar();
}

/** Começa a ouvir o navegador. Idempotente; chamada no layout raiz e ao assinar o estado. */
export function iniciarCapturaInstalacao(): void {
  if (capturando || typeof window === 'undefined') return;
  capturando = true;
  window.addEventListener('beforeinstallprompt', aoPreparar);
  window.addEventListener('appinstalled', aoInstalar);
}

/** Só para testes: volta ao estado inicial. */
export function resetarCapturaInstalacao(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeinstallprompt', aoPreparar);
    window.removeEventListener('appinstalled', aoInstalar);
  }
  capturando = false;
  adiado = null;
}

function assinar(listener: () => void): () => void {
  iniciarCapturaInstalacao();
  ouvintes.add(listener);
  return () => {
    ouvintes.delete(listener);
  };
}

/** Já roda como app (janela própria, ou "Tela de Início" no iOS). */
export function emModoApp(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standalone =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return ios || standalone;
}

/** iPhone/iPad (inclui iPadOS que se anuncia como Mac). Lá não existe prompt: só instruções. */
export function ehIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export type OpcaoInstalacao = 'prompt' | 'ios' | 'nenhuma';

function opcaoAtual(): OpcaoInstalacao {
  if (emModoApp()) return 'nenhuma';
  if (adiado) return 'prompt';
  if (ehIos()) return 'ios';
  return 'nenhuma';
}

/** O que oferecer: botão nativo, instruções do iOS ou nada (já instalado ou sem suporte). */
export function useOpcaoInstalacao(): OpcaoInstalacao {
  return useSyncExternalStore(assinar, opcaoAtual, () => 'nenhuma');
}

/** Abre o prompt nativo. Devolve true se o usuário aceitou. */
export async function pedirInstalacao(): Promise<boolean> {
  const evento = adiado;
  if (!evento) return false;
  adiado = null; // o evento só vale uma vez
  avisar();
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  return outcome === 'accepted';
}
