// Atualização silenciosa do app (RF-077, ADR-0014). O service worker novo se ativa sozinho
// (`skipWaiting` + `clients.claim` em sw.js); quando ele assume a página (`controllerchange`) o app
// recarrega SOZINHO, mas só em momento seguro, sem aviso nem botão:
//   - seguro = nenhum diálogo aberto e nenhum campo de texto em foco com conteúdo digitado;
//   - se não for seguro, adia para a próxima navegação entre telas, ou para quando a aba ficar
//     oculta (e nenhum diálogo estiver aberto), ou simplesmente para a próxima abertura do app
//     (que já nasce na versão nova);
//   - nunca perde dados (ficam no aparelho) e nunca entra em laço: um marcador em sessionStorage
//     impede duas recargas em sequência curta.
// Primeira instalação (sem controlador antes) não é atualização e não recarrega.

/** Intervalo mínimo entre duas recargas automáticas na mesma aba (guarda contra laço). */
export const INTERVALO_MIN_RECARGA_MS = 30_000;
export const CHAVE_MARCADOR_RECARGA = 'ogado.sw.recarga';

interface ContainerLike {
  controller: unknown;
  addEventListener(tipo: 'controllerchange', fn: () => void): void;
}

interface DocumentoLike {
  readonly visibilityState: string;
  addEventListener(tipo: 'visibilitychange', fn: () => void): void;
}

type ArmazenamentoLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface AtualizadorSilencioso {
  /** Chamar a cada navegação entre telas: é um bom momento para aplicar a versão nova. */
  aoNavegar(): void;
  /** Há versão nova ativa esperando o momento seguro para recarregar? */
  pendente(): boolean;
}

export interface DepsAtualizador {
  container: ContainerLike;
  documento: DocumentoLike;
  /** Há modal/diálogo aberto? */
  haDialogoAberto: () => boolean;
  /** Há campo de texto em foco com conteúdo digitado? */
  haCampoDigitado: () => boolean;
  recarregar: () => void;
  /** sessionStorage (ou `null` se bloqueado: então a guarda de laço fica só em memória). */
  armazenamento: ArmazenamentoLike | null;
  agora?: () => number;
}

export function criarAtualizadorSilencioso(deps: DepsAtualizador): AtualizadorSilencioso {
  const agora = deps.agora ?? Date.now;
  let controladoAntes = deps.container.controller !== null;
  let pendente = false;
  let ultimaRecargaMemoria = Number.NEGATIVE_INFINITY;

  const recargaRecente = (): boolean => {
    let marcador = ultimaRecargaMemoria;
    try {
      const salvo = Number(deps.armazenamento?.getItem(CHAVE_MARCADOR_RECARGA));
      if (Number.isFinite(salvo) && salvo > marcador) marcador = salvo;
    } catch {
      /* sessionStorage bloqueado: vale a memória */
    }
    return agora() - marcador < INTERVALO_MIN_RECARGA_MS;
  };

  const recarregarSe = (permitido: boolean): void => {
    if (!pendente || !permitido) return;
    pendente = false;
    if (recargaRecente()) return; // laço: já recarregou há pouco; fica para a próxima abertura
    const agoraMs = agora();
    ultimaRecargaMemoria = agoraMs;
    try {
      deps.armazenamento?.setItem(CHAVE_MARCADOR_RECARGA, String(agoraMs));
    } catch {
      /* sem marcador persistido: a memória já protege esta página */
    }
    deps.recarregar();
  };

  const momentoSeguro = (): boolean => !deps.haDialogoAberto() && !deps.haCampoDigitado();

  deps.container.addEventListener('controllerchange', () => {
    const eraAtualizacao = controladoAntes;
    controladoAntes = true;
    if (!eraAtualizacao) return; // primeira instalação: o worker só passou a controlar a página
    pendente = true;
    // Aba já oculta: ninguém está digitando; basta não haver diálogo aberto.
    recarregarSe(deps.documento.visibilityState === 'hidden' ? !deps.haDialogoAberto() : momentoSeguro());
  });

  deps.documento.addEventListener('visibilitychange', () => {
    if (deps.documento.visibilityState !== 'hidden') return;
    recarregarSe(!deps.haDialogoAberto());
  });

  return {
    aoNavegar: () => recarregarSe(momentoSeguro()),
    pendente: () => pendente,
  };
}

/** Há `input`/`textarea`/campo editável em foco com algo digitado? (checkbox, botões etc. não contam) */
export function haCampoDigitadoEmFoco(doc: Document = document): boolean {
  const el = doc.activeElement;
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return el.value !== '';
  if (el instanceof HTMLInputElement) {
    const semTexto = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];
    return !semTexto.includes(el.type) && el.value !== '';
  }
  return el instanceof HTMLElement && el.isContentEditable && (el.textContent ?? '') !== '';
}

let singleton: AtualizadorSilencioso | null = null;

/** Atualizador do navegador (um só por página). `null` fora do navegador/sem service worker. */
export function obterAtualizadorSilencioso(
  haDialogoAberto: () => boolean,
): AtualizadorSilencioso | null {
  if (singleton) return singleton;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  let armazenamento: Storage | null;
  try {
    armazenamento = window.sessionStorage;
  } catch {
    armazenamento = null;
  }
  singleton = criarAtualizadorSilencioso({
    container: navigator.serviceWorker,
    documento: document,
    haDialogoAberto,
    haCampoDigitado: () => haCampoDigitadoEmFoco(document),
    recarregar: () => window.location.reload(),
    armazenamento,
  });
  return singleton;
}
