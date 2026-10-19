// @vitest-environment happy-dom
import { calcularRecria, ENTRADA_PADRAO, formatarBRL, formatarNumero } from '@ogado/domain';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { criarRepoComPlanilha } from '../lib/repo/planilha.test-support';
import { RecriaScreen } from './RecriaScreen';
import { criarStorageMemoria, renderComApp } from './test-utils';

/** O simulador novo abre vazio (ADR-0014): estes testes partem das entradas da planilha. */
function renderComPlanilha() {
  return renderComApp(<RecriaScreen />, criarRepoComPlanilha(() => criarStorageMemoria()));
}

function hero() {
  const regiao = screen.getByRole('region', { name: 'Resultado da recria' });
  return regiao.querySelector('.hero') as HTMLElement;
}

describe('RF-030/RF-031 simulador de recria', () => {
  it('RF-031 com as entradas da planilha preenchidas mostra o líquido de ouro R$ 102.408,05', () => {
    renderComPlanilha();
    const ouro = formatarBRL(calcularRecria(ENTRADA_PADRAO).faturamentoLiquido);
    expect(ouro).toBe('R$ 102.408,05');
    expect(within(hero()).getByText('R$ 102.408,05')).toHaveClass('big');
    expect(screen.getByLabelText('Consumo (% do peso vivo)')).toHaveValue('0,3');
    expect(screen.getByLabelText('Rendimento de carcaça')).toHaveValue('52');
    expect(screen.getByLabelText('Imposto sobre a venda')).toHaveValue('1,5');
  });

  it('RF-031 mostra por mês, por hectare, total em caixa, custos, números do lote e alerta de cabeças', () => {
    renderComPlanilha();
    const r = calcularRecria(ENTRADA_PADRAO);
    expect(within(hero()).getByText(formatarBRL(r.liquidoMes, 0))).toBeInTheDocument();
    expect(within(hero()).getByText(formatarBRL(r.liquidoHa, 0))).toBeInTheDocument();
    expect(within(hero()).getByText(formatarBRL(r.totalEmCaixa, 0))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Custo operacional/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Da venda ao líquido' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dados do lote' })).toBeInTheDocument();
    // RN-026: 122.534,80 / 2.050 = 59,77 cabeças
    expect(screen.getByText(/O investimento compra 59,77 cabeças \(≈ 60\)/)).toBeInTheDocument();
    // RF-051: GMD é campo calculado (somente leitura, com cadeado)
    expect(screen.getByText(/GMD implícito/)).toBeInTheDocument();
  });

  it('RF-030 recalcula ao digitar', async () => {
    const user = userEvent.setup();
    renderComPlanilha();
    const preco = screen.getByLabelText('Preço de venda');
    await user.clear(preco);
    await user.type(preco, '330');
    const esperado = calcularRecria({ ...ENTRADA_PADRAO, precoVenda: '330' }).faturamentoLiquido;
    expect(within(hero()).getByText(formatarBRL(esperado))).toBeInTheDocument();
  });

  it('RN-022 campo vazio mostra "—" e a dica de preenchimento, sem quebrar', async () => {
    const user = userEvent.setup();
    renderComPlanilha();
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
    renderComPlanilha();
    const dias = screen.getByLabelText('Dias de recria');
    await user.clear(dias);
    await user.type(dias, '1.5');
    expect(screen.getByText(/Use vírgula para os decimais/)).toBeInTheDocument();
    expect(dias).toHaveAttribute('aria-invalid', 'true');
    expect(within(hero()).queryByText('R$ 102.408,05')).not.toBeInTheDocument();
  });

  it('RF-051 "Números do lote" são campos calculados com cadeado, não editáveis', () => {
    renderComPlanilha();
    const secao = screen.getByRole('region', { name: 'Dados do lote' });
    expect(within(secao).queryAllByRole('group').length).toBeGreaterThan(0);
    expect(within(secao).getAllByRole('group').length).toBeGreaterThanOrEqual(6);
  });

  it('RF-030 Limpar campos pede confirmação e deixa o resultado em "—"', async () => {
    const user = userEvent.setup();
    renderComPlanilha();
    await user.click(screen.getByRole('button', { name: 'Limpar campos' }));
    const alerta = screen.getByRole('alertdialog', { name: 'Limpar todos os campos?' });
    await user.click(within(alerta).getByRole('button', { name: 'Limpar' }));
    expect(screen.getByLabelText('Investimento')).toHaveValue('');
    expect(within(hero()).queryByText('R$ 102.408,05')).not.toBeInTheDocument();
    expect(within(hero()).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ADR-0014 simulador sem padrões', () => {
  it('RF-030 o simulador novo abre com todos os campos vazios e os resultados em "—"', () => {
    renderComApp(<RecriaScreen />);
    const campos = [
      'Área pastável',
      'Dias de recria',
      'Investimento',
      'R$ por cabeça (compra)',
      'Peso inicial',
      'Peso final',
      'Preço de venda',
      'Consumo (% do peso vivo)',
      'Proteinado',
      'Rendimento de carcaça',
      'Imposto sobre a venda',
      'Sanidade',
      'Funcionário',
      'Frete',
    ];
    for (const rotulo of campos) expect(screen.getByLabelText(rotulo)).toHaveValue('');
    expect(hero().querySelector('.big')).toHaveTextContent('—');
    expect(within(hero()).getByText(/faltam 14/)).toBeInTheDocument();
    const lote = screen.getByRole('region', { name: 'Dados do lote' });
    expect(within(lote).getAllByText('—')).toHaveLength(7);
    expect(screen.queryByText(/O investimento compra/)).not.toBeInTheDocument();
  });

  it('RF-030 não existe botão "Restaurar padrões" nem seletor de lotação inicial', () => {
    renderComApp(<RecriaScreen />);
    expect(screen.queryByRole('button', { name: /Restaurar padrões/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Lotação inicial \(UA\/ha\) calculada sobre/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar campos' })).toBeInTheDocument();
  });

  it('RN-009 a lotação inicial usa a área pastável informada (50 ha, não 80)', async () => {
    const user = userEvent.setup();
    renderComPlanilha();
    const area = screen.getByLabelText('Área pastável');
    await user.clear(area);
    await user.type(area, '50');
    const r = calcularRecria({ ...ENTRADA_PADRAO, area: '50' }, { lotacaoInicial: 'areaPastavel', faturamentoBruto: 'pesoVivo' });
    expect(r.lotacaoHaInicial).not.toBeNull();
    const lote = screen.getByRole('region', { name: 'Dados do lote' });
    expect(within(lote).getByText(`${formatarNumero(r.lotacaoHaInicial, 2)} UA/ha`)).toBeInTheDocument();
  });

  it('RF-032 salvar cenário com entradas vazias não abre o diálogo e orienta a preencher', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />);
    await user.click(screen.getByRole('button', { name: 'Salvar como cenário' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Preencha todos os campos com números válidos/)).toHaveLength(2); // dica + aviso
  });
});
