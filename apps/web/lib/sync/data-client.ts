// Cliente HTTP dos dados na nuvem (E3). Mesma origem: o Next repassa `/api/*` (ADR-0010 a.5).
import {
  historicoSyncSchema,
  type HistoricoSyncCreate,
  type HistoricoSync,
  cenarioListResponseSchema,
  errorEnvelopeSchema,
  cenarioSchema,
  loteListResponseSchema,
  loteSchema,
  recriaEntradaSchema,
  type CenarioCreate,
  type CenarioDto,
  type LoteCreate,
  type LoteDto,
  type LotePatch,
  type RecriaEntradaDto,
  type RecriaEntradaPut,
} from '@ogado/contracts';

/** O que o cliente precisa de um schema Zod (evita depender do `zod` direto na web). */
interface Esquema<T> {
  safeParse(valor: unknown): { success: true; data: T } | { success: false };
}

/** Campo que o servidor recusou (400 `validacao_invalida`): caminho e mensagem em pt-BR. */
export interface CampoInvalido {
  caminho: string;
  mensagem: string;
}

export type DadosFalha =
  | { ok: false; kind: 'conflito'; atual: unknown }
  /** 400 `validacao_invalida`: o item foi recusado e precisa de correção (RF-079). */
  | { ok: false; kind: 'validacao'; mensagem: string; campos: CampoInvalido[] }
  | { ok: false; kind: 'nao-encontrado' | 'nao-autenticado' | 'rede' | 'servidor' | 'contrato' };

export type DadosResult<T> = { ok: true; data: T; created: boolean } | DadosFalha;

export interface DadosClient {
  arquivarHistorico(body: HistoricoSyncCreate): Promise<DadosResult<HistoricoSync>>;
  listarLotes(): Promise<DadosResult<LoteDto[]>>;
  criarLote(body: LoteCreate): Promise<DadosResult<LoteDto>>;
  alterarLote(id: string, body: LotePatch): Promise<DadosResult<LoteDto>>;
  excluirLote(id: string, version: number): Promise<DadosResult<LoteDto>>;
  listarCenarios(): Promise<DadosResult<CenarioDto[]>>;
  criarCenario(body: CenarioCreate): Promise<DadosResult<CenarioDto>>;
  renomearCenario(id: string, nome: string, version: number): Promise<DadosResult<CenarioDto>>;
  excluirCenario(id: string, version: number): Promise<DadosResult<CenarioDto>>;
  lerRecria(): Promise<DadosResult<RecriaEntradaDto>>;
  gravarRecria(body: RecriaEntradaPut): Promise<DadosResult<RecriaEntradaDto>>;
}

export function criarDadosClient(
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
): DadosClient {
  const baseUrl = options.baseUrl ?? '/api';
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? fetch)(input, init);

  async function pedir<T>(
    metodo: string,
    caminho: string,
    schema: Esquema<T>,
    corpo?: unknown,
  ): Promise<DadosResult<T>> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${caminho}`, {
        method: metodo,
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      });
    } catch {
      return { ok: false, kind: 'rede' };
    }
    if (res.status === 401) return { ok: false, kind: 'nao-autenticado' };
    if (res.status === 404) return { ok: false, kind: 'nao-encontrado' };
    // Limite de taxa e bloqueio temporário não dizem nada sobre o item: tenta de novo depois.
    if (res.status >= 500 || res.status === 429 || res.status === 403) {
      return { ok: false, kind: 'servidor' };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, kind: 'contrato' };
    }
    if (res.status === 409) {
      const atual =
        typeof json === 'object' && json !== null ? (json as { atual?: unknown }).atual : undefined;
      return atual === undefined
        ? { ok: false, kind: 'contrato' }
        : { ok: false, kind: 'conflito', atual };
    }
    if (res.status === 400) {
      const envelope = errorEnvelopeSchema.safeParse(json);
      if (envelope.success && envelope.data.erro.codigo === 'validacao_invalida') {
        return {
          ok: false,
          kind: 'validacao',
          mensagem: envelope.data.erro.mensagem,
          campos: (envelope.data.erro.campos ?? []).map((c) => ({
            caminho: c.caminho,
            mensagem: c.mensagem,
          })),
        };
      }
    }
    if (!res.ok) return { ok: false, kind: 'contrato' };
    const parsed = schema.safeParse(json);
    return parsed.success
      ? { ok: true, data: parsed.data, created: res.status === 201 }
      : { ok: false, kind: 'contrato' };
  }

  const listaLotes: Esquema<LoteDto[]> = {
    safeParse(v) {
      const r = loteListResponseSchema.safeParse(v);
      return r.success ? { success: true, data: r.data.lotes } : { success: false };
    },
  };
  const listaCenarios: Esquema<CenarioDto[]> = {
    safeParse(v) {
      const r = cenarioListResponseSchema.safeParse(v);
      return r.success ? { success: true, data: r.data.cenarios } : { success: false };
    },
  };

  return {
    arquivarHistorico: (body) => pedir('POST', '/historico-sync', historicoSyncSchema, body),
    listarLotes: () =>
      pedir('GET', '/lotes?incluirExcluidos=true', listaLotes as unknown as Esquema<LoteDto[]>),
    criarLote: (body) => pedir('POST', '/lotes', loteSchema, body),
    alterarLote: (id, body) => pedir('PATCH', `/lotes/${id}`, loteSchema, body),
    excluirLote: (id, version) => pedir('DELETE', `/lotes/${id}?version=${version}`, loteSchema),
    listarCenarios: () =>
      pedir(
        'GET',
        '/cenarios?incluirExcluidos=true',
        listaCenarios as unknown as Esquema<CenarioDto[]>,
      ),
    criarCenario: (body) => pedir('POST', '/cenarios', cenarioSchema, body),
    renomearCenario: (id, nome, version) =>
      pedir('PATCH', `/cenarios/${id}`, cenarioSchema, { nome, version }),
    excluirCenario: (id, version) =>
      pedir('DELETE', `/cenarios/${id}?version=${version}`, cenarioSchema),
    lerRecria: () => pedir('GET', '/recria-entrada', recriaEntradaSchema),
    gravarRecria: (body) => pedir('PUT', '/recria-entrada', recriaEntradaSchema, body),
  };
}
