import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { criarRepoLocal } from '../lib/repo/local-repo';
import type { BovaroRepo } from '../lib/repo/types';
import { AppProviders } from './AppProviders';

/** Storage em memória (a mesma interface do localStorage) para os testes. */
export function criarStorageMemoria(inicial: Record<string, string> = {}): Storage {
  const dados = new Map(Object.entries(inicial));
  return {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (k) => dados.get(k) ?? null,
    key: (i) => Array.from(dados.keys())[i] ?? null,
    removeItem: (k) => {
      dados.delete(k);
    },
    setItem: (k, v) => {
      dados.set(k, String(v));
    },
  };
}

export function renderComApp(ui: ReactElement, repo?: BovaroRepo) {
  const repoUsado = repo ?? criarRepoLocal({ storage: () => criarStorageMemoria() });
  return { repo: repoUsado, ...render(<AppProviders repo={repoUsado}>{ui}</AppProviders>) };
}
