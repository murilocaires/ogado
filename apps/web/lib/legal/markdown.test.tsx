// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lerDocumentoLegal } from './conteudo';
import { hrefSeguro, MarkdownView, parseInline, parseMarkdown } from './markdown';

describe('RNF-009 renderizador mínimo de Markdown', () => {
  it('títulos, parágrafo com várias linhas, lista, negrito e link interno', () => {
    const { container } = render(
      <MarkdownView
        markdown={[
          '# Título',
          '',
          'Primeira linha',
          'segunda linha com **negrito** e [termos](/termos).',
          '',
          '## Seção Única',
          '',
          '- item um',
          '- item **dois**',
        ].join('\n')}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toBeTruthy();
    const h2 = screen.getByRole('heading', { level: 2, name: 'Seção Única' });
    expect(h2.id).toBe('secao-unica');
    expect(container.querySelector('p')?.textContent).toBe(
      'Primeira linha segunda linha com negrito e termos.',
    );
    expect(container.querySelector('strong')?.textContent).toBe('negrito');
    expect(screen.getByRole('link', { name: 'termos' }).getAttribute('href')).toBe('/termos');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('links externos abrem com rel seguro; esquemas perigosos viram texto', () => {
    const { container } = render(
      <MarkdownView markdown="[gov](https://www.gov.br/anpd) e [ruim](javascript:alert(1))" />,
    );
    const externo = screen.getByRole('link', { name: 'gov' });
    expect(externo.getAttribute('target')).toBe('_blank');
    expect(externo.getAttribute('rel')).toContain('noopener');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.textContent).toContain('ruim');
    expect(hrefSeguro('javascript:alert(1)')).toBe(false);
    expect(hrefSeguro('//evil.example')).toBe(false);
    expect(hrefSeguro('mailto:a@b.c')).toBe(true);
  });

  it('não interpreta HTML cru: tags viram texto', () => {
    const { container } = render(<MarkdownView markdown={'<script>x</script> **ok**'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>x</script>');
  });

  it('tabela de barras vira table com cabeçalhos', () => {
    render(<MarkdownView markdown={['| A | B |', '| --- | --- |', '| 1 | **2** |'].join('\n')} />);
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '2' })).toBeTruthy();
  });

  it('citação vira blockquote', () => {
    const { container } = render(<MarkdownView markdown="> **Rascunho.** revisar" />);
    expect(container.querySelector('blockquote')?.textContent).toBe('Rascunho. revisar');
  });

  it('ids de títulos repetidos não colidem', () => {
    const ids = parseMarkdown('## Igual\n\n## Igual').flatMap((b) =>
      b.tipo === 'titulo' ? [b.id] : [],
    );
    expect(ids).toEqual(['igual', 'igual-2']);
  });

  it('parseInline mantém texto sem marcação intacto', () => {
    expect(parseInline('só texto')).toEqual([{ tipo: 'texto', texto: 'só texto' }]);
  });
});

describe('RNF-009 textos legais (docs/legal) renderizados', () => {
  it.each([
    ['termos-de-uso', 'Termos de Uso'],
    ['politica-de-privacidade', 'Política de Privacidade'],
  ] as const)('%s: um único h1, aviso de rascunho e marcadores do controlador', (nome, h1) => {
    const { container } = render(<MarkdownView markdown={lerDocumentoLegal(nome)} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(h1);
    expect(container.querySelector('blockquote')?.textContent).toMatch(/Rascunho/);
    expect(container.textContent).toContain('[IDENTIFICAÇÃO DO CONTROLADOR — preencher]');
    expect(container.textContent).toContain('[E-MAIL DE CONTATO DO CONTROLADOR — preencher]');
    expect(container.textContent).toMatch(/Versão \d{4}-\d{2}-\d{2}/);
    // nada de Markdown sobrando na tela
    expect(container.textContent).not.toMatch(/\*\*|\]\(/);
  });
});
