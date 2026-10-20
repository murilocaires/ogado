// E5-A: pendências, conflitos, itens recusados e integridade com a rede cortada (RF-074…RF-080, RNF-017).
import { describe, expect, it } from 'vitest';
import type { DadosClient, DadosResult } from './data-client';
import { contarPendentes, pendentes, sincronizar } from './engine';
import { aparelho, COMPRA, cenario, criarServidor } from './engine.test-support';

type Servidor = ReturnType<typeof criarServidor>;
type Aparelho = ReturnType<typeof aparelho>;

const rodar = (ap: Aparelho, api: DadosClient) => sincronizar({ ...ap, api, usuarioId: 'u1' });
const versoesDe = (ap: Aparelho): Record<string, number> => ap.estado.atual?.versoes ?? {};
const pendentesDe = (ap: Aparelho): number => contarPendentes(ap.repo.exportar(), versoesDe(ap));

/** Dois aparelhos com o mesmo lote já sincronizado nos dois. */
async function doisAparelhosComLote(srv: Servidor) {
  const a = aparelho();
  const lote = a.repo.salvarLote(COMPRA);
  await rodar(a, srv.api);
  const b = aparelho();
  await rodar(b, srv.api);
  return { a, b, id: lote.id };
}

const qtdLocal = (ap: Aparelho, id: string) =>
  ap.repo.exportar().lotes.find((l) => l.id === id)?.qtd;

describe('pendentes (RF-075)', () => {
  it('conta version diferente da última sincronizada, ausente do controle e exclusões', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const l1 = a.repo.salvarLote(COMPRA);
    const c1 = a.repo.salvarCenario(cenario());

    // Nada sincronizado ainda: lote e cenário ausentes do controle (a recria intocada não conta).
    expect(
      pendentes(a.repo.exportar(), {})
        .map((p) => p.tipo)
        .sort(),
    ).toEqual(['cenario', 'lote']);

    await rodar(a, srv.api);
    expect(pendentesDe(a)).toBe(0);

    a.repo.salvarLote({ ...COMPRA, id: l1.id, qtd: '11' });
    expect(pendentes(a.repo.exportar(), versoesDe(a))).toEqual([{ tipo: 'lote', id: l1.id }]);

    a.repo.excluirCenario(c1.id);
    expect(pendentesDe(a)).toBe(2);

    await rodar(a, srv.api);
    expect(pendentesDe(a)).toBe(0);
  });

  it('lote criado e excluído antes de subir deixa de contar depois da rodada', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const l = a.repo.salvarLote(COMPRA);
    a.repo.excluirLote(l.id);
    await rodar(a, srv.api);
    expect(srv.lotes.size).toBe(0);
    expect(pendentesDe(a)).toBe(0);
  });
});

