import {
  abrirBancoLocal,
  canalLocal,
  LOCAL_ORIGIN,
  resultado,
  transacionar,
} from '../repo/indexed-db';
import type { IdentityStore, LocalIdentity } from './session-controller';

const IDENTITY_KEY = 'bovaro.identidade';
const LEGACY_IDENTITY_KEY = 'ogado.identidade';
const LEGACY_KEYS = ['bovaro.e2.v2', 'bovaro.e1.v1', 'ogado.e2.v2', 'ogado.e1.v1'] as const;

function identidadeDe(raw: unknown): LocalIdentity | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const valido = (id: unknown): id is string =>
    typeof id === 'string' && id.trim().length > 0 && id.length <= 200;
  return valido(value.usuarioId) && valido(value.fazendaId)
    ? { usuarioId: value.usuarioId, fazendaId: value.fazendaId }
    : null;
}

function igual(a: LocalIdentity, b: LocalIdentity): boolean {
  return a.usuarioId === b.usuarioId && a.fazendaId === b.fazendaId;
}

function erroDeProprietario(): Error {
  return new Error('Não foi possível confirmar a conta dona dos dados deste aparelho.');
}

/** RF-078: o dono acompanha os dados no IndexedDB; localStorage é somente espelho/migração. */
export function criarIdentidadeDuravel(): IdentityStore & { ready(): Promise<void> } {
  let confirmada: LocalIdentity | null = null;
  let epoca = 0;

  function espelhar(identity: LocalIdentity | null): void {
    try {
      if (identity) window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
      else window.localStorage.removeItem(IDENTITY_KEY);
    } catch {
      // O IndexedDB já confirmou o dono; falha do espelho não muda a titularidade.
    }
  }

  function notificar(): void {
    const canal = canalLocal();
    canal?.postMessage({ tipo: 'identidade', origem: LOCAL_ORIGIN });
    canal?.close();
  }

  async function ready(): Promise<void> {
    const mine = ++epoca;
    const db = await abrirBancoLocal();
    const owner = await transacionar(db, ['meta', 'entidades'], async (tx) => {
      const meta = tx.objectStore('meta');
      const pOwner = resultado<unknown>(meta.get('identidade'));
      const pCount = resultado(tx.objectStore('entidades').count());
      const pMigrado = resultado<unknown>(meta.get('migrado'));
      const pSync = resultado<unknown>(meta.get('bovaro.sync.v1'));
      const [raw, count, migrado, sync] = await Promise.all([pOwner, pCount, pMigrado, pSync]);
      const temSync = sync !== undefined && sync !== null;
      if (mine !== epoca) throw erroDeProprietario();
      // Logout registra ausência explícita; um espelho antigo de outra aba não pode revivê-la.
      if (raw === null) {
        if (count > 0 || temSync) throw erroDeProprietario();
        return null;
      }
      if (raw !== undefined) {
        const existente = identidadeDe(raw);
        if (!existente) throw erroDeProprietario();
        return existente;
      }
      let legado: LocalIdentity | null = null;
      let dadosLegados = false;
      try {
        const texto =
          window.localStorage.getItem(IDENTITY_KEY) ??
          window.localStorage.getItem(LEGACY_IDENTITY_KEY);
        if (texto) {
          legado = identidadeDe(JSON.parse(texto) as unknown);
          if (!legado) throw erroDeProprietario();
        }
        if (!migrado) {
          for (const key of LEGACY_KEYS) {
            const bruto = window.localStorage.getItem(key);
            if (bruto === null) continue;
            const dados: unknown = JSON.parse(bruto);
            if (
              typeof dados !== 'object' ||
              dados === null ||
              !('lotes' in dados) ||
              !Array.isArray(dados.lotes) ||
              ('cenarios' in dados && !Array.isArray(dados.cenarios))
            )
              throw erroDeProprietario();
            dadosLegados ||=
              dados.lotes.length > 0 ||
              ('cenarios' in dados && Array.isArray(dados.cenarios) && dados.cenarios.length > 0);
          }
        }
      } catch {
        if (!migrado || count > 0 || temSync) throw erroDeProprietario();
      }
      if (!legado && (count > 0 || dadosLegados || temSync)) throw erroDeProprietario();
      if (legado) meta.put(legado, 'identidade');
      return legado;
    });
    if (mine !== epoca) throw erroDeProprietario();
    confirmada = owner;
    if (owner) espelhar(owner);
  }

  return {
    ready,
    read: () => (confirmada ? { ...confirmada } : null),
    async write(identity) {
      const proxima = identidadeDe(identity);
      if (!proxima) throw erroDeProprietario();
      await ready();
      const mine = ++epoca;
      const db = await abrirBancoLocal();
      const mudou = await transacionar(db, ['meta', 'entidades'], async (tx) => {
        const meta = tx.objectStore('meta');
        const pOwner = resultado<unknown>(meta.get('identidade'));
        const pCount = resultado(tx.objectStore('entidades').count());
        const pSync = resultado<unknown>(meta.get('bovaro.sync.v1'));
        const [raw, count, sync] = await Promise.all([pOwner, pCount, pSync]);
        if (mine !== epoca) throw erroDeProprietario();
        const owner = identidadeDe(raw);
        if (raw !== undefined && raw !== null && (!owner || !igual(owner, proxima)))
          throw erroDeProprietario();
        if (!owner && (count > 0 || (sync !== undefined && sync !== null)))
          throw erroDeProprietario();
        if (owner && igual(owner, proxima)) return false;
        meta.put(proxima, 'identidade');
        return true;
      });
      if (mine !== epoca) throw erroDeProprietario();
      confirmada = proxima;
      espelhar(proxima);
      if (mudou) notificar();
    },
    clear() {
      // A limpeza autenticada apaga o banco inteiro antes desta chamada. Nunca remover apenas
      // o dono de um banco ainda preenchido, deixando seus dados disponíveis para outra conta.
      epoca++;
      confirmada = null;
      espelhar(null);
      notificar();
    },
  };
}
