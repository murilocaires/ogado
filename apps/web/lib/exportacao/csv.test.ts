import { describe, expect, it } from 'vitest';
import { BOM, escaparCampo, tabelaParaCsv } from './csv';
import type { Tabela } from './tabela';

const tabela = (linhas: Tabela['linhas']): Tabela => ({
  nome: 'T',
  colunas: [
    { titulo: 'Nome', tipo: 'texto' },
    { titulo: 'Data', tipo: 'data' },
    { titulo: 'Valor', tipo: 'numero', casas: 2 },
  ],
  linhas,
});

describe('RF-041 CSV para o Excel pt-BR', () => {
  it('começa com BOM UTF-8, usa ; e CRLF (inclusive no fim)', () => {
    const csv = tabelaParaCsv(tabela([['Bois', '2026-10-18', 1234.5]]));
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}Nome;Data;Valor\r\nBois;18/10/2026;1234,50\r\n`);
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('escreve a vírgula decimal, sem separador de milhar, e mantém as casas', () => {
    const csv = tabelaParaCsv(tabela([['a', null, 1234567.891], ['b', null, 0], ['c', null, -0.5]]));
    const [, a, b, c] = csv.split('\r\n');
    expect(a).toBe('a;;1234567,89');
    expect(b).toBe('b;;0,00');
    expect(c).toBe('c;;-0,50');
  });

  it('célula indefinida (null) fica vazia, não "—" nem "null"', () => {
    const csv = tabelaParaCsv(tabela([['x', null, null]]));
    expect(csv).toContain('\r\nx;;\r\n');
  });

  it('escapa aspas, ponto e vírgula e quebras de linha', () => {
    expect(escaparCampo('simples')).toBe('simples');
    expect(escaparCampo('a;b')).toBe('"a;b"');
    expect(escaparCampo('disse "oi"')).toBe('"disse ""oi"""');
    expect(escaparCampo('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(escaparCampo('linha1\r\nlinha2')).toBe('"linha1\r\nlinha2"');
    expect(escaparCampo(' espaço')).toBe('" espaço"');
    expect(escaparCampo('com,virgula')).toBe('com,virgula');
    const csv = tabelaParaCsv(tabela([['Lote "A"; novo', null, 1]]));
    expect(csv).toContain('"Lote ""A""; novo";;1,00');
  });

  it('neutraliza texto que o Excel leria como fórmula', () => {
    const csv = tabelaParaCsv(tabela([['=HYPERLINK("x")', null, 1], ['@soma', null, 1], ['-1+2', null, 1]]));
    expect(csv).toContain(`"'=HYPERLINK(""x"")";;1,00`);
    expect(csv).toContain(`'@soma;;1,00`);
    expect(csv).toContain(`'-1+2;;1,00`);
    // número negativo de verdade não é texto: não ganha apóstrofo
    expect(tabelaParaCsv(tabela([['a', null, -3]]))).toContain('a;;-3,00');
  });

  it('tabela sem linhas ainda traz o cabeçalho', () => {
    expect(tabelaParaCsv(tabela([]))).toBe(`${BOM}Nome;Data;Valor\r\n`);
  });
});
