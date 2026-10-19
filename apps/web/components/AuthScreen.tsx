'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  loginRequestSchema,
  type LoginRequest,
  signupRequestSchema,
  type FieldError,
} from '@ogado/contracts';
import type { ApiFailure } from '../lib/auth/api-client';
import { useOnline, useSessionController, useSessionState } from '../lib/auth/session-provider';
import { AuthShell } from './AuthShell';
import { PasswordRules } from './PasswordRules';

export type AuthMode = 'entrar' | 'cadastrar';

type FieldName = 'email' | 'senha';
type FieldErrors = Partial<Record<FieldName, string>>;
type FocusTarget = FieldName | 'alert';

const MSG = {
  credenciais: 'E-mail ou senha incorretos. Confira e tente de novo.',
  offlineEntrar: 'Você está sem internet. Para entrar é preciso internet.',
  offlineCadastrar: 'Você está sem internet. Para criar a conta é preciso internet.',
  rede: 'Não foi possível conectar. Verifique a conexão e tente de novo.',
  servidor: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
  bloqueada: 'A solicitação foi bloqueada. Recarregue a página e tente de novo.',
  senhaRequisitos: 'A senha ainda não cumpre os requisitos abaixo.',
} as const;

function failureMessage(failure: ApiFailure): string {
  switch (failure.kind) {
    case 'credenciais':
      return MSG.credenciais;
    case 'rede':
      return MSG.rede;
    case 'bloqueada':
      return MSG.bloqueada;
    case 'muitas-tentativas':
      return failure.retryAfterSeconds
        ? `Muitas tentativas. Tente de novo em ${failure.retryAfterSeconds} segundos.`
        : 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    case 'conflito':
      // ADR-0010 Q4: a mensagem é a decisão do humano; o link "Entrar" vem junto.
      return 'Não foi possível criar a conta com este e-mail.';
    default:
      return MSG.servidor;
  }
}

function fieldsFromServer(campos: FieldError[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const campo of campos) {
    if ((campo.caminho === 'email' || campo.caminho === 'senha') && !errors[campo.caminho]) {
      errors[campo.caminho] = campo.mensagem;
    }
  }
  return errors;
}

type Validation = { ok: true; body: LoginRequest } | { ok: false; errors: FieldErrors };

/** Valida com os mesmos schemas da API; o corpo enviado é o normalizado (e-mail sem espaços/maiúsculas). */
function validate(mode: AuthMode, email: string, senha: string): Validation {
  const schema = mode === 'entrar' ? loginRequestSchema : signupRequestSchema;
  const parsed = schema.safeParse({ email, senha });
  if (parsed.success) return { ok: true, body: parsed.data };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field !== 'email' && field !== 'senha') continue;
    if (errors[field]) continue;
    errors[field] =
      field === 'senha' && mode === 'cadastrar' && senha !== ''
        ? MSG.senhaRequisitos
        : issue.message;
  }
  return { ok: false, errors };
}

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const controller = useSessionController();
  const session = useSessionState();
  const online = useOnline();
  const ids = useId();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; n: number } | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  const isLogin = mode === 'entrar';
  const emailId = `${ids}-email`;
  const senhaId = `${ids}-senha`;
  const rulesId = `${ids}-regras`;

  useEffect(() => {
    if (session.status === 'autenticado') router.replace('/painel');
  }, [session.status, router]);

  useEffect(() => {
    if (!focusRequest) return;
    const element =
      focusRequest.target === 'email'
        ? emailRef.current
        : focusRequest.target === 'senha'
          ? senhaRef.current
          : alertRef.current;
    element?.focus();
  }, [focusRequest]);

  function requestFocus(target: FocusTarget): void {
    setFocusRequest((previous) => ({ target, n: (previous?.n ?? 0) + 1 }));
  }

  const offlineMessage = isLogin ? MSG.offlineEntrar : MSG.offlineCadastrar;
  const showOffline = !online;
  const alertText = showOffline ? offlineMessage : failure ? failureMessage(failure) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current) return;

    if (!navigator.onLine) {
      requestFocus('alert');
      return;
    }

    const validation = validate(mode, email, senha);
    setFailure(null);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      requestFocus(validation.errors.email ? 'email' : 'senha');
      return;
    }
    setFieldErrors({});

    submitting.current = true;
    setLoading(true);
    const { body } = validation;
    const result = await (isLogin ? controller.login(body) : controller.signup(body));
    submitting.current = false;
    setLoading(false);

    if (result.ok) return; // o efeito de sessão leva ao painel
    if (result.kind === 'validacao') {
      const serverErrors = fieldsFromServer(result.campos);
      setFieldErrors(serverErrors);
      if (serverErrors.email || serverErrors.senha) {
        requestFocus(serverErrors.email ? 'email' : 'senha');
        return;
      }
    }
    setFailure(result);
    requestFocus('alert');
  }

  const emailError = fieldErrors.email;
  const senhaError = fieldErrors.senha;

  return (
    <AuthShell mobileTitle={isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}>
      <form className="auth-card" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="desktop-title">
          <h1 className="disp">{isLogin ? 'Entrar' : 'Criar conta'}</h1>
          <p className="sub">
            {isLogin ? 'Bem-vindo de volta ao seu gado.' : 'Leva um minuto. Você já pode lançar.'}
          </p>
        </div>

        {session.status === 'expirada' && isLogin && (
          <div className="notice notice-warn" role="status">
            <strong>Entre de novo</strong>
            <p style={{ margin: '4px 0 0' }}>
              Sua sessão terminou. Seus dados continuam salvos neste aparelho.
            </p>
          </div>
        )}

        {alertText && (
          <div
            ref={alertRef}
            tabIndex={-1}
            role="alert"
            className={`notice ${showOffline ? 'notice-warn' : 'notice-error'}`}
          >
            {alertText}
            {!showOffline && failure?.kind === 'conflito' && (
              <>
                {' '}
                Já tem conta?{' '}
                <Link href="/entrar" className="link" style={{ textDecoration: 'underline' }}>
                  Entrar
                </Link>
              </>
            )}
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

        <div className="lbl">
          <label htmlFor={senhaId}>Senha</label>
          <div className="fld" data-invalid={senhaError ? 'true' : 'false'}>
            <input
              ref={senhaRef}
              id={senhaId}
              type={verSenha ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder={isLogin ? 'Sua senha' : 'Crie uma senha'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={senhaError ? true : undefined}
              aria-describedby={
                [senhaError ? `${senhaId}-erro` : null, isLogin ? null : rulesId]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
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
          {senhaError && (
            <span className="err" id={`${senhaId}-erro`}>
              {senhaError}
            </span>
          )}
        </div>

        {!isLogin && <PasswordRules senha={senha} id={rulesId} />}

        {isLogin && (
          <p style={{ margin: 0, textAlign: 'right', fontSize: 14.5 }}>
            <Link href="/esqueci-senha" className="link">
              Esqueci minha senha
            </Link>
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          aria-disabled={loading}
          aria-busy={loading}
        >
          {loading && <span className="spin" aria-hidden="true" />}
          {loading
            ? isLogin
              ? 'Entrando…'
              : 'Criando conta…'
            : isLogin
              ? 'Entrar'
              : 'Criar conta'}
        </button>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5, color: 'var(--tinta-2)' }}>
          {isLogin ? 'Ainda não tem conta? ' : 'Já tem conta? '}
          <Link href={isLogin ? '/cadastrar' : '/entrar'} className="link">
            {isLogin ? 'Criar conta' : 'Entrar'}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
