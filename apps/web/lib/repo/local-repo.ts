// Repositório da E1 sobre localStorage (ADR-0007). Sem API, sem login.
// - Chave versionada; toda leitura/escrita em try/catch (modo privado, cota, storage bloqueado).
// - Sem storage o app continua funcionando em memória e avisa (`persistencia: 'indisponivel'`).
// - SSR-safe: no servidor o snapshot é `carregando`; o storage só é tocado no cliente.
import { Decimal, ENTRADA_PADRAO } from '@ogado/domain';
import { paraCampo } from '../format';
import {
  RECRIA_CAMPOS,
  type LoteEntity,
  type OGadoRepo,
  type PersistenciaStatus,
  type RecriaAtualizacao,
  type RecriaEntity,
  type RecriaForm,
  type RepoSnapshot,
} from './types';

export const STORAGE_KEY = 'ogado.e1.v1';
const SCHEMA = 1;

/** Campos digitados em % na tela e guardados em fração no domínio. */
const CAMPOS_PERCENTUAIS = new Set(['consumoPct', 'rendCarcaca', 'imposto']);

/** Padrões da planilha (ENTRADA_PADRAO) como texto de campo pt-BR (fração -> %). */
export function recriaFormPadrao(): RecriaForm {
  const form = {} as RecriaForm;
  for (const campo of RECRIA_CAMPOS) {
    const original = ENTRADA_PADRAO[campo];
    form[campo] = paraCampo(
      CAMPOS_PERCENTUAIS.has(campo) ? new Decimal(original).times(100) : original,
    );
  }
  return form;
}

export function recriaFormVazio(): RecriaForm {
  const form = {} as RecriaForm;
  for (const campo of RECRIA_CAMPOS) form[campo] = '';
  return form;
}

/** UUID v4; `crypto.randomUUID` só existe em contexto seguro, então há reserva. */
export function novoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

interface Envelope {
  schema: number;
  lotes: LoteEntity[];
  recria: RecriaEntity;
}

function ehTexto(v: unknown): v is string {
  return typeof v === 'string';
}

function ehMeta(o: Record<string, unknown>): boolean {
  return (
    ehTexto(o['id']) &&
    typeof o['version'] === 'number' &&
    ehTexto(o['updatedAt']) &&
    (o['deletedAt'] === null || ehTexto(o['deletedAt']))
  );
}

function ehLote(v: unknown): v is LoteEntity {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    ehMeta(o) &&
    (o['tipo'] === 'compra' || o['tipo'] === 'venda') &&
    typeof o['numero'] === 'number' &&
    ehTexto(o['categoria']) &&
    ehTexto(o['data']) &&
    (o['modo'] === 'total' || o['modo'] === 'medio' || o['modo'] === 'individual') &&
    ehTexto(o['qtd']) &&
    ehTexto(o['peso']) &&
    Array.isArray(o['pesos']) &&
    (o['pesos'] as unknown[]).every(ehTexto) &&
    ehTexto(o['preco'])
  );
}

function ehRecria(v: unknown): v is RecriaEntity {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!ehMeta(o)) return false;
  if (o['lotacaoInicial'] !== 'fixa80' && o['lotacaoInicial'] !== 'areaPastavel') return false;
  const form = o['form'];
  if (typeof form !== 'object' || form === null) return false;
  return RECRIA_CAMPOS.every((c) => ehTexto((form as Record<string, unknown>)[c]));
}

function lerEnvelope(bruto: string): Envelope | null {
  const dados: unknown = JSON.parse(bruto);
  if (typeof dados !== 'object' || dados === null) return null;
  const o = dados as Record<string, unknown>;
  if (o['schema'] !== SCHEMA || !Array.isArray(o['lotes']) || !ehRecria(o['recria'])) return null;
  const lotes = (o['lotes'] as unknown[]).filter(ehLote);
  return { schema: SCHEMA, lotes, recria: o['recria'] };
}

