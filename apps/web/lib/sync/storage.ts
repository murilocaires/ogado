import { STORAGE_KEY, STORAGE_KEY_E1 } from '../repo/local-repo';
import type { EstadoSync, EstadoSyncStore } from './engine';
import {
  abrirBancoLocal,
  apagarBancoLocal,
  concluida,
  resultado,
  transacionar,
} from '../repo/indexed-db';

export const SYNC_KEY = 'ogado.sync.v1';

function ehEstado(v: unknown): v is EstadoSync {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['usuarioId'] === 'string' && typeof o['versoes'] === 'object' && o['versoes'] !== null
  );
}

/** Controle de sincronização e checkpoint no mesmo banco IndexedDB do repositório. */
export function browserSyncStore(key = SYNC_KEY): EstadoSyncStore {
  let atual: EstadoSync | null = null;
  let sujo = false;
  let geracao: unknown;
  return {
    async ready() {
      const db = await abrirBancoLocal();
      const tx = db.transaction('meta', 'readonly');
      const fim = concluida(tx);
      const valor = resultado<unknown>(tx.objectStore('meta').get(key));
      const epoca = resultado<unknown>(tx.objectStore('meta').get('geracao'));
      const [estado, novaGeracao] = await Promise.all([valor, epoca]);
      await fim;
      // Falha de flush não autoriza conservar em memória a fila da sessão anterior.
      // Só preservar alterações não confirmadas se o banco ainda pertence à mesma geração.
      if (sujo && geracao === novaGeracao) return;
      geracao = novaGeracao;
      atual = ehEstado(estado) ? estado : null;
      sujo = false;
    },
    ler() {
      return atual;
    },
    gravar(estado) {
      atual = structuredClone(estado);
      sujo = true;
    },
    async flush() {
      if (!sujo) return;
      const db = await abrirBancoLocal();
      const confirmado = atual;
      await transacionar(db, ['meta', 'outbox'], async (tx) => {
        const meta = tx.objectStore('meta');
        if ((await resultado(meta.get('geracao'))) !== geracao) {
          throw new Error('A sessão deste aparelho mudou.');
        }
        if (confirmado) meta.put(confirmado, key);
        else meta.delete(key);
        const cursor = tx.objectStore('outbox').openCursor();
        cursor.onsuccess = () => {
          const linha = cursor.result;
          if (!linha) return;
          const item = linha.value as { id: string; version: number };
          if (confirmado?.versoes[item.id] === item.version) linha.delete();
          linha.continue();
        };
      });
      if (atual === confirmado) sujo = false;
    },
    limpar() {
      atual = null;
      sujo = true;
    },
  };
}

/** Logout confirmado: some tudo o que é do usuário neste aparelho (menos as preferências). */
export async function limparDadosDoAparelho(): Promise<void> {
  await apagarBancoLocal();
  try {
    for (const k of [STORAGE_KEY, STORAGE_KEY_E1, SYNC_KEY]) window.localStorage.removeItem(k);
  } catch {
    /* storage indisponível: nada a apagar */
  }
}
