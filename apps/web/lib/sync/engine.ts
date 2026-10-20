// Motor de sincronização (E3, robusto na E5): o aparelho continua sendo a fonte da tela (otimista); a
// nuvem é reconciliada por id. Uma entidade está "limpa" quando `version` local == última versão
// sincronizada (`versoes[id]`). Limpa + nuvem mais nova => adota a nuvem. Suja => envia com a
// versao-base. Alteracoes concorrentes sao combinadas automaticamente, com historico no servidor.
// Recusas por validacao continuam exigindo correcao dos dados.
// Reenviar é seguro: POST é idempotente por id e, se o servidor já gravou o mesmo conteúdo (rede
// cortada no meio do envio), a rodada seguinte reconhece e adota sem duplicar nem avisar (RNF-017).
import {
  historicoSyncCreateSchema,
  type HistoricoSyncCreate,
  cenarioSchema,
  loteSchema,
  type CenarioDto,
  type LoteDto,
} from '@ogado/contracts';
import type {
  CenarioEntity,
  DadosCompletos,
  EntityMeta,
  LoteEntity,
  SyncableRepo,
} from '../repo/types';
import type { DadosClient, DadosFalha, DadosResult, PaginaDados, SyncCursor } from './data-client';
import { cenarioDeDto, cenarioParaCriar, loteDeDto, loteParaCriar, lotePatchDe } from './mappers';
import { mesclarLote, mesclarCenario } from './mesclar';
import { MOTIVO_CONTRATO, motivoDeValidacao } from './motivos';

export type TipoEntidade = 'lote' | 'cenario' | 'recria';

/** O que o aparelho queria fazer quando o conflito apareceu. */
export type AcaoLocal = 'editar' | 'excluir';

/**
 * Conflito (RF-076): `alterado` = o servidor tem uma versão diferente da que o aparelho conhecia;
 * `excluido-no-servidor` = o registro foi excluído em outro aparelho e este aparelho o editou.
 */
export interface Conflito {
  tipo: TipoEntidade;
  id: string;
  motivo: 'alterado' | 'excluido-no-servidor';
  acao: AcaoLocal;
  /** `version` local quando o conflito foi detectado. */
  versaoLocal: number;
  /** DTO do servidor no momento (o `atual` do 409 ou o item da listagem). */
  atual: unknown;
  detectadoEm: string;
}

/** Item que o servidor recusou por validação (RF-079); sai de "precisa de atenção" ao corrigir/excluir. */
export interface Rejeitado {
  tipo: TipoEntidade;
  id: string;
  versaoLocal: number;
  motivo: string;
  detectadoEm: string;
  original?: unknown;
}

export interface EstadoSync {
  usuarioId: string;
  versoes: Record<string, number>;
  /** DTO da ultima versao confirmada, para comparar campo a campo. */
  bases?: Record<string, unknown>;
  historicoPendente?: HistoricoSyncCreate[];
  conflitos?: Conflito[];
  rejeitados?: Rejeitado[];
  cursores?: Partial<Record<'lote' | 'cenario', { updatedAt: string; id: string }>>;
}

export interface EstadoSyncStore {
  ready?(): Promise<void>;
  flush?(): Promise<void>;
  ler(): EstadoSync | null;
  gravar(estado: EstadoSync): void;
  limpar(): void;
}

export type ResultadoSync = 'ok' | 'nao-autenticado' | 'rede' | 'erro';

/* ---------- Pendências (RF-075) ---------- */

export interface ItemPendente {
  tipo: TipoEntidade;
  id: string;
}

/**
 * Entidades que o aparelho tem e a nuvem ainda não recebeu: `version` local diferente da última
 * versão sincronizada, ou ausente do controle. Exclusão (tombstone) também conta. As entradas da
 * recria sao rascunhos em memoria e nunca geram pendencias.
 */
