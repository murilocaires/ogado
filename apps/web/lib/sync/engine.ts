// Motor de sincronização (E3): o aparelho continua sendo a fonte da tela (otimista); a nuvem é
// reconciliada por id. Uma entidade está "limpa" quando `version` local == última versão sincronizada
// (`versoes[id]`). Limpa + nuvem mais nova => adota a nuvem. Suja => envia com a versão-base; em
// conflito (409) a nuvem vence e o aparelho adota `atual` (conflito entre aparelhos fica p/ a E5).
import type { CenarioDto, LoteDto, RecriaEntradaDto } from '@ogado/contracts';
import type { CenarioEntity, LoteEntity, SyncableRepo } from '../repo/types';
import type { DadosClient, DadosFalha } from './data-client';
import {
  cenarioDeDto,
  cenarioParaCriar,
  loteDeDto,
  loteParaCriar,
  lotePatchDe,
  recriaDeDto,
  recriaParaPut,
} from './mappers';

export interface EstadoSync {
  usuarioId: string;
  versoes: Record<string, number>;
}

export interface EstadoSyncStore {
  ler(): EstadoSync | null;
  gravar(estado: EstadoSync): void;
  limpar(): void;
}

export type ResultadoSync = 'ok' | 'nao-autenticado' | 'rede' | 'erro';

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

export async function sincronizar(deps: {
  repo: SyncableRepo;
  api: DadosClient;
  estado: EstadoSyncStore;
  usuarioId: string;
}): Promise<ResultadoSync> {
  const { repo, api, estado, usuarioId } = deps;
  const lido = estado.ler();
  // Outra conta deixou dados neste aparelho: não mistura (RF-078); o logout limpa.
  if (lido && lido.usuarioId !== usuarioId) return 'erro';
  const versoes: Record<string, number> = { ...(lido?.versoes ?? {}) };
  const salvarEstado = (): void => estado.gravar({ usuarioId, versoes });

  async function sincronizarLotes(): Promise<void> {
    const remoto = await api.listarLotes();
    if (!remoto.ok) return checar(remoto);
    const locais = new Map(repo.exportar().lotes.map((l) => [l.id, l]));
    const aplicar: LoteEntity[] = [];
    const adotar = (d: LoteDto): void => {
      aplicar.push(loteDeDto(d));
      versoes[d.id] = d.version;
    };
    const lidos = new Set<string>();

    for (const r of remoto.data) {
      lidos.add(r.id);
      const l = locais.get(r.id);
      const base = versoes[r.id];
      if (!l) {
        adotar(r);
      } else if (base !== undefined && l.version === base) {
        if (r.version > base) adotar(r);
      } else {
        const versao = base ?? r.version;
        const res = l.deletedAt
          ? await api.excluirLote(l.id, versao)
          : await api.alterarLote(l.id, { version: versao, ...lotePatchDe(l) });
        if (res.ok) adotar(res.data);
        else if (res.kind === 'conflito') adotar(res.atual as LoteDto);
        else checar(res);
      }
    }
    for (const l of locais.values()) {
      if (lidos.has(l.id) || l.deletedAt) continue;
      const res = await api.criarLote(loteParaCriar(l));
      if (res.ok) adotar(res.data);
      else checar(res);
    }
    if (aplicar.length > 0) repo.aplicar({ lotes: aplicar });
  }

  async function sincronizarCenarios(): Promise<void> {
    const remoto = await api.listarCenarios();
    if (!remoto.ok) return checar(remoto);
    const locais = new Map(repo.exportar().cenarios.map((c) => [c.id, c]));
    const aplicar: CenarioEntity[] = [];
    const adotar = (dto: CenarioDto): void => {
      const e = cenarioDeDto(dto);
      if (!e) return;
      aplicar.push(e);
      versoes[dto.id] = dto.version;
    };
    const lidos = new Set<string>();

    for (const r of remoto.data) {
      lidos.add(r.id);
      const c = locais.get(r.id);
      const base = versoes[r.id];
      if (!c) {
        adotar(r);
      } else if (base !== undefined && c.version === base) {
        if (r.version > base) adotar(r);
      } else {
        const versao = base ?? r.version;
        const res = c.deletedAt
          ? await api.excluirCenario(c.id, versao)
          : await api.renomearCenario(c.id, c.nome, versao);
        if (res.ok) adotar(res.data);
        else if (res.kind === 'conflito') adotar(res.atual as CenarioDto);
        else checar(res);
      }
    }
    for (const c of locais.values()) {
      if (lidos.has(c.id) || c.deletedAt) continue;
      const res = await api.criarCenario(cenarioParaCriar(c));
      if (res.ok) adotar(res.data);
      else checar(res);
    }
    if (aplicar.length > 0) repo.aplicar({ cenarios: aplicar });
  }

  function adotarRecria(dto: RecriaEntradaDto): void {
    const e = recriaDeDto(dto);
    if (!e) return;
    repo.aplicar({ recria: e });
    versoes[dto.id] = dto.version;
  }

  async function sincronizarRecria(): Promise<void> {
    const local = repo.exportar().recria;
    const remoto = await api.lerRecria();
    if (!remoto.ok && remoto.kind !== 'nao-encontrado') return checar(remoto);

    if (!remoto.ok) {
      const res = await api.gravarRecria(recriaParaPut(local));
      if (res.ok) adotarRecria(res.data);
      else checar(res);
      return;
    }
    const r = remoto.data;
    const base = versoes[local.id];
    if (local.id !== r.id) {
      // Entradas editadas antes do login e nuvem ainda intocada: vale a do aparelho.
      const editadoSoAqui = local.version > 1 && base === undefined && r.version === 1;
      if (!editadoSoAqui) return adotarRecria(r);
      const res = await api.gravarRecria({ ...recriaParaPut(local, r.version), id: r.id });
      if (res.ok) adotarRecria(res.data);
      else if (res.kind === 'conflito') adotarRecria(res.atual as RecriaEntradaDto);
      else checar(res);
      return;
    }
    if (base !== undefined && local.version === base) {
      if (r.version > base) adotarRecria(r);
      return;
    }
    const res = await api.gravarRecria(recriaParaPut(local, base ?? r.version));
    if (res.ok) adotarRecria(res.data);
    else if (res.kind === 'conflito') adotarRecria(res.atual as RecriaEntradaDto);
    else checar(res);
  }

  try {
    await sincronizarLotes();
    await sincronizarCenarios();
    await sincronizarRecria();
    salvarEstado();
    return 'ok';
  } catch (e) {
    salvarEstado();
    if (e instanceof Interrompe) return e.resultado;
    return 'erro';
  }
}
