import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DocumentoLegal = 'termos-de-uso' | 'politica-de-privacidade';

function ler(caminho: () => string): string | null {
  try {
    return readFileSync(caminho(), 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

/**
 * Fonte única dos textos legais: os arquivos `docs/legal/*.md`, lidos em build (as páginas são
 * estáticas). Só roda no servidor. O build roda em `apps/web`; os testes, na raiz ou em `apps/web`.
 * Os nomes são literais para o bundler rastrear só estes dois arquivos (e não o projeto inteiro).
 */
export function lerDocumentoLegal(nome: DocumentoLegal): string {
  const texto =
    nome === 'termos-de-uso'
      ? (ler(() => join(process.cwd(), '..', '..', 'docs', 'legal', 'termos-de-uso.md')) ??
        ler(() => join(process.cwd(), 'docs', 'legal', 'termos-de-uso.md')))
      : (ler(() =>
          join(process.cwd(), '..', '..', 'docs', 'legal', 'politica-de-privacidade.md'),
        ) ?? ler(() => join(process.cwd(), 'docs', 'legal', 'politica-de-privacidade.md')));
  if (texto === null) throw new Error(`Texto legal não encontrado: docs/legal/${nome}.md`);
  return texto;
}
