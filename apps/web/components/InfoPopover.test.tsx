// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { INFO } from '../lib/info';
import { InfoPopover } from './InfoPopover';

describe('RF-052 ajuda contextual', () => {
  it('RF-052 abre com Enter no botão "i" e fecha com Esc devolvendo o foco', async () => {
    const user = userEvent.setup();
    render(<InfoPopover k="saldo" />);
    const botao = screen.getByRole('button', { name: 'O que é: Saldo' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');

    botao.focus();
    await user.keyboard('{Enter}');
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const balao = screen.getByRole('dialog', { name: 'Saldo' });
    expect(balao).toHaveTextContent(INFO.saldo.texto);
    expect(balao).toHaveTextContent('Como é calculado');
    expect(balao).toHaveTextContent('Total vendido − total comprado');
    expect(balao).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao).toHaveFocus();
  });

  it('RF-052 fecha ao clicar fora e ao rolar a página', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <InfoPopover k="comprado" />
        <p>fora</p>
      </div>,
    );
    const botao = screen.getByRole('button', { name: 'O que é: Comprado' });
    await user.click(botao);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByText('fora'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(botao);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    await Promise.resolve();
    expect(await screen.findByRole('button', { name: 'O que é: Comprado' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('RF-052 clicar de novo no "i" fecha o balão', async () => {
    const user = userEvent.setup();
    render(<InfoPopover k="porCab" />);
    const botao = screen.getByRole('button', { name: 'O que é: Valor por cabeça' });
    await user.click(botao);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(botao);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('RN-025 o texto de venda explica a base e o desconto em %', () => {
    expect(INFO.vendido.formula).toBe(
      'Cada lote = (kg × (1 − desconto%) ÷ kg por @) × preço da arroba',
    );
    expect(INFO.arrV.formula).toContain('desconto%');
  });
});
