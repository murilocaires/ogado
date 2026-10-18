// @vitest-environment happy-dom
import { calcularCompraVenda, calcularVenda, formatarBRL } from '@ogado/domain';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { brlComSinal } from '../lib/format';
import { NegociosScreen } from './NegociosScreen';
import { renderComApp } from './test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/negocios',
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type User = ReturnType<typeof userEvent.setup>;

async function preencherELancar(
  user: User,
  v: { qtd: string; peso: string; preco: string; categoria?: string },
) {
  const modal = screen.getByRole('dialog');
  if (v.categoria !== undefined) {
    const cat = within(modal).getByLabelText('Categoria');
    await user.clear(cat);
    await user.type(cat, v.categoria);
  }
  await user.type(within(modal).getByLabelText('Quantidade'), v.qtd);
  await user.type(within(modal).getByLabelText('Peso total do lote'), v.peso);
  await user.type(within(modal).getByLabelText('Preço da arroba'), v.preco);
  await user.click(within(modal).getByRole('button', { name: 'Salvar lote' }));
}

async function confirmarSalvar(user: User) {
  const confirmacao = await screen.findByRole('alertdialog');
  await user.click(within(confirmacao).getByRole('button', { name: 'Salvar' }));
}

describe('RF-024 estado vazio', () => {
  it('RF-024 sem lotes mostra o estado vazio e saldo zerado', () => {
    renderComApp(<NegociosScreen />);
    expect(screen.getByRole('heading', { name: 'Nenhum lote' })).toBeInTheDocument();
    expect(screen.getByTestId('saldo')).toHaveTextContent('R$ 0,00');
  });
});

describe('RF-020/RF-021/RF-023/RN-006 compra e venda geram o saldo do domínio', () => {
  it('RF-023 cadastra uma compra e uma venda e o saldo bate com @ogado/domain', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);

    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Novo lote de compra' })).toBeInTheDocument();
    await preencherELancar(user, { qtd: '10', peso: '3000', preco: '300' });
    await confirmarSalvar(user);

    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Venda' }));
    expect(screen.getByRole('dialog', { name: 'Novo lote de venda' })).toBeInTheDocument();
    await preencherELancar(user, { qtd: '10', peso: '4500', preco: '320' });
    await confirmarSalvar(user);

    const esperado = calcularCompraVenda({
      compras: [{ modo: 'total', qtd: '10', peso: '3000', preco: '300' }],
      vendas: [
        { modo: 'total', qtd: '10', peso: '4500', preco: '320', base: 'vivo', aplicarDesconto: false },
      ],
    });
    // 100 @ x 300 = 30.000 comprados; 150 @ x 320 = 48.000 vendidos; saldo +18.000
    expect(brlComSinal(esperado.saldo)).toBe('+R$ 18.000,00');
    expect(screen.getByTestId('saldo')).toHaveTextContent('+R$ 18.000,00');
    expect(screen.getByText(formatarBRL(esperado.totalCompras, 0))).toBeInTheDocument();
    expect(screen.getByText(formatarBRL(esperado.totalVendas, 0))).toBeInTheDocument();
    expect(screen.getByText('2 lançamentos · 1 compra · 1 venda')).toBeInTheDocument();
  });

  it('RN-025 categoria feminina liga o desconto de 10% e o total segue o domínio', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);
    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Venda' }));
    const modal = screen.getByRole('dialog');
    const desconto = within(modal).getByRole('checkbox', { name: /Aplicar desconto/ });
    expect(desconto).not.toBeChecked(); // BOIS

    const cat = within(modal).getByLabelText('Categoria');
    await user.clear(cat);
    await user.type(cat, 'NOVILHAS');
    expect(desconto).toBeChecked();

    await user.type(within(modal).getByLabelText('Quantidade'), '10');
    await user.type(within(modal).getByLabelText('Peso total do lote'), '3000');
    await user.type(within(modal).getByLabelText('Preço da arroba'), '300');

    const esperado = calcularVenda({
      modo: 'total',
      qtd: '10',
      peso: '3000',
      preco: '300',
      base: 'vivo',
      aplicarDesconto: true,
      desconto: '0.1',
    });
    expect(formatarBRL(esperado.total)).toBe('R$ 27.000,00');
    const previa = within(modal).getByRole('group', { name: 'Pré-visualização do lote' });
    expect(within(previa).getByText('R$ 27.000,00')).toBeInTheDocument();
    expect(within(previa).getByText('2.700 kg líq.')).toBeInTheDocument();
  });

  it('RN-025 depois que o usuário mexe no desconto, trocar a categoria não o religa', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);
    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Venda' }));
    const modal = screen.getByRole('dialog');
    const desconto = within(modal).getByRole('checkbox', { name: /Aplicar desconto/ });
    await user.click(desconto); // liga
    await user.click(desconto); // desliga: agora a escolha é dele
    const cat = within(modal).getByLabelText('Categoria');
    await user.clear(cat);
    await user.type(cat, 'VACAS');
    expect(desconto).not.toBeChecked();
  });
});

