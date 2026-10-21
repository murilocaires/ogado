import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaBootstrap } from '../components/PwaBootstrap';
import '../styles/tokens.css';
import '../styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://bovaro.com.br'),
  title: 'Bovaro',
  description: 'Gestão de pecuária: Compra e Venda e Recria',
  applicationName: 'Bovaro',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Bovaro', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#08241a',
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
        <PwaBootstrap />
        {children}
      </body>
    </html>
  );
}
