// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { snapshotDaRecria } from '../lib/cenarios';
import { BOM } from '../lib/exportacao/csv';
import type { OGadoRepo, RecriaEntity, RecriaForm } from '../lib/repo/types';
import { PainelScreen } from './PainelScreen';
import { RecriaScreen } from './RecriaScreen';
import { criarStorageMemoria, renderComApp } from './test-utils';
import { criarRepoComPlanilha, recriaFormPlanilha } from '../lib/repo/planilha.test-support';

vi.mock('next/navigation', () => ({
  usePathname: () => '/recria',
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
    className?: string;
  }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

// O download de verdade (Blob + link) é do navegador; aqui se captura o arquivo gerado.
const baixados = vi.hoisted(() => [] as { nome: string; tipo: string; conteudo: unknown }[]);
vi.mock('../lib/exportacao/baixar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/exportacao/baixar')>()),
  baixarArquivo: (arquivo: { nome: string; tipo: string; conteudo: unknown }) => {
    baixados.push(arquivo);
  },
}));

/** Repositório com as entradas da planilha preenchidas (o simulador novo abre vazio, ADR-0014). */
function novoRepo(): OGadoRepo {
  return criarRepoComPlanilha(() => criarStorageMemoria());
}

/** Guarda um cenário direto no repositório, com as entradas padrão alteradas por `form`. */
function semear(repo: OGadoRepo, nome: string, form: Partial<RecriaForm> = {}): void {
  const recria: RecriaEntity = {
    id: 'r',
    version: 1,
    updatedAt: '2026-10-18T10:00:00.000Z',
    deletedAt: null,
    form: { ...recriaFormPlanilha(), ...form },
    lotacaoInicial: 'areaPastavel',
  };
  const snapshot = snapshotDaRecria(recria, nome);
  if (!snapshot) throw new Error('snapshot indefinido');
  repo.salvarCenario(snapshot);
}

function nomesNaLista(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((i) => i.querySelector('b')?.textContent?.replace('★', '').trim() ?? '');
}

describe('RF-032 salvar como cenário', () => {
  it('RF-032 abre o diálogo com "Cenário 1", Enter confirma, mostra o aviso e vai para a aba Cenários', async () => {
    const user = userEvent.setup();
    const repo = novoRepo();
    renderComApp(<RecriaScreen />, repo);
    expect(screen.getByRole('tab', { name: /^Cenários\s*0$/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Salvar como cenário' }));
    const dialogo = screen.getByRole('dialog', { name: 'Salvar como cenário' });
    const campo = within(dialogo).getByLabelText('Nome do cenário');
    expect(campo).toHaveValue('Cenário 1');
    expect(campo).toHaveAttribute('maxlength', '80');
    expect(campo).toHaveAttribute('placeholder', 'ex.: Safra 26/27 — preço otimista');

    await user.clear(campo);
    await user.type(campo, 'Safra 26/27{Enter}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Cenário salvo.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Cenários\s*1$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Safra 26/27')).toBeInTheDocument();
    expect(screen.getByText('R$ 102.408')).toBeInTheDocument();
  });

  it('RF-032 não salva sem números válidos e avisa', async () => {
    const user = userEvent.setup();
    const repo = novoRepo();
    renderComApp(<RecriaScreen />, repo);
    await user.clear(screen.getByLabelText('Investimento (compra)'));
    await user.click(screen.getByRole('button', { name: 'Salvar como cenário' }));
    expect(
      screen.getByText(/Preencha todos os campos com números válidos para salvar/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Cenários\s*0$/ })).toBeInTheDocument();
  });

  it('RN-023 o cenário é um snapshot: mudar o simulador depois não altera a lista; abrir restaura as entradas', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen />, novoRepo());
    await user.click(screen.getByRole('button', { name: 'Salvar como cenário' }));
    await user.keyboard('{Enter}');
    expect(screen.getByText('R$ 102.408')).toBeInTheDocument();

    // volta ao simulador e muda o preço de venda
    await user.click(screen.getByRole('tab', { name: 'Simulador' }));
    const preco = screen.getByLabelText('R$/cab (venda)');
    await user.clear(preco);
    await user.type(preco, '400');

    await user.click(screen.getByRole('tab', { name: /^Cenários/ }));
    expect(screen.getByText('R$ 102.408')).toBeInTheDocument(); // continua o valor salvo

    // "Abrir no simulador" substitui as entradas atuais pelas do snapshot
    await user.click(screen.getByRole('button', { name: 'Abrir Cenário 1' }));
    expect(screen.getByText('Cenário "Cenário 1" aberto no simulador.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Simulador' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('R$/cab (venda)')).toHaveValue('325');
  });
});

