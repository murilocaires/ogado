'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSessionState } from '../lib/auth/session-provider';

/** Só para os e2e locais da E1/E2, que rodam sem API (`playwright.local.config.ts`). */
const ACESSO_LIVRE = process.env['NEXT_PUBLIC_ACESSO_LIVRE'] === '1';

/**
 * Barreira das telas do produto: sem sessão, vai para /entrar. Sessão expirada também (os dados
 * ficam no aparelho e voltam após entrar de novo, RF-080). Sem internet e sem poder verificar, deixa
 * usar com a identidade já conhecida no aparelho.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sessao = useSessionState();
  const bloqueada = sessao.status === 'anonimo' || sessao.status === 'expirada';

  useEffect(() => {
    if (!ACESSO_LIVRE && bloqueada) router.replace('/entrar');
  }, [bloqueada, router]);

  if (ACESSO_LIVRE) return <>{children}</>;
  if (sessao.status === 'verificando' || bloqueada) {
    return (
      <main className="shell">
        <p role="status">Verificando sua sessão…</p>
      </main>
    );
  }
  return <>{children}</>;
}
