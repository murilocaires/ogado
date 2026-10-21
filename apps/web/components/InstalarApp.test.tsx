// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iniciarCapturaInstalacao, resetarCapturaInstalacao } from '../lib/pwa/instalacao';
import { InstalarApp } from './InstalarApp';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';

function disparaPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(e);
  });
  return { prompt, e };
}

function simulaNavegador(opts: { ua?: string; standalone?: boolean }) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(opts.ua ?? 'Mozilla/5.0 Chrome/130');
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('standalone') && !!opts.standalone,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  resetarCapturaInstalacao();
  simulaNavegador({});
});
afterEach(() => vi.restoreAllMocks());

describe('InstalarApp (RF-070, RNF-016: Chrome/Edge e iOS)', () => {
  it('não aparece sem suporte a instalação', () => {
    render(<InstalarApp />);
    expect(screen.queryByRole('button', { name: 'Instalar o app' })).toBeNull();
  });

  it('com o aviso do navegador, mostra o botão e abre o prompt nativo ao clicar', async () => {
    render(<InstalarApp />);
    const { prompt, e } = disparaPrompt();
    expect(e.defaultPrevented).toBe(true);
    await userEvent.click(await screen.findByRole('button', { name: 'Instalar o app' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    // o aviso só vale uma vez: o botão some
    expect(screen.queryByRole('button', { name: 'Instalar o app' })).toBeNull();
  });

  it('aparece mesmo se o aviso chegou antes de a tela montar', () => {
    iniciarCapturaInstalacao(); // o registrador do layout raiz já ouve desde o início
    disparaPrompt();
    render(<InstalarApp />);
    expect(screen.getByRole('button', { name: 'Instalar o app' })).toBeInTheDocument();
  });

  it('não aparece quando o app já roda instalado (standalone)', () => {
    simulaNavegador({ standalone: true });
    render(<InstalarApp />);
    disparaPrompt();
    expect(screen.queryByRole('button', { name: 'Instalar o app' })).toBeNull();
  });

  it('some depois do evento appinstalled', async () => {
    render(<InstalarApp />);
    disparaPrompt();
    expect(await screen.findByRole('button', { name: 'Instalar o app' })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: 'Instalar o app' })).toBeNull();
  });

  describe('iPhone/iPad (sem prompt nativo)', () => {
    beforeEach(() => simulaNavegador({ ua: IPHONE }));

    it('abre as instruções em diálogo navegável por teclado; Esc fecha e devolve o foco', async () => {
      const user = userEvent.setup();
      render(<InstalarApp />);
      const botao = screen.getByRole('button', { name: 'Instalar o app' });
      await user.tab();
      expect(botao).toHaveFocus();
      await user.keyboard('{Enter}');

      const dialogo = screen.getByRole('dialog', { name: /Instalar o Bovaro no iPhone/ });
      expect(dialogo).toHaveTextContent('Adicionar à Tela de Início');
      expect(dialogo).toHaveTextContent('Compartilhar');
      const entendi = screen.getByRole('button', { name: 'Entendi' });
      expect(entendi).toHaveFocus();
      await user.tab(); // foco preso no diálogo
      expect(entendi).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(botao).toHaveFocus();
    });

    it('não oferece instruções se já está na Tela de Início', () => {
      simulaNavegador({ ua: IPHONE, standalone: true });
      render(<InstalarApp />);
      expect(screen.queryByRole('button', { name: 'Instalar o app' })).toBeNull();
    });
  });
});
