import type { ReactNode } from 'react';
import { SessionProvider } from '../../lib/auth/session-provider';

/** Só as telas de conta falam com a API (E3). O produto da E1 não verifica sessão. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