export function pendentes(
  dados: DadosCompletos,
  versoes: Readonly<Record<string, number>>,
): ItemPendente[] {
  const sujo = (e: EntityMeta): boolean => versoes[e.id] !== e.version;
  const itens: ItemPendente[] = [];
  for (const l of dados.lotes) if (sujo(l)) itens.push({ tipo: 'lote', id: l.id });
  for (const c of dados.cenarios) if (sujo(c)) itens.push({ tipo: 'cenario', id: c.id });
  return itens;
}

export function contarPendentes(
  dados: DadosCompletos,
  versoes: Readonly<Record<string, number>>,
): number {
  return pendentes(dados, versoes).length;
}

/* ---------- Rodada ---------- */

/** Falhas que interrompem a rodada; o resto é tentado de novo na próxima. */
class Interrompe extends Error {
  constructor(readonly resultado: ResultadoSync) {
    super(resultado);
  }
}

function checar(r: DadosFalha): void {
  if (r.kind === 'nao-autenticado') throw new Interrompe('nao-autenticado');
  if (r.kind === 'rede') throw new Interrompe('rede');
  if (r.kind === 'servidor') throw new Interrompe('erro');
}

interface DtoBase {
  id: string;
  version: number;
  deletedAt: string | null;
  updatedAt: string;
}

interface Adaptador<E extends EntityMeta, D extends DtoBase> {
  tipo: TipoEntidade;
  listar(): Promise<DadosResult<D[]>>;
  pagina?: ((cursor?: SyncCursor) => Promise<DadosResult<PaginaDados<D>>>) | undefined;
  locais(): E[];
  daDto(d: D): E | null;
  /** Valida o `atual` de um 409; `null` se não tiver o formato esperado. */
  dtoDe(valor: unknown): D | null;
  criar(e: E): Promise<DadosResult<D>>;
  alterar(e: E, versao: number): Promise<DadosResult<D>>;
  excluir(e: E, versao: number): Promise<DadosResult<D>>;
  /** Mesmo conteúdo e mesmo estado de exclusão (o que já está na nuvem é o que o aparelho tem). */
  igual(e: E, d: D): boolean;
  aplicar(es: E[]): void;
  mesclar(local: E, servidor: E, base: E | null): E;
}

export interface DepsSync {
  repo: SyncableRepo;
  api: DadosClient;
  estado: EstadoSyncStore;
  usuarioId: string;
  agora?: () => Date;
  /** A sessão/efeito que iniciou a rodada continua vigente. */
  ativo?: () => boolean;
}

function conteudoDoLote(l: LoteEntity): string {
  return JSON.stringify(lotePatchDe(l));
}

function igualLote(l: LoteEntity, d: LoteDto): boolean {
  if ((l.deletedAt === null) !== (d.deletedAt === null)) return false;
  return l.deletedAt !== null || conteudoDoLote(l) === conteudoDoLote(loteDeDto(d));
}

function igualCenario(c: CenarioEntity, d: CenarioDto): boolean {
  if ((c.deletedAt === null) !== (d.deletedAt === null)) return false;
  return c.deletedAt !== null || c.nome === d.nome;
}

export async function sincronizar(deps: DepsSync): Promise<ResultadoSync> {
  const exigirAtivo = () => {
    if (deps.ativo && !deps.ativo()) throw new Interrompe('nao-autenticado');
  };
  const original = deps.api.paraUsuario?.(deps.usuarioId) ?? deps.api;
  const api = new Proxy(original, {
    get(target, campo) {
      const valor: unknown = Reflect.get(target, campo);
      if (typeof valor !== 'function') return valor;
      return async (...args: unknown[]) => {
        exigirAtivo();
        const resposta: unknown = await Reflect.apply(valor, target, args);
        exigirAtivo();
        return resposta;
      };
    },
  });
  const rodar = async (): Promise<ResultadoSync> => {
    try {
      exigirAtivo();
      await deps.repo.ready?.();
      exigirAtivo();
      await deps.repo.flush?.();
      exigirAtivo();
      await deps.estado.ready?.();
      exigirAtivo();
      const resultado = await executarSincronizacao({ ...deps, api });
      exigirAtivo();
      await deps.repo.flush?.();
      exigirAtivo();
      await deps.estado.flush?.();
      return resultado;
    } catch (erro) {
      if (erro instanceof Interrompe) return erro.resultado;
      return 'erro';
    }
  };
  // Uma única rodada por origem entre abas: versões/checkpoints nunca se atropelam.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('ogado.sync', rodar).catch(() => 'erro' as ResultadoSync);
  }
  return rodar();
}

