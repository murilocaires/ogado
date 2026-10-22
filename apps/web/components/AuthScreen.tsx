'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  loginRequestSchema,
  type LoginRequest,
  signupRequestSchema,
  type FieldError,
} from '@bovaro/contracts';
import type { ApiFailure } from '../lib/auth/api-client';
import { useOnline, useSessionController, useSessionState } from '../lib/auth/session-provider';
import { AuthShell } from './AuthShell';
import { GoogleLink } from './GoogleButton';
import { PasswordRules } from './PasswordRules';

export type AuthMode = 'entrar' | 'cadastrar';

type FieldName = 'email' | 'senha' | 'confirmacao' | 'aceiteTermos';
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
  confirmacaoVazia: 'Repita a senha.',
  confirmacaoDiferente: 'As senhas não coincidem.',
  aceiteObrigatorio: 'Marque que leu e aceita os Termos de Uso e a Política de Privacidade.',
  googleContaExistente:
    'Já existe uma conta com este e-mail. Entre com a senha e vincule o Google em Conta.',
  google: 'Não foi possível entrar com o Google. Tente de novo.',
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
    if (
      (campo.caminho === 'email' ||
        campo.caminho === 'senha' ||
        campo.caminho === 'aceiteTermos') &&
      !errors[campo.caminho]
    ) {
      errors[campo.caminho] = campo.mensagem;
    }
  }
  return errors;
}

type Validation = { ok: true; body: LoginRequest } | { ok: false; errors: FieldErrors };

