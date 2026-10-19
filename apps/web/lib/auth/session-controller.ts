import type {
  FazendaDto,
  FazendaPatch,
  LoginRequest,
  PerfilRequest,
  SenhaRequest,
  SessionResponse,
  SignupRequest,
  UsuarioDto,
} from '@ogado/contracts';
import type { ApiClient, ApiResult } from './api-client';

/** Identidade local: ids que não são segredo (ADR-0010 f). Nunca token, senha nem cookie. */
export interface LocalIdentity {
  usuarioId: string;
  fazendaId: string;
}

export interface IdentityStore {
  read(): LocalIdentity | null;
  write(identity: LocalIdentity): void;
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
  /** RF-005: define ou altera a senha (a atual é exigida pela API quando já existe). */
  changePassword(body: SenhaRequest): Promise<ApiResult<void>>;
  /** RF-011: grava nome/área da fazenda; em sucesso o estado passa a refletir a fazenda devolvida. */
  updateFazenda(body: FazendaPatch): Promise<ApiResult<SessionResponse>>;
  /** RF-007: apaga a conta no servidor e, só depois do 204, o aparelho (como no logout). */
  deleteAccount(): Promise<ApiResult<void>>;
  /** Qualquer 401 vindo de outra chamada (sync, dados): expira sem apagar nada (RF-080). */
  markUnauthorized(): void;
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
  // Época: cada ação que muda a sessão invalida respostas antigas de verify() ainda em voo.
  let epoch = 0;
  const listeners = new Set<() => void>();

  function set(next: SessionState): void {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function authenticate(data: SessionResponse): void {
    const next = toIdentity(data);
    const stored = deps.identity.read();
    if (stored && stored.usuarioId !== next.usuarioId) {
      mismatch = { previous: stored, next };
      deps.onAccountMismatch?.(stored, next);
    } else {
      mismatch = null;
      deps.identity.write(next);
    }
    set({ status: 'autenticado', usuario: data.usuario, fazenda: data.fazenda });
  }

  function currentIdentity(): LocalIdentity | null {
    if (state.status === 'expirada' || state.status === 'offline-nao-verificado') {
      return state.identity;
    }
    return deps.identity.read();
  }

  function expire(): void {
    const identity = currentIdentity();
    set(identity ? { status: 'expirada', identity } : { status: 'anonimo' });
  }

  async function authCall(
    run: () => Promise<ApiResult<SessionResponse>>,
  ): Promise<ApiResult<SessionResponse>> {
    epoch += 1;
    const result = await run();
    if (result.ok) authenticate(result.data);
    return result;
  }

  /** Chamadas da Conta: 401 expira a sessão sem apagar nada (RF-080); sucesso atualiza o estado. */
  async function accountCall<T>(
    run: () => Promise<ApiResult<T>>,
    onOk?: (data: T) => void,
  ): Promise<ApiResult<T>> {
    const result = await run();
    if (result.ok) onOk?.(result.data);
    else if (result.kind === 'nao-autenticado' || result.kind === 'sessao-expirada') {
      epoch += 1;
      expire();
    }
    return result;
  }

  function applySession(data: SessionResponse): void {
    // Mesma conta: ids não mudam, então só o conteúdo exibido (nome, e-mail, fazenda) é trocado.
    epoch += 1;
    if (state.status === 'autenticado') {
      set({ status: 'autenticado', usuario: data.usuario, fazenda: data.fazenda });
    }
  }

  return {
    getState: () => state,
    getAccountMismatch: () => mismatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async verify() {
      const mine = ++epoch;
      const result = await deps.api.getSession();
      if (mine !== epoch) return; // resposta antiga: uma ação mais nova já decidiu o estado
      if (result.ok) return authenticate(result.data);
      if (result.kind === 'nao-autenticado' || result.kind === 'sessao-expirada') return expire();
      // Sem rede (ou API fora do ar): usa a identidade local, nunca apaga nada.
      const identity = deps.identity.read();
      set(identity ? { status: 'offline-nao-verificado', identity } : { status: 'anonimo' });
    },
    login: (body) => authCall(() => deps.api.login(body)),
    signup: (body) => authCall(() => deps.api.signup(body)),
    async logout() {
      epoch += 1;
      const result = await deps.api.logout();
      if (result.ok) {
        mismatch = null;
        await deps.clearLocalData();
        deps.identity.clear();
        set({ status: 'anonimo' });
      }
      return result;
    },
    updatePerfil: (body) => accountCall(() => deps.api.updatePerfil(body), applySession),
    changePassword: (body) => accountCall(() => deps.api.changePassword(body)),
    updateFazenda: (body) => accountCall(() => deps.api.updateFazenda(body), applySession),
    async deleteAccount() {
      const result = await accountCall(() => deps.api.deleteAccount());
      if (result.ok) {
        epoch += 1;
        mismatch = null;
        await deps.clearLocalData();
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
export function browserIdentityStore(key = 'ogado.identidade'): IdentityStore {
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
