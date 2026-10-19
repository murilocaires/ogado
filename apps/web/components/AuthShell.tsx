import type { ReactNode } from 'react';
import { LogoMark, Wordmark } from './Logo';

/** Moldura comum das telas públicas de conta: painel da marca e coluna do formulário. */
export function AuthShell({ mobileTitle, children }: { mobileTitle: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="stripes" />
        <div className="ring ring-1" />
        <div className="ring ring-2" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <LogoMark />
          <Wordmark />
        </div>
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <h2 className="disp">Cada arroba na ponta do lápis.</h2>
          <p>Suas planilhas de compra, venda, cria e recria, agora no computador e no celular.</p>
        </div>
        <div style={{ position: 'relative', fontSize: 13, color: 'var(--nevoa-300)' }}>
          Cria · Recria · Compra e Venda
        </div>
      </section>

      <div className="auth-mobile-head">
        <LogoMark />
        <div className="title disp">{mobileTitle}</div>
      </div>

      <main className="auth-main">{children}</main>
    </div>
  );
}
