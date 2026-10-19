'use client';

import { descreverSync } from '../lib/sync/indicador';
import { AtencaoLista } from './AtencaoPainel';
import { useOnline } from './SyncIndicador';
import { useSyncInfo, useSyncStatus } from './SyncProvider';

/** Conta > Sincronização: estado, pendências, "Sincronizar agora" (RF-074) e "Precisa de atenção". */
export function SincronizacaoPainel() {
  const status = useSyncStatus();
  const info = useSyncInfo();
  const online = useOnline();
  const r = descreverSync(status, info.totalPendentes, online);

  return (
    <div className="panel" data-testid="painel-sync">
      <div className="bd">
        <div className="stack">
          <div>
            <span className={`sync-pill ${r.tom}`}>
              <i aria-hidden="true" />
              {r.texto}
            </span>
            <p
              style={{ margin: '8px 0 0', color: 'var(--tinta-2)', fontSize: 14, lineHeight: 1.5 }}
            >
              {r.detalhe}
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Precisa de atenção</h4>
            <AtencaoLista />
          </div>
        </div>
      </div>
      <div className="ft">
        <span className="hint">
          {info.totalPendentes === 0
            ? 'Nada aguardando envio.'
            : `${info.totalPendentes} ${info.totalPendentes === 1 ? 'item aguarda' : 'itens aguardam'} envio.`}
        </span>
        <button
          type="button"
          className="btn sm"
          onClick={info.sincronizarAgora}
          disabled={status === 'sincronizando'}
        >
          Sincronizar agora
        </button>
      </div>
    </div>
  );
}
