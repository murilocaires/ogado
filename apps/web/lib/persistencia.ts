import type { BovaroRepo } from './repo/types';

/** RF-073/RNF-017: o sucesso da UI só é anunciado após a confirmação no aparelho. */
export async function aguardarGravacao(repo: BovaroRepo): Promise<void> {
  if ('flush' in repo && typeof repo.flush === 'function') await repo.flush();
  const state = repo.getSnapshot();
  if (state.status === 'pronto' && state.persistencia === 'indisponivel')
    throw new Error('persistencia_indisponivel');
}
