import type { ReactNode } from 'react';
import { SessionProvider } from '../lib/auth/session-provider';
import '../styles/tokens.css';
import '../styles/globals.css';

export const metadata = {
  title: 'O Gado',
  description: 'Gestão de pecuária: Compra e Venda e Recria',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
