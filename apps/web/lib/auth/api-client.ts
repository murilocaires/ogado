import {
  errorEnvelopeSchema,
  exportacaoDadosSchema,
  fazendaSchema,
  sessionResponseSchema,
  type ExportacaoDados,
  type FazendaDto,
  type FazendaPatch,
  type FieldError,
  type LoginRequest,
  type EsqueciSenhaRequest,
  type PerfilRequest,
  type RedefinirSenhaRequest,
  type SenhaRequest,
  type SessionResponse,
  type SignupRequest,
} from '@bovaro/contracts';

/** Por que uma chamada falhou. A tela decide o texto; a API nunca dita a mensagem mostrada. */
export type ApiFailure =
  | { ok: false; kind: 'credenciais' }
  | { ok: false; kind: 'validacao'; campos: FieldError[] }
  /** `atual` só vem no 409 de versão da fazenda (ADR-0011 §4); e-mail em uso não traz nada. */
  | { ok: false; kind: 'conflito'; atual?: FazendaDto }
  | { ok: false; kind: 'nao-autenticado' }
  | { ok: false; kind: 'sessao-expirada' }
  | { ok: false; kind: 'muitas-tentativas'; retryAfterSeconds: number | null }
  | { ok: false; kind: 'bloqueada' }
  /** Link de redefinição de senha inválido, expirado ou já usado (RF-002); a API não distingue. */
  | { ok: false; kind: 'link-invalido' }
  | { ok: false; kind: 'rede' }
  | { ok: false; kind: 'servidor' }
  | { ok: false; kind: 'contrato' };

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export interface ApiClient {
  /** Contexto imutável para chamadas privadas e logout; cookie de outra conta é recusado. */
  forUser?(usuarioId: string): ApiClient;
  signup(body: SignupRequest): Promise<ApiResult<SessionResponse>>;
  login(body: LoginRequest): Promise<ApiResult<SessionResponse>>;
  /** Só é sucesso com 204 (o chamador limpa o aparelho depois disso, e só depois). */
  logout(): Promise<ApiResult<void>>;
  getSession(): Promise<ApiResult<SessionResponse>>;
  /** PATCH /conta/perfil (RF-004): devolve a sessão com o usuário atualizado. */
  updatePerfil(body: PerfilRequest): Promise<ApiResult<SessionResponse>>;
  /** PUT /conta/senha (RF-005): só é sucesso com 204. */
  changePassword(body: SenhaRequest): Promise<ApiResult<void>>;
  /** DELETE /conta/google (RF-006): só é sucesso com 204; 409 = conta sem senha definida. */
  unlinkGoogle(): Promise<ApiResult<void>>;
  /** PATCH /fazenda (RF-011): 409 devolve a fazenda atual em `atual`. */
  updateFazenda(body: FazendaPatch): Promise<ApiResult<SessionResponse>>;
  /** DELETE /conta (RF-007): só é sucesso com 204; o chamador limpa o aparelho depois. */
  deleteAccount(): Promise<ApiResult<void>>;
  /** GET /conta/exportar (RNF-009): cópia dos dados do titular, validada pelo contrato. */
  exportData(): Promise<ApiResult<ExportacaoDados>>;
  /** POST /conta/aceite (RNF-009): registra o aceite da versão vigente e devolve a sessão. */
  aceitarTermos(versao: string): Promise<ApiResult<SessionResponse>>;
  /** POST /conta/exportar/enviar (RNF-009): 202 sempre igual; o e-mail é da própria conta. */
  enviarDadosPorEmail(): Promise<ApiResult<void>>;
  /** POST /auth/senha/esqueci (RF-002): 202 é sempre o mesmo, exista a conta ou não. */
  forgotPassword(body: EsqueciSenhaRequest): Promise<ApiResult<void>>;
  /** POST /auth/senha/redefinir (RF-002): só é sucesso com 204; 400 vira `link-invalido`. */
  resetPassword(body: RedefinirSenhaRequest): Promise<ApiResult<void>>;
}

export interface ApiClientOptions {
  usuarioId?: string;
  /** Mesma origem: o Next repassa `/api/*` para a API (ADR-0010 a.5). */
  baseUrl?: string;
  fetch?: typeof fetch;
}

