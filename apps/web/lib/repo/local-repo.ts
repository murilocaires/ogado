// Repositório da E1 sobre localStorage (ADR-0007). Sem API, sem login.
// - Chave versionada; toda leitura/escrita em try/catch (modo privado, cota, storage bloqueado).
// - Sem storage o app continua funcionando em memória e avisa (`persistencia: 'indisponivel'`).
// - SSR-safe: no servidor o snapshot é `carregando`; o storage só é tocado no cliente.
import { Decimal, ENTRADA_PADRAO } from '@ogado/domain';
import { paraCampo } from '../format';
import {
  CENARIO_NOME_MAX,
  CENARIO_RESULTADO_CAMPOS,
  RECRIA_CAMPOS,
  type CenarioEntity,
  type CenarioSalvar,
  type LoteEntity,
  type OGadoRepo,
  type PersistenciaStatus,
  type RecriaAtualizacao,
  type RecriaEntity,
  type RecriaForm,
  type RepoSnapshot,
} from './types';

/** Chave atual (E2, esquema 2: lotes + recria + cenários). */
export const STORAGE_KEY = 'ogado.e2.v2';
/** Chave da E1 (esquema 1, sem cenários): lida uma vez e migrada, nunca apagada. */
export const STORAGE_KEY_E1 = 'ogado.e1.v1';
const SCHEMA = 2;
const SCHEMA_E1 = 1;

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
  cenarios: CenarioEntity[];
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

function ehTextoOuNulo(v: unknown): v is string | null {
  return v === null || ehTexto(v);
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function ehCenario(v: unknown): v is CenarioEntity {
  if (!ehObjeto(v)) return false;
  if (!ehMeta(v) || !ehTexto(v['nome']) || !ehTexto(v['criadoEm'])) return false;
  const { form, variantes, parametros, resultado } = v;
  if (!ehObjeto(form) || !RECRIA_CAMPOS.every((c) => ehTexto(form[c]))) return false;
  if (!ehObjeto(variantes)) return false;
  if (variantes['lotacaoInicial'] !== 'fixa80' && variantes['lotacaoInicial'] !== 'areaPastavel') {
    return false;
  }
  if (variantes['faturamentoBruto'] !== 'pesoVivo' && variantes['faturamentoBruto'] !== 'carcaca') {
    return false;
  }
  const chavesParametros = ['arrobaVivoKg', 'arrobaCarcacaKg', 'uaKg', 'lotacaoFixaHa'];
  if (!ehObjeto(parametros) || !chavesParametros.every((k) => ehTexto(parametros[k]))) return false;
  if (!ehObjeto(resultado) || !CENARIO_RESULTADO_CAMPOS.every((c) => ehTextoOuNulo(resultado[c]))) {
    return false;
  }
  const custos = resultado['custos'];
  return (
    Array.isArray(custos) &&
    custos.every(
      (c: unknown) =>
        ehObjeto(c) && ehTexto(c['id']) && ehTexto(c['nome']) && ehTextoOuNulo(c['valor']),
    )
  );
}

/**
 * Leitura tolerante: aceita o esquema 2 e o 1 (sem cenários); descarta só os itens inválidos,
 * nunca o conteúdo inteiro por causa de um item.
 */
function lerEnvelope(bruto: string): Envelope | null {
  const dados: unknown = JSON.parse(bruto);
  if (!ehObjeto(dados)) return null;
  if (dados['schema'] !== SCHEMA && dados['schema'] !== SCHEMA_E1) return null;
  if (!Array.isArray(dados['lotes']) || !ehRecria(dados['recria'])) return null;
  const lotes = (dados['lotes'] as unknown[]).filter(ehLote);
  const cenarios = Array.isArray(dados['cenarios'])
    ? (dados['cenarios'] as unknown[]).filter(ehCenario)
    : [];
  return { schema: SCHEMA, lotes, recria: dados['recria'], cenarios };
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
  let cenarios: CenarioEntity[] = []; // inclui tombstones (deletedAt)
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
    let chave = STORAGE_KEY;
    try {
      bruto = storage.getItem(STORAGE_KEY);
      if (bruto === null) {
        // Migração E1 -> E2: sem dados novos, lê os da E1 (esquema 1) sem perder lotes/entradas.
        bruto = storage.getItem(STORAGE_KEY_E1);
        chave = STORAGE_KEY_E1;
      }
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
        cenarios = envelope.cenarios;
        return;
      }
    } catch {
      /* JSON corrompido: cai no backup abaixo */
    }
    // Conteúdo ilegível: guarda uma cópia para não perder nada e segue com os padrões.
    try {
      storage.setItem(`${chave}.corrompido`, bruto);
    } catch {
      /* sem espaço: segue */
    }
  }

  function gravar(): void {
    if (persistencia === 'indisponivel') return;
    try {
      const storage = obterStorage();
      if (!storage) throw new Error('sem storage');
      const envelope: Envelope = { schema: SCHEMA, lotes, recria, cenarios };
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
      cenarios: cenarios.filter((c) => c.deletedAt === null),
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
    salvarCenario(entrada) {
      garantir();
      const agoraISO = agora().toISOString();
      const vivos = cenarios.filter((c) => c.deletedAt === null).length;
      const salvo: CenarioEntity = {
        id: gerarId(),
        version: 1,
        updatedAt: agoraISO,
        deletedAt: null,
        criadoEm: agoraISO,
        nome: nomeValido(entrada.nome, `Cenário ${vivos + 1}`),
        ...copiarSnapshot(entrada),
      };
      cenarios = [...cenarios, salvo];
      notificar();
      return salvo;
    },
    renomearCenario(id, nome) {
      garantir();
      const agoraISO = agora().toISOString();
      cenarios = cenarios.map((c) =>
        c.id === id && c.deletedAt === null
          ? { ...c, nome: nomeValido(nome, c.nome), version: c.version + 1, updatedAt: agoraISO }
          : c,
      );
      notificar();
    },
    duplicarCenario(id) {
      garantir();
      const origem = cenarios.find((c) => c.id === id && c.deletedAt === null);
      if (!origem) return null;
      const agoraISO = agora().toISOString();
      const copia: CenarioEntity = {
        id: gerarId(),
        version: 1,
        updatedAt: agoraISO,
        deletedAt: null,
        criadoEm: agoraISO,
        nome: nomeValido(`${origem.nome} (cópia)`, origem.nome),
        ...copiarSnapshot(origem),
      };
      cenarios = [...cenarios, copia];
      notificar();
      return copia;
    },
    excluirCenario(id) {
      garantir();
      const agoraISO = agora().toISOString();
      cenarios = cenarios.map((c) =>
        c.id === id && c.deletedAt === null
          ? { ...c, version: c.version + 1, updatedAt: agoraISO, deletedAt: agoraISO }
          : c,
      );
      notificar();
    },
  };
}

/** Nome aparado e limitado a 80 caracteres; vazio cai na reserva. */
function nomeValido(nome: string, reserva: string): string {
  const aparado = nome.trim().slice(0, CENARIO_NOME_MAX);
  return aparado === '' ? reserva.slice(0, CENARIO_NOME_MAX) : aparado;
}

/** Cópia profunda do snapshot: o cenário salvo nunca compartilha referência com o simulador. */
function copiarSnapshot(
  origem: CenarioSalvar,
): Pick<CenarioEntity, 'form' | 'variantes' | 'parametros' | 'resultado'> {
  return {
    form: { ...origem.form },
    variantes: { ...origem.variantes },
    parametros: { ...origem.parametros },
    resultado: { ...origem.resultado, custos: origem.resultado.custos.map((c) => ({ ...c })) },
  };
}
