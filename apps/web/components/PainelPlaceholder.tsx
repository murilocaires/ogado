'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSessionController, useSessionState } from '../lib/auth/session-provider';
import { LogoMark, Wordmark } from './Logo';

/** Painel provisório (o real é outro ticket): prova a jornada de sessão e o logout explícito. */
export function PainelPlaceholder() {
  const router = useRouter();
  const controller = useSessionController();
  const session = useSessionState();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const exitButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (session.status === 'anonimo') router.replace('/entrar');
  }, [session.status, router]);

  useEffect(() => {
    if (confirming) {
      restoreFocus.current = true;
      cancelButton.current?.focus();
      return;
    }
    // Fechou: o fundo deixou de ser inerte nesta renderização, então o foco volta ao botão que abriu.
    if (restoreFocus.current) {
      restoreFocus.current = false;
      exitButton.current?.focus();
    }
  }, [confirming]);

  useEffect(() => {
    if (!confirming) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        if (!leaving) setConfirming(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? [],
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const outside = !dialogRef.current?.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirming, leaving]);

  function closeDialog(): void {
    if (leaving) return;
    setConfirming(false);
  }

  async function leave(): Promise<void> {
    if (leaving) return;
    setLeaving(true);
    setLogoutFailed(false);
    const result = await controller.logout();
    setLeaving(false);
    if (result.ok) return; // anonimo: o efeito acima leva a /entrar
    setLogoutFailed(true);
    setConfirming(false);
  }

  if (session.status === 'verificando' || session.status === 'anonimo') {
    return (
      <main className="shell">
        <p role="status">Verificando sua sessão…</p>
      </main>
    );
  }

  return (
    <>
      <main className="shell" inert={confirming || undefined}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoMark size={40} />
          <Wordmark size={24} />
        </header>

        {session.status === 'expirada' && (
          <div className="notice notice-warn" role="status">
            <strong>Entre de novo</strong>
            <p style={{ margin: '4px 0 8px' }}>
              Sua sessão terminou. Seus dados continuam salvos neste aparelho.
            </p>
            <Link href="/entrar" className="btn btn-primary" style={{ width: 'auto' }}>
              Entrar
            </Link>
          </div>
        )}

        {session.status === 'offline-nao-verificado' && (
          <div className="notice notice-warn" role="status">
            <strong>Você está sem internet</strong>
            <p style={{ margin: '4px 0 0' }}>
              Pode continuar. Tudo fica salvo neste aparelho e sobe quando a conexão voltar.
            </p>
          </div>
        )}

        <h1 className="disp">Painel</h1>

        <section className="card" aria-label="Sua conta">
          {session.status === 'autenticado' ? (
            <p style={{ margin: 0 }}>
              Você entrou como <strong>{session.usuario.email}</strong>.
            </p>
          ) : (
            <p style={{ margin: 0 }}>Sessão não verificada.</p>
          )}
          <p style={{ margin: '8px 0 0', color: 'var(--tinta-2)' }}>
            O painel completo chega nos próximos tickets.
          </p>
        </section>

        {logoutFailed && (
          <div className="notice notice-error" role="alert">
            Não foi possível sair agora. Verifique a conexão e tente de novo. Nada foi apagado deste
            aparelho.
          </div>
        )}

        {session.status === 'autenticado' && (
          <div>
            <button
              ref={exitButton}
              type="button"
              className="btn btn-quiet"
              style={{ width: 'auto', padding: '0 24px' }}
              onClick={() => setConfirming(true)}
            >
              Sair
            </button>
          </div>
        )}
      </main>
      {confirming && (
        <div className="overlay">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sair-titulo"
            className="dialog"
          >
            <h2 id="sair-titulo" className="disp">
              Sair deste aparelho?
            </h2>
            <p style={{ margin: 0, color: 'var(--tinta-2)', lineHeight: 1.5 }}>
              Ao sair, os dados guardados neste aparelho são apagados. Lançamentos que ainda não
              subiram para o servidor se perdem.
            </p>
            <div className="row">
              <button
                ref={cancelButton}
                type="button"
                className="btn btn-quiet"
                onClick={closeDialog}
                aria-disabled={leaving}
              >
                Continuar logado
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void leave()}
                aria-busy={leaving}
                aria-disabled={leaving}
              >
                {leaving ? 'Saindo…' : 'Sair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
