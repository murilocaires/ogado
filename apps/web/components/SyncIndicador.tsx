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
 * Indicador global de sincronização (RF-075): Sincronizado · Sem conexão · N pendentes · Erro.
 * `lateral` vive no menu (desktop); `compacto` aparece no topo da tela estreita. O botão
 * "Sincronizar agora" (RF-074) e o acesso a "Precisa de atenção" ficam junto.
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
  const comConta = status !== 'desligado';
  const compacto = variante === 'compacto';

  // Sem conta não há nuvem: no topo da tela estreita o indicador nem aparece.
  if (compacto && !comConta) return null;

  return (
    <div className={`sync-ind ${variante}`} data-tom={r.tom}>
      <span
        className={`sync-pill ${r.tom}`}
        role={compacto ? undefined : 'status'}
        aria-live={compacto ? undefined : 'polite'}
      >
        <i aria-hidden="true" />
        {r.texto}
      </span>
      {!compacto && <span className="sync-detalhe">{r.detalhe}</span>}
      {comConta && (
        <button
          type="button"
          className={compacto ? 'btn sec sm' : 'btn ghost sm block'}
          onClick={info.sincronizarAgora}
          disabled={status === 'sincronizando'}
        >
          Sincronizar agora
        </button>
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
