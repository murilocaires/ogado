'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newPasswordSchema } from '@ogado/contracts';
import { createApiClient, type ApiClient, type ApiFailure } from '../lib/auth/api-client';
import { MSG_RECUPERACAO, mensagemFalhaRecuperacao } from '../lib/auth/recuperacao-senha';
import { useOnline } from '../lib/auth/session-provider';
import { AuthShell } from './AuthShell';
import { PasswordRules } from './PasswordRules';

type Stage = 'lendo' | 'form' | 'invalido' | 'sucesso';
type FocusTarget = 'nova' | 'confirmacao' | 'alert' | 'done';
type FieldErrors = { nova?: string; confirmacao?: string };

/** RF-002: define a nova senha a partir do `?token=` do e-mail. */
export function RedefinirSenhaScreen({ api }: { api?: ApiClient }) {
  const client = useMemo(() => api ?? createApiClient(), [api]);
  const online = useOnline();
  const ids = useId();
  const novaId = `${ids}-nova`;
  const confirmacaoId = `${ids}-confirmacao`;
  const rulesId = `${ids}-regras`;

  const [stage, setStage] = useState<Stage>('lendo');
  const [token, setToken] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusReq, setFocusReq] = useState<{ target: FocusTarget; n: number } | null>(null);

  const novaRef = useRef<HTMLInputElement>(null);
  const confirmacaoRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const read = useRef(false);

  // Lê o token uma vez e o tira da URL: não fica no histórico nem no Referer.
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const found = new URLSearchParams(window.location.search).get('token') ?? '';
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    setToken(found);
    setStage(found ? 'form' : 'invalido');
  }, []);

  useEffect(() => {
    if (!focusReq) return;
    const el = {
      nova: novaRef.current,
      confirmacao: confirmacaoRef.current,
      alert: alertRef.current,
      done: doneRef.current,
    }[focusReq.target];
    el?.focus();
  }, [focusReq, stage]);

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

    const errors: FieldErrors = {};
    if (!newPasswordSchema.safeParse(nova).success) {
      errors.nova = nova === '' ? 'Informe a nova senha.' : MSG_RECUPERACAO.senhaRequisitos;
    }
    if (confirmacao === '') errors.confirmacao = MSG_RECUPERACAO.confirmacaoVazia;
    else if (confirmacao !== nova) errors.confirmacao = MSG_RECUPERACAO.confirmacaoDiferente;
    setFieldErrors(errors);
    if (errors.nova || errors.confirmacao) {
      focus(errors.nova ? 'nova' : 'confirmacao');
      return;
    }

    submitting.current = true;
    setLoading(true);
    const result = await client.resetPassword({ token, novaSenha: nova });
    submitting.current = false;
    setLoading(false);

    if (result.ok) {
      setStage('sucesso');
      setNova('');
      setConfirmacao('');
      setToken('');
      focus('done');
      return;
    }
    if (result.kind === 'link-invalido') {
      setStage('invalido');
      focus('alert');
      return;
    }
    if (result.kind === 'validacao') {
      const campo = result.campos.find((c) => c.caminho === 'novaSenha');
      setFieldErrors({ nova: campo?.mensagem ?? MSG_RECUPERACAO.senhaRequisitos });
      focus('nova');
      return;
    }
    setFailure(result);
    focus('alert');
  }

  if (stage === 'lendo') {
    return (
      <AuthShell mobileTitle="Redefinir senha">
        <div className="auth-card" role="status" aria-busy="true">
          Carregando…
        </div>
      </AuthShell>
    );
  }

  if (stage === 'invalido') {
    return (
      <AuthShell mobileTitle="Redefinir senha">
        <div className="auth-card">
          <div className="desktop-title">
            <h1 className="disp">Link inválido</h1>
          </div>
          <div ref={alertRef} tabIndex={-1} role="alert" className="notice notice-error">
            {MSG_RECUPERACAO.linkInvalido}
          </div>
          <Link href="/esqueci-senha" className="btn btn-primary">
            Pedir novo link
          </Link>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5 }}>
            <Link href="/entrar" className="link">
              Voltar para Entrar
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  if (stage === 'sucesso') {
    return (
      <AuthShell mobileTitle="Senha redefinida">
        <div className="auth-card">
          <div className="desktop-title">
            <h1 className="disp">Senha redefinida</h1>
          </div>
          <div ref={doneRef} tabIndex={-1} role="status" className="notice notice-ok">
            {MSG_RECUPERACAO.sucesso}
          </div>
          <Link href="/entrar" className="btn btn-primary">
            Entrar
          </Link>
        </div>
      </AuthShell>
    );
  }

  const { nova: novaError, confirmacao: confirmacaoError } = fieldErrors;

  return (
    <AuthShell mobileTitle="Redefinir senha">
      <form className="auth-card" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="desktop-title">
          <h1 className="disp">Redefinir senha</h1>
          <p className="sub">Crie uma nova senha para entrar na sua conta.</p>
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
          <label htmlFor={novaId}>Nova senha</label>
          <div className="fld" data-invalid={novaError ? 'true' : 'false'}>
            <input
              ref={novaRef}
              id={novaId}
              type={verSenha ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Crie uma senha"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              aria-invalid={novaError ? true : undefined}
              aria-describedby={[novaError ? `${novaId}-erro` : null, rulesId]
                .filter(Boolean)
                .join(' ')}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Ocultar senhas' : 'Mostrar senhas'}
              aria-pressed={verSenha}
              style={{
                border: 0,
                background: 'none',
                color: 'var(--folha-600)',
                font: '600 13px var(--font-ui)',
                cursor: 'pointer',
                minHeight: 44,
                minWidth: 44,
                padding: '0 4px',
              }}
            >
              {verSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {novaError && (
            <span className="err" id={`${novaId}-erro`}>
              {novaError}
            </span>
          )}
        </div>

        <PasswordRules senha={nova} id={rulesId} />

        <div className="lbl">
          <label htmlFor={confirmacaoId}>Repita a nova senha</label>
          <div className="fld" data-invalid={confirmacaoError ? 'true' : 'false'}>
            <input
              ref={confirmacaoRef}
              id={confirmacaoId}
              type={verSenha ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              aria-invalid={confirmacaoError ? true : undefined}
              aria-describedby={confirmacaoError ? `${confirmacaoId}-erro` : undefined}
            />
          </div>
          {confirmacaoError && (
            <span className="err" id={`${confirmacaoId}-erro`}>
              {confirmacaoError}
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
          {loading ? 'Salvando…' : 'Redefinir senha'}
        </button>
      </form>
    </AuthShell>
  );
}
