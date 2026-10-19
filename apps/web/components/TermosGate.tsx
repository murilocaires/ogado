'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TERMOS_VERSAO, type UsuarioDto } from '@ogado/contracts';
import { MSG_CONTA, mensagemFalha } from '../lib/auth/falhas';
import { useOnline, useSessionController } from '../lib/auth/session-provider';
import { ApagarDialog } from './ContaScreen';

const LINK_NOVA_ABA = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * Tela bloqueante (RNF-009): usuário autenticado cujo aceite não é da versão vigente (conta nova do
 * Google ou termos atualizados). O produto não é renderizado por trás. Alternativas: sair ou apagar.
 */
export function TermosGate({ usuario }: { usuario: UsuarioDto }) {
  const router = useRouter();
  const controller = useSessionController();
  const online = useOnline();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const ocupado = useRef(false);
  const [aceitando, setAceitando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const primeiraVez = usuario.aceiteTermosVersao === null;

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  async function aceitar(): Promise<void> {
    if (ocupado.current) return;
    setFalha(null);
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    ocupado.current = true;
    setAceitando(true);
    const res = await controller.acceptTerms(TERMOS_VERSAO);
    ocupado.current = false;
    setAceitando(false);
    if (!res.ok) setFalha(mensagemFalha(res));
    // Sucesso: o estado da sessão passa a `aceiteVigente` e o produto é liberado.
  }

  async function sair(): Promise<void> {
    if (ocupado.current) return;
    ocupado.current = true;
    setSaindo(true);
    setFalha(null);
    const res = await controller.logout();
    ocupado.current = false;
    setSaindo(false);
    if (res.ok) router.replace('/entrar');
    else setFalha(mensagemFalha(res));
  }

  return (
    <main className="shell" aria-labelledby="termos-gate-titulo">
      <h1 id="termos-gate-titulo" ref={tituloRef} tabIndex={-1} className="disp">
        {primeiraVez
          ? 'Aceite os termos para continuar'
          : 'Termos atualizados — aceite para continuar'}
      </h1>
      <p style={{ margin: 0, lineHeight: 1.55 }}>
        {primeiraVez
          ? 'Para usar o O Gado, leia e aceite os Termos de Uso e a Política de Privacidade.'
          : 'Atualizamos os Termos de Uso e a Política de Privacidade. Leia as novas versões e aceite para continuar usando o O Gado.'}{' '}
        Versão {TERMOS_VERSAO}.
      </p>
      <ul style={{ margin: 0, paddingLeft: 22, lineHeight: 1.9 }}>
        <li>
          <Link href="/termos" className="legal-link" {...LINK_NOVA_ABA}>
            Termos de Uso (abre em nova aba)
          </Link>
        </li>
        <li>
          <Link href="/privacidade" className="legal-link" {...LINK_NOVA_ABA}>
            Política de Privacidade (abre em nova aba)
          </Link>
        </li>
      </ul>

      {(falha || !online) && (
        <div className="notice notice-error" role="alert">
          {falha ?? MSG_CONTA.offline}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          aria-busy={aceitando}
          aria-disabled={aceitando}
          onClick={() => void aceitar()}
        >
          {aceitando ? 'Salvando…' : 'Li e aceito'}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          aria-busy={saindo}
          aria-disabled={saindo}
          onClick={() => void sair()}
        >
          {saindo ? 'Saindo…' : 'Sair'}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => setApagando(true)}>
          Apagar minha conta
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--tinta-2)', lineHeight: 1.5 }}>
        Sem o aceite não é possível usar o serviço. Ao sair, os dados guardados neste aparelho são
        apagados; o que já está na sua conta volta quando você entrar de novo.
      </p>

      {apagando && <ApagarDialog onClose={() => setApagando(false)} />}
    </main>
  );
}
