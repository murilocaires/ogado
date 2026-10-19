// CSV para o Excel em pt-BR (RF-041): separador `;`, vírgula decimal, BOM UTF-8 e CRLF.
import type { Celula, Coluna, Tabela } from './tabela';

export const BOM = String.fromCharCode(0xfeff);
const SEPARADOR = ';';
const QUEBRA = '\r\n';

/** Texto que o Excel leria como fórmula ganha um apóstrofo na frente (CSV injection). */
const GATILHO_FORMULA = /^[=+\-@\t\r]/;

/** Escapa um campo: aspas se tiver `;`, `"`, quebra de linha ou espaço nas pontas. */
export function escaparCampo(texto: string): string {
  if (/[;"\r\n]/.test(texto) || texto !== texto.trim()) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function dataBr(iso: string): string {
  return iso.split('-').reverse().join('/');
}

function textoDaCelula(celula: Celula, coluna: Coluna): string {
  if (celula === null) return '';
  if (typeof celula === 'number') return celula.toFixed(coluna.casas ?? 0).replace('.', ',');
  if (coluna.tipo === 'data') return dataBr(celula);
  return GATILHO_FORMULA.test(celula) ? `'${celula}` : celula;
}

/** Uma tabela vira um arquivo CSV (com BOM, `;` e CRLF). */
export function tabelaParaCsv(tabela: Pick<Tabela, 'colunas' | 'linhas'>): string {
  const cabecalho = tabela.colunas.map((c) => escaparCampo(c.titulo)).join(SEPARADOR);
  const corpo = tabela.linhas.map((linha) =>
    tabela.colunas
      .map((coluna, i) => escaparCampo(textoDaCelula(linha[i] ?? null, coluna)))
      .join(SEPARADOR),
  );
  return BOM + [cabecalho, ...corpo].join(QUEBRA) + QUEBRA;
}
