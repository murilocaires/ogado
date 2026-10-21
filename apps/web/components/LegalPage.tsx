import Link from 'next/link';
import { LogoMark, Wordmark } from './Logo';
import { MarkdownView } from '../lib/legal/markdown';

export type LegalAtual = 'termos' | 'privacidade';

/** Moldura das páginas públicas /termos e /privacidade (sem sessão, sem API). */
export function LegalPage({ atual, markdown }: { atual: LegalAtual; markdown: string }) {
  return (
    <div className="legal-page">
      <header className="legal-head">
        <Link href="/" aria-label="Bovaro, ir para o início">
          <LogoMark size={36} />
          <Wordmark size={24} />
        </Link>
        <nav aria-label="Documentos legais">
          <Link href="/termos" aria-current={atual === 'termos' ? 'page' : undefined}>
            Termos de Uso
          </Link>
          <Link href="/privacidade" aria-current={atual === 'privacidade' ? 'page' : undefined}>
            Política de Privacidade
          </Link>
        </nav>
      </header>
      <main id="conteudo" className="legal-doc">
        <MarkdownView markdown={markdown} />
      </main>
      <footer className="legal-foot">
        <Link href="/entrar">Entrar</Link>
        <Link href="/cadastrar">Criar conta</Link>
      </footer>
    </div>
  );
}
