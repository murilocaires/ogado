import type {
  ExportacaoDados,
  FazendaDto,
  FazendaPatch,
  LoginRequest,
  PerfilRequest,
  SenhaRequest,
  SessionResponse,
  SignupRequest,
  UsuarioDto,
} from '@bovaro/contracts';
import type { ApiClient, ApiResult } from './api-client';

/** Identidade local: ids que não são segredo (ADR-0010 f). Nunca token, senha nem cookie. */
export interface LocalIdentity {
  usuarioId: string;
  fazendaId: string;
}

export interface IdentityStore {
  ready?(): Promise<void>;
  read(): LocalIdentity | null;
  write(identity: LocalIdentity): void | Promise<void>;
  clear(): void;
}

/**
 * Estados da sessão (ADR-0010 f). `verificando` é só o instante inicial, antes da primeira
 * resposta da API; não é um estado de negócio.
 */
export type SessionState =
  | { status: 'verificando' }
  | { status: 'autenticado'; usuario: UsuarioDto; fazenda: FazendaDto }
  | { status: 'anonimo' }
  | { status: 'offline-nao-verificado'; identity: LocalIdentity }
  | { status: 'expirada'; identity: LocalIdentity };

/** Login de uma conta diferente da que deixou dados neste aparelho (RF-078). Gancho do T-14. */
export interface AccountMismatch {
  previous: LocalIdentity;
  next: LocalIdentity;
}

export interface SessionController {
  getState(): SessionState;
  /** Não nulo quando o usuário autenticado difere da identidade guardada; nada é apagado sozinho. */
  getAccountMismatch(): AccountMismatch | null;
  subscribe(listener: () => void): () => void;
  verify(): Promise<void>;
  login(body: LoginRequest): Promise<ApiResult<SessionResponse>>;
  signup(body: SignupRequest): Promise<ApiResult<SessionResponse>>;
  /** Única ação que limpa o aparelho, e só depois do 204 (RF-078). */
  logout(): Promise<ApiResult<void>>;
  /** RF-004: grava nome/e-mail; em sucesso o estado passa a refletir o usuário devolvido. */
  updatePerfil(body: PerfilRequest): Promise<ApiResult<SessionResponse>>;
  /** RF-005/RF-006: define ou altera a senha (a atual só é exigida quando a conta já tem senha); em sucesso `temSenha` passa a verdadeiro. */
  changePassword(body: SenhaRequest): Promise<ApiResult<void>>;
  /** RF-006: desvincula o Google (a API recusa com 409 sem senha); em sucesso `googleVinculado` passa a falso. */
  unlinkGoogle(): Promise<ApiResult<void>>;
  /** RF-011: grava nome/área da fazenda; em sucesso o estado passa a refletir a fazenda devolvida. */
  updateFazenda(body: FazendaPatch): Promise<ApiResult<SessionResponse>>;
  /** RF-007: apaga a conta no servidor e, só depois do 204, o aparelho (como no logout). */
  deleteAccount(): Promise<ApiResult<void>>;
  /** RNF-009: baixa a cópia dos dados do titular; 401 expira a sessão sem apagar nada. */
  exportData(): Promise<ApiResult<ExportacaoDados>>;
  /** RNF-009: aceita a versão vigente dos termos; em sucesso o estado passa a `aceiteVigente`. */
  acceptTerms(versao: string): Promise<ApiResult<SessionResponse>>;
  /** RNF-009: pede o envio da cópia dos dados ao e-mail da conta (202 sempre igual). */
  sendDataByEmail(): Promise<ApiResult<void>>;
  /** Qualquer 401 vindo de outra chamada (sync, dados): expira sem apagar nada (RF-080). */
  markUnauthorized(): void;
  /** RF-078: mudança de identidade em outra aba invalida imediatamente respostas antigas. */
  identityChanged(): Promise<void>;
}

export interface SessionControllerDeps {
  api: ApiClient;
  identity: IdentityStore;
  /** Apaga o banco local/fila do aparelho. Chamada somente no logout confirmado. */
  clearLocalData: () => void | Promise<void>;
  /**
   * Chamado quando o `usuarioId` autenticado difere da identidade guardada. O controlador não apaga
   * nem sobrescreve nada: a confirmação e o destino da fila são do T-14.
   */
  onAccountMismatch?: (previous: LocalIdentity, next: LocalIdentity) => void;
}

