import type { ReactNode } from 'react';
import { AppProviders } from '../../components/AppProviders';
import { AppShell } from '../../components/AppShell';
import '../../styles/app.css';

export default function ProdutoLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
