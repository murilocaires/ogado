import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

/**
 * Renderizador mínimo de Markdown para os textos legais (docs/legal/*.md): títulos (#, ##, ###),
 * parágrafos, listas com "-", citações ">", tabelas de barras, **negrito**, `código` e [links](url).
 * Sem HTML cru e sem dependência: tudo vira elemento React (nada de dangerouslySetInnerHTML).
 */

export type Inline =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito'; filhos: Inline[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; href: string; filhos: Inline[] };

export type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; id: string; filhos: Inline[] }
  | { tipo: 'paragrafo'; filhos: Inline[] }
  | { tipo: 'lista'; itens: Inline[][] }
  | { tipo: 'citacao'; filhos: Inline[] }
  | { tipo: 'tabela'; cabecalho: Inline[][]; linhas: Inline[][][] };

/** Só caminhos do site, https, http e mailto: qualquer outro esquema (ex.: javascript:) vira texto. */
export function hrefSeguro(href: string): boolean {
  return /^(\/(?!\/)|https?:\/\/|mailto:)/i.test(href.trim());
}

export function parseInline(texto: string): Inline[] {
  const saida: Inline[] = [];
  let resto = texto;
  const empurrar = (t: string) => {
    if (t) saida.push({ tipo: 'texto', texto: t });
  };
  while (resto.length > 0) {
    const m = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/.exec(resto);
    if (!m) {
      empurrar(resto);
      break;
    }
    empurrar(resto.slice(0, m.index));
    if (m[1] !== undefined) saida.push({ tipo: 'negrito', filhos: parseInline(m[1]) });
    else if (m[2] !== undefined) saida.push({ tipo: 'codigo', texto: m[2] });
    else if (m[3] !== undefined && m[4] !== undefined) {
      if (hrefSeguro(m[4])) {
        saida.push({ tipo: 'link', href: m[4], filhos: parseInline(m[3]) });
      } else {
        empurrar(m[3]);
      }
    }
    resto = resto.slice(m.index + m[0].length);
  }
  return saida;
}

function textoPuro(filhos: Inline[]): string {
  return filhos
    .map((f) => (f.tipo === 'texto' || f.tipo === 'codigo' ? f.texto : textoPuro(f.filhos)))
    .join('');
}

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function celulas(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const ehSeparadorTabela = (linha: string): boolean =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(linha);

export function parseMarkdown(markdown: string): Bloco[] {
  const linhas = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocos: Bloco[] = [];
  const idsUsados = new Map<string, number>();
  let i = 0;

  const idUnico = (base: string): string => {
    const n = idsUsados.get(base) ?? 0;
    idsUsados.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  while (i < linhas.length) {
    const linha = linhas[i] ?? '';
    if (linha.trim() === '') {
      i += 1;
      continue;
    }

    const titulo = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(linha);
    if (titulo?.[1] && titulo[2]) {
      const filhos = parseInline(titulo[2]);
      blocos.push({
        tipo: 'titulo',
        nivel: titulo[1].length as 1 | 2 | 3,
        id: idUnico(slugify(textoPuro(filhos)) || 'secao'),
        filhos,
      });
      i += 1;
      continue;
    }

    if (/^\s*-\s+/.test(linha)) {
      const itens: Inline[][] = [];
      while (i < linhas.length && /^\s*-\s+/.test(linhas[i] ?? '')) {
        itens.push(parseInline((linhas[i] ?? '').replace(/^\s*-\s+/, '')));
        i += 1;
      }
      blocos.push({ tipo: 'lista', itens });
      continue;
    }

    if (/^>\s?/.test(linha)) {
      const partes: string[] = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i] ?? '')) {
        partes.push((linhas[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocos.push({ tipo: 'citacao', filhos: parseInline(partes.join(' ')) });
      continue;
    }

    if (linha.includes('|') && ehSeparadorTabela(linhas[i + 1] ?? '')) {
      const cabecalho = celulas(linha).map(parseInline);
      i += 2;
      const corpo: Inline[][][] = [];
      while (i < linhas.length && (linhas[i] ?? '').includes('|')) {
        corpo.push(celulas(linhas[i] ?? '').map(parseInline));
        i += 1;
      }
      blocos.push({ tipo: 'tabela', cabecalho, linhas: corpo });
      continue;
    }

    const partes: string[] = [];
    while (
      i < linhas.length &&
      (linhas[i] ?? '').trim() !== '' &&
      !/^(#{1,3}\s|\s*-\s+|>)/.test(linhas[i] ?? '')
    ) {
      partes.push((linhas[i] ?? '').trim());
      i += 1;
    }
    blocos.push({ tipo: 'paragrafo', filhos: parseInline(partes.join(' ')) });
  }
  return blocos;
}

function renderInline(filhos: Inline[]): ReactNode {
  return filhos.map((f, i) => {
    switch (f.tipo) {
      case 'texto':
        return <Fragment key={i}>{f.texto}</Fragment>;
      case 'negrito':
        return <strong key={i}>{renderInline(f.filhos)}</strong>;
      case 'codigo':
        return <code key={i}>{f.texto}</code>;
      case 'link':
        return f.href.startsWith('/') ? (
          <Link key={i} href={f.href} className="legal-link">
            {renderInline(f.filhos)}
          </Link>
        ) : (
          <a key={i} href={f.href} className="legal-link" target="_blank" rel="noopener noreferrer">
            {renderInline(f.filhos)}
          </a>
        );
    }
  });
}

export function MarkdownView({ markdown }: { markdown: string }) {
  const blocos = parseMarkdown(markdown);
  return (
    <>
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case 'titulo': {
            const Tag = `h${b.nivel}` as 'h1' | 'h2' | 'h3';
            return (
              <Tag key={i} id={b.nivel === 1 ? undefined : b.id}>
                {renderInline(b.filhos)}
              </Tag>
            );
          }
          case 'paragrafo':
            return <p key={i}>{renderInline(b.filhos)}</p>;
          case 'lista':
            return (
              <ul key={i}>
                {b.itens.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'citacao':
            return (
              <blockquote key={i} className="legal-aviso">
                {renderInline(b.filhos)}
              </blockquote>
            );
          case 'tabela':
            return (
              <div
                key={i}
                className="legal-tabela"
                role="region"
                tabIndex={0}
                aria-label="Tabela com detalhes"
              >
                <table>
                  <thead>
                    <tr>
                      {b.cabecalho.map((c, j) => (
                        <th key={j} scope="col">
                          {renderInline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.linhas.map((linha, j) => (
                      <tr key={j}>
                        {linha.map((c, k) => (
                          <td key={k}>{renderInline(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}