describe('resolucao automatica entre aparelhos', () => {
  it('combina quantidade e preco alterados em aparelhos diferentes', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, preco: '400' });
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.lotes.get(id)).toMatchObject({ qtd: '50', preco: '400' });
    expect(a.estado.atual?.conflitos).toEqual([]);
    expect(pendentesDe(a)).toBe(0);
    expect([...srv.historico.values()][0]?.servidor['qtd']).toBe('50');
    await rodar(b, srv.api);
    expect(b.repo.exportar().lotes[0]).toMatchObject({ qtd: '50', preco: '400' });
  });
  it('mesmo campo: vence o ultimo envio e preserva as duas versoes no servidor', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    await rodar(a, srv.api);
    expect(srv.lotes.get(id)?.qtd).toBe('99');
    expect(qtdLocal(a, id)).toBe('99');
    const h = [...srv.historico.values()][0]!;
    expect(h.local['qtd']).toBe('99');
    expect(h.servidor['qtd']).toBe('50');
    expect(h.resultado['qtd']).toBe('99');
  });
  it('uma corrida com 409 refaz a mesclagem com a versao atual', async () => {
    const srv = criarServidor();
    const { a, id } = await doisAparelhosComLote(srv);
    a.repo.salvarLote({ ...COMPRA, id, preco: '400' });
    let corrida = true;
    const api: DadosClient = {
      ...srv.api,
      alterarLote: async (lid, body) => {
        if (corrida) {
          corrida = false;
          await srv.api.alterarLote(lid, { version: 1, qtd: '50' });
        }
        return srv.api.alterarLote(lid, body);
      },
    };
    expect(await rodar(a, api)).toBe('ok');
    expect(srv.lotes.get(id)).toMatchObject({ qtd: '50', preco: '400' });
    expect(a.estado.atual?.conflitos).toEqual([]);
  });
  it('exclusao remota vence edicao e arquiva o trabalho local sem criar copia', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.excluirLote(id);
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    await rodar(a, srv.api);
    expect(srv.lotes.size).toBe(1);
    expect(a.repo.exportar().lotes[0]?.deletedAt).not.toBeNull();
    expect([...srv.historico.values()][0]?.local['qtd']).toBe('99');
    expect([...srv.historico.values()][0]?.motivo).toBe('exclusao');
    expect(pendentesDe(a)).toBe(0);
  });
  it('exclusao local vence edicao remota e preserva a versao substituida', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.excluirLote(id);
    await rodar(a, srv.api);
    expect(srv.lotes.get(id)?.deletedAt).not.toBeNull();
    expect([...srv.historico.values()][0]?.servidor['qtd']).toBe('50');
  });
  it('renomeacao de cenario tambem e automatica', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const c = a.repo.salvarCenario(cenario());
    await rodar(a, srv.api);
    const b = aparelho();
    await rodar(b, srv.api);
    b.repo.renomearCenario(c.id, 'Nome B');
    await rodar(b, srv.api);
    a.repo.renomearCenario(c.id, 'Nome A');
    await rodar(a, srv.api);
    expect(srv.cenarios.get(c.id)?.nome).toBe('Nome A');
    expect([...srv.historico.values()][0]?.servidor['nome']).toBe('Nome B');
    expect(a.estado.atual?.conflitos).toEqual([]);
  });
  it('nao substitui valores se o historico nao puder ser gravado', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    expect(
      await rodar(a, { ...srv.api, arquivarHistorico: async () => ({ ok: false, kind: 'rede' }) }),
    ).toBe('rede');
    expect(srv.lotes.get(id)?.qtd).toBe('50');
    expect(qtdLocal(a, id)).toBe('99');
    expect(a.estado.atual?.historicoPendente).toHaveLength(1);
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.lotes.get(id)?.qtd).toBe('99');
  });
  it('resposta do arquivo perdida: reenvia o mesmo evento sem duplicacao', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    await rodar(a, {
      ...srv.api,
      arquivarHistorico: async (h) => {
        await srv.api.arquivarHistorico(h);
        return { ok: false, kind: 'rede' };
      },
    });
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.historico.size).toBe(1);
    expect(srv.lotes.get(id)?.qtd).toBe('99');
  });
  it('legado sem base: preserva o servidor no historico antes de aceitar o local', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    a.estado.gravar({
      usuarioId: 'u1',
      versoes: a.estado.atual!.versoes,
      conflitos: [
        {
          tipo: 'lote',
          id,
          motivo: 'alterado',
          acao: 'editar',
          versaoLocal: 2,
          atual: srv.lotes.get(id),
          detectadoEm: '2026-10-19T12:00:00.000Z',
        },
      ],
    });
    await rodar(a, srv.api);
    expect(srv.lotes.get(id)?.qtd).toBe('99');
    expect([...srv.historico.values()][0]?.motivo).toBe('sem-base');
    expect(a.estado.atual?.conflitos).toEqual([]);
  });
  it('edicao durante o envio conserva campos remotos sem reenvia-los como locais', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, preco: '400' });
    let editar = true;
    const api: DadosClient = {
      ...srv.api,
      alterarLote: async (lid, body) => {
        const r = await srv.api.alterarLote(lid, body);
        if (editar) {
          editar = false;
          a.repo.salvarLote({ ...COMPRA, id, preco: '450' });
        }
        return r;
      },
    };
    await rodar(a, api);
    expect(a.repo.exportar().lotes[0]).toMatchObject({ qtd: '50', preco: '450' });
    await rodar(a, srv.api);
    expect(srv.lotes.get(id)).toMatchObject({ qtd: '50', preco: '450' });
  });
});