async function executarSincronizacao(deps: DepsSync): Promise<ResultadoSync> {
  const { repo, api, estado, usuarioId } = deps;
  const agora = deps.agora ?? (() => new Date());
  const lido = estado.ler();
  // Outra conta deixou dados neste aparelho: não mistura (RF-078); o logout limpa.
  if (lido && lido.usuarioId !== usuarioId) return 'erro';
  const versoes: Record<string, number> = { ...(lido?.versoes ?? {}) };
  const conflitos = new Map<string, Conflito>();
  const bases: Record<string, unknown> = { ...(lido?.bases ?? {}) };
  const cursores = { ...(lido?.cursores ?? {}) };
  let historicoPendente = (
    Array.isArray(lido?.historicoPendente) ? lido.historicoPendente : []
  ).flatMap((h) => {
    const parsed = historicoSyncCreateSchema.safeParse(h);
    return parsed.success ? [parsed.data] : [];
  });
  const rejeitados = new Map<string, Rejeitado>(
    (lido?.rejeitados ?? []).filter((r) => r.tipo !== 'recria').map((r) => [r.id, r]),
  );

  const salvarEstado = (): void => {
    if (deps.ativo && !deps.ativo()) return;
    // Pendência de entidade que não existe mais no aparelho não tem o que mostrar.
    const dados = repo.exportar();
    const existentes = new Set<string>([
      ...dados.lotes.map((l) => l.id),
      ...dados.cenarios.map((c) => c.id),
    ]);
    for (const id of [...conflitos.keys()]) if (!existentes.has(id)) conflitos.delete(id);
    for (const id of [...rejeitados.keys()])
      if (!existentes.has(id) && !rejeitados.get(id)?.original) rejeitados.delete(id);
    estado.gravar({
      usuarioId,
      versoes,
      bases,
      historicoPendente,
      conflitos: [...conflitos.values()],
      rejeitados: [...rejeitados.values()],
      cursores,
    });
  };

  const rejeitar = (tipo: TipoEntidade, e: EntityMeta, falha: DadosFalha): void => {
    const motivo =
      falha.kind === 'validacao'
        ? motivoDeValidacao(falha.campos, falha.mensagem)
        : MOTIVO_CONTRATO;
    rejeitados.set(e.id, {
      tipo,
      id: e.id,
      versaoLocal: e.version,
      motivo,
      detectadoEm: agora().toISOString(),
    });
  };

  /** Recusado nesta mesma versão local: espera o usuário corrigir ou excluir (outras seguem). */
  const aguardandoCorrecao = (e: EntityMeta): boolean => {
    const r = rejeitados.get(e.id);
    if (!r) return false;
    if (r.versaoLocal === e.version) return true;
    rejeitados.delete(e.id); // o usuário mexeu: tenta de novo
    return false;
  };

  /** Falha de escrita que não é conflito: recusa o item (e segue) ou interrompe a rodada. */
  const falhaDeEscrita = (tipo: TipoEntidade, e: EntityMeta, falha: DadosFalha): void => {
    if (falha.kind === 'validacao' || falha.kind === 'contrato') rejeitar(tipo, e, falha);
    else checar(falha);
  };

  const sincronizado = (id: string, versao: number): void => {
    versoes[id] = versao;
    conflitos.delete(id);
    rejeitados.delete(id);
    historicoPendente = historicoPendente.filter((h) => h.entidadeId !== id);
  };

  async function arquivar<E extends EntityMeta, D extends DtoBase>(
    a: Adaptador<E, D>,
    local: E,
    remoto: D,
    resultado: E,
    semBase: boolean,
  ): Promise<void> {
    const dados = {
      entidadeId: local.id,
      tipo: a.tipo,
      motivo: remoto.deletedAt || local.deletedAt ? 'exclusao' : semBase ? 'sem-base' : 'mesclagem',
      local: JSON.parse(JSON.stringify(local)),
      servidor: JSON.parse(JSON.stringify(a.daDto(remoto))),
      resultado: JSON.parse(JSON.stringify(resultado)),
    };
    const existente = historicoPendente.find(
      (h) =>
        JSON.stringify([h.entidadeId, h.tipo, h.motivo, h.local, h.servidor, h.resultado]) ===
        JSON.stringify([
          dados.entidadeId,
          dados.tipo,
          dados.motivo,
          dados.local,
          dados.servidor,
          dados.resultado,
        ]),
    );
    const evento =
      existente ?? historicoSyncCreateSchema.parse({ id: crypto.randomUUID(), ...dados });
    if (!existente) historicoPendente.push(evento);
    salvarEstado();
    await repo.flush?.();
    await estado.flush?.();
    const res = await api.arquivarHistorico(evento);
    if (!res.ok) {
      checar(res);
      throw new Interrompe('erro');
    }
  }

  async function reconciliar<E extends EntityMeta, D extends DtoBase>(
    a: Adaptador<E, D>,
    recebidos?: D[],
    modo: 'legado' | 'pagina' | 'pendentes' = 'legado',
  ): Promise<void> {
    const remoto: DadosResult<D[]> = recebidos
      ? { ok: true, data: recebidos, created: false }
      : await a.listar();
    if (!remoto.ok) return checar(remoto);
    const locais = new Map(a.locais().map((e) => [e.id, e]));
    const candidatos: { entidade: E; lida: E | null }[] = [];
    const adotar = (d: D, lida: E | null): void => {
      const e = a.daDto(d);
      if (!e) throw new Interrompe('erro');
      candidatos.push({ entidade: e, lida });
      bases[d.id] = d;
      sincronizado(d.id, d.version);
    };
    const lidos = new Set<string>();
    try {
      for (const inicial of remoto.data) {
        lidos.add(inicial.id);
        if (!a.daDto(inicial)) {
          if (inicial.deletedAt !== null) {
            const local = locais.get(inicial.id);
            if (local)
              candidatos.push({
                entidade: {
                  ...local,
                  version: inicial.version,
                  updatedAt: inicial.updatedAt,
                  deletedAt: inicial.deletedAt,
                },
                lida: local,
              });
            bases[inicial.id] = inicial;
            sincronizado(inicial.id, inicial.version);
            continue;
          }
          rejeitados.set(inicial.id, {
            tipo: a.tipo,
            id: inicial.id,
            versaoLocal: inicial.version,
            motivo: MOTIVO_CONTRATO,
            detectadoEm: agora().toISOString(),
            original: inicial,
          });
          continue;
        }
        const local = locais.get(inicial.id);
        const versaoBase = versoes[inicial.id];
        if (!local) {
          adotar(inicial, null);
          continue;
        }
        if (versaoBase !== undefined && local.version === versaoBase) {
          if (inicial.version > versaoBase) adotar(inicial, local);
          else if (inicial.version === versaoBase) {
            // Aprende a base dos aparelhos antigos sem notificar edicao e agendar outra rodada.
            bases[inicial.id] = inicial;
            sincronizado(inicial.id, inicial.version);
          }
          continue;
        }
        if (aguardandoCorrecao(local)) continue;
        const dtoBase = a.dtoDe(bases[local.id]);
        const base = dtoBase && dtoBase.version === versaoBase ? a.daDto(dtoBase) : null;
        let atual = inicial;
        let concluido = false;
        for (let tentativa = 0; tentativa < 5; tentativa++) {
          if (a.igual(local, atual)) {
            adotar(atual, local);
            concluido = true;
            break;
          }
          const entidadeRemota = a.daDto(atual);
          if (!entidadeRemota) throw new Interrompe('erro');
          // Exclusao sempre prevalece; uma edicao antiga nunca recria um registro.
          if (atual.deletedAt !== null) {
            await arquivar(a, local, atual, entidadeRemota, !base);
            adotar(atual, local);
            concluido = true;
            break;
          }
          const combinada = a.mesclar(local, entidadeRemota, base);
          if (a.igual(combinada, atual)) {
            adotar(atual, local);
            concluido = true;
            break;
          }
          if (atual.version !== versaoBase) await arquivar(a, local, atual, combinada, !base);
          const res = combinada.deletedAt
            ? await a.excluir(combinada, atual.version)
            : await a.alterar(combinada, atual.version);
          if (res.ok) {
            adotar(res.data, local);
            concluido = true;
            break;
          }
          if (res.kind === 'conflito') {
            const novo = a.dtoDe(res.atual);
            if (!novo) throw new Interrompe('erro');
            atual = novo;
          } else if (res.kind === 'nao-encontrado') {
            // A exclusao pode ter ocorrido entre GET e PATCH; busca a lapide.
            const lista = a.pagina
              ? await (async (): Promise<DadosResult<D[]>> => {
                  let cursor: SyncCursor | undefined;
                  while (true) {
                    const pagina = await a.pagina!(cursor);
                    if (!pagina.ok) return pagina;
                    const encontrado = pagina.data.itens.find((d) => d.id === local.id);
                    if (encontrado) return { ok: true, data: [encontrado], created: false };
                    const proximo = pagina.data.proximoCursor;
                    if (!proximo) return { ok: true, data: [], created: false };
                    if (
                      cursor &&
                      (proximo.updatedAt < cursor.updatedAt ||
                        (proximo.updatedAt === cursor.updatedAt && proximo.id <= cursor.id))
                    )
                      return { ok: false, kind: 'contrato' };
                    cursor = proximo;
                  }
                })()
              : await a.listar();
            if (!lista.ok) {
              checar(lista);
              throw new Interrompe('erro');
            }
            const novo = lista.data.find((d) => d.id === local.id);
            if (!novo) throw new Interrompe('erro');
            atual = novo;
          } else {
            falhaDeEscrita(a.tipo, local, res);
            concluido = true;
            break;
          }
        }
        if (!concluido) throw new Interrompe('erro');
      }
      for (const local of locais.values()) {
        if (lidos.has(local.id)) continue;
        if (modo === 'pagina') continue;
        if (
          modo === 'pendentes' &&
          (versoes[local.id] === local.version || a.dtoDe(bases[local.id]))
        )
          continue;
        if (local.deletedAt !== null) {
          sincronizado(local.id, local.version);
          continue;
        }
        if (aguardandoCorrecao(local)) continue;
        const res = await a.criar(local);
        if (res.ok) {
          // POST idempotente pode devolver um registro criado por um envio anterior.
          // Nao descartar edicoes posteriores que ocorreram antes da resposta daquele envio.
          if (a.igual(local, res.data)) adotar(res.data, local);
          else {
            bases[res.data.id] ??= res.data;
            versoes[res.data.id] = res.data.version;
            const nova = Math.max(local.version, res.data.version) + 1;
            a.aplicar([{ ...local, version: nova }]);
            throw new Interrompe('erro');
          }
        } else falhaDeEscrita(a.tipo, local, res);
      }
    } finally {
      const atuais = new Map(a.locais().map((e) => [e.id, e]));
      const saida: E[] = [];
      for (const { entidade, lida } of candidatos) {
        const hoje = atuais.get(entidade.id);
        if (!hoje || hoje.version === lida?.version) {
          saida.push(entidade);
          continue;
        }
        // Mescla tambem edicoes feitas enquanto a requisicao estava em andamento.
        const proxima = entidade.deletedAt ? entidade : a.mesclar(hoje, entidade, lida);
        saida.push({ ...proxima, version: Math.max(hoje.version, entidade.version) + 1 });
      }
      if (saida.length && (!deps.ativo || deps.ativo())) a.aplicar(saida);
    }
  }

  async function reconciliarIncremental<E extends EntityMeta, D extends DtoBase>(
    a: Adaptador<E, D>,
  ): Promise<void> {
    if (!a.pagina || a.tipo === 'recria') return reconciliar(a);
    let cursor = cursores[a.tipo];
    while (true) {
      const resposta = await a.pagina(cursor);
      if (!resposta.ok) {
        checar(resposta);
        throw new Interrompe('erro');
      }
      await reconciliar(a, resposta.data.itens, 'pagina');
      const ultimo = resposta.data.itens.at(-1);
      if (ultimo) {
        cursores[a.tipo] = { updatedAt: ultimo.updatedAt, id: ultimo.id };
        salvarEstado();
        // Checkpoint só é confirmado depois dos dados da página (interrupção pode repetir, nunca pular).
        await repo.flush?.();
        await estado.flush?.();
      }
      const proximo = resposta.data.proximoCursor;
      if (!proximo) break;
      if (
        cursor &&
        (proximo.updatedAt < cursor.updatedAt ||
          (proximo.updatedAt === cursor.updatedAt && proximo.id <= cursor.id))
      )
        throw new Interrompe('erro');
      cursor = proximo;
    }
    const checkpoint = cursores[a.tipo];
    // Releitura inclusiva do último milissegundo cobre commits concorrentes com o mesmo timestamp.
    if (checkpoint)
      cursores[a.tipo] = { ...checkpoint, id: '00000000-0000-0000-0000-000000000000' };
    const alterados = a.locais().flatMap((local) => {
      if (versoes[local.id] === local.version) return [];
      const base = a.dtoDe(bases[local.id]);
      return base ? [base] : [];
    });
    if (alterados.length) await reconciliar(a, alterados, 'pagina');
    await reconciliar(a, [], 'pendentes');
  }

  const lotes: Adaptador<LoteEntity, LoteDto> = {
    tipo: 'lote',
    listar: () => api.listarLotes(),
    pagina: api.paginaLotes?.bind(api),
    locais: () => repo.exportar().lotes,
    daDto: loteDeDto,
    dtoDe: (v) => {
      const p = loteSchema.safeParse(v);
      return p.success ? p.data : null;
    },
    criar: (l) => api.criarLote(loteParaCriar(l)),
    alterar: (l, versao) => api.alterarLote(l.id, { version: versao, ...lotePatchDe(l) }),
    excluir: (l, versao) => api.excluirLote(l.id, versao),
    igual: igualLote,
    aplicar: (es) => repo.aplicar({ lotes: es }),
    mesclar: mesclarLote,
  };

  const cenarios: Adaptador<CenarioEntity, CenarioDto> = {
    tipo: 'cenario',
    listar: () => api.listarCenarios(),
    pagina: api.paginaCenarios?.bind(api),
    locais: () => repo.exportar().cenarios,
    daDto: cenarioDeDto,
    dtoDe: (v) => {
      const p = cenarioSchema.safeParse(v);
      return p.success ? p.data : null;
    },
    criar: async (c) => {
      try {
        return await api.criarCenario(cenarioParaCriar(c));
      } catch {
        return { ok: false, kind: 'contrato' };
      }
    },
    alterar: (c, versao) => api.renomearCenario(c.id, c.nome, versao),
    excluir: (c, versao) => api.excluirCenario(c.id, versao),
    igual: igualCenario,
    aplicar: (es) => repo.aplicar({ cenarios: es }),
    mesclar: mesclarCenario,
  };

  try {
    // Um arquivo pendente continua necessario mesmo se os valores convergirem em outro aparelho.
    for (const evento of historicoPendente) {
      const res = await api.arquivarHistorico(evento);
      if (!res.ok) {
        checar(res);
        throw new Interrompe('erro');
      }
    }
    await reconciliarIncremental(lotes);
    await reconciliarIncremental(cenarios);
    salvarEstado();
    return 'ok';
  } catch (e) {
    salvarEstado();
    if (e instanceof Interrompe) return e.resultado;
    return 'erro';
  }
}
