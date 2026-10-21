'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { esqueciSenhaRequestSchema } from '@bovaro/contracts';
import { createApiClient, type ApiClient, type ApiFailure } from '../lib/auth/api-client';
import { MSG_RECUPERACAO, mensagemFalhaRecuperacao } from '../lib/auth/recuperacao-senha';
import { useOnline } from '../lib/auth/session-provider';
import { AuthShell } from './AuthShell';

type FocusTarget = 'email' | 'alert' | 'done';

/** RF-002: pede o link de redefinição. A confirmação é sempre a mesma, exista a conta ou não. */
export function EsqueciSenhaScreen({ api }: { api?: ApiClient }) {
  const client = useMemo(() => api ?? createApiClient(), [api]);
  const online = useOnline();
  const emailId = `${useId()}-email`;

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusReq, setFocusReq] = useState<{ target: FocusTarget; n: number } | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (!focusReq) return;
    const el = { email: emailRef.current, alert: alertRef.current, done: doneRef.current }[
      focusReq.target
    ];
    el?.focus();
  }, [focusReq]);

  function focus(target: FocusTarget): void {
    setFocusReq((p) => ({ target, n: (p?.n ?? 0) + 1 }));
  }

  const alertText = !online
    ? MSG_RECUPERACAO.offline
    : failure
      ? mensagemFalhaRecuperacao(failure)
      : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current) return;
    if (!navigator.onLine) {
      focus('alert');
      return;
    }
    setFailure(null);
    const parsed = esqueciSenhaRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? 'Informe um e-mail válido.');
      focus('email');
      return;
    }
    setEmailError(null);

    submitting.current = true;
    setLoading(true);
    const result = await client.forgotPassword(parsed.data);
    submitting.current = false;
    setLoading(false);

    if (result.ok) {
      setSent(true);
      focus('done');
      return;
    }
    if (result.kind === 'validacao') {
      setEmailError(result.campos[0]?.mensagem ?? 'Informe um e-mail válido.');
      focus('email');
      return;
    }
    setFailure(result);
    focus('alert');
  }

  return (
    <AuthShell mobileTitle="Esqueci minha senha">
      {sent ? (
        <div className="auth-card">
          <div className="desktop-title">
            <h1 className="disp">Confira seu e-mail</h1>
          </div>
          <div ref={doneRef} tabIndex={-1} role="status" className="notice notice-ok">
            {MSG_RECUPERACAO.confirmacaoEsqueci}
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5 }}>
            <Link href="/entrar" className="link">
              Voltar para Entrar
            </Link>
          </p>
        </div>
      ) : (
        <form className="auth-card" onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="desktop-title">
            <h1 className="disp">Esqueci minha senha</h1>
            <p className="sub">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
          </div>

          {alertText && (
            <div
              ref={alertRef}
              tabIndex={-1}
              role="alert"
              className={`notice ${!online ? 'notice-warn' : 'notice-error'}`}
            >
              {alertText}
            </div>
          )}

          <div className="lbl">
            <label htmlFor={emailId}>E-mail</label>
            <div className="fld" data-invalid={emailError ? 'true' : 'false'}>
              <input
                ref={emailRef}
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="voce@fazenda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? `${emailId}-erro` : undefined}
              />
            </div>
            {emailError && (
              <span className="err" id={`${emailId}-erro`}>
                {emailError}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={loading}
            aria-busy={loading}
          >
            {loading && <span className="spin" aria-hidden="true" />}
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>

          <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5 }}>
            <Link href="/entrar" className="link">
              Voltar para Entrar
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
