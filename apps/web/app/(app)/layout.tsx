import type { ReactNode } from 'react';
import { AppProviders } from '../../components/AppProviders';
import { SessionProvider } from '../../lib/auth/session-provider';
import { RequireSession } from '../../components/RequireSession';
import { AppShell } from '../../components/AppShell';
import '../../styles/app.css';

export default function ProdutoLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <RequireSession>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </RequireSession>
    </SessionProvider>
  );
}