export function obterStorageDoNavegador(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export interface OpcoesRepoLocal {
  storage?: () => Storage | null;
  agora?: () => Date;
  novoId?: () => string;
}

export function criarRepoLocal(opcoes: OpcoesRepoLocal = {}): OGadoRepo {
  const obterStorage = opcoes.storage ?? obterStorageDoNavegador;
  const agora = opcoes.agora ?? (() => new Date());
  const gerarId = opcoes.novoId ?? novoId;
  const ouvintes = new Set<() => void>();
  const carregando: RepoSnapshot = { status: 'carregando' };

  let lotes: LoteEntity[] = []; // inclui tombstones (deletedAt)
  let recria: RecriaEntity = recriaPadrao();
  let persistencia: PersistenciaStatus = 'ok';
  let snapshot: RepoSnapshot | null = null;

  function recriaPadrao(): RecriaEntity {
    return {
      id: gerarId(),
      version: 1,
      updatedAt: agora().toISOString(),
      deletedAt: null,
      form: recriaFormPadrao(),
      lotacaoInicial: 'fixa80',
    };
  }

  function carregar(): void {
    let storage: Storage | null;
    try {
      storage = obterStorage();
    } catch {
      storage = null;
    }
    if (!storage) {
      persistencia = 'indisponivel';
      return;
    }
    let bruto: string | null;
    try {
      bruto = storage.getItem(STORAGE_KEY);
    } catch {
      persistencia = 'indisponivel';
      return;
    }
    if (bruto === null) return;
    try {
      const envelope = lerEnvelope(bruto);
      if (envelope) {
        lotes = envelope.lotes;
        recria = envelope.recria;
        return;
      }
    } catch {
      /* JSON corrompido: cai no backup abaixo */
    }
    // Conteúdo ilegível: guarda uma cópia para não perder nada e segue com os padrões.
    try {
      storage.setItem(`${STORAGE_KEY}.corrompido`, bruto);
    } catch {
      /* sem espaço: segue */
    }
  }

  function gravar(): void {
    if (persistencia === 'indisponivel') return;
    try {
      const storage = obterStorage();
      if (!storage) throw new Error('sem storage');
      const envelope: Envelope = { schema: SCHEMA, lotes, recria };
      storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      persistencia = 'indisponivel';
    }
  }

  function montarSnapshot(): RepoSnapshot {
    return {
      status: 'pronto',
      lotes: lotes.filter((l) => l.deletedAt === null),
      recria,
      persistencia,
    };
  }

  function garantir(): RepoSnapshot {
    if (snapshot === null) {
      carregar();
      snapshot = montarSnapshot();
    }
    return snapshot;
  }

  function notificar(): void {
    gravar();
    snapshot = montarSnapshot();
    ouvintes.forEach((o) => o());
  }

  return {
    subscribe(listener) {
      ouvintes.add(listener);
      return () => {
        ouvintes.delete(listener);
      };
    },
    getSnapshot() {
      return garantir();
    },
    getServerSnapshot() {
      return carregando;
    },
    salvarLote(entrada) {
      garantir();
      const agoraISO = agora().toISOString();
      const existente = entrada.id ? lotes.find((l) => l.id === entrada.id) : undefined;
      const salvo: LoteEntity = {
        ...entrada,
        id: existente?.id ?? entrada.id ?? gerarId(),
        version: existente ? existente.version + 1 : 1,
        updatedAt: agoraISO,
        deletedAt: null,
      };
      lotes = existente ? lotes.map((l) => (l.id === salvo.id ? salvo : l)) : [...lotes, salvo];
      notificar();
      return salvo;
    },
    excluirLote(id) {
      garantir();
      const agoraISO = agora().toISOString();
      lotes = lotes.map((l) =>
        l.id === id && l.deletedAt === null
          ? { ...l, version: l.version + 1, updatedAt: agoraISO, deletedAt: agoraISO }
          : l,
      );
      notificar();
    },
    atualizarRecria(atualizacao: RecriaAtualizacao) {
      garantir();
      recria = {
        ...recria,
        form: { ...recria.form, ...atualizacao.form },
        lotacaoInicial: atualizacao.lotacaoInicial ?? recria.lotacaoInicial,
        version: recria.version + 1,
        updatedAt: agora().toISOString(),
      };
      notificar();
    },
    redefinirRecria(modo) {
      garantir();
      recria = {
        ...recria,
        form: modo === 'padrao' ? recriaFormPadrao() : recriaFormVazio(),
        lotacaoInicial: 'fixa80',
        version: recria.version + 1,
        updatedAt: agora().toISOString(),
      };
      notificar();
    },
  };
}
