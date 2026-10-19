import { describe, expect, it, vi } from 'vitest';
import { criarControladorAtualizacao, type RegistroLike } from './atualizacao';

function cenario(opts: { controlada?: boolean; edicaoAberta?: boolean } = {}) {
  const container = Object.assign(new EventTarget(), {
    controller: opts.controlada === false ? null : {},
  });
  const estado = { edicaoAberta: opts.edicaoAberta ?? false };
  const recarregar = vi.fn();
  const controlador = criarControladorAtualizacao({
    container,
    haEdicaoAberta: () => estado.edicaoAberta,
    recarregar,
  });
  const novoWorker = (state: string) => {
    const w = Object.assign(new EventTarget(), { state, postMessage: vi.fn() });
    return w;
  };
  const registro = (waiting: ReturnType<typeof novoWorker> | null = null) => {
    const r = Object.assign(new EventTarget(), {
      waiting,
      installing: null as ReturnType<typeof novoWorker> | null,
      update: async () => undefined,
    });
    return r;
  };
  return { container, estado, recarregar, controlador, novoWorker, registro };
}

const comoRegistro = (r: object): RegistroLike => r as RegistroLike;

describe('atualização do app (RF-077)', () => {
  it('worker novo em espera acende o aviso; sem atualização, não', () => {
    const t = cenario();
    expect(t.controlador.getSnapshot()).toBe(false);
    const w = t.novoWorker('installed');
    t.controlador.observar(comoRegistro(t.registro(w)));
    expect(t.controlador.getSnapshot()).toBe(true);
  });

  it('instalação que termina depois (updatefound -> installed) também avisa e notifica', () => {
    const t = cenario();
    const r = t.registro();
    const ouvinte = vi.fn();
    t.controlador.subscribe(ouvinte);
    t.controlador.observar(comoRegistro(r));

    const w = t.novoWorker('installing');
    r.installing = w;
    r.dispatchEvent(new Event('updatefound'));
    expect(t.controlador.getSnapshot()).toBe(false);
    w.state = 'installed';
    w.dispatchEvent(new Event('statechange'));

    expect(t.controlador.getSnapshot()).toBe(true);
    expect(ouvinte).toHaveBeenCalled();
  });

  it('primeira instalação (sem controlador) não é "nova versão"', () => {
    const t = cenario({ controlada: false });
    t.controlador.observar(comoRegistro(t.registro(t.novoWorker('installed'))));
    expect(t.controlador.getSnapshot()).toBe(false);
  });

  it('só aplica quando não há modal/edição aberta; com edição aberta bloqueia e nada é enviado', () => {
    const t = cenario({ edicaoAberta: true });
    const w = t.novoWorker('installed');
    t.controlador.observar(comoRegistro(t.registro(w)));

    expect(t.controlador.aplicar()).toBe('bloqueado');
    expect(w.postMessage).not.toHaveBeenCalled();

    t.estado.edicaoAberta = false;
    expect(t.controlador.aplicar()).toBe('aplicando');
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('recarrega uma única vez, só depois de aceito; troca vinda de outra aba não recarrega', () => {
    const t = cenario();
    t.container.dispatchEvent(new Event('controllerchange'));
    expect(t.recarregar).not.toHaveBeenCalled();

    t.controlador.observar(comoRegistro(t.registro(t.novoWorker('installed'))));
    t.controlador.aplicar();
    t.container.dispatchEvent(new Event('controllerchange'));
    t.container.dispatchEvent(new Event('controllerchange'));
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });

  it('sem versão em espera não há o que aplicar', () => {
    expect(cenario().controlador.aplicar()).toBe('indisponivel');
  });
});
