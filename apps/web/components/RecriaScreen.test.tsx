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
    expect(screen.getByLabelText('Proteinado')).toHaveValue('0,30');
    expect(screen.getByLabelText('Se')).toHaveValue('52,00');
    expect(screen.getAllByLabelText('Imposto').find((e) => e.tagName === 'INPUT')).toHaveValue('1,50');
  });

  it('RF-031 mostra por mês, por hectare, total em caixa, custos, números do lote e alerta de cabeças', () => {
    renderComPlanilha();
    const r = calcularRecria(ENTRADA_PADRAO);
    expect(within(hero()).getByText(formatarBRL(r.liquidoMes))).toBeInTheDocument();
    expect(within(hero()).getByText(formatarBRL(r.liquidoHa))).toBeInTheDocument();
    expect(within(hero()).getByText(formatarBRL(r.totalEmCaixa))).toBeInTheDocument();
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
    const preco = screen.getByLabelText('R$/cab (venda)');
    await user.clear(preco);
    await user.type(preco, '33000');
    const esperado = calcularRecria({ ...ENTRADA_PADRAO, precoVenda: '330' }).faturamentoLiquido;
    expect(within(hero()).getByText(formatarBRL(esperado))).toBeInTheDocument();
  });

  it('RN-022 campo vazio mostra "—" e a dica de preenchimento, sem quebrar', async () => {
    const user = userEvent.setup();
    renderComPlanilha();
    await user.clear(screen.getByLabelText('Investimento (compra)'));
    expect(within(hero()).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(within(hero()).queryByText('R$ 102.408,05')).not.toBeInTheDocument();
    expect(screen.getAllByText('Preencha este campo para calcular.')).toHaveLength(1);
    expect(screen.getByLabelText('Investimento (compra)')).toHaveAccessibleDescription(
      'Preencha este campo para calcular.',
    );
  });

  it('bloqueia separadores manuais e conserva dias inteiros', async () => {
    const user = userEvent.setup();
    renderComPlanilha();
    const dias = screen.getByLabelText('Dias de Recria');
    await user.clear(dias);
    await user.type(dias, '2.,70');
    expect(dias).toHaveValue('270');
    expect(dias).not.toHaveAttribute('aria-invalid', 'true');
    expect(within(hero()).getByText('R$ 102.408,05')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Investimento (compra)')).toHaveValue('');
    expect(within(hero()).queryByText('R$ 102.408,05')).not.toBeInTheDocument();
    expect(within(hero()).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ADR-0014 simulador sem padrões', () => {
  it('RF-030 o simulador novo abre com todos os campos vazios e os resultados em "—"', () => {
    renderComApp(<RecriaScreen />);
    const campos = [
      'Área Pastável',
      'Dias de Recria',
      'Investimento (compra)',
      'R$/cab (compra)',
      'Peso inicial',
      'Peso Final',
      'R$/cab (venda)',
      'Proteinado',
      'R$/Kg',
      'Se',
      'Imposto',
      'Sanidade',
      'Funcionário',
      'Transporte (frete)',
    ];
    for (const rotulo of campos) {
      const entrada = screen.getAllByLabelText(rotulo).find((e) => e.tagName === 'INPUT');
      expect(entrada).toHaveValue('');
    }
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
    const area = screen.getByLabelText('Área Pastável');
    await user.clear(area);
    await user.type(area, '5000');
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