const LINK_NOVA_ABA = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Valida com os mesmos schemas da API; o corpo enviado é o normalizado (e-mail sem espaços/maiúsculas). */
function validate(
  mode: AuthMode,
  email: string,
  senha: string,
  confirmacao: string,
  aceite: boolean,
): Validation {
  const parsed =
    mode === 'entrar'
      ? loginRequestSchema.safeParse({ email, senha })
      : signupRequestSchema.safeParse({ email, senha, aceiteTermos: aceite });
  const errors: FieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field !== 'email' && field !== 'senha' && field !== 'aceiteTermos') continue;
      if (errors[field]) continue;
      errors[field] =
        field === 'senha' && mode === 'cadastrar' && senha !== ''
          ? MSG.senhaRequisitos
          : field === 'aceiteTermos'
            ? MSG.aceiteObrigatorio
            : issue.message;
    }
  }
  // A confirmação é só da tela: nunca vai para a API.
  if (mode === 'cadastrar') {
    if (confirmacao === '') errors.confirmacao = MSG.confirmacaoVazia;
    else if (confirmacao !== senha) errors.confirmacao = MSG.confirmacaoDiferente;
  }
  if (parsed.success && !errors.confirmacao) {
    return { ok: true, body: { email: parsed.data.email, senha: parsed.data.senha } };
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
  const [confirmacao, setConfirmacao] = useState('');
  const [aceite, setAceite] = useState(false);
  const [googleErro, setGoogleErro] = useState<string | null>(null);
  const [verSenha, setVerSenha] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const [senhaTocada, setSenhaTocada] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; n: number } | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const confirmacaoRef = useRef<HTMLInputElement>(null);
  const aceiteRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  const isLogin = mode === 'entrar';
  const emailId = `${ids}-email`;
  const senhaId = `${ids}-senha`;
  const confirmacaoId = `${ids}-confirmacao`;
  const aceiteId = `${ids}-aceite`;
  const rulesId = `${ids}-regras`;

  useEffect(() => {
    if (session.status === 'autenticado') router.replace('/painel');
  }, [session.status, router]);

  // Retorno do Google com erro (?erro=google...): mostra o aviso e tira o parâmetro da URL.
  useEffect(() => {
    if (!isLogin) return;
    const params = new URLSearchParams(window.location.search);
    const erro = params.get('erro');
    if (erro !== 'google' && erro !== 'google-conta-existente') return;
    setGoogleErro(erro === 'google' ? MSG.google : MSG.googleContaExistente);
    params.delete('erro');
    const resto = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + (resto ? `?${resto}` : ''),
    );
    setFocusRequest({ target: 'alert', n: 1 });
  }, [isLogin]);

  useEffect(() => {
    if (!focusRequest) return;
    const element =
      focusRequest.target === 'email'
        ? emailRef.current
        : focusRequest.target === 'senha'
          ? senhaRef.current
          : focusRequest.target === 'confirmacao'
            ? confirmacaoRef.current
            : focusRequest.target === 'aceiteTermos'
              ? aceiteRef.current
              : alertRef.current;
    element?.focus();
  }, [focusRequest]);

  function requestFocus(target: FocusTarget): void {
    setFocusRequest((previous) => ({ target, n: (previous?.n ?? 0) + 1 }));
  }

  const offlineMessage = isLogin ? MSG.offlineEntrar : MSG.offlineCadastrar;
  const showOffline = !online;
  const trocaDeConta = controller.getAccountMismatch?.();
  const alertText = showOffline
    ? offlineMessage
    : trocaDeConta
      ? 'Os dados deste aparelho pertencem a outra conta. Entre com a conta original para preservá-los.'
      : failure
        ? failureMessage(failure)
        : googleErro;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current) return;

    if (!navigator.onLine) {
      requestFocus('alert');
      return;
    }

    const validation = validate(mode, email, senha, confirmacao, aceite);
    setFailure(null);
    setGoogleErro(null);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      requestFocus(
        validation.errors.email
          ? 'email'
          : validation.errors.senha
            ? 'senha'
            : validation.errors.confirmacao
              ? 'confirmacao'
              : 'aceiteTermos',
      );
      return;
    }
    setFieldErrors({});

    submitting.current = true;
    setLoading(true);
    const { body } = validation;
    const result = await (isLogin
      ? controller.login(body)
      : controller.signup({ ...body, aceiteTermos: true }));
    submitting.current = false;
    setLoading(false);

    if (result.ok) return; // o efeito de sessão leva ao painel
    if (result.kind === 'validacao') {
      const serverErrors = fieldsFromServer(result.campos);
      setFieldErrors(serverErrors);
      if (serverErrors.email || serverErrors.senha || serverErrors.aceiteTermos) {
        requestFocus(serverErrors.email ? 'email' : serverErrors.senha ? 'senha' : 'aceiteTermos');
        return;
      }
    }
    setFailure(result);
    requestFocus('alert');
  }

  const emailError = fieldErrors.email;
  const senhaError = fieldErrors.senha;
  const confirmacaoError = fieldErrors.confirmacao;
  const aceiteError = fieldErrors.aceiteTermos;

  return (
    <AuthShell mobileTitle={isLogin ? 'Entrar' : 'Crie sua conta'}>
      <form className="auth-card" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="desktop-title">
          <h1 className="disp">{isLogin ? 'Entrar' : 'Criar conta'}</h1>
          <p className="sub">
            {isLogin ? 'Bem-vindo de volta ao Bovaro.' : 'Leva um minuto. Você já pode lançar.'}
          </p>
        </div>

        {!isLogin && (
          <>
            <GoogleLink texto="Cadastrar com Google" />
            <p className="auth-legal">
              Ao continuar com o Google você aceita os{' '}
              <Link href="/termos" {...LINK_NOVA_ABA}>
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" {...LINK_NOVA_ABA}>
                Política de Privacidade
              </Link>
              .
            </p>
            <p className="auth-sep" aria-hidden="true">
              ou cadastre com e-mail
            </p>
          </>
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
              onFocus={() => setSenhaTocada(true)}
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
              aria-label={
                verSenha
                  ? isLogin
                    ? 'Ocultar senha'
                    : 'Ocultar senhas'
                  : isLogin
                    ? 'Mostrar senha'
                    : 'Mostrar senhas'
              }
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

        {!isLogin && <PasswordRules senha={senha} id={rulesId} tocada={senhaTocada} />}

        {!isLogin && (
          <div className="lbl">
            <label htmlFor={confirmacaoId}>Confirmar senha</label>
            <div className="fld" data-invalid={confirmacaoError ? 'true' : 'false'}>
              <input
                ref={confirmacaoRef}
                id={confirmacaoId}
                type={verSenha ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repita a senha"
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
        )}

        {!isLogin && (
          <div className="lbl">
            <div className="check">
              <input
                ref={aceiteRef}
                id={aceiteId}
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                aria-invalid={aceiteError ? true : undefined}
                aria-describedby={aceiteError ? `${aceiteId}-erro` : undefined}
              />
              <label htmlFor={aceiteId}>
                Li e aceito os{' '}
                <Link href="/termos" {...LINK_NOVA_ABA}>
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link href="/privacidade" {...LINK_NOVA_ABA}>
                  Política de Privacidade
                </Link>
              </label>
            </div>
            {aceiteError && (
              <span className="err" id={`${aceiteId}-erro`}>
                {aceiteError}
              </span>
            )}
          </div>
        )}

        {isLogin && (
          <p style={{ margin: '-14px 0 0', textAlign: 'right', fontSize: 14.5 }}>
            <Link
              href="/esqueci-senha"
              className="link"
              style={{ display: 'inline-block', padding: '10px 0 10px 8px' }}
            >
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

        {isLogin && (
          <>
            <p className="auth-sep" aria-hidden="true">
              ou
            </p>
            <GoogleLink texto="Entrar com Google" />
          </>
        )}

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
