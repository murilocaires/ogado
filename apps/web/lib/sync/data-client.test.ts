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
