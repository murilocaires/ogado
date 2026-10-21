import {
  criarRepoLocal,
  LEGACY_STORAGE_KEY,
  LEGACY_STORAGE_KEY_E1,
  STORAGE_KEY,
  STORAGE_KEY_E1,
} from './local-repo';
import {
  abrirBancoLocal,
  apagarBancoLocal,
  canalLocal,
  concluida,
  LEGACY_SYNC_KEY,
  resultado,
  transacionar,
  LOCAL_ORIGIN,
} from './indexed-db';
import { mesclarCenario, mesclarLote } from '../sync/mesclar';
import type {
  CenarioEntity,
  LoteEntity,
  PersistenciaStatus,
  RepoSnapshot,
  SyncableRepo,
} from './types';

type Entidade = { tipo: 'lote'; valor: LoteEntity } | { tipo: 'cenario'; valor: CenarioEntity };
const chave = (e: Entidade) => `${e.tipo}:${e.valor.id}`;
const serializar = (e: Entidade) => JSON.stringify(e);

/** Interface síncrona das telas, confirmação durável explícita por ready/flush. */
export function criarRepoDuravel(): SyncableRepo {
  // O módulo interno cuida das regras de edição; a persistência é exclusivamente transacional.
  // Sem envelope JSON agregado por alteração, nem segunda cópia de todos os dados em memória.
  const interno = criarRepoLocal({ storage: () => null });
  const ouvintes = new Set<() => void>();
  const canal = canalLocal();
  let hidratado = false;
  let aplicando = false;
  let erro: unknown;
  let persistencia: PersistenciaStatus = 'ok';
  let cache: RepoSnapshot = interno.getServerSnapshot();
  let vistos = new Map<string, Entidade>();
  // Uma releitura de outra aba nunca substitui intenções locais ainda não confirmadas.
  const gravacoesPendentes = new Set<string>();
  let fila: Promise<void> = Promise.resolve();
  let pendencias = 0;
  let epoca = 0;
  let geracaoBanco: unknown;
  const falhas: (() => Promise<void>)[] = [];

  function publicar() {
    const snap = interno.getSnapshot();
    cache =
      hidratado && snap.status === 'pronto'
        ? { ...snap, persistencia }
        : interno.getServerSnapshot();
    ouvintes.forEach((o) => o());
  }
  function entidades(): Entidade[] {
    const dados = interno.exportar();
    return [
      ...dados.lotes.map((valor): Entidade => ({ tipo: 'lote', valor })),
      ...dados.cenarios.map((valor): Entidade => ({ tipo: 'cenario', valor })),
    ];
  }
  function adotar(es: Entidade[]) {
    const atuais = new Map(entidades().map((e) => [chave(e), e]));
    es = es.filter((e) => JSON.stringify(atuais.get(chave(e))) !== serializar(e));
    if (!es.length) {
      if (cache.status === 'carregando') publicar();
      return;
    }
    aplicando = true;
    try {
      interno.aplicar({
        lotes: es.flatMap((e) => (e.tipo === 'lote' ? [e.valor] : [])),
        cenarios: es.flatMap((e) => (e.tipo === 'cenario' ? [e.valor] : [])),
      });
      vistos = new Map(entidades().map((e) => [chave(e), e]));
    } finally {
      aplicando = false;
    }
    publicar();
  }

  async function recarregar() {
    const db = await abrirBancoLocal();
    const tx = db.transaction(['entidades', 'meta'], 'readonly');
    const fim = concluida(tx);
    const geracao = resultado<unknown>(tx.objectStore('meta').get('geracao'));
    const es = await resultado<Entidade[]>(tx.objectStore('entidades').getAll());
    const novaGeracao = await geracao;
    await fim;
    if (geracaoBanco !== novaGeracao) {
      epoca++;
      aplicando = true;
      interno.limpar();
      vistos.clear();
      gravacoesPendentes.clear();
      falhas.length = 0;
      erro = undefined;
      geracaoBanco = novaGeracao;
      aplicando = false;
    }
    // Uma resposta de outra aba não substitui escrita local ainda não confirmada.
    const locais = new Map(entidades().map((e) => [chave(e), e]));
    adotar(
      es.filter((e) => {
        if (gravacoesPendentes.has(chave(e))) return false;
        const atual = locais.get(chave(e));
        const visto = vistos.get(chave(e));
        return !atual || !visto || serializar(atual) === serializar(visto);
      }),
    );
  }

  const inicial = (async () => {
    const db = await abrirBancoLocal();
    const leitura = db.transaction('meta', 'readonly');
    const fimLeitura = concluida(leitura);
    const migrado = await resultado<unknown>(leitura.objectStore('meta').get('migrado'));
    await fimLeitura;
    if (migrado !== true) {
      // Não confundir falha de leitura com ausência de legado. Sem leitura completa, não há
      // migração nem limpeza: a próxima tentativa precisa continuar encontrando os originais.
      const capturados = new Map<string, string>();
      for (const k of [
        STORAGE_KEY,
        STORAGE_KEY_E1,
        LEGACY_STORAGE_KEY,
        LEGACY_STORAGE_KEY_E1,
        'bovaro.sync.v1',
        LEGACY_SYNC_KEY,
        'bovaro.identidade',
        'ogado.identidade',
      ]) {
        const valor = window.localStorage.getItem(k);
        if (valor !== null) capturados.set(k, valor);
      }
      const copia: Storage = {
        get length() {
          return capturados.size;
        },
        key: (n) => [...capturados.keys()][n] ?? null,
        getItem: (k) => capturados.get(k) ?? null,
        setItem: (k, v) => {
          capturados.set(k, v);
        },
        removeItem: (k) => {
          capturados.delete(k);
        },
        clear: () => {
          capturados.clear();
        },
      };
      const dadosLegados = criarRepoLocal({ storage: () => copia }).exportar();
      const es: Entidade[] = [
        ...dadosLegados.lotes.map((valor): Entidade => ({ tipo: 'lote', valor })),
        ...dadosLegados.cenarios.map((valor): Entidade => ({ tipo: 'cenario', valor })),
      ];
      const brutoSync = capturados.get('bovaro.sync.v1') ?? capturados.get(LEGACY_SYNC_KEY);
      const brutoIdentidade =
        capturados.get('bovaro.identidade') ?? capturados.get('ogado.identidade');
      const sync: unknown = brutoSync ? JSON.parse(brutoSync) : undefined;
      const identidade: unknown = brutoIdentidade ? JSON.parse(brutoIdentidade) : undefined;
      const identidadeId = (valor: unknown): string | null => {
        if (typeof valor !== 'object' || valor === null) return null;
        const o = valor as Record<string, unknown>;
        return typeof o['usuarioId'] === 'string' && typeof o['fazendaId'] === 'string'
          ? JSON.stringify([o['usuarioId'], o['fazendaId']])
          : null;
      };
      if (brutoIdentidade !== undefined && identidadeId(identidade) === null)
        throw new Error('A identidade dos dados deste aparelho está inválida.');
      let importado = false;
      // Uma segunda aba nunca importa por cima de dados/dono já confirmados pela primeira.
      await transacionar(db, ['entidades', 'outbox', 'meta'], async (tx) => {
        const meta = tx.objectStore('meta');
        if ((await resultado(meta.get('migrado'))) === true) {
          geracaoBanco = await resultado(meta.get('geracao'));
          return;
        }
        const dono = await resultado<unknown>(meta.get('identidade'));
        if (
          (dono !== undefined && dono !== null && identidadeId(dono) === null) ||
          (dono !== undefined &&
            ((identidade && identidadeId(dono) !== identidadeId(identidade)) ||
              (!identidade && es.length > 0)))
        ) {
          throw new Error('Os dados deste aparelho pertencem a outra sessão.');
        }
        for (const e of es) {
          tx.objectStore('entidades').put(e, chave(e));
          tx.objectStore('outbox').put({ id: e.valor.id, version: e.valor.version }, chave(e));
        }
        if (sync) meta.put(sync, 'bovaro.sync.v1');
        if (brutoSync !== undefined) meta.put(brutoSync, 'legado.sync');
        if (identidade && dono === undefined) meta.put(identidade, 'identidade');
        const envelope =
          capturados.get(STORAGE_KEY) ??
          capturados.get(LEGACY_STORAGE_KEY) ??
          capturados.get(STORAGE_KEY_E1) ??
          capturados.get(LEGACY_STORAGE_KEY_E1);
        if (envelope) meta.put(envelope, 'legado');
        const e1 = capturados.get(STORAGE_KEY_E1) ?? capturados.get(LEGACY_STORAGE_KEY_E1);
        if (e1) meta.put(e1, 'legado.e1');
        meta.put(true, 'migrado');
        meta.put(crypto.randomUUID(), 'geracao');
        geracaoBanco = await resultado(meta.get('geracao'));
        importado = true;
      });
      if (importado) {
        for (const k of [STORAGE_KEY, STORAGE_KEY_E1]) {
          try {
            const valor = capturados.get(k);
            // Outra aba antiga pode ter alterado o legado enquanto o commit aguardava.
            if (valor !== undefined && window.localStorage.getItem(k) === valor)
              window.localStorage.removeItem(k);
          } catch {
            /* Commit já preservou o original; limpeza pode esperar. */
          }
        }
      }
    }
    hidratado = true;
    await recarregar();
  })().catch((e: unknown) => {
    erro = e;
    hidratado = true;
    persistencia = 'indisponivel';
    publicar();
  });

  interno.subscribe(() => {
    if (aplicando) return;
    const novos = entidades().filter((e) => serializar(e) !== JSON.stringify(vistos.get(chave(e))));
    const bases = new Map(vistos);
    for (const e of novos) {
      vistos.set(chave(e), e);
      gravacoesPendentes.add(chave(e));
    }
    if (!novos.length) {
      publicar();
      return;
    }
    pendencias++;
    persistencia = 'salvando';
    publicar();
    const geracao = epoca;
    const executar = async () => {
      await inicial;
      if (geracao !== epoca) return;
      const db = await abrirBancoLocal();
      const confirmadas: Entidade[] = [];
      await transacionar(db, ['entidades', 'outbox', 'meta'], async (tx) => {
        const store = tx.objectStore('entidades');
        const geracaoAtual = await resultado(tx.objectStore('meta').get('geracao'));
        if (geracaoAtual !== geracaoBanco) {
          throw new Error('A sessão deste aparelho mudou. Reabra o aplicativo.');
        }
        // Todos os reads são enfileirados antes de aguardar: a transação continua ativa.
        const anteriores = novos.map((e) => resultado<Entidade | undefined>(store.get(chave(e))));
        for (let i = 0; i < novos.length; i++) {
          const novo = novos[i]!;
          const anterior = await anteriores[i];
          const base = bases.get(chave(novo));
          let gravado = novo;
          if (anterior && base && serializar(anterior) !== serializar(base)) {
            if (anterior.valor.deletedAt) gravado = anterior;
            else {
              const valor =
                novo.tipo === 'lote' && anterior.tipo === 'lote'
                  ? mesclarLote(
                      novo.valor,
                      anterior.valor,
                      base.tipo === 'lote' ? base.valor : null,
                    )
                  : novo.tipo === 'cenario' && anterior.tipo === 'cenario'
                    ? mesclarCenario(
                        novo.valor,
                        anterior.valor,
                        base.tipo === 'cenario' ? base.valor : null,
                      )
                    : novo.valor;
              gravado = {
                ...novo,
                valor: {
                  ...valor,
                  version: Math.max(novo.valor.version, anterior.valor.version) + 1,
                },
              } as Entidade;
            }
          }
          store.put(gravado, chave(gravado));
          tx.objectStore('outbox').put(
            { id: gravado.valor.id, version: gravado.valor.version },
            chave(gravado),
          );
          confirmadas.push(gravado);
        }
      });
      if (geracao !== epoca) return;
      // Só adota a confirmação se o usuário ainda não editou novamente.
      const atuais = new Map(entidades().map((e) => [chave(e), e]));
      const confirmacoesAtuais = confirmadas.filter(
        (e, i) => serializar(atuais.get(chave(e))!) === serializar(novos[i]!),
      );
      for (const e of confirmacoesAtuais) gravacoesPendentes.delete(chave(e));
      adotar(confirmacoesAtuais);
      canal?.postMessage({ tipo: 'alterar', origem: LOCAL_ORIGIN });
    };
    fila = fila
      .then(async () => {
        if (erro) throw erro;
        await executar();
      })
      .catch((e: unknown) => {
        erro = e;
        falhas.push(executar);
      })
      .finally(() => {
        pendencias--;
        persistencia = erro ? 'indisponivel' : pendencias ? 'salvando' : 'ok';
        publicar();
      });
  });
  if (canal)
    canal.onmessage = (evento: MessageEvent<{ tipo?: string }>) => {
      if (evento.data.tipo === 'limpar') {
        epoca++;
        falhas.length = 0;
        aplicando = true;
        interno.limpar();
        vistos.clear();
        gravacoesPendentes.clear();
        aplicando = false;
        publicar();
        void fila.then(recarregar).catch((e: unknown) => {
          erro = e;
          persistencia = 'indisponivel';
          publicar();
        });
      } else
        void fila.then(recarregar).catch((e: unknown) => {
          erro = e;
          persistencia = 'indisponivel';
          publicar();
        });
    };

  return {
    ...interno,
    getSnapshot: () => cache,
    subscribe: (o) => {
      ouvintes.add(o);
      return () => {
        ouvintes.delete(o);
      };
    },
    async ready() {
      await inicial;
      await fila;
      await recarregar();
      if (erro) throw erro;
    },
    async flush() {
      await inicial;
      await fila;
      if (erro && falhas.length) {
        const tarefas = falhas.splice(0);
        fila = fila.then(async () => {
          erro = undefined;
          persistencia = 'salvando';
          publicar();
          for (let i = 0; i < tarefas.length; i++) {
            try {
              await tarefas[i]!();
            } catch (e) {
              erro = e;
              falhas.push(...tarefas.slice(i));
              break;
            }
          }
          persistencia = erro ? 'indisponivel' : 'ok';
          publicar();
        });
      }
      await fila;
      if (erro) throw erro;
    },
    limpar() {
      epoca++;
      falhas.length = 0;
      aplicando = true;
      interno.limpar();
      vistos.clear();
      gravacoesPendentes.clear();
      aplicando = false;
      publicar();
      fila = fila
        .then(apagarBancoLocal)
        .then(recarregar)
        .catch((e: unknown) => {
          erro = e;
          persistencia = 'indisponivel';
          publicar();
        });
    },
  };
}
