// @vitest-environment happy-dom
import { calcularRecria, ENTRADA_PADRAO, formatarBRL } from '@ogado/domain';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { criarRepoLocal } from '../lib/repo/local-repo';
import type { LoteSalvar } from '../lib/repo/types';
import { AppShell } from './AppShell';
import { PainelScreen } from './PainelScreen';
import { criarStorageMemoria, renderComApp } from './test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/negocios',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...resto
  }: {
    href: string;
    children: ReactNode;
    'aria-current'?: 'page';
    className?: string;
  }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

function lote(numero: number, data: string, tipo: 'compra' | 'venda' = 'compra'): LoteSalvar {
  return {
    tipo,
    numero,
    categoria: 'BOIS',
    data,
    modo: 'total',
    qtd: '10',
    peso: '3000',
    pesos: [],
    preco: '300',
    ...(tipo === 'venda' ? { base: 'vivo' as const, aplicarDesconto: false, descontoPct: '' } : {}),
  };
}

describe('RF-040 Painel', () => {
  it('RF-040 sem lançamentos: estado vazio, saudação genérica e a recria atual', () => {
    renderComApp(<PainelScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Olá' })).toBeInTheDocument();
    expect(screen.getByText('Nenhuma operação ainda')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar primeiro lote' })).toHaveAttribute(
      'href',
      '/negocios?novo=compra',
    );
    const liquido = formatarBRL(calcularRecria(ENTRADA_PADRAO).faturamentoLiquido);
    expect(within(screen.getByRole('region', { name: /Recria, simulação atual/ })).getByText(liquido)).toBeInTheDocument();
  });

  it('RF-040 atalhos levam a novo lote (compra, venda) e à recria', () => {
    renderComApp(<PainelScreen />);
    expect(screen.getByRole('link', { name: 'Nova compra' })).toHaveAttribute('href', '/negocios?novo=compra');
    expect(screen.getByRole('link', { name: 'Nova venda' })).toHaveAttribute('href', '/negocios?novo=venda');
    expect(screen.getByRole('link', { name: 'Simular recria' })).toHaveAttribute('href', '/recria');
  });

  it('RF-040 lista só as 6 últimas operações, por data decrescente, e mostra o saldo', () => {
    const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
    for (let i = 1; i <= 7; i += 1) repo.salvarLote(lote(i, `2026-10-0${i}`));
    repo.salvarLote(lote(1, '2026-10-09', 'venda'));
    renderComApp(<PainelScreen />, repo);

    const secao = screen.getByRole('region', { name: 'Últimas operações' });
    const itens = Array.from(secao.querySelectorAll('.ops > div'));
    expect(itens).toHaveLength(6);
    expect(itens[0]).toHaveTextContent('VENDA');
    expect(itens[0]).toHaveTextContent('09/10/2026');
    expect(itens[5]).toHaveTextContent('Lote 3'); // 7,6,5,4,3 depois da venda do dia 9
    // 7 compras de R$ 30.000 e 1 venda de R$ 30.000: saldo −R$ 180.000,00
    expect(screen.getByTestId('saldo')).toHaveTextContent('−R$ 180.000,00');
  });
});

describe('RF-053 navegação', () => {
  it('RF-053 tem 3 itens (Painel, Negócios, Recria) em cada barra, sem Conta, e marca a página atual', () => {
    renderComApp(
      <AppShell>
        <p>conteúdo</p>
      </AppShell>,
    );
    const navs = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(navs).toHaveLength(2); // lateral (desktop) e inferior (< 900 px)
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual(['Painel', 'Negócios', 'Recria']);
      expect(within(nav).getByRole('link', { name: 'Negócios' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
    }
    expect(screen.queryByText('Conta')).not.toBeInTheDocument();
    expect(screen.queryByText('PROTÓTIPO')).not.toBeInTheDocument();
  });

  it('RNF-004 avisa quando o navegador não deixa salvar os dados', () => {
    const repo = criarRepoLocal({ storage: () => null });
    renderComApp(
      <AppShell>
        <p>conteúdo</p>
      </AppShell>,
      repo,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/não está deixando salvar/);
  });
});
