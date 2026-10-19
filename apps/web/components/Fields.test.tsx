// @vitest-environment happy-dom
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CampoNumero } from './Fields';
import { valorCampo } from '../lib/format';

function Campo({ inicial = '', casas = 2 }) {
  const [value, setValue] = useState(inicial);
  return (
    <>
      <CampoNumero mascara label="Valor" value={value} onChange={setValue} casas={casas} />
      <output data-testid="numero">{valorCampo(value)?.toFixed() ?? 'vazio'}</output>
    </>
  );
}

describe('entrada com virgula opcional', () => {
  it.each([
    ['2000', '2.000,00', '2000'],
    ['2000,5', '2.000,50', '2000.5'],
    ['2000,75', '2.000,75', '2000.75'],
    [',30', '0,30', '0.3'],
  ])('formata %s e preserva a escala', async (digitado, exibido, numero) => {
    const user = userEvent.setup();
    render(<Campo />);
    const input = screen.getByLabelText('Valor');
    await user.type(input, digitado);
    await user.tab();
    expect(input).toHaveValue(exibido);
    expect(screen.getByTestId('numero')).toHaveTextContent(numero);
  });
  it('aceita a virgula durante a digitacao sem interromper os calculos', async () => {
    const user = userEvent.setup();
    render(<Campo />);
    await user.type(screen.getByLabelText('Valor'), '2000,');
    expect(screen.getByLabelText('Valor')).toHaveValue('2.000,');
    expect(screen.getByTestId('numero')).toHaveTextContent('2000');
    await user.tab();
    expect(screen.getByLabelText('Valor')).toHaveValue('2.000,00');
  });
  it('bloqueia pontos, letras, segunda virgula e excesso de casas', async () => {
    const user = userEvent.setup();
    render(<Campo />);
    const input = screen.getByLabelText('Valor');
    await user.type(input, '2.abc000,7,59');
    expect(input).toHaveValue('2.000,75');
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue('');
    expect(screen.getByTestId('numero')).toHaveTextContent('vazio');
  });
  it('preserva valores existentes e permite acrescentar inteiros', async () => {
    const user = userEvent.setup();
    render(<Campo inicial="2000" />);
    const input = screen.getByLabelText('Valor');
    expect(input).toHaveValue('2.000,00');
    await user.click(input);
    await user.keyboard('{End}1');
    expect(input).toHaveValue('20.001');
    await user.tab();
    expect(input).toHaveValue('20.001,00');
  });
  it('mantem dias inteiros e bloqueia a virgula', async () => {
    const user = userEvent.setup();
    render(<Campo casas={0} />);
    await user.type(screen.getByLabelText('Valor'), '2.,000');
    await user.tab();
    expect(screen.getByLabelText('Valor')).toHaveValue('2.000');
    expect(screen.getByTestId('numero')).toHaveTextContent('2000');
  });
  it('aceita colar inteiros e decimais com virgula', async () => {
    const user = userEvent.setup();
    render(<Campo />);
    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.paste('2000,75');
    expect(input).toHaveValue('2.000,75');
    await user.paste('1.000');
    expect(input).toHaveValue('2.000,75');
  });
  it('preserva o cursor ao editar e apagar no meio do numero', async () => {
    const user = userEvent.setup();
    render(<Campo inicial="1234,56" />);
    const input = screen.getByLabelText('Valor') as HTMLInputElement;
    await user.click(input);
    input.setSelectionRange(3, 3);
    await user.keyboard('9');
    expect(input).toHaveValue('12.934,56');
    expect(input.selectionStart).toBe(4);
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('1.234,56');
  });
});
