'use client';

import { useState, useSyncExternalStore } from 'react';
import type { SessionState } from '../lib/auth/session-controller';
import { useOptionalSessionController } from '../lib/auth/session-provider';
import { useOpcaoInstalacao } from '../lib/pwa/instalacao';
import { InstalarApp } from './InstalarApp';

export const CHAVE_DISPENSADO = 'ogado.instalar.dispensado';
/** Depois de "Agora não", só volta a sugerir depois deste tempo. */
export const DIAS_SEM_SUGERIR = 14;

const SEM_SESSAO: SessionState = { status: 'anonimo' };
const semAssinatura = (): (() => void) => () => undefined;

export function foiDispensado(agora = Date.now()): boolean {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DISPENSADO);
    if (!bruto) return false;
    const quando = Number(bruto);
    return Number.isFinite(quando) && agora - quando < DIAS_SEM_SUGERIR * 86_400_000;
  } catch {
    return false;
  }
}

function dispensar(agora = Date.now()): void {
  try {
    window.localStorage.setItem(CHAVE_DISPENSADO, String(agora));
  } catch {
    /* sem armazenamento: some só nesta sessão */
  }
}

/**
 * Depois do login, se o app ainda não está instalado, sugere instalar (RF-070). Aparece no topo da
 * tela, não bloqueia nada e, com "Agora não", some por 14 dias. Instalado ou sem suporte: não aparece.
 */
export function SugestaoInstalar() {
  const controller = useOptionalSessionController();
  const sessao = useSyncExternalStore(
    controller ? controller.subscribe : semAssinatura,
    () => controller?.getState() ?? SEM_SESSAO,
    () => SEM_SESSAO,
  );
  const opcao = useOpcaoInstalacao();
  const [oculto, setOculto] = useState(() => foiDispensado());

  if (sessao.status !== 'autenticado' || opcao === 'nenhuma' || oculto) return null;

  return (
    <div className="note banner sugestao-instalar" role="region" aria-label="Instalar o app">
      <p style={{ margin: 0 }}>
        <b>Instale o O Gado no seu aparelho.</b> Abre mais rápido, em tela cheia, e funciona mesmo
        sem internet.
      </p>
      <div className="sugestao-acoes">
        <InstalarApp className="btn sm" />
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            dispensar();
            setOculto(true);
          }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
