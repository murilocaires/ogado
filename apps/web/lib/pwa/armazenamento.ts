// Armazenamento do aparelho (RNF-015): pede persistência depois do login e avisa quando a cota
// do navegador passa de 80%. Tudo opcional: navegador sem a API simplesmente não avisa.
export const LIMITE_COTA = 0.8;

interface Estimativa {
  usage?: number;
  quota?: number;
}

/** Fração usada (0..1) se passou do limite; `null` se está tranquilo ou não dá para saber. */
export function cotaQuaseCheia(estimativa: Estimativa | null, limite = LIMITE_COTA): number | null {
  if (!estimativa) return null;
  const { usage, quota } = estimativa;
  if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) return null;
  const fracao = usage / quota;
  return fracao > limite ? fracao : null;
}

type ArmazenamentoNavegador = Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>;

function gerenciador(): ArmazenamentoNavegador | null {
  if (typeof navigator === 'undefined') return null;
  const s = (navigator as { storage?: ArmazenamentoNavegador }).storage;
  return s ?? null;
}

/** Pede ao navegador para não apagar os dados do app sob pressão de espaço. */
export async function pedirPersistencia(
  armazenamento: Pick<StorageManager, 'persist' | 'persisted'> | null = gerenciador(),
): Promise<boolean> {
  if (!armazenamento || typeof armazenamento.persist !== 'function') return false;
  try {
    if (typeof armazenamento.persisted === 'function' && (await armazenamento.persisted())) {
      return true;
    }
    return await armazenamento.persist();
  } catch {
    return false;
  }
}

/** Fração da cota usada se estiver acima de 80%; senão `null`. */
export async function verificarCota(
  armazenamento: Pick<StorageManager, 'estimate'> | null = gerenciador(),
): Promise<number | null> {
  if (!armazenamento || typeof armazenamento.estimate !== 'function') return null;
  try {
    return cotaQuaseCheia(await armazenamento.estimate());
  } catch {
    return null;
  }
}
