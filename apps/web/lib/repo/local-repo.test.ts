import { describe, expect, it } from 'vitest';
import { criarStorageMemoria } from '../../components/test-utils';
import { snapshotDaRecria } from '../cenarios';
import { criarRepoLocal, recriaFormPadrao, STORAGE_KEY, STORAGE_KEY_E1 } from './local-repo';
import type { LoteSalvar, RecriaEntity } from './types';

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

function recriaPadraoEntidade(): RecriaEntity {
  return {
    id: 'r-1',
    version: 1,
    updatedAt: '2026-10-18T10:00:00.000Z',
    deletedAt: null,
    form: recriaFormPadrao(),
    lotacaoInicial: 'fixa80',
  };
}

function snapshotPadrao(nome = 'Base') {
  const s = snapshotDaRecria(recriaPadraoEntidade(), nome);
  if (!s) throw new Error('snapshot indefinido');
  return s;
}

describe('RF-032 cenários no repositório (snapshot, RN-023)', () => {
  it('RF-032 salva com id UUID, version, updatedAt, deletedAt e data, e relê em outra instância', () => {
    const storage = criarStorageMemoria();
    const repo = criarRepoLocal({ storage: () => storage });
    const salvo = repo.salvarCenario(snapshotPadrao('Safra 26/27'));
    expect(salvo.id).toMatch(UUID);
    expect(salvo).toMatchObject({ nome: 'Safra 26/27', version: 1, deletedAt: null });
    expect(Date.parse(salvo.criadoEm)).not.toBeNaN();

    const snap = criarRepoLocal({ storage: () => storage }).getSnapshot();
    expect(snap.status === 'pronto' && snap.cenarios.map((c) => c.id)).toEqual([salvo.id]);
  });

  it('RN-023 guarda resultado do domínio como string decimal sem arredondar (ADR-0003)', () => {
    const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
    const salvo = repo.salvarCenario(snapshotPadrao());
    expect(salvo.resultado.faturamentoLiquido).toMatch(/^-?\d+\.\d{3,}$/);
    expect(salvo.resultado.faturamentoLiquido?.startsWith('102408.05')).toBe(true);
    expect(salvo.variantes).toEqual({ lotacaoInicial: 'fixa80', faturamentoBruto: 'pesoVivo' });
    expect(salvo.parametros).toEqual({
      arrobaVivoKg: '30',
      arrobaCarcacaKg: '15',
      uaKg: '450',
      lotacaoFixaHa: '80',
    });
    expect(salvo.form.precoVenda).toBe('325');
  });

  it('RN-023 mudar a recria depois não altera o cenário salvo', () => {
    const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
    const salvo = repo.salvarCenario(snapshotPadrao());
    repo.atualizarRecria({ form: { precoVenda: '999' }, lotacaoInicial: 'areaPastavel' });
    const snap = repo.getSnapshot();
    const guardado = snap.status === 'pronto' ? snap.cenarios[0] : undefined;
    expect(guardado?.form.precoVenda).toBe('325');
    expect(guardado?.variantes.lotacaoInicial).toBe('fixa80');
    expect(guardado?.resultado.faturamentoLiquido).toBe(salvo.resultado.faturamentoLiquido);
  });

  it('RF-032 nome vazio vira "Cenário N" e passa de 80 caracteres é cortado', () => {
    const repo = criarRepoLocal({ storage: () => criarStorageMemoria() });
    expect(repo.salvarCenario(snapshotPadrao('   ')).nome).toBe('Cenário 1');
    expect(repo.salvarCenario(snapshotPadrao('x'.repeat(120))).nome).toHaveLength(80);
  });

  it('RF-032 duplicar copia o snapshot como "… (cópia)"; renomear e excluir incrementam version', () => {
    const storage = criarStorageMemoria();
    const repo = criarRepoLocal({ storage: () => storage });
    const original = repo.salvarCenario(snapshotPadrao('Base'));
    const copia = repo.duplicarCenario(original.id);
    expect(copia).toMatchObject({ nome: 'Base (cópia)', version: 1 });
    expect(copia?.id).not.toBe(original.id);
    expect(copia?.resultado).toEqual(original.resultado);
    expect(repo.duplicarCenario('inexistente')).toBeNull();

    repo.renomearCenario(original.id, '  Novo nome ');
    repo.excluirCenario(original.id);
    const snap = repo.getSnapshot();
    expect(snap.status === 'pronto' && snap.cenarios.map((c) => c.nome)).toEqual(['Base (cópia)']);
    const guardado = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      cenarios: { id: string; nome: string; version: number; deletedAt: string | null }[];
    };
    const tombstone = guardado.cenarios.find((c) => c.id === original.id);
    expect(tombstone).toMatchObject({ nome: 'Novo nome', version: 3 });
    expect(tombstone?.deletedAt).not.toBeNull();
  });
});

describe('RNF-004 migração do storage da E1 para a E2', () => {
  const e1 = {
    schema: 1,
    lotes: [
      {
        id: 'l-1',
        version: 2,
        updatedAt: '2026-10-01T10:00:00.000Z',
        deletedAt: null,
        tipo: 'compra',
        numero: 1,
        categoria: 'BEZERROS',
        data: '2026-10-01',
        modo: 'total',
        qtd: '10',
        peso: '3000',
        pesos: [],
        preco: '300',
      },
    ],
    recria: { ...recriaPadraoEntidade(), id: 'r-e1', form: { ...recriaFormPadrao(), dias: '300' } },
  };

  it('RNF-004 lê a chave da E1 sem perder lotes nem a recria e passa a gravar na chave nova', () => {
    const storage = criarStorageMemoria({ [STORAGE_KEY_E1]: JSON.stringify(e1) });
    const repo = criarRepoLocal({ storage: () => storage });
    const snap = repo.getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes.map((l) => l.id)).toEqual(['l-1']);
    expect(snap.status === 'pronto' && snap.recria.form.dias).toBe('300');
    expect(snap.status === 'pronto' && snap.cenarios).toEqual([]);

    repo.salvarCenario(snapshotPadrao());
    const novo = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      schema: number;
      lotes: unknown[];
      cenarios: unknown[];
    };
    expect(novo.schema).toBe(2);
    expect(novo.lotes).toHaveLength(1);
    expect(novo.cenarios).toHaveLength(1);
    expect(storage.getItem(STORAGE_KEY_E1)).not.toBeNull(); // a cópia antiga fica de reserva
  });

  it('RNF-004 a chave nova tem prioridade sobre a antiga', () => {
    const storage = criarStorageMemoria({ [STORAGE_KEY_E1]: JSON.stringify(e1) });
    const primeira = criarRepoLocal({ storage: () => storage });
    primeira.excluirLote('l-1');
    const snap = criarRepoLocal({ storage: () => storage }).getSnapshot();
    expect(snap.status === 'pronto' && snap.lotes).toHaveLength(0);
  });

  it('RNF-004 leitura tolerante: cenário inválido é descartado, os demais ficam', () => {
    const base = criarRepoLocal({ storage: () => criarStorageMemoria() });
    const bom = base.salvarCenario(snapshotPadrao('Bom'));
    const storage = criarStorageMemoria({
      [STORAGE_KEY]: JSON.stringify({
        schema: 2,
        lotes: [],
        recria: recriaPadraoEntidade(),
        cenarios: [bom, { id: 'x', nome: 'quebrado' }, 42],
      }),
    });
    const snap = criarRepoLocal({ storage: () => storage }).getSnapshot();
    expect(snap.status === 'pronto' && snap.cenarios.map((c) => c.nome)).toEqual(['Bom']);
  });
});
