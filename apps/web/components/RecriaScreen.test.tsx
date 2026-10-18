// @vitest-environment happy-dom
import { calcularRecria, ENTRADA_PADRAO, formatarBRL } from '@ogado/domain';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RecriaScreen } from './RecriaScreen';
import { renderComApp } from './test-utils';

function hero() {
  const regiao = screen.getByRole('region', { name: 'Resultado da recria' });
  return regiao.querySelector('.hero') as HTMLElement;
}

describe('RF-030/RF-031 simulador de recria', () => {
  it('RF-031 abre com os padrões da planilha e mostra o líquido de ouro R$ 102.408,05', () => {
    renderComApp(<RecriaScreen />);
    const ouro = formatarBRL(calcularRecria(ENTRADA_PADRAO).faturamentoLiquido);
    expect(ouro).toBe('R$ 102.408,05');
    expect(within(hero()).getByText('R$ 102.408,05')).toHaveClass('big');
    expect(screen.getByLabelText('Consumo (% do peso vivo)')).toHaveValue('0,3');
    expect(screen.getByLabelText('Rendimento de carcaça')).toHaveValue('52');
    expect(screen.getByLabelText('Imposto sobre a venda')).toHaveValue('1,5');
  });

  it('RF-031 mostra por mês, por hectare, total em caixa, custos, números do lote e alerta de cabeças', () => {
    renderComApp(<RecriaScreen />);
    const r = calcularRecria(ENTRADA_PADRAO);
    expect(within(hero()).getByText(formatarBRL(r.liquidoMes, 0))).toBeInTheDocument();
    expect(within(hero()).getByText(formatarBRL(r.liquidoHa, 0))).toBeInTheDocument();
    expect(within(hero()).getByText(formatarBRL(r.totalEmCaixa, 0))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Custo operacional/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Da venda ao líquido' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Números do lote' })).toBeInTheDocument();
    // RN-026: 122.534,80 / 2.050 = 59,77 cabeças
    expect(screen.getByText(/O investimento compra 59,77 cabeças \(≈ 60\)/)).toBeInTheDocument();
    // RF-051: GMD é campo calculado (somente leitura, com cadeado)
    expect(screen.getByText(/GMD implícito/)).toBeInTheDocument();
  });

  it('RF-030 recalcula ao digitar', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />);
    const preco = screen.getByLabelText('Preço de venda');
    await user.clear(preco);
    await user.type(preco, '330');
    const esperado = calcularRecria({ ...ENTRADA_PADRAO, precoVenda: '330' }).faturamentoLiquido;
    expect(within(hero()).getByText(formatarBRL(esperado))).toBeInTheDocument();
  });

  it('RN-022 campo vazio mostra "—" e a dica de preenchimento, sem quebrar', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />);
    await user.clear(screen.getByLabelText('Investimento'));
    expect(within(hero()).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(within(hero()).queryByText('R$ 102.408,05')).not.toBeInTheDocument();
    expect(screen.getAllByText('Preencha este campo para calcular.')).toHaveLength(1);
    expect(screen.getByLabelText('Investimento')).toHaveAccessibleDescription(
      'Preencha este campo para calcular.',
    );
  });

  it('RNF-007 "1.5" em dias é inválido, com dica de vírgula, e o resultado vira "—"', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />);
    const dias = screen.getByLabelText('Dias de recria');
    await user.clear(dias);
    await user.type(dias, '1.5');
    expect(screen.getByText(/Use vírgula para os decimais/)).toBeInTheDocument();
    expect(dias).toHaveAttribute('aria-invalid', 'true');
    expect(within(hero()).queryByText('R$ 102.408,05')).not.toBeInTheDocument();
  });

  it('RN-023 a lotação inicial muda de base sem alterar o resultado financeiro', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />);
    const antes = within(hero()).getByText('R$ 102.408,05');
    expect(antes).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Lotação inicial (UA/ha) calculada sobre'),
      'areaPastavel',
    );
    expect(within(hero()).getByText('R$ 102.408,05')).toBeInTheDocument();
  });

  it('RF-051 "Números do lote" são campos calculados com cadeado, não editáveis', () => {
    renderComApp(<RecriaScreen />);
    const secao = screen.getByRole('region', { name: 'Números do lote' });
    expect(within(secao).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(secao).getAllByRole('group').length).toBeGreaterThanOrEqual(10);
  });

  it('RF-030 Restaurar padrões pede confirmação e volta ao valor de ouro', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />);
    await user.clear(screen.getByLabelText('Investimento'));
    await user.click(screen.getByRole('button', { name: 'Restaurar padrões' }));
    const alerta = screen.getByRole('alertdialog', { name: 'Restaurar os padrões?' });
    await user.click(within(alerta).getByRole('button', { name: 'Restaurar' }));
    expect(screen.getByLabelText('Investimento')).toHaveValue('122534,8');
    expect(within(hero()).getByText('R$ 102.408,05')).toBeInTheDocument();
  });
});
