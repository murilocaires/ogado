// @vitest-environment node
import { strFromU8, unzipSync } from 'fflate';
import readExcelFile, { readSheet } from 'read-excel-file/universal';
import { describe, expect, it } from 'vitest';
import type { Tabela } from './tabela';
import { larguraDaColuna, letraDaColuna, nomeDeAba, serialDoExcel, tabelasParaXlsx } from './xlsx';

function blob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart]);
}

const compras: Tabela = {
  nome: 'Compras',
  colunas: [
    { titulo: 'Categoria', tipo: 'texto' },
    { titulo: 'Data', tipo: 'data' },
    { titulo: 'Cabeças', tipo: 'numero', casas: 0 },
    { titulo: 'Total (R$)', tipo: 'numero', casas: 2 },
  ],
  linhas: [
    ['Bezerro <A> & "B"', '2026-10-18', 10, 1234567.89],
    ['Boi', null, 3, null],
  ],
};
const vendas: Tabela = {
  nome: 'Vendas',
  colunas: [{ titulo: 'Total (R$)', tipo: 'numero', casas: 2 }],
  linhas: [[-50.5]],
};

describe('RF-041 XLSX', () => {
  it('reabre o arquivo: abas, cabeçalhos e células com tipo certo', async () => {
    const bytes = tabelasParaXlsx([compras, vendas]);
    const abas = await readExcelFile(blob(bytes));
    expect(abas.map((a) => a.sheet)).toEqual(['Compras', 'Vendas']);

    const [cabecalho, l1, l2] = abas[0]!.data;
    expect(cabecalho).toEqual(['Categoria', 'Data', 'Cabeças', 'Total (R$)']);
    expect(l1![0]).toBe('Bezerro <A> & "B"');
    expect(l1![1]).toBeInstanceOf(Date);
    expect((l1![1] as unknown as Date).toISOString().slice(0, 10)).toBe('2026-10-18');
    expect(l1![2]).toBe(10);
    expect(typeof l1![2]).toBe('number');
    expect(l1![3]).toBe(1234567.89);
    expect(l2![0]).toBe('Boi');
    expect(l2![1] ?? null).toBeNull();
    expect(l2![2]).toBe(3);
    expect(l2![3] ?? null).toBeNull();

    expect(abas[1]!.data).toEqual([['Total (R$)'], [-50.5]]);
  });

  it('é um pacote OOXML com cabeçalho em negrito, larguras e formatos de número', () => {
    const arquivos = unzipSync(tabelasParaXlsx([compras]));
    expect(Object.keys(arquivos).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    const estilos = strFromU8(arquivos['xl/styles.xml']!);
    expect(estilos).toContain('<b/>');
    expect(estilos).toContain('formatCode="#,##0.00"');
    expect(estilos).toContain('formatCode="dd/mm/yyyy"');
    const planilha = strFromU8(arquivos['xl/worksheets/sheet1.xml']!);
    // cabeçalho com o estilo 1 (negrito); corpo sem texto "numérico" disfarçado
    expect(planilha).toMatch(/<c r="A1" s="1" t="inlineStr">/);
    expect(planilha).toMatch(/<c r="C2" s="\d+"><v>10<\/v><\/c>/);
    expect(planilha).toContain('customWidth="1"');
    expect(planilha).toContain('state="frozen"');
    expect(planilha).toContain('Bezerro &lt;A&gt; &amp; &quot;B&quot;');
  });

  it('a largura cresce com o conteúdo, entre 10 e 50', () => {
    const curta = larguraDaColuna(compras.colunas[2]!, compras, 2);
    const longa = larguraDaColuna(compras.colunas[0]!, compras, 0);
    expect(curta).toBeGreaterThanOrEqual(10);
    expect(longa).toBeGreaterThan(curta);
    const enorme: Tabela = { ...compras, linhas: [['x'.repeat(200), null, 1, 1]] };
    expect(larguraDaColuna(compras.colunas[0]!, enorme, 0)).toBe(50);
  });

  it('tabela vazia gera só o cabeçalho', async () => {
    const dados = await readSheet(blob(tabelasParaXlsx([{ ...compras, linhas: [] }])));
    expect(dados).toEqual([['Categoria', 'Data', 'Cabeças', 'Total (R$)']]);
  });

  it('nomes de aba são válidos e únicos', () => {
    const usados = new Set<string>();
    expect(nomeDeAba('Cenários', usados)).toBe('Cenários');
    expect(nomeDeAba('cenários', usados)).toBe('cenários (2)');
    expect(nomeDeAba('a/b:c*d', new Set())).toBe('a b c d');
    expect(nomeDeAba('x'.repeat(40), new Set())).toHaveLength(31);
  });

  it('auxiliares: letra da coluna e data serial do Excel', () => {
    expect([0, 25, 26, 27, 51, 52].map(letraDaColuna)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA']);
    expect(serialDoExcel('1900-03-01')).toBe(61);
    expect(serialDoExcel('2026-10-18')).toBe(46313);
  });

  it('rejeita pasta sem abas', () => {
    expect(() => tabelasParaXlsx([])).toThrow();
  });
});
