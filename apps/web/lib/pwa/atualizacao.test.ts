// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  CHAVE_MARCADOR_RECARGA,
  criarAtualizadorSilencioso,
  haCampoDigitadoEmFoco,
  INTERVALO_MIN_RECARGA_MS,
} from './atualizacao';

function cenario(
  opts: { controlada?: boolean; dialogo?: boolean; campo?: boolean; oculta?: boolean } = {},
) {
  const container = Object.assign(new EventTarget(), {
    controller: opts.controlada === false ? null : {},
  });
  const documento = Object.assign(new EventTarget(), {
    visibilityState: opts.oculta ? 'hidden' : 'visible',
  });
  const estado = { dialogo: opts.dialogo ?? false, campo: opts.campo ?? false, agora: 1_000_000 };
  const memoria = new Map<string, string>();
  const armazenamento = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, v),
  };
  const recarregar = vi.fn();
  const atualizador = criarAtualizadorSilencioso({
    container,
    documento,
    haDialogoAberto: () => estado.dialogo,
    haCampoDigitado: () => estado.campo,
    recarregar,
    armazenamento,
    agora: () => estado.agora,
  });
  const trocarWorker = () => container.dispatchEvent(new Event('controllerchange'));
  const ocultarAba = () => {
    documento.visibilityState = 'hidden';
    documento.dispatchEvent(new Event('visibilitychange'));
  };
  return { container, estado, memoria, recarregar, atualizador, trocarWorker, ocultarAba };
}

describe('RF-077 atualização silenciosa do app', () => {
  it('worker novo assume em momento seguro: recarrega na hora, sem pendência', () => {
    const t = cenario();
    t.trocarWorker();
    expect(t.recarregar).toHaveBeenCalledTimes(1);
    expect(t.atualizador.pendente()).toBe(false);
    expect(t.memoria.get(CHAVE_MARCADOR_RECARGA)).toBe(String(t.estado.agora));
  });

  it('primeira instalação (sem controlador antes) não recarrega; a atualização seguinte sim', () => {
    const t = cenario({ controlada: false });
    t.trocarWorker(); // clients.claim da primeira visita
    expect(t.recarregar).not.toHaveBeenCalled();
    expect(t.atualizador.pendente()).toBe(false);

    t.trocarWorker(); // uma versão nova depois, na mesma página
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });

  it('com diálogo aberto adia; recarrega na próxima navegação entre telas', () => {
    const t = cenario({ dialogo: true });
    t.trocarWorker();
    expect(t.recarregar).not.toHaveBeenCalled();
    expect(t.atualizador.pendente()).toBe(true);

    t.atualizador.aoNavegar(); // ainda com diálogo: continua adiado
    expect(t.recarregar).not.toHaveBeenCalled();

    t.estado.dialogo = false;
    t.atualizador.aoNavegar();
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });

  it('com campo digitado em foco adia; ao navegar (foco saiu do campo) recarrega', () => {
    const t = cenario({ campo: true });
    t.trocarWorker();
    expect(t.recarregar).not.toHaveBeenCalled();
    t.estado.campo = false;
    t.atualizador.aoNavegar();
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });

  it('adiado por campo digitado: recarrega quando a aba fica oculta', () => {
    const t = cenario({ campo: true });
    t.trocarWorker();
    t.ocultarAba();
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });

  it('aba oculta com diálogo aberto não recarrega (rascunho do diálogo) e segue pendente', () => {
    const t = cenario({ dialogo: true });
    t.trocarWorker();
    t.ocultarAba();
    expect(t.recarregar).not.toHaveBeenCalled();
    expect(t.atualizador.pendente()).toBe(true);
  });

  it('aba já oculta quando o worker assume: recarrega mesmo com campo digitado', () => {
    const t = cenario({ campo: true, oculta: true });
    t.trocarWorker();
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });

  it('sem versão nova pendente, navegar ou ocultar a aba não faz nada', () => {
    const t = cenario();
    t.atualizador.aoNavegar();
    t.ocultarAba();
    expect(t.recarregar).not.toHaveBeenCalled();
  });

  it('nunca entra em laço: segunda troca logo após uma recarga não recarrega de novo', () => {
    const t = cenario();
    t.trocarWorker();
    expect(t.recarregar).toHaveBeenCalledTimes(1);

    t.estado.agora += 1_000; // a página "recarregada" volta a trocar de worker em seguida
    t.trocarWorker();
    t.atualizador.aoNavegar();
    t.ocultarAba();
    expect(t.recarregar).toHaveBeenCalledTimes(1);

    t.estado.agora += INTERVALO_MIN_RECARGA_MS; // uma atualização legítima bem depois
    t.trocarWorker();
    expect(t.recarregar).toHaveBeenCalledTimes(2);
  });

  it('o marcador de sessionStorage vale entre recargas reais (memória nova, mesmo marcador)', () => {
    const t = cenario();
    t.memoria.set(CHAVE_MARCADOR_RECARGA, String(t.estado.agora - 500));
    t.trocarWorker();
    expect(t.recarregar).not.toHaveBeenCalled();
  });

  it('só recarrega uma vez por pendência', () => {
    const t = cenario({ dialogo: true });
    t.trocarWorker();
    t.estado.dialogo = false;
    t.atualizador.aoNavegar();
    t.atualizador.aoNavegar();
    t.ocultarAba();
    expect(t.recarregar).toHaveBeenCalledTimes(1);
  });
});

describe('RF-077 campo digitado em foco', () => {
  it('input de texto com conteúdo em foco conta; vazio, checkbox e botão não', () => {
    document.body.innerHTML = `<input id="t" type="text"><input id="c" type="checkbox"><button id="b">x</button><textarea id="a"></textarea>`;
    const t = document.getElementById('t') as HTMLInputElement;
    t.focus();
    expect(haCampoDigitadoEmFoco()).toBe(false);
    t.value = '12';
    expect(haCampoDigitadoEmFoco()).toBe(true);

    (document.getElementById('c') as HTMLInputElement).focus();
    (document.getElementById('c') as HTMLInputElement).checked = true;
    expect(haCampoDigitadoEmFoco()).toBe(false);

    (document.getElementById('b') as HTMLButtonElement).focus();
    expect(haCampoDigitadoEmFoco()).toBe(false);

    const a = document.getElementById('a') as HTMLTextAreaElement;
    a.focus();
    a.value = 'texto';
    expect(haCampoDigitadoEmFoco()).toBe(true);
  });
});
