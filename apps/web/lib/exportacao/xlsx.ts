// XLSX mínimo (RF-041): um pacote OOXML escrito à mão e compactado com `fflate` (~8 kB). Só o que
// a exportação precisa: abas, números como número, datas, cabeçalho em negrito, larguras e
// cabeçalho congelado. Importe este módulo sob demanda (`import()`) para não pesar o bundle inicial.
import { strToU8, zipSync } from 'fflate';
import type { Celula, Coluna, Tabela } from './tabela';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FORMATO_DATA = 'dd/mm/yyyy';
const ID_FORMATO_DATA = 164;
const ID_PRIMEIRO_FORMATO_NUMERICO = 165;

// Caracteres de controle que o XML 1.0 proíbe.
// eslint-disable-next-line no-control-regex
const PROIBIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function esc(texto: string): string {
  return texto
    .replace(PROIBIDOS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `A`, `B`, ..., `Z`, `AA`... para o índice base 0. */
export function letraDaColuna(indice: number): string {
  let n = indice + 1;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

/** Nome de aba válido no Excel: até 31 caracteres, sem `[]:*?/\`, único na pasta. */
export function nomeDeAba(nome: string, usados: Set<string>): string {
  const base = nome.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Planilha';
  let candidato = base;
  for (let i = 2; usados.has(candidato.toLowerCase()); i += 1) {
    const sufixo = ` (${i})`;
    candidato = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

/** Dias desde 30/12/1899 (a época do Excel) para `AAAA-MM-DD`. */
export function serialDoExcel(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function codigoNumerico(casas: number): string {
  return casas <= 0 ? '#,##0' : `#,##0.${'0'.repeat(casas)}`;
}

interface Estilos {
  xml: string;
  /** Índice do estilo (`s`) por coluna do formato: chave `data` | `n<casas>`. */
  indice: Map<string, number>;
}

/** styles.xml: fonte normal e negrito; formatos de número por casas e de data. */
function montarEstilos(tabelas: readonly Tabela[]): Estilos {
  const casas = new Set<number>();
  let temData = false;
  for (const t of tabelas) {
    for (const c of t.colunas) {
      if (c.tipo === 'numero') casas.add(c.casas ?? 0);
      if (c.tipo === 'data') temData = true;
    }
  }
  const ordenadas = [...casas].sort((a, b) => a - b);
  const indice = new Map<string, number>();
  const formatos: string[] = [];
  const xfs: string[] = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  ];
  if (temData) {
    formatos.push(`<numFmt numFmtId="${ID_FORMATO_DATA}" formatCode="${FORMATO_DATA}"/>`);
    indice.set('data', xfs.length);
    xfs.push(
      `<xf numFmtId="${ID_FORMATO_DATA}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    );
  }
  ordenadas.forEach((c, i) => {
    const id = ID_PRIMEIRO_FORMATO_NUMERICO + i;
    formatos.push(`<numFmt numFmtId="${id}" formatCode="${codigoNumerico(c)}"/>`);
    indice.set(`n${c}`, xfs.length);
    xfs.push(
      `<xf numFmtId="${id}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    );
  });
  const xml =
    `${XML}<styleSheet xmlns="${NS}">` +
    (formatos.length ? `<numFmts count="${formatos.length}">${formatos.join('')}</numFmts>` : '') +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
  return { xml, indice };
}

function textoParaLargura(celula: Celula, coluna: Coluna): string {
  if (celula === null) return '';
  // Com separador de milhar: ~1/3 a mais de caracteres que o número cru.
  if (typeof celula === 'number') {
    const cru = celula.toFixed(coluna.casas ?? 0);
    return cru + '.'.repeat(Math.floor(cru.length / 3));
  }
  return coluna.tipo === 'data' ? '00/00/0000' : celula;
}

/** Largura (em caracteres) pelo maior conteúdo da coluna, entre 10 e 50. */
export function larguraDaColuna(coluna: Coluna, tabela: Tabela, indice: number): number {
  let maior = coluna.titulo.length + 2;
  for (const linha of tabela.linhas) {
    maior = Math.max(maior, textoParaLargura(linha[indice] ?? null, coluna).length + 2);
  }
  return Math.min(50, Math.max(10, maior));
}

function celulaXml(
  celula: Celula,
  coluna: Coluna,
  referencia: string,
  estilos: Map<string, number>,
): string {
  if (celula === null) return '';
  if (typeof celula === 'number') {
    const s = estilos.get(`n${coluna.casas ?? 0}`) ?? 0;
    return `<c r="${referencia}" s="${s}"><v>${celula}</v></c>`;
  }
  if (coluna.tipo === 'data') {
    const s = estilos.get('data') ?? 0;
    return `<c r="${referencia}" s="${s}"><v>${serialDoExcel(celula)}</v></c>`;
  }
  return `<c r="${referencia}" t="inlineStr"><is><t xml:space="preserve">${esc(celula)}</t></is></c>`;
}

function planilhaXml(tabela: Tabela, estilos: Map<string, number>): string {
  const colunas = tabela.colunas
    .map((c, i) => {
      const w = larguraDaColuna(c, tabela, i);
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
    })
    .join('');
  const cabecalho =
    '<row r="1">' +
    tabela.colunas
      .map(
        (c, i) =>
          `<c r="${letraDaColuna(i)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${esc(c.titulo)}</t></is></c>`,
      )
      .join('') +
    '</row>';
  const linhas = tabela.linhas
    .map((linha, r) => {
      const n = r + 2;
      const cels = tabela.colunas
        .map((c, i) => celulaXml(linha[i] ?? null, c, `${letraDaColuna(i)}${n}`, estilos))
        .join('');
      return `<row r="${n}">${cels}</row>`;
    })
    .join('');
  const ultima = `${letraDaColuna(Math.max(tabela.colunas.length - 1, 0))}${tabela.linhas.length + 1}`;
  return (
    `${XML}<worksheet xmlns="${NS}">` +
    `<dimension ref="A1:${ultima}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${colunas}</cols>` +
    `<sheetData>${cabecalho}${linhas}</sheetData>` +
    '</worksheet>'
  );
}

/** Pasta de trabalho `.xlsx` com uma aba por tabela. */
export function tabelasParaXlsx(tabelas: readonly Tabela[]): Uint8Array {
  if (tabelas.length === 0) throw new Error('Nenhuma aba para exportar.');
  const usados = new Set<string>();
  const nomes = tabelas.map((t) => nomeDeAba(t.nome, usados));
  const estilos = montarEstilos(tabelas);

  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        tabelas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${REL_DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${XML}<workbook xmlns="${NS}" xmlns:r="${REL_DOC}"><sheets>` +
        nomes
          .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        tabelas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${REL_DOC}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${tabelas.length + 1}" Type="${REL_DOC}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(estilos.xml),
  };
  tabelas.forEach((t, i) => {
    arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(planilhaXml(t, estilos.indice));
  });
  return zipSync(arquivos, { level: 6 });
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