describe('preservacao do arquivo pendente', () => {
  it('arquiva a versao anterior mesmo se os dados convergirem antes da nova tentativa', async () => {
    const srv = criarServidor();
    const { a, b, id } = await doisAparelhosComLote(srv);
    b.repo.salvarLote({ ...COMPRA, id, qtd: '50' });
    await rodar(b, srv.api);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    await rodar(a, { ...srv.api, arquivarHistorico: async () => ({ ok: false, kind: 'rede' }) });
    const remoto = srv.lotes.get(id)!;
    await srv.api.alterarLote(id, { version: remoto.version, qtd: '99' });
    expect(await rodar(a, srv.api)).toBe('ok');
    expect([...srv.historico.values()][0]?.servidor['qtd']).toBe('50');
    expect(a.estado.atual?.historicoPendente).toEqual([]);
  });
});

describe('corridas durante a resolucao automatica', () => {
  it('exclusao entre GET e PATCH e reconhecida sem recriar o lote', async () => {
    const srv = criarServidor();
    const { a, id } = await doisAparelhosComLote(srv);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    const api: DadosClient = {
      ...srv.api,
      alterarLote: async (lid, body) => {
        await srv.api.excluirLote(lid, body.version);
        return { ok: false, kind: 'nao-encontrado' };
      },
    };
    expect(await rodar(a, api)).toBe('ok');
    expect(a.repo.exportar().lotes[0]?.deletedAt).not.toBeNull();
    expect(srv.lotes.size).toBe(1);
    expect([...srv.historico.values()][0]?.local['qtd']).toBe('99');
  });
  it('concorrencia continua fica pendente e tenta novamente sem pedir uma escolha', async () => {
    const srv = criarServidor();
    const { a, id } = await doisAparelhosComLote(srv);
    a.repo.salvarLote({ ...COMPRA, id, qtd: '99' });
    let tentativas = 0;
    const api: DadosClient = {
      ...srv.api,
      alterarLote: async () => {
        tentativas++;
        return { ok: false, kind: 'conflito', atual: srv.lotes.get(id) };
      },
    };
    expect(await rodar(a, api)).toBe('erro');
    expect(tentativas).toBe(5);
    expect(qtdLocal(a, id)).toBe('99');
    expect(a.estado.atual?.conflitos).toEqual([]);
    expect(pendentesDe(a)).toBe(1);
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.lotes.get(id)?.qtd).toBe('99');
  });
});

describe('item recusado pelo servidor (RF-079)', () => {
  function recusando(srv: Servidor, qtdRuim: string): DadosClient {
    return {
      ...srv.api,
      criarLote: async (body) =>
        body.qtd === qtdRuim
          ? {
              ok: false,
              kind: 'validacao',
              mensagem: 'Confira os campos informados.',
              campos: [{ caminho: 'qtd', mensagem: 'Informe uma quantidade válida.' }],
            }
          : srv.api.criarLote(body),
    };
  }

  it('vai para "precisa de atenção" com o motivo em pt-BR e não trava as outras entidades', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const ruim = a.repo.salvarLote({ ...COMPRA, qtd: '1' });
    const boa = a.repo.salvarLote({ ...COMPRA, qtd: '5' });
    a.repo.salvarCenario(cenario());

    expect(await rodar(a, recusando(srv, '1'))).toBe('ok');

    expect(srv.lotes.has(boa.id)).toBe(true);
    expect(srv.lotes.has(ruim.id)).toBe(false);
    expect(srv.cenarios.size).toBe(1);
    expect(a.estado.atual?.rejeitados).toEqual([
      expect.objectContaining({
        tipo: 'lote',
        id: ruim.id,
        motivo: 'Quantidade: Informe uma quantidade válida.',
      }),
    ]);
    // Nunca descarta: continua no aparelho e pendente.
    expect(a.repo.exportar().lotes.map((l) => l.id)).toContain(ruim.id);
    expect(pendentes(a.repo.exportar(), versoesDe(a))).toEqual([{ tipo: 'lote', id: ruim.id }]);
  });

  it('não reenvia o mesmo item recusado a cada rodada; corrigir tenta de novo e libera', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const ruim = a.repo.salvarLote({ ...COMPRA, qtd: '1' });
    const api = recusando(srv, '1');
    let tentativas = 0;
    const contando: DadosClient = {
      ...api,
      criarLote: async (b) => {
        tentativas += 1;
        return api.criarLote(b);
      },
    };
    await rodar(a, contando);
    await rodar(a, contando);
    expect(tentativas).toBe(1);

    a.repo.salvarLote({ ...COMPRA, id: ruim.id, qtd: '2' });
    await rodar(a, contando);

    expect(srv.lotes.get(ruim.id)?.qtd).toBe('2');
    expect(a.estado.atual?.rejeitados).toEqual([]);
  });

  it('excluir o item recusado o tira da lista sem enviar nada', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const ruim = a.repo.salvarLote({ ...COMPRA, qtd: '1' });
    await rodar(a, recusando(srv, '1'));

    a.repo.excluirLote(ruim.id);
    await rodar(a, recusando(srv, '1'));

    expect(a.estado.atual?.rejeitados).toEqual([]);
    expect(srv.lotes.size).toBe(0);
    expect(pendentesDe(a)).toBe(0);
  });

  it('contrato inválido (400 sem campos) também é recusado com um motivo, não descartado', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const l = a.repo.salvarLote(COMPRA);
    const api: DadosClient = {
      ...srv.api,
      criarLote: async () => ({ ok: false, kind: 'contrato' }),
    };

    expect(await rodar(a, api)).toBe('ok');

    expect(a.estado.atual?.rejeitados?.[0]).toMatchObject({ id: l.id });
    expect(a.estado.atual?.rejeitados?.[0]?.motivo).toMatch(/servidor não aceitou/);
  });

  it('recusa na edição de um lote já na nuvem também é registrada', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const l = a.repo.salvarLote(COMPRA);
    await rodar(a, srv.api);
    a.repo.salvarLote({ ...COMPRA, id: l.id, qtd: '-1' });
    const api: DadosClient = {
      ...srv.api,
      alterarLote: async () => ({
        ok: false,
        kind: 'validacao',
        mensagem: 'Confira os campos informados.',
        campos: [{ caminho: 'qtd', mensagem: 'Valor inválido.' }],
      }),
    };
    await rodar(a, api);
    expect(a.estado.atual?.rejeitados?.[0]).toMatchObject({ id: l.id, versaoLocal: 2 });
  });
});

