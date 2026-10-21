// Gera o arquivo no navegador e dispara o download (RF-041). Funciona offline: não chama a API.
import { tabelaParaCsv } from './csv';
import { dataParaArquivo, type Tabela } from './tabela';

export type FormatoExportacao = 'csv' | 'xlsx';

export interface ArquivoExportado {
  nome: string;
  tipo: string;
  conteudo: BlobPart;
}

/**
 * Monta o arquivo. CSV leva uma tabela (a primeira); XLSX leva todas, uma por aba. O módulo do
 * XLSX só é carregado aqui, na hora de exportar.
 */
export async function gerarArquivo(
  formato: FormatoExportacao,
  tabelas: readonly Tabela[],
  nomeBase: string,
  agora: Date = new Date(),
): Promise<ArquivoExportado> {
  const data = dataParaArquivo(agora);
  if (formato === 'csv') {
    const primeira = tabelas[0];
    if (!primeira) throw new Error('Nada para exportar.');
    return {
      nome: `bovaro-${nomeBase}-${data}.csv`,
      tipo: 'text/csv;charset=utf-8',
      conteudo: tabelaParaCsv(primeira),
    };
  }
  const { tabelasParaXlsx, XLSX_MIME } = await import('./xlsx');
  return {
    nome: `bovaro-${nomeBase}-${data}.xlsx`,
    tipo: XLSX_MIME,
    conteudo: tabelasParaXlsx(tabelas) as BlobPart,
  };
}

export function baixarArquivo(arquivo: ArquivoExportado): void {
  const url = URL.createObjectURL(new Blob([arquivo.conteudo], { type: arquivo.tipo }));
  const link = document.createElement('a');
  link.href = url;
  link.download = arquivo.nome;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // O navegador já começou o download; soltar o endereço depois evita vazar memória.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
