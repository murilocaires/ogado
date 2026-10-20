/** Banco versionado do aparelho (ADR-0007). Nunca contém senha, token ou cookie. */
export const LOCAL_DATABASE = 'ogado.local.v1';
export const LOCAL_CHANNEL = 'ogado.local.changes';
/** Identifica a janela, não o usuário; evita invalidar o próprio logout em andamento. */
export const LOCAL_ORIGIN = typeof window === 'undefined' ? 'server' : crypto.randomUUID();
export const STORES = ['entidades', 'outbox', 'meta'] as const;
let abertura: Promise<IDBDatabase> | undefined;

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
      resolve(db);
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
    // null registra saída confirmada; undefined ainda permite migração de identidade legada.
    tx.objectStore('meta').put(null, 'identidade');
    tx.objectStore('meta').put(crypto.randomUUID(), 'geracao');
  });
  const canal = canalLocal();
  canal?.postMessage({ tipo: 'limpar', origem: LOCAL_ORIGIN });
  canal?.close();
}