async function readFailure(res: Response): Promise<ApiFailure> {
  if (res.status >= 500) return { ok: false, kind: 'servidor' };
  let raw: unknown;
  let parsed: ReturnType<typeof errorEnvelopeSchema.safeParse> | undefined;
  try {
    raw = await res.json();
    parsed = errorEnvelopeSchema.safeParse(raw);
  } catch {
    parsed = undefined;
  }
  const erro = parsed?.success ? parsed.data.erro : undefined;
  switch (erro?.codigo) {
    case 'credenciais_invalidas':
      return { ok: false, kind: 'credenciais' };
    case 'validacao_invalida':
      return { ok: false, kind: 'validacao', campos: erro.campos ?? [] };
    case 'conflito': {
      const atual = fazendaSchema.safeParse((raw as { atual?: unknown } | null)?.atual);
      return atual.success
        ? { ok: false, kind: 'conflito', atual: atual.data }
        : { ok: false, kind: 'conflito' };
    }
    case 'nao_autenticado':
      return { ok: false, kind: 'nao-autenticado' };
    case 'sessao_expirada':
      return { ok: false, kind: 'sessao-expirada' };
    case 'requisicao_invalida':
      return { ok: false, kind: 'link-invalido' };
    case 'requisicao_bloqueada':
      return { ok: false, kind: 'bloqueada' };
    case 'muitas_tentativas': {
      const raw = Number(res.headers.get('retry-after'));
      return {
        ok: false,
        kind: 'muitas-tentativas',
        retryAfterSeconds: Number.isFinite(raw) && raw > 0 ? raw : null,
      };
    }
    default:
      return { ok: false, kind: 'contrato' };
  }
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '/api';
  // Resolvido a cada chamada: permite trocar o fetch global nos testes e evita "Illegal invocation".
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? fetch)(input, init);

  async function call(path: string, init: RequestInit): Promise<Response | null> {
    try {
      return await doFetch(`${baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(options.usuarioId ? { 'X-Bovaro-Usuario': options.usuarioId } : {}),
        },
      });
    } catch {
      return null;
    }
  }

  async function sessionCall(path: string, init: RequestInit): Promise<ApiResult<SessionResponse>> {
    const res = await call(path, init);
    if (!res) return { ok: false, kind: 'rede' };
    if (!res.ok) return readFailure(res);
    try {
      const parsed = sessionResponseSchema.safeParse(await res.json());
      return parsed.success ? { ok: true, data: parsed.data } : { ok: false, kind: 'contrato' };
    } catch {
      return { ok: false, kind: 'contrato' };
    }
  }

  async function noContentCall(path: string, init: RequestInit): Promise<ApiResult<void>> {
    const res = await call(path, init);
    if (!res) return { ok: false, kind: 'rede' };
    if (res.status === 204) return { ok: true, data: undefined };
    return readFailure(res);
  }

  async function acceptedCall(path: string, init: RequestInit): Promise<ApiResult<void>> {
    const res = await call(path, init);
    if (!res) return { ok: false, kind: 'rede' };
    if (res.status === 202) return { ok: true, data: undefined };
    return readFailure(res);
  }

  return {
    forUser: (usuarioId) => createApiClient({ ...options, usuarioId }),
    signup: (body) => sessionCall('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => sessionCall('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    getSession: () => sessionCall('/auth/session', { method: 'GET' }),
    logout: () => noContentCall('/auth/logout', { method: 'POST', body: '{}' }),
    updatePerfil: (body) =>
      sessionCall('/conta/perfil', { method: 'PATCH', body: JSON.stringify(body) }),
    changePassword: (body) =>
      noContentCall('/conta/senha', { method: 'PUT', body: JSON.stringify(body) }),
    unlinkGoogle: () => noContentCall('/conta/google', { method: 'DELETE', body: '{}' }),
    updateFazenda: (body) =>
      sessionCall('/fazenda', { method: 'PATCH', body: JSON.stringify(body) }),
    forgotPassword: (body) =>
      acceptedCall('/auth/senha/esqueci', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (body) =>
      noContentCall('/auth/senha/redefinir', { method: 'POST', body: JSON.stringify(body) }),
    async exportData() {
      const res = await call('/conta/exportar', { method: 'GET' });
      if (!res) return { ok: false, kind: 'rede' };
      if (!res.ok) return readFailure(res);
      try {
        const parsed = exportacaoDadosSchema.safeParse(await res.json());
        return parsed.success ? { ok: true, data: parsed.data } : { ok: false, kind: 'contrato' };
      } catch {
        return { ok: false, kind: 'contrato' };
      }
    },
    aceitarTermos: (versao) =>
      sessionCall('/conta/aceite', { method: 'POST', body: JSON.stringify({ versao }) }),
    enviarDadosPorEmail: () =>
      acceptedCall('/conta/exportar/enviar', { method: 'POST', body: '{}' }),
    deleteAccount: () =>
      noContentCall('/conta', {
        method: 'DELETE',
        body: JSON.stringify({ confirmacao: 'deletar' }),
      }),
  };
}