describe('RF-032/RF-034/RF-035/RF-036 lista de cenários', () => {
  it('RF-034 sem cenários mostra o estado vazio com botão para o Simulador', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen abaInicial="cenarios" />, novoRepo());
    expect(screen.getByRole('heading', { name: 'Nenhum cenário salvo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir para o Simulador' }));
    expect(screen.getByRole('tab', { name: 'Simulador' })).toHaveAttribute('aria-selected', 'true');
  });

  it('RF-034 busca por nome e "Nada encontrado"; contagem muda', async () => {
    const user = userEvent.setup();
    const repo = novoRepo();
    semear(repo, 'Safra 26/27 otimista');
    semear(repo, 'Base conservadora', { precoVenda: '300' });
    renderComApp(<RecriaScreen abaInicial="cenarios" />, repo);
    expect(screen.getByText('2 cenários')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar cenário'), 'SAFRA');
    expect(nomesNaLista()).toEqual(['Safra 26/27 otimista']);
    expect(screen.getByText('1 cenário encontrados')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar cenário'));
    await user.type(screen.getByLabelText('Buscar cenário'), 'zzz');
    expect(screen.getByRole('heading', { name: 'Nada encontrado' })).toBeInTheDocument();
  });

  it('RF-034 ordena por mais recentes, maior líquido e nome A–Z', async () => {
    const user = userEvent.setup();
    const repo = novoRepo();
    semear(repo, 'Beta', { precoVenda: '300' });
    semear(repo, 'Alfa', { precoVenda: '350' });
    semear(repo, 'Gama', { precoVenda: '325' });
    renderComApp(<RecriaScreen abaInicial="cenarios" />, repo);

    expect(nomesNaLista()).toEqual(['Gama', 'Alfa', 'Beta']); // mais recentes primeiro
    await user.selectOptions(screen.getByLabelText('Ordenar'), 'liquido');
    expect(nomesNaLista()).toEqual(['Alfa', 'Gama', 'Beta']);
    await user.selectOptions(screen.getByLabelText('Ordenar'), 'nome');
    expect(nomesNaLista()).toEqual(['Alfa', 'Beta', 'Gama']);
  });

  it('RF-036 ★ no maior líquido só com 2 ou mais cenários', () => {
    const um = novoRepo();
    semear(um, 'Único');
    const { unmount } = renderComApp(<RecriaScreen abaInicial="cenarios" />, um);
    expect(screen.queryByRole('img', { name: 'Melhor líquido' })).not.toBeInTheDocument();
    unmount();

    const dois = novoRepo();
    semear(dois, 'Pior', { precoVenda: '300' });
    semear(dois, 'Melhor', { precoVenda: '350' });
    renderComApp(<RecriaScreen abaInicial="cenarios" />, dois);
    const estrelas = screen.getAllByRole('img', { name: 'Melhor líquido' });
    expect(estrelas).toHaveLength(1);
    expect(estrelas[0]?.closest('[role="listitem"]')).toHaveTextContent('Melhor');
  });

  it('RF-034 alterna lista e grade com aria-pressed', async () => {
    const user = userEvent.setup();
    const repo = novoRepo();
    semear(repo, 'Base');
    renderComApp(<RecriaScreen abaInicial="cenarios" />, repo);
    const lista = screen.getByRole('button', { name: 'Lista' });
    const grade = screen.getByRole('button', { name: 'Grade' });
    expect(lista).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.clist')).not.toBeNull();
    await user.click(grade);
    expect(grade).toHaveAttribute('aria-pressed', 'true');
    expect(lista).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('.cgrid')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir Base' })).toBeInTheDocument();
  });

  it('RF-032 duplica ("… (cópia)"), renomeia e exclui com confirmação', async () => {
    const user = userEvent.setup();
    const repo = novoRepo();
    semear(repo, 'Base');
    renderComApp(<RecriaScreen abaInicial="cenarios" />, repo);

    await user.click(screen.getByRole('button', { name: 'Duplicar Base' }));
    expect(screen.getByText('Cenário duplicado.')).toBeInTheDocument();
    expect(nomesNaLista()).toContain('Base (cópia)');

    await user.click(screen.getByRole('button', { name: 'Renomear Base (cópia)' }));
    const campo = within(screen.getByRole('dialog', { name: 'Renomear cenário' })).getByLabelText(
      'Nome do cenário',
    );
    expect(campo).toHaveValue('Base (cópia)');
    await user.clear(campo);
    await user.type(campo, 'Otimista{Enter}');
    expect(nomesNaLista()).toContain('Otimista');

    await user.click(screen.getByRole('button', { name: 'Excluir Otimista' }));
    const alerta = screen.getByRole('alertdialog', { name: 'Excluir cenário?' });
    expect(alerta).toHaveTextContent('“Otimista” será removido.');
    await user.click(within(alerta).getByRole('button', { name: 'Cancelar' }));
    expect(nomesNaLista()).toContain('Otimista');

    await user.click(screen.getByRole('button', { name: 'Excluir Otimista' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );
    expect(screen.getByText('Cenário excluído.')).toBeInTheDocument();
    expect(nomesNaLista()).toEqual(['Base']);
    expect(screen.getByRole('tab', { name: /^Cenários\s*1$/ })).toBeInTheDocument();
  });
});

describe('RF-041 exportar cenários', () => {
  it('RF-041 sem cenários não há botão Exportar (estado vazio)', () => {
    renderComApp(<RecriaScreen abaInicial="cenarios" />, novoRepo());
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
  });

  it('RF-041 baixa o CSV e o XLSX dos cenários, com o nome do arquivo e o toast', async () => {
    baixados.length = 0;
    const user = userEvent.setup();
    const repo = novoRepo();
    semear(repo, 'Safra 26/27');
    semear(repo, 'Preço baixo', { precoVenda: '250' });
    renderComApp(<RecriaScreen abaInicial="cenarios" />, repo);

    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    let dialogo = screen.getByRole('dialog', { name: 'Exportar cenários' });
    await user.click(within(dialogo).getByRole('button', { name: 'Exportar' }));
    await screen.findByText(/^Arquivo ogado-cenarios-\d{4}-\d{2}-\d{2}\.csv baixado\.$/);
    const csv = String(baixados[0]!.conteudo);
    expect(csv.startsWith(`${BOM}Cenário;Criado em;Faturamento líquido;`)).toBe(true);
    expect(csv).toContain('Safra 26/27;');
    expect(csv).toContain('Preço baixo;');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    dialogo = screen.getByRole('dialog', { name: 'Exportar cenários' });
    await user.click(within(dialogo).getByRole('button', { name: 'XLSX' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Exportar' }));
    await screen.findByText(/^Arquivo ogado-cenarios-\d{4}-\d{2}-\d{2}\.xlsx baixado\.$/);
    expect(baixados[1]!.nome).toMatch(/\.xlsx$/);
  });
});

describe('RF-033 comparação de 2 a 3 cenários', () => {
  function tresCenarios(): OGadoRepo {
    const repo = novoRepo();
    semear(repo, 'Base');
    semear(repo, 'Otimista', { precoVenda: '350' });
    semear(repo, 'Pessimista', { precoVenda: '300' });
    return repo;
  }

  it('RF-033 a barra flutuante aparece com 1 marcado, libera Comparar com 2 e Limpar zera', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen abaInicial="cenarios" />, tresCenarios());
    expect(screen.queryByRole('region', { name: 'Comparação' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Comparar Base' }));
    const barra = screen.getByRole('region', { name: 'Comparação' });
    expect(barra).toHaveTextContent('1 selecionado · marque mais 1');
    expect(within(barra).queryByRole('button', { name: 'Comparar' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Comparar Otimista' }));
    expect(barra).toHaveTextContent('2 selecionados');
    expect(within(barra).getByRole('button', { name: 'Comparar' })).toBeInTheDocument();

    await user.click(within(barra).getByRole('button', { name: 'Limpar' }));
    expect(screen.queryByRole('region', { name: 'Comparação' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Comparar Base' })).not.toBeChecked();
  });

  it('RF-033 o 4º marcado avisa "Compare até 3 cenários." e fica desmarcado', async () => {
    const user = userEvent.setup();
    const repo = tresCenarios();
    semear(repo, 'Quarto', { precoVenda: '310' });
    renderComApp(<RecriaScreen abaInicial="cenarios" />, repo);
    for (const nome of ['Base', 'Otimista', 'Pessimista']) {
      await user.click(screen.getByRole('checkbox', { name: `Comparar ${nome}` }));
    }
    await user.click(screen.getByRole('checkbox', { name: 'Comparar Quarto' }));
    expect(screen.getByText('Compare até 3 cenários.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Comparar Quarto' })).not.toBeChecked();
    expect(screen.getByRole('region', { name: 'Comparação' })).toHaveTextContent('3 selecionados');
  });

  it('RF-033/RF-036 tabela com diferença vs. o primeiro marcado (verde melhor, vermelho pior) e ★ no melhor líquido', async () => {
    const user = userEvent.setup();
    renderComApp(<RecriaScreen abaInicial="cenarios" />, tresCenarios());
    await user.click(screen.getByRole('checkbox', { name: 'Comparar Base' }));
    await user.click(screen.getByRole('checkbox', { name: 'Comparar Otimista' }));
    await user.click(screen.getByRole('checkbox', { name: 'Comparar Pessimista' }));
    await user.click(
      within(screen.getByRole('region', { name: 'Comparação' })).getByRole('button', {
        name: 'Comparar',
      }),
    );

    const tabela = screen.getByRole('table');
    expect(
      within(tabela)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Indicador', 'Base', 'Otimista', 'Pessimista']);
    const linhaLiquido = within(tabela).getByRole('row', { name: /^Faturamento líquido/ });
    const celulas = within(linhaLiquido).getAllByRole('cell');
    // 325 -> 350 R$/@: +25 × (420/30 × cabeças) a mais; 325 -> 300: o mesmo a menos
    expect(celulas[1]?.querySelector('small')).toHaveClass('up');
    expect(celulas[1]?.querySelector('small')?.textContent).toMatch(/^\+R\$/);
    expect(celulas[2]?.querySelector('small')).toHaveClass('dn');
    expect(celulas[2]?.querySelector('small')?.textContent).toMatch(/^−R\$/);
    expect(celulas[0]).not.toHaveClass('best');
    expect(celulas[1]).toHaveClass('best');
    expect(
      within(celulas[1] as HTMLElement).getByRole('img', { name: 'Melhor líquido' }),
    ).toBeInTheDocument();

    // Custo operacional: menor é melhor (o imposto sobe com o preço) -> o Otimista custa mais = pior
    const custo = within(tabela).getByRole('row', { name: /^Custo operacional/ });
    const difCusto = within(custo).getAllByRole('cell')[1]?.querySelector('small');
    expect(difCusto).toHaveClass('dn');
    expect(difCusto?.textContent).toMatch(/^\+R\$/);
    // Indicador sem melhor/pior (preço de venda) é neutro: diferença sem verde nem vermelho
    const preco = within(tabela).getByRole('row', { name: /^Preço de venda/ });
    const difs = Array.from(preco.querySelectorAll('small'));
    expect(difs).toHaveLength(2);
    for (const d of difs) expect(d.className).toBe('');
    // ajuda "i" nos indicadores com entrada no dicionário
    expect(
      within(linhaLiquido).getByRole('button', { name: 'O que é: Faturamento líquido' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('RF-040 Painel com cenários', () => {
  it('RF-040 o cartão da Recria mostra o último cenário salvo e leva a Cenários', () => {
    const repo = novoRepo();
    semear(repo, 'Primeiro', { precoVenda: '300' });
    semear(repo, 'Último', { precoVenda: '350' });
    renderComApp(<PainelScreen />, repo);
    const cartao = screen.getByRole('region', { name: /Recria, último cenário salvo: Último/ });
    expect(cartao).toHaveTextContent('Último');
    const snap = repo.getSnapshot();
    expect(snap.status === 'pronto' && snap.cenarios).toHaveLength(2);
    expect(within(cartao).getByRole('link', { name: /Ver cenários/ })).toHaveAttribute(
      'href',
      '/recria?aba=cenarios',
    );
    // 350 R$/@ rende mais que a simulação atual (325): o cartão não é a simulação
    expect(cartao).not.toHaveTextContent('R$ 102.408,05');
  });

  it('RF-040 sem cenários o cartão segue mostrando a simulação atual', () => {
    renderComApp(<PainelScreen />, novoRepo());
    const cartao = screen.getByRole('region', { name: /Recria, simulação atual/ });
    expect(cartao).toHaveTextContent('R$ 102.408,05');
    expect(within(cartao).queryByRole('link', { name: /Ver cenários/ })).not.toBeInTheDocument();
  });
});
