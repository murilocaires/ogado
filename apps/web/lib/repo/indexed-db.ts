/** Banco versionado do aparelho (ADR-0007). Nunca contém senha, token ou cookie. */
export const LOCAL_DATABASE = 'bovaro.local.v1';
export const LOCAL_CHANNEL = 'bovaro.local.changes';
const LEGACY_DATABASE = 'ogado.local.v1';
export const LEGACY_SYNC_KEY = 'ogado.sync.v1';
const LEGACY_IDENTITY_KEY = 'ogado.identidade';
const SYNC_KEY = 'bovaro.sync.v1';
/** Identifica a janela, não o usuário; evita invalidar o próprio logout em andamento. */
export const LOCAL_ORIGIN = typeof window === 'undefined' ? 'server' : crypto.randomUUID();
export const STORES = ['entidades', 'outbox', 'meta'] as const;
/** Um banco suspenso pelo sistema (celular) não pode prender a tela para sempre. */
const PRAZO_ABERTURA_MS = 12_000;
const PRAZO_ESCRITA_MS = 6_000;
const PRAZO_LEITURA_MS = 12_000;
const PRAZO_MIGRACAO_MS = 60_000;
let abertura: Promise<IDBDatabase> | undefined;
let conexao: IDBDatabase | undefined;

/**
 * Descarta a conexão atual depois de um erro. No celular o sistema pode encerrar o IndexedDB
 * quando o app fica em segundo plano; sem isto, toda gravação seguinte falharia até recarregar.
 * A próxima chamada de `abrirBancoLocal` cria uma conexão nova.
 */
export function invalidarConexao(db?: IDBDatabase): void {
  if (db && conexao !== db) return;
  const alvo = db ?? conexao;
  conexao = undefined;
  abertura = undefined;
  try {
    alvo?.close();
  } catch {
    /* já fechada */
  }
}

function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('O armazenamento do aparelho não respondeu.'));
    }, ms);
    promessa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (erro: unknown) => {
        clearTimeout(timer);
        reject(erro);
      },
    );
  });
}

function abrirBancoLegado(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(LEGACY_DATABASE);
    pedido.onupgradeneeded = () => {
      // Não criar/apagar um banco vazio: outra aba pode começar a usá-lo nesse intervalo.
      pedido.transaction?.abort();
      resolve(null);
    };
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => reject(new Error('Feche as outras abas para migrar os dados locais.'));
    pedido.onsuccess = () => {
      resolve(pedido.result);
    };
  });
}

async function importarBancoLegado(destino: IDBDatabase): Promise<void> {
  // A checagem do marcador é rápida; se o banco não responde nela, não adianta esperar a
  // migração inteira (o app ficaria "Carregando" por um minuto).
  const migrado = await lerTransacao(
    destino,
    ['meta'],
    async (tx) => {
      const migracaoFeita = resultado<unknown>(
        tx.objectStore('meta').get('bovaro.migracao-ogado-concluida'),
      );
      return await migracaoFeita;
    },
    PRAZO_ESCRITA_MS,
  );
  if (migrado === true) return;

  const legado = await abrirBancoLegado();
  if (!legado) {
    await transacionar(destino, ['meta'], (tx) => {
      tx.objectStore('meta').put(true, 'bovaro.migracao-ogado-concluida');
    });
    return;
  }
  try {
    const leitura = legado.transaction([...STORES], 'readonly');
    const fim = concluida(leitura);
    const dados = await Promise.all(
      STORES.map(async (nome) => {
        const store = leitura.objectStore(nome);
        const [chaves, valores] = await Promise.all([
          resultado<IDBValidKey[]>(store.getAllKeys()),
          resultado<unknown[]>(store.getAll()),
        ]);
        return { nome, chaves, valores };
      }),
    );
    await fim;

    await transacionar(
      destino,
      [...STORES],
      async (tx) => {
        // Outra aba pode ter concluído a migração ou feito logout desde a leitura inicial.
        if (
          (await resultado(tx.objectStore('meta').get('bovaro.migracao-ogado-concluida'))) === true
        )
          return;
        const contagens = await Promise.all(
          STORES.map((nome) => resultado(tx.objectStore(nome).count())),
        );
        if (contagens.some((total) => total > 0))
          throw new Error('O banco Bovaro já contém dados; a migração precisa ser revisada.');
        for (const grupo of dados) {
          const store = tx.objectStore(grupo.nome);
          for (let indice = 0; indice < grupo.chaves.length; indice += 1) {
            const chaveAntiga = grupo.chaves[indice]!;
            const chaveNova =
              grupo.nome !== 'meta'
                ? chaveAntiga
                : chaveAntiga === LEGACY_SYNC_KEY
                  ? SYNC_KEY
                  : chaveAntiga === LEGACY_IDENTITY_KEY
                    ? 'identidade'
                    : chaveAntiga;
            if ((await resultado(store.get(chaveNova))) === undefined)
              store.put(grupo.valores[indice], chaveNova);
          }
        }
        tx.objectStore('meta').put(true, 'bovaro.migracao-ogado-concluida');
      },
      PRAZO_MIGRACAO_MS,
    );
  } finally {
    legado.close();
  }
}