describe('integridade com a rede cortada (RNF-017)', () => {
  /** Falha a N-ésima escrita; `depois` = o servidor chegou a gravar, mas a resposta se perdeu. */
  function cortando(srv: Servidor, n: number, depois: boolean): DadosClient {
    let escritas = 0;
    const escrever =
      <A extends unknown[], R>(f: (...a: A) => Promise<DadosResult<R>>) =>
      async (...args: A): Promise<DadosResult<R>> => {
        escritas += 1;
        if (escritas !== n) return f(...args);
        if (depois) await f(...args);
        return { ok: false, kind: 'rede' };
      };
    const { api } = srv;
    return {
      ...api,
      criarLote: escrever(api.criarLote),
      alterarLote: escrever(api.alterarLote),
      excluirLote: escrever(api.excluirLote),
      criarCenario: escrever(api.criarCenario),
      renomearCenario: escrever(api.renomearCenario),
      excluirCenario: escrever(api.excluirCenario),
      gravarRecria: escrever(api.gravarRecria),
    };
  }

  // 2 lotes + 1 cenário = 3 escritas; o corte 4 nunca dispara (rodada completa). A recria é rascunho e não sincroniza.
  for (const depois of [false, true]) {
    for (let n = 1; n <= 3; n += 1) {
      it(`corte na escrita ${n} (${depois ? 'servidor gravou' : 'antes de gravar'}): a rodada seguinte não perde nem duplica`, async () => {
        const srv = criarServidor();
        const a = aparelho();
        const l1 = a.repo.salvarLote(COMPRA);
        const l2 = a.repo.salvarLote({ ...COMPRA, qtd: '20' });
        const c = a.repo.salvarCenario(cenario());

        expect(await rodar(a, cortando(srv, n, depois))).toBe('rede');
        expect(await rodar(a, srv.api)).toBe('ok');
        expect(await rodar(a, srv.api)).toBe('ok');

        expect([...srv.lotes.keys()].sort()).toEqual([l1.id, l2.id].sort());
        expect([...srv.cenarios.keys()]).toEqual([c.id]);
        const locais = a.repo.exportar();
        expect(locais.lotes).toHaveLength(2);
        expect(locais.lotes.map((l) => l.numero).sort()).toEqual([1, 2]);
        expect(a.estado.atual?.conflitos ?? []).toEqual([]);
        expect(a.estado.atual?.rejeitados ?? []).toEqual([]);
        expect(pendentesDe(a)).toBe(0);
      });
    }
  }

  for (const depois of [false, true]) {
    for (let n = 1; n <= 3; n += 1) {
      it(`edição, exclusão e renomeação com corte na escrita ${n} (${depois ? 'servidor gravou' : 'antes de gravar'}): sem conflito falso nem perda`, async () => {
        const srv = criarServidor();
        const a = aparelho();
        const l1 = a.repo.salvarLote(COMPRA);
        const l2 = a.repo.salvarLote({ ...COMPRA, qtd: '20' });
        const c = a.repo.salvarCenario(cenario());
        await rodar(a, srv.api);

        a.repo.salvarLote({ ...COMPRA, id: l1.id, qtd: '11' });
        a.repo.excluirLote(l2.id);
        a.repo.renomearCenario(c.id, 'Outro');
        expect(await rodar(a, cortando(srv, n, depois))).toBe('rede');
        expect(await rodar(a, srv.api)).toBe('ok');

        expect(srv.lotes.get(l1.id)?.qtd).toBe('11');
        expect(srv.lotes.get(l2.id)?.deletedAt).not.toBeNull();
        expect(srv.cenarios.get(c.id)?.nome).toBe('Outro');
        expect(a.estado.atual?.conflitos ?? []).toEqual([]);
        expect(pendentesDe(a)).toBe(0);
      });
    }
  }

  it('listagem cortada no meio da rodada não altera nem perde nada do aparelho', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const lote = a.repo.salvarLote(COMPRA);
    const api: DadosClient = {
      ...srv.api,
      listarCenarios: async () => ({ ok: false, kind: 'rede' }),
    };

    expect(await rodar(a, api)).toBe('rede');

    expect(srv.lotes.size).toBe(1); // o que veio antes do corte foi enviado
    expect(a.repo.exportar().lotes.map((l) => l.id)).toEqual([lote.id]);
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.lotes.size).toBe(1);
  });

  it('edição feita durante o envio não é atropelada pela resposta do servidor', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const l = a.repo.salvarLote(COMPRA);
    await rodar(a, srv.api);
    a.repo.salvarLote({ ...COMPRA, id: l.id, qtd: '20' });

    const api: DadosClient = {
      ...srv.api,
      alterarLote: async (id, body) => {
        const r = await srv.api.alterarLote(id, body);
        // o produtor edita de novo enquanto a resposta ainda está a caminho
        a.repo.salvarLote({ ...COMPRA, id: l.id, qtd: '30' });
        return r;
      },
    };
    await rodar(a, api);
    expect(qtdLocal(a, l.id)).toBe('30');
    expect(pendentesDe(a)).toBe(1);

    await rodar(a, srv.api);
    expect(srv.lotes.get(l.id)?.qtd).toBe('30');
    expect(pendentesDe(a)).toBe(0);
  });
});

