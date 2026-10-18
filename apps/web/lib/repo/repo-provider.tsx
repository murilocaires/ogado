'use client';

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { criarRepoLocal } from './local-repo';
import type { OGadoRepo, RepoSnapshot } from './types';

const RepoContext = createContext<OGadoRepo | null>(null);

/** Entrega o repositório às telas. Em produção da E1 é o localStorage; testes injetam o seu. */
export function RepoProvider({ children, repo }: { children: ReactNode; repo?: OGadoRepo }) {
  const [valor] = useState<OGadoRepo>(() => repo ?? criarRepoLocal());
  return <RepoContext.Provider value={valor}>{children}</RepoContext.Provider>;
}

export function useRepo(): OGadoRepo {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('useRepo fora do RepoProvider');
  return repo;
}

/** Estado atual dos dados; `status: 'carregando'` no servidor e na hidratação. */
export function useRepoState(): RepoSnapshot {
  const repo = useRepo();
  return useSyncExternalStore(repo.subscribe, repo.getSnapshot, repo.getServerSnapshot);
}
