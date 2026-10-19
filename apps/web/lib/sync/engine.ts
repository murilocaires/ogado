// Motor de sincronização (E3, robusto na E5): o aparelho continua sendo a fonte da tela (otimista); a
// nuvem é reconciliada por id. Uma entidade está "limpa" quando `version` local == última versão
// sincronizada (`versoes[id]`). Limpa + nuvem mais nova => adota a nuvem. Suja => envia com a
// versão-base. Conflito (outro aparelho mexeu) NUNCA é resolvido em silêncio (RF-076): fica
// registrado no estado do aparelho até o usuário decidir. Item recusado por validação (RF-079) idem.
// Reenviar é seguro: POST é idempotente por id e, se o servidor já gravou o mesmo conteúdo (rede
// cortada no meio do envio), a rodada seguinte reconhece e adota sem duplicar nem avisar (RNF-017).
import {
  cenarioSchema,
  loteSchema,
  recriaEntradaSchema,
  type CenarioDto,
  type LoteDto,
  type RecriaEntradaDto,
} from '@ogado/contracts';
import type {
  CenarioEntity,
  DadosCompletos,
  EntityMeta,
  LoteEntity,
  LoteSalvar,
  RecriaEntity,
  SyncableRepo,
} from '../repo/types';
import type { DadosClient, DadosFalha, DadosResult } from './data-client';
import {
  cenarioDeDto,
  cenarioParaCriar,
  loteDeDto,
  loteParaCriar,
  lotePatchDe,
  recriaDeDto,
  recriaParaPut,
} from './mappers';
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
}

export interface EstadoSync {
  usuarioId: string;
  versoes: Record<string, number>;
  conflitos?: Conflito[];
  rejeitados?: Rejeitado[];
}

