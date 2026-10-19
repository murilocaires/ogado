'use client';

import { useState, useSyncExternalStore } from 'react';
import { obterControladorAtualizacao, type ControladorAtualizacao } from '../lib/pwa/atualizacao';
import { haDialogoAberto } from './Dialog';

const semAssinatura = (): (() => void) => () => undefined;

/**
 * Aviso discreto "Nova versão disponível — Atualizar" (RF-077). A troca só acontece quando o
 * usuário clica e não há modal/edição aberta; os dados e a fila de sincronização ficam no aparelho.
 */
export function AtualizacaoBanner({
  controlador,
}: {
  controlador?: ControladorAtualizacao | null;
}) {
  const [ctrl] = useState<ControladorAtualizacao | null>(
    () => controlador ?? obterControladorAtualizacao(haDialogoAberto),
  );
  const disponivel = useSyncExternalStore(
    ctrl ? ctrl.subscribe : semAssinatura,
    () => ctrl?.getSnapshot() ?? false,
    () => false,
  );
  const [aviso, setAviso] = useState('');

  if (!ctrl || !disponivel) return null;

  function atualizar(): void {
    const r = ctrl?.aplicar();
    if (r === 'bloqueado') {
      setAviso('Termine o que está aberto e toque em Atualizar de novo. Nada foi perdido.');
    } else if (r === 'aplicando') {
      setAviso('Atualizando…');
    }
  }

  return (
    <div className="note banner atualizacao" role="status">
      <span>
        <b>Nova versão disponível.</b> Seus dados e o que ainda não foi enviado continuam salvos.
        {aviso && <span className="hint"> {aviso}</span>}
      </span>
      <button type="button" className="btn sm" onClick={atualizar}>
        Atualizar
      </button>
    </div>
  );
}
