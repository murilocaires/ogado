import { STORAGE_KEY, STORAGE_KEY_E1 } from '../repo/local-repo';
import type { EstadoSync, EstadoSyncStore } from './engine';

export const SYNC_KEY = 'ogado.sync.v1';

function ehEstado(v: unknown): v is EstadoSync {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['usuarioId'] === 'string' && typeof o['versoes'] === 'object' && o['versoes'] !== null
  );
}

/** Controle de sincronização (id -> última versão sincronizada) no localStorage. */
export function browserSyncStore(key = SYNC_KEY): EstadoSyncStore {
  return {
    ler() {
      try {
        const bruto = window.localStorage.getItem(key);
        if (!bruto) return null;
        const v: unknown = JSON.parse(bruto);
        return ehEstado(v) ? v : null;
      } catch {
        return null;
      }
    },
    gravar(estado) {
      try {
        window.localStorage.setItem(key, JSON.stringify(estado));
      } catch {
        /* sem armazenamento: a próxima rodada reenvia, e o servidor é idempotente por id */
      }
    },
    limpar() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* idem */
      }
    },
  };
}

/** Logout confirmado: some tudo o que é do usuário neste aparelho (menos as preferências). */
export function limparDadosDoAparelho(): void {
  try {
    for (const k of [STORAGE_KEY, STORAGE_KEY_E1, SYNC_KEY]) window.localStorage.removeItem(k);
  } catch {
    /* storage indisponível: nada a apagar */
  }
}
