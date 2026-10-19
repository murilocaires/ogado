'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';
import { useOptionalSessionController } from '../lib/auth/session-provider';
import { useRepoState } from '../lib/repo/repo-provider';
import { Icon, type IconName } from './Icon';
import { InstalarApp } from './InstalarApp';
import { LogoMark } from './Logo';
import { useSyncStatus, type SyncStatus } from './SyncProvider';

const ITENS: { href: string; rotulo: string; icone: IconName }[] = [
  { href: '/painel', rotulo: 'Painel', icone: 'home' },
  { href: '/negocios', rotulo: 'Negócios', icone: 'swap' },
  { href: '/recria', rotulo: 'Recria', icone: 'calc' },
  { href: '/conta', rotulo: 'Conta', icone: 'user' },
];

function assinarRede(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    assinarRede,
    () => navigator.onLine,
    () => true,
  );
}

const TEXTO_SYNC: Record<SyncStatus, string> = {
  desligado: 'Seus dados ficam salvos neste navegador.',
  sincronizando: 'Sincronizando com a nuvem…',
  sincronizado: 'Dados salvos na sua conta.',
  offline: 'Sem conexão: salvo neste aparelho, sobe quando voltar.',
  erro: 'Não foi possível sincronizar agora. Tentaremos de novo.',
};

/** Navegação lateral (desktop) e barra inferior (< 900 px); item ativo com `aria-current` (RF-053). */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const online = useOnline();
  const dados = useRepoState();
  const sync = useSyncStatus();
  const comConta = useOptionalSessionController() !== null;
  const ativo = (href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="app">
      <a href="#conteudo" className="skip">
        Pular para o conteúdo
      </a>
      <div className="app-shell">
        <aside className="app-side">
          <div className="brand">
            <LogoMark size={40} />
            <b>O Gado</b>
          </div>
          <nav className="nav" aria-label="Principal">
            {ITENS.map((i) => (
              <Link key={i.href} href={i.href} aria-current={ativo(i.href) ? 'page' : undefined}>
                <Icon name={i.icone} />
                {i.rotulo}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <div className="tagline">Cada arroba na ponta do lápis.</div>
            <span role="status">{TEXTO_SYNC[sync]}</span>
            {comConta && sync === 'desligado' && (
              <div>
                <Link href="/entrar">Entrar para guardar na nuvem</Link>
              </div>
            )}
            <InstalarApp className="btn ghost sm block" />
          </div>
        </aside>
        <main id="conteudo" className="app-main" tabIndex={-1}>
          {!online && (
            <div className="note banner" role="status">
              Você está sem internet. Pode continuar: tudo funciona e fica salvo neste aparelho.
            </div>
          )}
          {dados.status === 'pronto' && dados.persistencia === 'indisponivel' && (
            <div className="note erro banner" role="alert">
              Este navegador não está deixando salvar os dados (modo privado ou armazenamento
              bloqueado). Você pode usar normalmente, mas o que digitar se perde ao fechar a aba.
            </div>
          )}
          {children}
        </main>
        <nav className="bottom" aria-label="Principal">
          {ITENS.map((i) => (
            <Link key={i.href} href={i.href} aria-current={ativo(i.href) ? 'page' : undefined}>
              <span>
                <Icon name={i.icone} />
              </span>
              {i.rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  titulo,
  sub,
  acoes,
}: {
  titulo: string;
  sub?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="top">
      <div>
        <h1>{titulo}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {acoes && <div className="top-actions">{acoes}</div>}
    </div>
  );
}

/** Estado "carregando" enquanto o navegador lê os dados salvos. */
export function Carregando() {
  return (
    <div role="status" aria-live="polite">
      <div className="skeleton" aria-hidden="true" />
      <span className="sr-only">Carregando seus dados…</span>
    </div>
  );
}
