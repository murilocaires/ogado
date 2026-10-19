// Nova versão do app (RF-077, ADR-0007 §9). O service worker novo instala em segundo plano e fica
// em espera; o app só mostra "Nova versão disponível — Atualizar". A troca (SKIP_WAITING + recarga)
// só acontece quando o usuário pede E não há modal/edição aberta. Os dados ficam no localStorage e
// a fila de sincronização sobrevive à recarga.
export type ResultadoAplicar = 'aplicando' | 'bloqueado' | 'indisponivel';

interface TrabalhadorLike {
  state: string;
  postMessage(msg: unknown): void;
  addEventListener(tipo: 'statechange', fn: () => void): void;
}

export interface RegistroLike {
  waiting: TrabalhadorLike | null;
  installing: TrabalhadorLike | null;
  addEventListener(tipo: 'updatefound', fn: () => void): void;
  update(): Promise<unknown>;
}

interface ContainerLike {
  controller: unknown;
  addEventListener(tipo: 'controllerchange', fn: () => void): void;
}

export interface ControladorAtualizacao {
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
  observar(registro: RegistroLike): void;
  aplicar(): ResultadoAplicar;
}

export function criarControladorAtualizacao(deps: {
  container: ContainerLike;
  /** Há modal/edição aberta? Enquanto sim, não troca de versão. */
  haEdicaoAberta: () => boolean;
  recarregar: () => void;
}): ControladorAtualizacao {
  const ouvintes = new Set<() => void>();
  let espera: TrabalhadorLike | null = null;
  let aplicando = false;
  let recarregado = false;

  const definir = (w: TrabalhadorLike | null): void => {
    if (espera === w) return;
    espera = w;
    ouvintes.forEach((o) => o());
  };

  deps.container.addEventListener('controllerchange', () => {
    // Só recarrega por pedido do usuário; outra aba atualizando não deve derrubar esta edição.
    if (!aplicando || recarregado) return;
    recarregado = true;
    deps.recarregar();
  });

  return {
    subscribe(listener) {
      ouvintes.add(listener);
      return () => {
        ouvintes.delete(listener);
      };
    },
    getSnapshot: () => espera !== null,
    observar(registro) {
      // Só é "atualização" se já havia uma versão controlando a página (senão é a 1ª instalação).
      const aguardar = (w: TrabalhadorLike | null): void => {
        if (w && w.state === 'installed' && deps.container.controller) definir(w);
      };
      aguardar(registro.waiting);
      registro.addEventListener('updatefound', () => {
        const novo = registro.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => aguardar(novo));
      });
    },
    aplicar() {
      if (!espera) return 'indisponivel';
      if (deps.haEdicaoAberta()) return 'bloqueado';
      aplicando = true;
      espera.postMessage({ type: 'SKIP_WAITING' });
      return 'aplicando';
    },
  };
}

let singleton: ControladorAtualizacao | null = null;

/** Controlador do navegador (um só por página). `null` fora do navegador/sem service worker. */
export function obterControladorAtualizacao(
  haEdicaoAberta: () => boolean,
): ControladorAtualizacao | null {
  if (singleton) return singleton;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  singleton = criarControladorAtualizacao({
    container: navigator.serviceWorker,
    haEdicaoAberta,
    recarregar: () => window.location.reload(),
  });
  return singleton;
}
