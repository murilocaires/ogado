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

describe('m?scara num?rica', () => {
  it('digita centavos, agrupa milhares e preserva o valor para c?lculo', async () => {
    const user = userEvent.setup();
    render(<Campo />);
    const input = screen.getByLabelText('Valor');
    await user.type(input, '200000');
    expect(input).toHaveValue('2.000,00');
    expect(screen.getByTestId('numero')).toHaveTextContent('2000');
    await user.clear(input);
    await user.type(input, '30');
    expect(input).toHaveValue('0,30');
    expect(screen.getByTestId('numero')).toHaveTextContent('0.3');
  });
  it('bloqueia pontua??o e letras e permite limpar', async () => {
    const user = userEvent.setup();
    render(<Campo />);
    const input = screen.getByLabelText('Valor');
    await user.type(input, '2.,abc05000');
    expect(input).toHaveValue('2.050,00');
    await user.clear(input);
    expect(input).toHaveValue('');
    expect(screen.getByTestId('numero')).toHaveTextContent('vazio');
  });
  it('formata os valores antigos sem mudar sua escala', () => {
    render(<Campo inicial="122534,8" />);
    expect(screen.getByLabelText('Valor')).toHaveValue('122.534,80');
    expect(screen.getByTestId('numero')).toHaveTextContent('122534.8');
  });
  it('mant?m dias e quantidades inteiros v?lidos ao ultrapassar mil', async () => {
    const user = userEvent.setup();
    render(<Campo casas={0} />);
    await user.type(screen.getByLabelText('Valor'), '2000');
    expect(screen.getByLabelText('Valor')).toHaveValue('2.000');
    expect(screen.getByTestId('numero')).toHaveTextContent('2000');
  });
  it('aceita colar somente d?gitos', async () => {
    const user = userEvent.setup();
    render(<Campo />);
    await user.click(screen.getByLabelText('Valor'));
    await user.paste('200000');
    expect(screen.getByLabelText('Valor')).toHaveValue('2.000,00');
    await user.paste('2,050');
    expect(screen.getByLabelText('Valor')).toHaveValue('2.000,00');
  });
  it('preserva o cursor ao inserir e apagar no meio do n?mero', async () => {
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
    input.setSelectionRange(2, 2);
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('234,56');
  });
  it('preserva a digita??o dos campos sem m?scara', async () => {
    const user = userEvent.setup();
    function SemMascara() {
      const [value, setValue] = useState('');
      return <CampoNumero label="Livre" value={value} onChange={setValue} />;
    }
    render(<SemMascara />);
    await user.type(screen.getByLabelText('Livre'), '3000,5');
    expect(screen.getByLabelText('Livre')).toHaveValue('3000,5');
  });
});