function toIdentity(data: SessionResponse): LocalIdentity {
  return { usuarioId: data.usuario.id, fazendaId: data.fazenda.id };
}

export function createSessionController(deps: SessionControllerDeps): SessionController {
  let state: SessionState = { status: 'verificando' };
  let mismatch: AccountMismatch | null = null;
  // Cada mudança de sessão invalida todas as respostas anteriores, inclusive login/Conta.
  let epoch = 0;
  const listeners = new Set<() => void>();

  function set(next: SessionState): void {
    state = next;
    listeners.forEach((listener) => listener());
  }

  async function authenticate(data: SessionResponse, vigente: () => boolean): Promise<boolean> {
    const mine = epoch;
    await deps.identity.ready?.();
    if (!vigente()) return false;
    const next = toIdentity(data);
    const stored = deps.identity.read();
    if (stored && (stored.usuarioId !== next.usuarioId || stored.fazendaId !== next.fazendaId)) {
      mismatch = { previous: stored, next };
      deps.onAccountMismatch?.(stored, next);
      // Uma sessão válida de B não autoriza exibir o banco local que ainda pertence a A.
      set({ status: 'anonimo' });
      return false;
    } else {
      mismatch = null;
      await deps.identity.write(next);
    }
    if (mine !== epoch) return false;
    set({ status: 'autenticado', usuario: data.usuario, fazenda: data.fazenda });
    return true;
  }

  function currentIdentity(): LocalIdentity | null {
    if (state.status === 'autenticado') return toIdentity(state);
    if (state.status === 'expirada' || state.status === 'offline-nao-verificado') {
      return state.identity;
    }
    return deps.identity.read();
  }

  function expire(): void {
    const identity = currentIdentity();
    set(identity ? { status: 'expirada', identity } : { status: 'anonimo' });
  }

  function contextoAtual(): () => boolean {
    const mine = epoch;
    const identidade = deps.identity.read();
    return () => {
      const atual = deps.identity.read();
      return (
        mine === epoch &&
        identidade?.usuarioId === atual?.usuarioId &&
        identidade?.fazendaId === atual?.fazendaId
      );
    };
  }

  async function authCall(
    run: () => Promise<ApiResult<SessionResponse>>,
  ): Promise<ApiResult<SessionResponse>> {
    epoch += 1;
    const mine = epoch;
    try {
      await deps.identity.ready?.();
    } catch {
      return { ok: false, kind: 'bloqueada' };
    }
    if (mine !== epoch) return { ok: false, kind: 'sessao-expirada' };
    const vigente = contextoAtual();
    const result = await run();
    if (!vigente()) return { ok: false, kind: 'sessao-expirada' };
    if (result.ok) {
      try {
        if (!(await authenticate(result.data, vigente)))
          return { ok: false, kind: mismatch ? 'bloqueada' : 'sessao-expirada' };
      } catch {
        return { ok: false, kind: 'bloqueada' };
      }
    }
    return result;
  }

  /** Chamadas da Conta: 401 expira a sessão sem apagar nada (RF-080); sucesso atualiza o estado. */
  async function accountCall<T>(
    run: (api: ApiClient) => Promise<ApiResult<T>>,
    onOk?: (data: T) => void,
  ): Promise<ApiResult<T>> {
    const vigente = contextoAtual();
    const result = await run(accountApi());
    if (!vigente()) return { ok: false, kind: 'sessao-expirada' };
    if (result.ok) onOk?.(result.data);
    else if (result.kind === 'nao-autenticado' || result.kind === 'sessao-expirada') {
      epoch += 1;
      expire();
    }
    return result;
  }

  function accountApi(): ApiClient {
    const identity = currentIdentity();
    return identity ? (deps.api.forUser?.(identity.usuarioId) ?? deps.api) : deps.api;
  }

  function applySession(data: SessionResponse): void {
    // Mesma conta: ids não mudam, então só o conteúdo exibido (nome, e-mail, fazenda) é trocado.
    epoch += 1;
    if (state.status === 'autenticado') {
      if (data.usuario.id !== state.usuario.id || data.fazenda.id !== state.fazenda.id) return;
      set({ status: 'autenticado', usuario: data.usuario, fazenda: data.fazenda });
    }
  }

  /** Ajusta só os selos do usuário já autenticado (mesma conta, mesmos ids). */
  function patchUsuario(patch: Partial<UsuarioDto>): void {
    if (state.status !== 'autenticado') return;
    set({ ...state, usuario: { ...state.usuario, ...patch } });
  }

  async function verify(): Promise<void> {
    const mine = ++epoch;
    try {
      await deps.identity.ready?.();
    } catch {
      if (mine === epoch) set({ status: 'anonimo' });
      return;
    }
    if (mine !== epoch) return;
    const vigente = contextoAtual();
    const result = await deps.api.getSession();
    if (!vigente()) return;
    if (result.ok) {
      try {
        await authenticate(result.data, vigente);
      } catch {
        if (mine === epoch) set({ status: 'anonimo' });
      }
      return;
    }
    if (result.kind === 'nao-autenticado' || result.kind === 'sessao-expirada') return expire();
    const identity = deps.identity.read();
    set(identity ? { status: 'offline-nao-verificado', identity } : { status: 'anonimo' });
  }

  return {
    getState: () => state,
    getAccountMismatch: () => mismatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    verify,
    async identityChanged() {
      const mine = ++epoch;
      mismatch = null;
      set({ status: 'verificando' });
      try {
        await deps.identity.ready?.();
      } catch {
        if (mine === epoch) set({ status: 'anonimo' });
        return;
      }
      if (mine !== epoch) return;
      const identity = deps.identity.read();
      if (!identity) {
        set({ status: 'anonimo' });
        return;
      }
      // Não mostrar os dados da sessão anterior enquanto o cookie compartilhado é verificado.
      set({ status: 'verificando' });
      await verify();
    },
    login: (body) => authCall(() => deps.api.login(body)),
    signup: (body) => authCall(() => deps.api.signup(body)),
    async logout() {
      epoch += 1;
      const vigente = contextoAtual();
      const result = await accountApi().logout();
      if (!vigente()) return { ok: false, kind: 'sessao-expirada' };
      if (result.ok) {
        mismatch = null;
        await deps.clearLocalData();
        if (!vigente()) return { ok: false, kind: 'sessao-expirada' };
        deps.identity.clear();
        set({ status: 'anonimo' });
      }
      return result;
    },
    updatePerfil: (body) => accountCall((api) => api.updatePerfil(body), applySession),
    changePassword: (body) =>
      accountCall(
        (api) => api.changePassword(body),
        () => patchUsuario({ temSenha: true }),
      ),
    unlinkGoogle: () =>
      accountCall(
        (api) => api.unlinkGoogle(),
        () => patchUsuario({ googleVinculado: false }),
      ),
    updateFazenda: (body) => accountCall((api) => api.updateFazenda(body), applySession),
    exportData: () => accountCall((api) => api.exportData()),
    acceptTerms: (versao) => accountCall((api) => api.aceitarTermos(versao), applySession),
    sendDataByEmail: () => accountCall((api) => api.enviarDadosPorEmail()),
    async deleteAccount() {
      epoch += 1;
      const vigente = contextoAtual();
      const result = await accountCall((api) => api.deleteAccount());
      if (result.ok && !vigente()) return { ok: false, kind: 'sessao-expirada' };
      if (result.ok) {
        mismatch = null;
        await deps.clearLocalData();
        if (!vigente()) return { ok: false, kind: 'sessao-expirada' };
        deps.identity.clear();
        set({ status: 'anonimo' });
      }
      return result;
    },
    markUnauthorized() {
      epoch += 1;
      expire();
    },
  };
}

/** Armazém real da identidade (só ids; nunca segredo). Falhas de storage não derrubam o app. */
export function browserIdentityStore(key = 'bovaro.identidade'): IdentityStore {
  return {
    read() {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (
          typeof value === 'object' &&
          value !== null &&
          'usuarioId' in value &&
          'fazendaId' in value &&
          typeof value.usuarioId === 'string' &&
          typeof value.fazendaId === 'string'
        ) {
          return { usuarioId: value.usuarioId, fazendaId: value.fazendaId };
        }
        return null;
      } catch {
        return null;
      }
    },
    write(identity) {
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({ usuarioId: identity.usuarioId, fazendaId: identity.fazendaId }),
        );
      } catch {
        /* armazenamento indisponível: segue sem identidade local */
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* idem */
      }
    },
  };
}
