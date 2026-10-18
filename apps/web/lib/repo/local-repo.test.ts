import { describe, expect, it } from 'vitest';
import { criarStorageMemoria } from '../../components/test-utils';
import { criarRepoLocal, recriaFormPadrao, STORAGE_KEY } from './local-repo';
import type { LoteSalvar } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const compra: LoteSalvar = {
  tipo: 'compra',
  numero: 1,
  categoria: 'BEZERROS',
  data: '2026-10-01',
  modo: 'total',
  qtd: '10',
  peso: '3000',
  pesos: [],
  preco: '300',
};

function storageQuebrado(): Storage {
  const falha = (): never => {
    throw new DOMException('bloqueado', 'SecurityError');
  };
  return {
    length: 0,
    clear: falha,
    getItem: falha,
    key: falha,
    removeItem: falha,
    setItem: falha,
  };
}

describe('RF-020 repositório local (ADR-0007)', () => {
  it('RF-020 grava lote com id UUID, version, updatedAt e deletedAt e relê em outra instância', () => {
    const storage = criarStorageMemoria();
    const repo = criarRepoLocal({ storage: () => storage });
    const salvo = repo.salvarLote(compra);
    expect(salvo.id).toMatch(UUID);
    expect(salvo).toMatchObject({ version: 1, deletedAt: null });
    expect(Date.parse(salvo.updatedAt)).not.toBeNaN();

    const outra = criarRepoLocal({ storage: () => storage });
    const snap = outra.getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes.map((l) => l.id)).toEqual([salvo.id]);
  });

  it('RF-020 editar incrementa version; excluir vira tombstone e some da lista', () => {
    const storage = criarStorageMemoria();
    const repo = criarRepoLocal({ storage: () => storage });
    const v1 = repo.salvarLote(compra);
    const v2 = repo.salvarLote({ ...compra, id: v1.id, qtd: '12' });
    expect(v2.version).toBe(2);
    repo.excluirLote(v1.id);

    const snap = repo.getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes).toHaveLength(0);
    const guardado = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      lotes: { id: string; version: number; deletedAt: string | null }[];
    };
    expect(guardado.lotes[0]).toMatchObject({ id: v1.id, version: 3 });
    expect(guardado.lotes[0]?.deletedAt).not.toBeNull();
  });

  it('RNF-001 a recria abre com os padrões da planilha (percentuais em %)', () => {
    const snap = criarRepoLocal({ storage: () => criarStorageMemoria() }).getSnapshot();
    expect(snap.status === 'pronto' && snap.recria.form).toEqual(recriaFormPadrao());
    expect(recriaFormPadrao()).toMatchObject({
      investimento: '122534,8',
      consumoPct: '0,3',
      rendCarcaca: '52',
      imposto: '1,5',
      pesoIni: '188',
    });
  });

  it('RF-030 notifica quem assina e redefine a recria', () => {
    const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
    let chamadas = 0;
    const cancelar = repo.subscribe(() => {
      chamadas += 1;
    });
    repo.atualizarRecria({ form: { dias: '300' }, lotacaoInicial: 'areaPastavel' });
    repo.redefinirRecria('vazio');
    const snap = repo.getSnapshot();
    expect(chamadas).toBe(2);
    expect(snap.status === 'pronto' && snap.recria.form.dias).toBe('');
    expect(snap.status === 'pronto' && snap.recria.lotacaoInicial).toBe('fixa80');
    cancelar();
    repo.redefinirRecria('padrao');
    expect(chamadas).toBe(2);
  });
});

describe('RNF-004 storage indisponível não quebra', () => {
  it('RNF-004 storage que lança em toda chamada: segue em memória e avisa', () => {
    const repo = criarRepoLocal({ storage: () => storageQuebrado() });
    const antes = repo.getSnapshot();
    expect(antes.status === 'pronto' && antes.persistencia).toBe('indisponivel');

    const salvo = repo.salvarLote(compra);
    const depois = repo.getSnapshot();
    expect(depois.status === 'pronto' && depois.lotes.map((l) => l.id)).toEqual([salvo.id]);
    expect(() => repo.atualizarRecria({ form: { dias: '10' } })).not.toThrow();
  });

  it('RNF-004 sem storage (null) funciona em memória', () => {
    const repo = criarRepoLocal({ storage: () => null });
    expect(() => repo.salvarLote(compra)).not.toThrow();
    const snap = repo.getSnapshot();
    expect(snap.status === 'pronto' && snap.persistencia).toBe('indisponivel');
  });

  it('RNF-004 acesso ao storage que lança ao obtê-lo também não quebra', () => {
    const repo = criarRepoLocal({
      storage: () => {
        throw new Error('acesso negado');
      },
    });
    expect(repo.getSnapshot().status).toBe('pronto');
  });

  it('RNF-004 gravação que estoura a cota passa a avisar, sem perder o estado em memória', () => {
    const base = criarStorageMemoria();
    let cheio = false;
    const storage: Storage = {
      ...base,
      getItem: (k) => base.getItem(k),
      setItem: (k, v) => {
        if (cheio) throw new DOMException('cota', 'QuotaExceededError');
        base.setItem(k, v);
      },
    };
    const repo = criarRepoLocal({ storage: () => storage });
    repo.salvarLote(compra);
    cheio = true;
    repo.salvarLote({ ...compra, numero: 2 });
    const snap = repo.getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes).toHaveLength(2);
    expect(snap.status === 'pronto' && snap.persistencia).toBe('indisponivel');
  });

  it('RNF-004 conteúdo corrompido cai nos padrões e guarda uma cópia', () => {
    const storage = criarStorageMemoria({ [STORAGE_KEY]: '{isto não é json' });
    const snap = criarRepoLocal({ storage: () => storage }).getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes).toHaveLength(0);
    expect(storage.getItem(`${STORAGE_KEY}.corrompido`)).toBe('{isto não é json');
  });

  it('RNF-004 no servidor o snapshot é "carregando" (SSR-safe)', () => {
    const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
    expect(repo.getServerSnapshot()).toEqual({ status: 'carregando' });
  });
});
