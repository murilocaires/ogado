'use client';

import type { ReactNode } from 'react';
import { RepoProvider } from '../lib/repo/repo-provider';
import type { OGadoRepo } from '../lib/repo/types';
import { ToastProvider } from './Toast';

export function AppProviders({ children, repo }: { children: ReactNode; repo?: OGadoRepo }) {
  return (
    <RepoProvider repo={repo}>
      <ToastProvider>{children}</ToastProvider>
    </RepoProvider>
  );
}
