import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DocumentoLegal = 'termos-de-uso' | 'politica-de-privacidade';

/**
 * Fonte única dos textos legais: os arquivos `docs/legal/*.md`, lidos em build (as páginas são
 * estáticas). Só roda no servidor. O build roda em `apps/web`; os testes, na raiz ou em `apps/web`.
 */
export function lerDocumentoLegal(nome: DocumentoLegal): string {
  const candidatos = [
    join(process.cwd(), '..', '..', 'docs', 'legal', `${nome}.md`),
    join(process.cwd(), 'docs', 'legal', `${nome}.md`),
  ];
  for (const caminho of candidatos) {
    try {
      return readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error(`Texto legal não encontrado: docs/legal/${nome}.md`);
}
