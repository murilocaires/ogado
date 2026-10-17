import type { ReactNode } from 'react';

export const metadata = {
  title: 'O Gado',
  description: 'Gestão de pecuária: Compra e Venda e Recria',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        {children}
      </body>
    </html>
  );
}
