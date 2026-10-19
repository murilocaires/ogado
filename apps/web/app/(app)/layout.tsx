import type { ReactNode } from 'react';
import { AppProviders } from '../../components/AppProviders';
import { SessionProvider } from '../../lib/auth/session-provider';
import { AppShell } from '../../components/AppShell';
import '../../styles/app.css';

export default function ProdutoLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppProviders>
        <AppShell>{children}</AppShell>
      </AppProviders>
    </SessionProvider>
  );
}