describe('sessão expirada (RF-080)', () => {
  it('a fila sobrevive a expirar e a entrar de novo: nada se perde e tudo sobe', async () => {
    const srv = criarServidor();
    const a = aparelho();
    await rodar(a, srv.api);
    const lote = a.repo.salvarLote(COMPRA);
    const expirada: DadosClient = {
      ...srv.api,
      listarLotes: async () => ({ ok: false, kind: 'nao-autenticado' }),
    };

    expect(await rodar(a, expirada)).toBe('nao-autenticado');
    expect(a.repo.exportar().lotes.map((l) => l.id)).toEqual([lote.id]);
    expect(pendentesDe(a)).toBe(1);
    expect(srv.lotes.size).toBe(0);

    // Entrou de novo (mesmo usuário): a fila sobe.
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.lotes.has(lote.id)).toBe(true);
    expect(pendentesDe(a)).toBe(0);
  });

  it('401 no meio da rodada preserva o que já foi confirmado e o que falta', async () => {
    const srv = criarServidor();
    const a = aparelho();
    a.repo.salvarLote(COMPRA);
    a.repo.salvarCenario(cenario());
    const api: DadosClient = {
      ...srv.api,
      criarCenario: async () => ({ ok: false, kind: 'nao-autenticado' }),
    };

    expect(await rodar(a, api)).toBe('nao-autenticado');
    expect(srv.lotes.size).toBe(1);
    expect(pendentesDe(a)).toBe(1);
    expect(await rodar(a, srv.api)).toBe('ok');
    expect(srv.cenarios.size).toBe(1);
  });
});
