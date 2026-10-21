import { describe, expect, it } from 'vitest';
import { criarDadosClient } from './data-client';

function clienteCom(status: number, corpo: unknown) {
  return criarDadosClient({
    baseUrl: '/api',
    fetch: async () =>
      new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status }),
  });
}

const CORPO_LOTE = {
  id: '00000000-0000-4000-8000-000000000001',
  tipo: 'compra',
  categoria: 'BEZERRO',
  data: null,
  modo: 'total',
  qtd: '0',
  peso: '0',
  pesos: [],
  preco: '0',
  base: 'vivo',
  aplicarDesconto: false,
  descontoKg: null,
};

describe('data-client: falhas', () => {
  it('RF-078/RNF-014 cada rodada captura seu usuário sem alterar outros clientes', async () => {
    const enviados: (string | null)[] = [];
    const api = criarDadosClient({
      fetch: async (_url, init) => {
        enviados.push(new Headers(init?.headers).get('x-bovaro-usuario'));
        return new Response(JSON.stringify({ lotes: [] }), { status: 200 });
      },
    });
    const a = api.paraUsuario!('usuario-a');
    const b = api.paraUsuario!('usuario-b');
    await a.listarLotes();
    await b.listarLotes();
    await a.listarLotes();
    await api.listarLotes();
    expect(enviados).toEqual(['usuario-a', 'usuario-b', 'usuario-a', null]);
  });

  it('400 validacao_invalida expõe os campos recusados em vez de "contrato"', async () => {
    const api = clienteCom(400, {
      erro: {
        codigo: 'validacao_invalida',
        mensagem: 'Confira os campos informados.',
        campos: [{ caminho: 'qtd', regra: 'min', mensagem: 'Informe uma quantidade válida.' }],
      },
    });
    const r = await api.criarLote(CORPO_LOTE as never);
    expect(r).toEqual({
      ok: false,
      kind: 'validacao',
      mensagem: 'Confira os campos informados.',
      campos: [{ caminho: 'qtd', mensagem: 'Informe uma quantidade válida.' }],
    });
  });

  it('400 de outro tipo e corpo ilegível continuam "contrato"', async () => {
    const outro = clienteCom(400, { erro: { codigo: 'requisicao_invalida', mensagem: 'x' } });
    expect(await outro.criarLote(CORPO_LOTE as never)).toEqual({ ok: false, kind: 'contrato' });
    const ilegivel = clienteCom(400, 'não é json');
    expect(await ilegivel.criarLote(CORPO_LOTE as never)).toEqual({ ok: false, kind: 'contrato' });
  });

  it('429 e 5xx são transitórios ("servidor"), nunca rejeitam o item', async () => {
    expect(await clienteCom(429, {}).criarLote(CORPO_LOTE as never)).toMatchObject({
      kind: 'servidor',
    });
    expect(await clienteCom(503, {}).criarLote(CORPO_LOTE as never)).toMatchObject({
      kind: 'servidor',
    });
  });

  it('409 traz o estado atual do servidor', async () => {
    const r = await clienteCom(409, {
      erro: { codigo: 'conflito', mensagem: 'x' },
      atual: { a: 1 },
    }).alterarLote('id', { version: 1 } as never);
    expect(r).toEqual({ ok: false, kind: 'conflito', atual: { a: 1 } });
  });
});
describe('RF-074: compatibilidade durante atualização da API', () => {
  it.each(['lotes', 'cenarios'] as const)(
    'sincroniza %s com API anterior sem paginação',
    async (tipo) => {
      const urls: string[] = [];
      const api = criarDadosClient({
        fetch: async (url) => {
          urls.push(String(url));
          return String(url).includes('incremental=')
            ? new Response(
                JSON.stringify({
                  erro: {
                    codigo: 'validacao_invalida',
                    mensagem: 'Confira os campos informados.',
                    campos: [
                      {
                        caminho: '',
                        regra: 'unrecognized_keys',
                        mensagem: 'Unrecognized keys: incremental, limit',
                      },
                    ],
                  },
                }),
                { status: 400 },
              )
            : new Response(JSON.stringify({ [tipo]: [] }), { status: 200 });
        },
      }).paraUsuario!('usuario-teste');
      const pagina = tipo === 'lotes' ? api.paginaLotes! : api.paginaCenarios!;

      expect(await pagina({ updatedAt: '2026-10-20T12:00:00.000Z', id: CORPO_LOTE.id })).toEqual({
        ok: true,
        created: false,
        data: { itens: [], proximoCursor: null },
      });
      expect(urls).toHaveLength(2);
      expect(urls[1]).toBe(`/api/${tipo}?incluirExcluidos=true`);
    },
  );
});
