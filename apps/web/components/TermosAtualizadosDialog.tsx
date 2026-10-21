'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { TERMOS_VERSAO } from '@bovaro/contracts';
import { useSessionController } from '../lib/auth/session-provider';
import { mensagemFalha } from '../lib/auth/falhas';
import { Dialog } from './Dialog';

/** Atualizacoes pedem aceite em um dialogo dispensavel, sem substituir o produto. */
export function TermosAtualizadosDialog() {
  const controller = useSessionController();
  const ocupado = useRef(false);
  const [dispensado, setDispensado] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  if (dispensado) return null;

  function fechar() {
    if (!ocupado.current) setDispensado(true);
  }
  async function aceitar() {
    if (ocupado.current) return;
    ocupado.current = true;
    setAceitando(true);
    setFalha(null);
    try {
      const res = await controller.acceptTerms(TERMOS_VERSAO);
      if (res.ok) setDispensado(true);
      else setFalha(mensagemFalha(res));
    } catch {
      setFalha('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      ocupado.current = false;
      setAceitando(false);
    }
  }

  return (
    <div className="app termos-update-host">
      <Dialog
        titulo="Termos atualizados"
        onClose={fechar}
        estreito
        fecharNoFundo
        focoInicial="[data-adiar]"
      >
        <p>
          Atualizamos os Termos de Uso e a Política de Privacidade. Leia a nova versão e confirme
          seu aceite.
        </p>
        <p className="hint">Versão {TERMOS_VERSAO}</p>
        <p className="termos-update-links">
          <Link href="/termos" target="_blank" rel="noopener noreferrer" className="link">
            Termos de Uso
          </Link>
          <Link href="/privacidade" target="_blank" rel="noopener noreferrer" className="link">
            Política de Privacidade
          </Link>
        </p>
        {falha && (
          <p className="notice notice-error" role="alert">
            {falha}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btn sec sm"
            data-adiar
            disabled={aceitando}
            onClick={fechar}
          >
            Agora não
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={aceitando}
            aria-busy={aceitando}
            onClick={() => void aceitar()}
          >
            {aceitando ? 'Registrando…' : 'Li e aceito'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
