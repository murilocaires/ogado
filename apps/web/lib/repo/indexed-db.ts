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
let abertura: Promise<IDBDatabase> | undefined;

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
  const leituraDestino = destino.transaction('meta', 'readonly');
  const fimDestino = concluida(leituraDestino);
  const migracaoFeita = resultado<unknown>(
    leituraDestino.objectStore('meta').get('bovaro.migracao-ogado-concluida'),
  );
  const migrado = await migracaoFeita;
  await fimDestino;
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

    await transacionar(destino, [...STORES], async (tx) => {
      // Outra aba pode ter concluído a migração ou feito logout desde a leitura inicial.
      if ((await resultado(tx.objectStore('meta').get('bovaro.migracao-ogado-concluida'))) === true)
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
    });
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
    const pedido = indexedDB.open(LOCAL_DATABASE, 1);
    pedido.onupgradeneeded = () => {
      for (const nome of STORES) pedido.result.createObjectStore(nome);
    };
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () =>
      reject(new Error('Feche as outras abas para atualizar os dados locais.'));
    pedido.onsuccess = () => {
      const db = pedido.result;
      db.onversionchange = () => {
        db.close();
        abertura = undefined;
      };
      void importarBancoLegado(db).then(
        () => resolve(db),
        (erro: unknown) => {
          db.close();
          reject(erro);
        },
      );
    };
  }).catch((erro: unknown) => {
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

/** Também aborta em erro síncrono (ex.: quota no segundo put); nunca confirma meia escrita. */
export async function transacionar<T>(
  db: IDBDatabase,
  nomes: string[],
  executar: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const tx = db.transaction(nomes, 'readwrite');
  const fim = concluida(tx);
  void fim.catch(() => undefined);
  try {
    const valor = await executar(tx);
    await fim;
    return valor;
  } catch (erro) {
    try {
      tx.abort();
    } catch {
      /* A transação já terminou ou abortou. */
    }
    await fim.catch(() => undefined);
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
