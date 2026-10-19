'use client';

import { useSyncExternalStore } from 'react';
import { rotuloSync } from '../lib/sync/indicador';
import { useSyncInfo, useSyncStatus } from './SyncProvider';

function assinarRede(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    assinarRede,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Indicador global de sincronização (RF-075): só aparece sem internet ("Sem conexão · N
 * pendentes") e some ao reconectar; a sincronização ao voltar é automática. `lateral` vive no
 * menu (desktop); `compacto` no topo da tela estreita. O aviso "N itens precisam de atenção"
 * aparece, online ou offline, só quando houver conflito ou item recusado.
 */
export function SyncIndicador({
  variante,
  onRevisar,
}: {
  variante: 'lateral' | 'compacto';
  onRevisar: () => void;
}) {
  const status = useSyncStatus();
  const info = useSyncInfo();
  const online = useOnline();
  const r = rotuloSync(status, info.totalPendentes, online);
  const atencao = info.conflitos.length + info.rejeitados.length;
  const compacto = variante === 'compacto';

  if (!r && atencao === 0) return null;

  return (
    <div className={`sync-ind ${variante}`} data-tom={r?.tom ?? 'neutro'}>
      {r && (
        <>
          <span
            className={`sync-pill ${r.tom}`}
            role={compacto ? undefined : 'status'}
            aria-live={compacto ? undefined : 'polite'}
          >
            <i aria-hidden="true" />
            {r.texto}
          </span>
          {!compacto && <span className="sync-detalhe">{r.detalhe}</span>}
        </>
      )}
      {atencao > 0 && (
        <button
          type="button"
          className={compacto ? 'btn danger sm' : 'btn ghost sm block sync-atencao'}
          onClick={onRevisar}
        >
          {atencao === 1 ? '1 item precisa de atenção' : `${atencao} itens precisam de atenção`}
        </button>
      )}
    </div>
  );
}

/** Selo por registro (RF-075): "pendente" até a nuvem confirmar; "precisa de atenção" se travou. */
export function SeloSync({ id }: { id: string }) {
  const info = useSyncInfo();
  const travado =
    info.conflitos.some((c) => c.id === id) || info.rejeitados.some((r) => r.id === id);
  if (travado) {
    return (
      <span className="selo atencao">
        <i aria-hidden="true" />
        precisa de atenção
      </span>
    );
  }
  if (!info.pendentes.has(id)) return null;
  return (
    <span className="selo">
      <i aria-hidden="true" />
      pendente
    </span>
  );
}