export function abrirBancoLocal(): Promise<IDBDatabase> {
  if (abertura) return abertura;
  const promessa = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Armazenamento do aparelho indisponível.'));
      return;
    }
    let finalizado = false;
    let emAbertura: IDBDatabase | undefined;
    const prazoAbertura = setTimeout(() => {
      try {
        emAbertura?.close();
      } catch {
        /* já fechado */
      }
      concluir(() => reject(new Error('O armazenamento do aparelho não respondeu.')));
    }, PRAZO_ABERTURA_MS);
    const concluir = (fn: () => void): void => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(prazoAbertura);
      fn();
    };

    const pedido = indexedDB.open(LOCAL_DATABASE, 1);
    pedido.onupgradeneeded = () => {
      for (const nome of STORES) pedido.result.createObjectStore(nome);
    };
    pedido.onerror = () =>
      concluir(() => reject(pedido.error ?? new Error('Falha ao abrir os dados locais.')));
    pedido.onblocked = () =>
      concluir(() => reject(new Error('Feche as outras abas para atualizar os dados locais.')));
    pedido.onsuccess = () => {
      const db = pedido.result;
      if (finalizado) {
        db.close();
        return;
      }
      if (prazoAbertura) clearTimeout(prazoAbertura);
      emAbertura = db;
      db.onversionchange = () => invalidarConexao(db);
      db.onclose = () => {
        if (conexao === db) {
          conexao = undefined;
          abertura = undefined;
        }
      };
      // Migração legada mantém prazo próprio: pode envolver muitos registros num aparelho lento.
      void comPrazo(importarBancoLegado(db), PRAZO_MIGRACAO_MS).then(
        () => {
          if (finalizado) {
            db.close();
            return;
          }
          finalizado = true;
          conexao = db;
          resolve(db);
        },
        (erro: unknown) => {
          db.close();
          concluir(() => reject(erro));
        },
      );
    };
  }).catch((erro: unknown) => {
    conexao = undefined;
    abertura = undefined;
    throw erro;
  });
  abertura = promessa;
  return promessa;
}

export function resultado<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export function concluida(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error('Não foi possível guardar os dados no aparelho.'));
    tx.onerror = () =>
      reject(tx.error ?? new Error('Não foi possível guardar os dados no aparelho.'));
  });
}

/**
 * Executa uma transação de escrita com prazo. Em erro ou demora, aborta e descarta a conexão:
 * o próximo `abrirBancoLocal` tenta um canal novo (o anterior pode ter morrido em segundo plano).
 */
export async function transacionar<T>(
  db: IDBDatabase,
  nomes: string[],
  executar: (tx: IDBTransaction) => T | Promise<T>,
  prazoMs = PRAZO_ESCRITA_MS,
): Promise<T> {
  let tx: IDBTransaction;
  try {
    tx = db.transaction(nomes, 'readwrite');
  } catch (erro) {
    invalidarConexao(db);
    throw erro;
  }
  const fim = concluida(tx);
  void fim.catch(() => undefined);
  try {
    return await comPrazo(
      (async () => {
        const valor = await executar(tx);
        await fim;
        return valor;
      })(),
      prazoMs,
    );
  } catch (erro) {
    try {
      tx.abort();
    } catch {
      /* A transação já terminou ou abortou. */
    }
    // Não espera o fim: se o banco estiver suspenso, o abort pode nunca responder.
    void fim.catch(() => undefined);
    invalidarConexao(db);
    throw erro;
  }
}

/** Leitura com prazo: um banco suspenso não pode deixar a tela em "Carregando" para sempre. */
export async function lerTransacao<T>(
  db: IDBDatabase,
  nomes: string[],
  executar: (tx: IDBTransaction) => T | Promise<T>,
  prazoMs = PRAZO_LEITURA_MS,
): Promise<T> {
  let tx: IDBTransaction;
  try {
    tx = db.transaction(nomes, 'readonly');
  } catch (erro) {
    invalidarConexao(db);
    throw erro;
  }
  const fim = concluida(tx);
  void fim.catch(() => undefined);
  try {
    return await comPrazo(
      (async () => {
        const valor = await executar(tx);
        await fim;
        return valor;
      })(),
      prazoMs,
    );
  } catch (erro) {
    try {
      tx.abort();
    } catch {
      /* Leitura já encerrada. */
    }
    void fim.catch(() => undefined);
    invalidarConexao(db);
    throw erro;
  }
}

export function canalLocal(): BroadcastChannel | null {
  return typeof window === 'undefined' || typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel(LOCAL_CHANNEL);
}

export async function apagarBancoLocal(): Promise<void> {
  const db = await abrirBancoLocal();
  await transacionar(db, [...STORES], (tx) => {
    for (const nome of STORES) tx.objectStore(nome).clear();
    tx.objectStore('meta').put(true, 'migrado');
    tx.objectStore('meta').put(true, 'bovaro.migracao-ogado-concluida');
    // null registra saída confirmada; undefined ainda permite migração de identidade legada.
    tx.objectStore('meta').put(null, 'identidade');
    tx.objectStore('meta').put(crypto.randomUUID(), 'geracao');
  });
  const canal = canalLocal();
  canal?.postMessage({ tipo: 'limpar', origem: LOCAL_ORIGIN });
  canal?.close();
}