describe('RN-027 modos de peso retêm o que foi digitado', () => {
  it('RN-027 alternar total, média e peso a peso não perde valores e marca o modo guardado', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);
    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    const modal = screen.getByRole('dialog');

    await user.type(within(modal).getByLabelText('Peso total do lote'), '3000');
    await user.click(within(modal).getByRole('tab', { name: /Média × qtd\./ }));
    // O modo "total" tem valor guardado e aparece marcado.
    expect(within(modal).getByRole('tab', { name: /Total do lote.*valor guardado/ })).toBeInTheDocument();
    const medio = within(modal).getByLabelText('Peso médio por cabeça');
    expect(medio).toHaveValue('');
    await user.type(medio, '300');

    await user.click(within(modal).getByRole('tab', { name: /Peso a peso/ }));
    await user.type(
      within(modal).getByLabelText('Pesos, um por animal (kg)'),
      '450{Enter}480; 500, 510,5',
    );
    const chips = within(modal).getByRole('list', { name: 'Pesos informados' });
    expect(within(chips).getAllByRole('listitem')).toHaveLength(4);
    expect(within(chips).getByText('510,5 kg')).toBeInTheDocument();

    await user.click(within(modal).getByRole('tab', { name: /Total do lote/ }));
    expect(within(modal).getByLabelText('Peso total do lote')).toHaveValue('3000');
    await user.click(within(modal).getByRole('tab', { name: /Média × qtd\./ }));
    expect(within(modal).getByLabelText('Peso médio por cabeça')).toHaveValue('300');
  });
});

describe('RNF-007 / RN-022 entrada pt-BR estrita', () => {
  it('RNF-007 "1.500" é recusado com dica para usar vírgula e o total fica "—"', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);
    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    const modal = screen.getByRole('dialog');
    await user.type(within(modal).getByLabelText('Quantidade'), '10');
    await user.type(within(modal).getByLabelText('Peso total do lote'), '1.500');
    await user.type(within(modal).getByLabelText('Preço da arroba'), '300');

    expect(within(modal).getByText(/Use vírgula para os decimais/)).toBeInTheDocument();
    const previa = within(modal).getByRole('group', { name: 'Pré-visualização do lote' });
    expect(within(previa).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(modal).queryByText(/R\$ 3\./)).not.toBeInTheDocument();
  });

  it('RF-025 sem o preço da arroba avisa e não pede confirmação', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);
    await user.click(screen.getAllByRole('button', { name: 'Novo lote' })[0]!);
    const modal = screen.getByRole('dialog');
    await user.type(within(modal).getByLabelText('Quantidade'), '10');
    await user.type(within(modal).getByLabelText('Peso total do lote'), '3000');
    await user.click(within(modal).getByRole('button', { name: 'Salvar lote' }));

    expect(within(modal).getByRole('alert')).toHaveTextContent('Informe o preço da arroba.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('RF-020 exclusão com confirmação', () => {
  async function comUmaCompra() {
    const user = userEvent.setup();
    const ctx = renderComApp(<NegociosScreen />);
    ctx.repo.salvarLote({
      tipo: 'compra',
      numero: 1,
      categoria: 'BEZERROS',
      data: '2026-10-01',
      modo: 'total',
      qtd: '10',
      peso: '3000',
      pesos: [],
      preco: '300',
    });
    return { user, ...ctx };
  }

  it('RF-020 cancelar mantém o lote; confirmar remove e recalcula o saldo', async () => {
    const { user } = await comUmaCompra();
    expect(await screen.findByTestId('saldo')).toHaveTextContent('−R$ 30.000,00');

    await user.click(screen.getAllByRole('button', { name: 'Excluir lote 1 de compra' })[0]!);
    let alerta = await screen.findByRole('alertdialog', { name: 'Excluir lote 1?' });
    await user.click(within(alerta).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('saldo')).toHaveTextContent('−R$ 30.000,00');

    await user.click(screen.getAllByRole('button', { name: 'Excluir lote 1 de compra' })[0]!);
    alerta = await screen.findByRole('alertdialog', { name: 'Excluir lote 1?' });
    await user.click(within(alerta).getByRole('button', { name: 'Excluir' }));

    expect(screen.getByTestId('saldo')).toHaveTextContent('R$ 0,00');
    expect(screen.getByRole('heading', { name: 'Nenhum lote' })).toBeInTheDocument();
    expect(screen.getByText('Lote excluído.')).toBeInTheDocument();
  });

  it('RF-020 Esc fecha a confirmação sem excluir', async () => {
    const { user } = await comUmaCompra();
    await user.click(screen.getAllByRole('button', { name: 'Excluir lote 1 de compra' })[0]!);
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('saldo')).toHaveTextContent('−R$ 30.000,00');
  });
});

describe('RF-026 aba Vendas', () => {
  it('RF-026 mostra a dica de fêmeas só na aba Vendas', async () => {
    const user = userEvent.setup();
    renderComApp(<NegociosScreen />);
    expect(screen.queryByText(/em vendas de fêmeas/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Vendas' }));
    expect(screen.getByText(/em vendas de fêmeas, é comum descontar 10%/)).toBeInTheDocument();
  });
});