export interface EstadoSyncStore {
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
 * recria nunca editadas (versão 1) não são pendência: não há nada do usuário para subir.
 */
export function pendentes(
  dados: DadosCompletos,
  versoes: Readonly<Record<string, number>>,
): ItemPendente[] {
  const sujo = (e: EntityMeta): boolean => versoes[e.id] !== e.version;
  const itens: ItemPendente[] = [];
  for (const l of dados.lotes) if (sujo(l)) itens.push({ tipo: 'lote', id: l.id });
  for (const c of dados.cenarios) if (sujo(c)) itens.push({ tipo: 'cenario', id: c.id });
  const r = dados.recria;
  if (sujo(r) && !(versoes[r.id] === undefined && r.version === 1)) {
    itens.push({ tipo: 'recria', id: r.id });
  }
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
}

interface Adaptador<E extends EntityMeta, D extends DtoBase> {
  tipo: TipoEntidade;
  listar(): Promise<DadosResult<D[]>>;
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
}

export interface DepsSync {
  repo: SyncableRepo;
  api: DadosClient;
  estado: EstadoSyncStore;
  usuarioId: string;
  agora?: () => Date;
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

function igualRecria(r: RecriaEntity, d: RecriaEntradaDto): boolean {
  const outra = recriaDeDto(d);
  if (!outra) return false;
  return (
    r.lotacaoInicial === outra.lotacaoInicial &&
    JSON.stringify(r.form) === JSON.stringify(outra.form)
  );
}

export async function sincronizar(deps: DepsSync): Promise<ResultadoSync> {
  const { repo, api, estado, usuarioId } = deps;
  const agora = deps.agora ?? (() => new Date());
  const lido = estado.ler();
  // Outra conta deixou dados neste aparelho: não mistura (RF-078); o logout limpa.
  if (lido && lido.usuarioId !== usuarioId) return 'erro';
  const versoes: Record<string, number> = { ...(lido?.versoes ?? {}) };
  const conflitos = new Map<string, Conflito>((lido?.conflitos ?? []).map((c) => [c.id, c]));
  const rejeitados = new Map<string, Rejeitado>((lido?.rejeitados ?? []).map((r) => [r.id, r]));

  const salvarEstado = (): void => {
    // Pendência de entidade que não existe mais no aparelho não tem o que mostrar.
    const dados = repo.exportar();
    const existentes = new Set<string>([
      ...dados.lotes.map((l) => l.id),
      ...dados.cenarios.map((c) => c.id),
      dados.recria.id,
    ]);
    for (const id of [...conflitos.keys()]) if (!existentes.has(id)) conflitos.delete(id);
    for (const id of [...rejeitados.keys()]) if (!existentes.has(id)) rejeitados.delete(id);
    estado.gravar({
      usuarioId,
      versoes,
      conflitos: [...conflitos.values()],
      rejeitados: [...rejeitados.values()],
    });
  };

  const registrarConflito = (c: Omit<Conflito, 'detectadoEm'>): void => {
    conflitos.set(c.id, { ...c, detectadoEm: agora().toISOString() });
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
  };

  /**
   * Aplica ao repositório o que veio da nuvem, sem atropelar o que o usuário editou enquanto o envio
   * estava em curso: se a versão local mudou desde a leitura, mantém o conteúdo do aparelho e só
   * garante que continue "sujo" (será enviado na próxima rodada).
   */
  function aplicarSemAtropelar<E extends EntityMeta>(
    candidatos: { entidade: E; lida: number | null }[],
    atuais: () => E[],
    aplicar: (es: E[]) => void,
  ): void {
    if (candidatos.length === 0) return;
    const hoje = new Map(atuais().map((e) => [e.id, e]));
    const saida: E[] = [];
    for (const { entidade, lida } of candidatos) {
      const local = hoje.get(entidade.id);
      if (!local || local.version === lida) {
        saida.push(entidade);
        continue;
      }
      const base = versoes[entidade.id];
      const versao = local.version === base ? local.version + 1 : local.version;
      if (versao !== local.version) saida.push({ ...local, version: versao });
    }
    if (saida.length > 0) aplicar(saida);
  }

  async function reconciliar<E extends EntityMeta, D extends DtoBase>(
    a: Adaptador<E, D>,
  ): Promise<void> {
    const remoto = await a.listar();
    if (!remoto.ok) return checar(remoto);
    const locais = new Map(a.locais().map((e) => [e.id, e]));
    const candidatos: { entidade: E; lida: number | null }[] = [];
    const adotar = (d: D, lida: number | null): void => {
      const e = a.daDto(d);
      if (!e) return;
      candidatos.push({ entidade: e, lida });
      sincronizado(d.id, d.version);
    };
    const lidos = new Set<string>();

    try {
      for (const r of remoto.data) {
        lidos.add(r.id);
        const l = locais.get(r.id);
        const base = versoes[r.id];
        if (!l) {
          adotar(r, null);
          continue;
        }
        if (base !== undefined && l.version === base) {
          if (r.version > base) adotar(r, l.version);
          continue;
        }
        // Suja: o aparelho tem algo que a nuvem não confirmou.
        if (a.igual(l, r)) {
          adotar(r, l.version); // já está lá (envio anterior cortado antes da resposta)
          continue;
        }
        if (conflitos.has(l.id) || aguardandoCorrecao(l)) continue;
        const acao: AcaoLocal = l.deletedAt ? 'excluir' : 'editar';
        if (r.deletedAt !== null) {
          if (l.deletedAt !== null) adotar(r, l.version);
          else {
            registrarConflito({
              tipo: a.tipo,
              id: l.id,
              motivo: 'excluido-no-servidor',
              acao,
              versaoLocal: l.version,
              atual: r,
            });
          }
          continue;
        }
        if (base !== undefined && r.version !== base) {
          registrarConflito({
            tipo: a.tipo,
            id: l.id,
            motivo: 'alterado',
            acao,
            versaoLocal: l.version,
            atual: r,
          });
          continue;
        }
        const res = l.deletedAt
          ? await a.excluir(l, base ?? r.version)
          : await a.alterar(l, base ?? r.version);
        if (res.ok) adotar(res.data, l.version);
        else if (res.kind === 'conflito') {
          const atual = a.dtoDe(res.atual);
          if (atual && a.igual(l, atual)) adotar(atual, l.version);
          else {
            registrarConflito({
              tipo: a.tipo,
              id: l.id,
              motivo: atual?.deletedAt ? 'excluido-no-servidor' : 'alterado',
              acao,
              versaoLocal: l.version,
              atual: atual ?? res.atual,
            });
          }
        } else falhaDeEscrita(a.tipo, l, res);
      }

      for (const l of locais.values()) {
        if (lidos.has(l.id)) continue;
        if (l.deletedAt !== null) {
          // Criado e excluído antes de subir: não há nada a enviar.
          sincronizado(l.id, l.version);
          continue;
        }
        if (aguardandoCorrecao(l)) continue;
        const res = await a.criar(l);
        if (res.ok) adotar(res.data, l.version);
        else falhaDeEscrita(a.tipo, l, res);
      }
    } finally {
      aplicarSemAtropelar(
        candidatos,
        () => a.locais(),
        (es) => a.aplicar(es),
      );
    }
  }

  const lotes: Adaptador<LoteEntity, LoteDto> = {
    tipo: 'lote',
    listar: () => api.listarLotes(),
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
  };

  const cenarios: Adaptador<CenarioEntity, CenarioDto> = {
    tipo: 'cenario',
    listar: () => api.listarCenarios(),
    locais: () => repo.exportar().cenarios,
    daDto: cenarioDeDto,
    dtoDe: (v) => {
      const p = cenarioSchema.safeParse(v);
      return p.success ? p.data : null;
    },
    criar: (c) => api.criarCenario(cenarioParaCriar(c)),
    alterar: (c, versao) => api.renomearCenario(c.id, c.nome, versao),
    excluir: (c, versao) => api.excluirCenario(c.id, versao),
    igual: igualCenario,
    aplicar: (es) => repo.aplicar({ cenarios: es }),
  };

  /** As entradas da recria são um registro único por fazenda (PUT). */
  async function sincronizarRecria(): Promise<void> {
    const local = repo.exportar().recria;
    const remoto = await api.lerRecria();
    if (!remoto.ok && remoto.kind !== 'nao-encontrado') return checar(remoto);

    let adotada: { entidade: RecriaEntity; lida: number } | null = null;
    const adotar = (d: RecriaEntradaDto): void => {
      const e = recriaDeDto(d);
      if (!e) return;
      adotada = { entidade: e, lida: local.version };
      sincronizado(d.id, d.version);
      if (local.id !== d.id) {
        conflitos.delete(local.id);
        rejeitados.delete(local.id);
      }
    };
    const conflitar = (atual: unknown): void => {
      registrarConflito({
        tipo: 'recria',
        id: local.id,
        motivo: 'alterado',
        acao: 'editar',
        versaoLocal: local.version,
        atual,
      });
    };

    try {
      if (!remoto.ok) {
        if (aguardandoCorrecao(local)) return;
        const res = await api.gravarRecria(recriaParaPut(local));
        if (res.ok) adotar(res.data);
        else falhaDeEscrita('recria', local, res);
        return;
      }
      const r = remoto.data;
      const base = local.id === r.id ? versoes[local.id] : undefined;
      if (base !== undefined && local.version === base) {
        if (r.version > base) adotar(r);
        return;
      }
      if (igualRecria(local, r)) return adotar(r);
      // Nunca editada neste aparelho: não há nada do usuário a proteger.
      if (base === undefined && local.version === 1) return adotar(r);
      if (conflitos.has(local.id) || aguardandoCorrecao(local)) return;
      if (base !== undefined ? r.version !== base : local.id !== r.id && r.version > 1) {
        return conflitar(r);
      }
      const res = await api.gravarRecria({ ...recriaParaPut(local, r.version), id: r.id });
      if (res.ok) adotar(res.data);
      else if (res.kind === 'conflito') {
        const p = recriaEntradaSchema.safeParse(res.atual);
        if (p.success && igualRecria(local, p.data)) adotar(p.data);
        else conflitar(p.success ? p.data : res.atual);
      } else falhaDeEscrita('recria', local, res);
    } finally {
      const a = adotada as { entidade: RecriaEntity; lida: number } | null;
      if (a) {
        const hoje = repo.exportar().recria;
        if (hoje.version === a.lida) repo.aplicar({ recria: a.entidade });
        else {
          // Editada durante o envio: fica com o conteúdo do usuário, já na identidade da nuvem.
          const base = versoes[a.entidade.id];
          const versao = hoje.version === base ? hoje.version + 1 : hoje.version;
          if (hoje.id !== a.entidade.id || versao !== hoje.version) {
            repo.aplicar({ recria: { ...hoje, id: a.entidade.id, version: versao } });
          }
        }
      }
    }
  }

  try {
    await reconciliar(lotes);
    await reconciliar(cenarios);
    await sincronizarRecria();
    salvarEstado();
    return 'ok';
  } catch (e) {
    salvarEstado();
    if (e instanceof Interrompe) return e.resultado;
    return 'erro';
  }
}

/* ---------- Decisão do usuário (RF-076) ---------- */

export type EscolhaConflito = 'meu' | 'servidor';

/**
 * Aplica a decisão do usuário sobre um conflito registrado. Não fala com a rede: "manter o meu"
 * só troca a versão-base pela do servidor (a próxima rodada reenvia por cima, já ciente); "usar o
 * do servidor" adota o `atual`. Retorna `false` se o conflito não existe mais.
 */
export function resolverConflito(
  deps: Pick<DepsSync, 'repo' | 'estado' | 'usuarioId'> & { id: string; escolha: EscolhaConflito },
): boolean {
  const { repo, estado, usuarioId, id, escolha } = deps;
  const lido = estado.ler();
  if (!lido || lido.usuarioId !== usuarioId) return false;
  const conflito = (lido.conflitos ?? []).find((c) => c.id === id);
  if (!conflito) return false;
  const versoes = { ...lido.versoes };
  const dados = repo.exportar();

  const adotarServidor = (): void => {
    if (conflito.tipo === 'lote') {
      const dto = loteSchema.safeParse(conflito.atual);
      if (!dto.success) return;
      repo.aplicar({ lotes: [loteDeDto(dto.data)] });
      versoes[id] = dto.data.version;
    } else if (conflito.tipo === 'cenario') {
      const dto = cenarioSchema.safeParse(conflito.atual);
      const e = dto.success ? cenarioDeDto(dto.data) : null;
      if (!dto.success || !e) return;
      repo.aplicar({ cenarios: [e] });
      versoes[id] = dto.data.version;
    } else {
      const dto = recriaEntradaSchema.safeParse(conflito.atual);
      const e = dto.success ? recriaDeDto(dto.data) : null;
      if (!dto.success || !e) return;
      repo.aplicar({ recria: e });
      versoes[dto.data.id] = dto.data.version;
    }
  };

  if (escolha === 'servidor') {
    adotarServidor();
  } else if (conflito.motivo === 'excluido-no-servidor') {
    // O servidor não revive um registro excluído: o aparelho cria uma cópia nova com o conteúdo dele.
    if (conflito.tipo === 'lote') {
      const l = dados.lotes.find((x) => x.id === id);
      if (l) {
        const conteudo: Partial<LoteEntity> = { ...l };
        delete conteudo.id;
        delete conteudo.version;
        delete conteudo.updatedAt;
        delete conteudo.deletedAt;
        adotarServidor();
        if (l.deletedAt === null) repo.salvarLote(conteudo as LoteSalvar);
      }
    } else if (conflito.tipo === 'cenario') {
      const c = dados.cenarios.find((x) => x.id === id);
      if (c) {
        adotarServidor();
        if (c.deletedAt === null) {
          repo.salvarCenario({
            nome: c.nome,
            form: c.form,
            variantes: c.variantes,
            parametros: c.parametros,
            resultado: c.resultado,
          });
        }
      }
    }
  } else {
    // Manter o meu: a base passa a ser a versão do servidor e a entidade local ganha uma versão
    // própria, diferente dela, para continuar "suja" e subir na próxima rodada.
    const dto = conflito.atual as { id?: unknown; version?: unknown } | null;
    if (dto && typeof dto.version === 'number') {
      const servidor = dto.version;
      const proxima = (v: number): number => Math.max(v, servidor) + 1;
      if (conflito.tipo === 'lote') {
        const l = dados.lotes.find((x) => x.id === id);
        if (l) repo.aplicar({ lotes: [{ ...l, version: proxima(l.version) }] });
        versoes[id] = servidor;
      } else if (conflito.tipo === 'cenario') {
        const c = dados.cenarios.find((x) => x.id === id);
        if (c) repo.aplicar({ cenarios: [{ ...c, version: proxima(c.version) }] });
        versoes[id] = servidor;
      } else {
        const novoId = typeof dto.id === 'string' ? dto.id : dados.recria.id;
        repo.aplicar({
          recria: { ...dados.recria, id: novoId, version: proxima(dados.recria.version) },
        });
        versoes[novoId] = servidor;
      }
    }
  }

  estado.gravar({
    usuarioId,
    versoes,
    conflitos: (lido.conflitos ?? []).filter((c) => c.id !== id),
    rejeitados: lido.rejeitados ?? [],
  });
  return true;
}
