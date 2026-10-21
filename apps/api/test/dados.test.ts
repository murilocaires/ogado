import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cenarioConflictSchema,
  cenarioListResponseSchema,
  cenarioSchema,
  errorEnvelopeSchema,
  loteConflictSchema,
  loteListResponseSchema,
  loteSchema,
  recriaEntradaConflictSchema,
  recriaEntradaSchema,
} from '@bovaro/contracts';
import { TEST_ORIGIN } from './support/env';
import { buildTestApp, prisma, signup } from './support/harness';
import { cenarioFixture as novoCenario } from './support/cenario';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

interface SendOptions {
  cookie?: string;
  origin?: string | null;
  headers?: Record<string, string>;
}

/** Requisição como o navegador: Origin permitido; JSON só quando há corpo. */
function send(
  server: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie: string,
  body?: unknown,
  options: SendOptions = {},
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = {
    cookie,
    ...(options.origin === null ? {} : { origin: options.origin ?? TEST_ORIGIN }),
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...options.headers,
  };
  return server.inject({
    method,
    url,
    headers,
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
}

const novoLote = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  tipo: 'compra',
  categoria: 'NOVILHO',
  data: '2026-10-01',
  modo: 'medio',
  qtd: '100',
  peso: '12.500',
  preco: '300.00',
  ...over,
});

async function conta() {
  const c = await signup(app);
  return c.cookie;
}

describe('lotes na nuvem (RF-020 compra, RF-021 venda)', () => {
  it('RF-020: cria, lista, edita e exclui; número sequencial por fazenda e tipo; decimal canônico', async () => {
    const cookie = await conta();

    const a = await send(app, 'POST', '/lotes', cookie, novoLote());
    expect(a.statusCode).toBe(201);
    const loteA = loteSchema.parse(a.json());
    expect(loteA).toMatchObject({
      numero: 1,
      tipo: 'compra',
      peso: '12.5',
      preco: '300',
      qtd: '100',
      base: 'vivo',
      aplicarDesconto: false,
      descontoKg: null,
      pesos: [],
      version: 1,
      deletedAt: null,
      data: '2026-10-01',
    });

    const b = loteSchema.parse((await send(app, 'POST', '/lotes', cookie, novoLote())).json());
    const venda = loteSchema.parse(
      (await send(app, 'POST', '/lotes', cookie, novoLote({ tipo: 'venda' }))).json(),
    );
    expect([b.numero, venda.numero]).toEqual([2, 1]);

    const lista = loteListResponseSchema.parse((await send(app, 'GET', '/lotes', cookie)).json());
    expect(lista.lotes.map((l) => `${l.tipo}${l.numero}`)).toEqual([
      'compra1',
      'compra2',
      'venda1',
    ]);
    const soVenda = loteListResponseSchema.parse(
      (await send(app, 'GET', '/lotes?tipo=venda', cookie)).json(),
    );
    expect(soVenda.lotes).toHaveLength(1);

    const editado = await send(app, 'PATCH', `/lotes/${loteA.id}`, cookie, {
      version: 1,
      categoria: 'BEZERRO',
      preco: '310.50',
      data: null,
    });
    expect(editado.statusCode).toBe(200);
    expect(loteSchema.parse(editado.json())).toMatchObject({
      categoria: 'BEZERRO',
      preco: '310.5',
      data: null,
      numero: 1,
      version: 2,
    });

    const excluido = await send(app, 'DELETE', `/lotes/${loteA.id}?version=2`, cookie);
    expect(excluido.statusCode).toBe(200);
    expect(loteSchema.parse(excluido.json())).toMatchObject({ version: 3 });
    expect(loteSchema.parse(excluido.json()).deletedAt).not.toBeNull();

    const depois = loteListResponseSchema.parse((await send(app, 'GET', '/lotes', cookie)).json());
    expect(depois.lotes.map((l) => l.id)).not.toContain(loteA.id);
    const comLapides = loteListResponseSchema.parse(
      (await send(app, 'GET', '/lotes?incluirExcluidos=true', cookie)).json(),
    );
    expect(comLapides.lotes.map((l) => l.id)).toContain(loteA.id);
    expect((await send(app, 'GET', `/lotes/${loteA.id}`, cookie)).statusCode).toBe(404);
    // nunca reutiliza o número de um lote excluído
    const c = loteSchema.parse((await send(app, 'POST', '/lotes', cookie, novoLote())).json());
    expect(c.numero).toBe(3);
  });

  it('RF-021: lote de venda guarda base da @, desconto (kg por cabeça) e pesos individuais', async () => {
    const cookie = await conta();
    const res = await send(
      app,
      'POST',
      '/lotes',
      cookie,
      novoLote({
        tipo: 'venda',
        modo: 'individual',
        pesos: ['480.000', '510.5'],
        base: 'carcaca',
        aplicarDesconto: true,
        descontoKg: '10.000',
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(loteSchema.parse(res.json())).toMatchObject({
      pesos: ['480', '510.5'],
      base: 'carcaca',
      aplicarDesconto: true,
      descontoKg: '10',
    });
    const criado = loteSchema.parse(res.json());
    const editado = await send(app, 'PATCH', `/lotes/${criado.id}`, cookie, {
      version: 1,
      descontoKg: '12.5',
    });
    expect(editado.statusCode).toBe(200);
    expect(loteSchema.parse(editado.json()).descontoKg).toBe('12.5');
    // campo legado (fração) não é mais aceito (ADR-0013)
    const legado = await send(app, 'POST', '/lotes', cookie, novoLote({ desconto: '0.1' }));
    expect(legado.statusCode).toBe(400);
  });

  it('RF-020: POST é idempotente pelo id do cliente (repetir = mesmo lote, sem duplicar)', async () => {
    const cookie = await conta();
    const corpo = novoLote();
    const primeira = await send(app, 'POST', '/lotes', cookie, corpo);
    const repetida = await send(app, 'POST', '/lotes', cookie, corpo);
    expect(primeira.statusCode).toBe(201);
    expect(repetida.statusCode).toBe(200);
    expect(repetida.json()).toEqual(primeira.json());
    const lista = loteListResponseSchema.parse((await send(app, 'GET', '/lotes', cookie)).json());
    expect(lista.lotes).toHaveLength(1);
  });

  it('RF-020: lotes criados em paralelo recebem números distintos e sequenciais', async () => {
    const cookie = await conta();
    const respostas = await Promise.all(
      Array.from({ length: 6 }, () => send(app, 'POST', '/lotes', cookie, novoLote())),
    );
    expect(respostas.map((r) => r.statusCode)).toEqual(Array(6).fill(201));
    const numeros = respostas.map((r) => loteSchema.parse(r.json()).numero).sort((x, y) => x - y);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('RNF-004: UUID de lote já usado por outra fazenda dá 409 sem vazar e não altera o lote alheio', async () => {
    const donoA = await conta();
    const donoB = await conta();
    const loteDeA = loteSchema.parse(
      (await send(app, 'POST', '/lotes', donoA, novoLote({ categoria: 'DA-A' }))).json(),
    );

    const res = await send(app, 'POST', '/lotes', donoB, novoLote({ id: loteDeA.id }));
    expect(res.statusCode).toBe(409);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('conflito');
    expect(res.json()).not.toHaveProperty('atual');
    expect(res.body).not.toContain('DA-A');

    const deB = loteListResponseSchema.parse((await send(app, 'GET', '/lotes', donoB)).json());
    expect(deB.lotes).toEqual([]);
    const intacto = await send(app, 'GET', `/lotes/${loteDeA.id}`, donoA);
    expect(loteSchema.parse(intacto.json())).toEqual(loteDeA);
  });

  it('RF-020 (ADR-0011 §4): PATCH com versão divergente dá 409 com o lote atual e não grava', async () => {
    const cookie = await conta();
    const lote = loteSchema.parse((await send(app, 'POST', '/lotes', cookie, novoLote())).json());
    await send(app, 'PATCH', `/lotes/${lote.id}`, cookie, { version: 1, categoria: 'PRIMEIRO' });

    const velho = await send(app, 'PATCH', `/lotes/${lote.id}`, cookie, {
      version: 1,
      categoria: 'SEGUNDO',
    });
    expect(velho.statusCode).toBe(409);
    const conflito = loteConflictSchema.parse(velho.json());
    expect(conflito.erro.codigo).toBe('conflito');
    expect(conflito.atual).toMatchObject({ categoria: 'PRIMEIRO', version: 2 });

    const adiantado = await send(app, 'PATCH', `/lotes/${lote.id}`, cookie, {
      version: 9,
      categoria: 'TERCEIRO',
    });
    expect(adiantado.statusCode).toBe(409);
    const atual = loteSchema.parse((await send(app, 'GET', `/lotes/${lote.id}`, cookie)).json());
    expect(atual.categoria).toBe('PRIMEIRO');
  });

  it('RF-020: validação técnica — chave desconhecida, formato, casas decimais, fração e data', async () => {
    const cookie = await conta();
    const rejeita = async (corpo: Record<string, unknown>, regra?: string) => {
      const res = await send(app, 'POST', '/lotes', cookie, corpo);
      expect(res.statusCode).toBe(400);
      const env = errorEnvelopeSchema.parse(res.json());
      expect(env.erro.codigo).toBe('validacao_invalida');
      if (regra) expect(env.erro.campos?.map((c) => c.regra)).toContain(regra);
    };
    await rejeita(novoLote({ numero: 9 }));
    await rejeita(novoLote({ qtd: '1,5' }), 'formato');
    await rejeita(novoLote({ qtd: 100 }));
    await rejeita(novoLote({ preco: '300.001' }), 'casas_decimais');
    await rejeita(novoLote({ qtd: '1e3' }), 'formato');
    await rejeita(novoLote({ descontoKg: '100000', aplicarDesconto: true }), 'faixa');
    await rejeita(novoLote({ data: '2026-02-31' }));
    await rejeita(novoLote({ categoria: '   ' }));
    await rejeita(novoLote({ tipo: 'recria' }));
    await rejeita(novoLote({ id: 'nao-e-uuid' }));

    const lote = loteSchema.parse((await send(app, 'POST', '/lotes', cookie, novoLote())).json());
    const vazio = await send(app, 'PATCH', `/lotes/${lote.id}`, cookie, { version: 1 });
    expect(vazio.statusCode).toBe(400);
    const mudaTipo = await send(app, 'PATCH', `/lotes/${lote.id}`, cookie, {
      version: 1,
      tipo: 'venda',
    });
    expect(mudaTipo.statusCode).toBe(400);
  });

  it('RF-020: sem faixa de negócio — peso e preço zero ou enormes (que cabem na coluna) são aceitos', async () => {
    const cookie = await conta();
    const res = await send(
      app,
      'POST',
      '/lotes',
      cookie,
      novoLote({ qtd: '0', peso: '999999999.999', preco: '0' }),
    );
    expect(res.statusCode).toBe(201);
  });
});

describe('DELETE sem corpo e CSRF (ADR-0011 §7, RF-020)', () => {
  it('RF-020: DELETE exige ?version=N (Zod) e aceita requisição sem Content-Type', async () => {
    const cookie = await conta();
    const lote = loteSchema.parse((await send(app, 'POST', '/lotes', cookie, novoLote())).json());

    const semVersao = await send(app, 'DELETE', `/lotes/${lote.id}`, cookie);
    expect(semVersao.statusCode).toBe(400);
    const versaoInvalida = await send(app, 'DELETE', `/lotes/${lote.id}?version=abc`, cookie);
    expect(versaoInvalida.statusCode).toBe(400);

    const velha = await send(app, 'DELETE', `/lotes/${lote.id}?version=7`, cookie);
    expect(velha.statusCode).toBe(409);
    expect(loteConflictSchema.parse(velha.json()).atual.id).toBe(lote.id);

    const ok = await send(app, 'DELETE', `/lotes/${lote.id}?version=1`, cookie);
    expect(ok.statusCode).toBe(200);
    // repetir o DELETE de algo já excluído = 404 idêntico ao inexistente
    const repetido = await send(app, 'DELETE', `/lotes/${lote.id}?version=2`, cookie);
    expect(repetido.statusCode).toBe(404);
  });

  it('RF-020: DELETE continua exigindo Origin permitido e Sec-Fetch-Site same-site/origin; com corpo é 403', async () => {
    const cookie = await conta();
    const lote = loteSchema.parse((await send(app, 'POST', '/lotes', cookie, novoLote())).json());
    const url = `/lotes/${lote.id}?version=1`;

    const semOrigin = await send(app, 'DELETE', url, cookie, undefined, { origin: null });
    expect(semOrigin.statusCode).toBe(403);
    const origemErrada = await send(app, 'DELETE', url, cookie, undefined, {
      origin: 'https://evil.example',
    });
    expect(origemErrada.statusCode).toBe(403);
    const crossSite = await send(app, 'DELETE', url, cookie, undefined, {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(crossSite.statusCode).toBe(403);
    const comCorpo = await send(app, 'DELETE', url, cookie, { version: 1 });
    expect(comCorpo.statusCode).toBe(403);

    // nada foi excluído pelas tentativas bloqueadas
    expect((await send(app, 'GET', `/lotes/${lote.id}`, cookie)).statusCode).toBe(200);
    const mesmoSite = await send(app, 'DELETE', url, cookie, undefined, {
      headers: { 'sec-fetch-site': 'same-origin' },
    });
    expect(mesmoSite.statusCode).toBe(200);
  });

  it('RF-020: POST/PATCH seguem exigindo Content-Type JSON', async () => {
    const cookie = await conta();
    const res = await app.inject({
      method: 'POST',
      url: '/lotes',
      headers: { cookie, origin: TEST_ORIGIN, 'content-type': 'text/plain' },
      payload: JSON.stringify(novoLote()),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('cenários na nuvem (RF-032)', () => {
  it('RF-032: cria, lista por data de criação, renomeia e exclui; snapshot volta idêntico', async () => {
    const cookie = await conta();
    const velho = novoCenario({ nome: 'Antigo', criadoEm: '2026-01-01T00:00:00.000Z' });
    const novo = novoCenario({ nome: 'Novo' });
    // criado em ordem inversa: a lista ordena por criadoEm
    expect((await send(app, 'POST', '/cenarios', cookie, novo)).statusCode).toBe(201);
    const criado = await send(app, 'POST', '/cenarios', cookie, velho);
    expect(criado.statusCode).toBe(201);
    const dto = cenarioSchema.parse(criado.json());
    expect(dto).toMatchObject({
      nome: 'Antigo',
      version: 1,
      resultado: velho.resultado,
      entradas: velho.entradas,
    });

    const lista = cenarioListResponseSchema.parse(
      (await send(app, 'GET', '/cenarios', cookie)).json(),
    );
    expect(lista.cenarios.map((c) => c.nome)).toEqual(['Antigo', 'Novo']);

    const renomeado = await send(app, 'PATCH', `/cenarios/${dto.id}`, cookie, {
      version: 1,
      nome: '  Safra 26  ',
    });
    expect(cenarioSchema.parse(renomeado.json())).toMatchObject({ nome: 'Safra 26', version: 2 });

    const stale = await send(app, 'PATCH', `/cenarios/${dto.id}`, cookie, {
      version: 1,
      nome: 'Outro',
    });
    expect(stale.statusCode).toBe(409);
    expect(cenarioConflictSchema.parse(stale.json()).atual.nome).toBe('Safra 26');

    const excluido = await send(app, 'DELETE', `/cenarios/${dto.id}?version=2`, cookie);
    expect(excluido.statusCode).toBe(200);
    const depois = cenarioListResponseSchema.parse(
      (await send(app, 'GET', '/cenarios', cookie)).json(),
    );
    expect(depois.cenarios.map((c) => c.nome)).toEqual(['Novo']);
    const comLapides = cenarioListResponseSchema.parse(
      (await send(app, 'GET', '/cenarios?incluirExcluidos=true', cookie)).json(),
    );
    expect(comLapides.cenarios).toHaveLength(2);
  });

  it('RF-032: POST idempotente e UUID de outra fazenda dá 409 sem vazar', async () => {
    const donoA = await conta();
    const donoB = await conta();
    const corpo = novoCenario({ nome: 'Segredo do A' });
    const um = await send(app, 'POST', '/cenarios', donoA, corpo);
    const dois = await send(app, 'POST', '/cenarios', donoA, corpo);
    expect([um.statusCode, dois.statusCode]).toEqual([201, 200]);
    expect(dois.json()).toEqual(um.json());

    const colisao = await send(app, 'POST', '/cenarios', donoB, novoCenario({ id: corpo.id }));
    expect(colisao.statusCode).toBe(409);
    expect(colisao.body).not.toContain('Segredo do A');
    expect(colisao.json()).not.toHaveProperty('atual');
  });

  it('RF-032: validação — nome até 80, folhas só string, snapshot imutável, chave desconhecida', async () => {
    const cookie = await conta();
    const rejeita = async (corpo: unknown) => {
      const res = await send(app, 'POST', '/cenarios', cookie, corpo);
      expect(res.statusCode).toBe(400);
    };
    expect(
      (await send(app, 'POST', '/cenarios', cookie, novoCenario({ nome: 'x'.repeat(80) })))
        .statusCode,
    ).toBe(201);
    await rejeita(novoCenario({ nome: 'x'.repeat(81) }));
    await rejeita(novoCenario({ nome: '  ' }));
    await rejeita(novoCenario({ entradas: {}, variantes: {}, parametros: {}, resultado: {} }));
    await rejeita(novoCenario({ entradas: { area: 100 } }));
    await rejeita(novoCenario({ resultado: { cabecas: 100 } }));
    await rejeita(novoCenario({ criadoEm: 'ontem' }));
    await rejeita({ ...novoCenario(), extra: 'x' });

    const c = cenarioSchema.parse(
      (await send(app, 'POST', '/cenarios', cookie, novoCenario())).json(),
    );
    const muta = await send(app, 'PATCH', `/cenarios/${c.id}`, cookie, {
      version: 1,
      nome: 'ok',
      entradas: { area: '1' },
    });
    expect(muta.statusCode).toBe(400);
  });
});

describe('entradas da recria na nuvem (RF-010, 1 por fazenda)', () => {
  const entradas = { area: '100', dias: '365', pesoIni: '200' };

  it('RF-010: GET sem registro é 404; PUT cria (201); PUT com versão atualiza; versão velha ou ausente dá 409', async () => {
    const cookie = await conta();
    expect((await send(app, 'GET', '/recria-entrada', cookie)).statusCode).toBe(404);

    const id = randomUUID();
    const criado = await send(app, 'PUT', '/recria-entrada', cookie, {
      id,
      entradas,
      lotacaoInicial: 'fixa80',
    });
    expect(criado.statusCode).toBe(201);
    expect(recriaEntradaSchema.parse(criado.json())).toMatchObject({ id, version: 1, entradas });

    const atualiza = await send(app, 'PUT', '/recria-entrada', cookie, {
      id,
      version: 1,
      entradas: { ...entradas, area: '120' },
      lotacaoInicial: 'areaPastavel',
    });
    expect(atualiza.statusCode).toBe(200);
    expect(recriaEntradaSchema.parse(atualiza.json())).toMatchObject({
      version: 2,
      lotacaoInicial: 'areaPastavel',
    });

    for (const version of [1, undefined]) {
      const velho = await send(app, 'PUT', '/recria-entrada', cookie, {
        id,
        ...(version ? { version } : {}),
        entradas: { area: '1' },
        lotacaoInicial: 'fixa80',
      });
      expect(velho.statusCode).toBe(409);
      expect(recriaEntradaConflictSchema.parse(velho.json()).atual).toMatchObject({
        version: 2,
        entradas: { ...entradas, area: '120' },
      });
    }
    const lida = recriaEntradaSchema.parse(
      (await send(app, 'GET', '/recria-entrada', cookie)).json(),
    );
    expect(lida.entradas.area).toBe('120');
  });

  it('RF-010: PUT valida (folha número = 400) e id de outra fazenda dá 409 sem vazar', async () => {
    const donoA = await conta();
    const donoB = await conta();
    const id = randomUUID();
    await send(app, 'PUT', '/recria-entrada', donoA, {
      id,
      entradas: { area: 'SEGREDO-A' },
      lotacaoInicial: 'fixa80',
    });
    const numero = await send(app, 'PUT', '/recria-entrada', donoB, {
      id: randomUUID(),
      entradas: { area: 100 },
      lotacaoInicial: 'fixa80',
    });
    expect(numero.statusCode).toBe(400);
    const colisao = await send(app, 'PUT', '/recria-entrada', donoB, {
      id,
      entradas,
      lotacaoInicial: 'fixa80',
    });
    expect(colisao.statusCode).toBe(409);
    expect(colisao.body).not.toContain('SEGREDO-A');
    expect(colisao.json()).not.toHaveProperty('atual');
    expect((await send(app, 'GET', '/recria-entrada', donoB)).statusCode).toBe(404);
  });
});

describe('isolamento multi-tenant dos dados (RNF-004)', () => {
  it('RNF-004: A não lê, edita nem exclui lote/cenário/recria de B; 404 idêntico ao inexistente', async () => {
    const donoA = await conta();
    const donoB = await conta();
    const loteB = loteSchema.parse(
      (await send(app, 'POST', '/lotes', donoB, novoLote({ categoria: 'SO-DO-B' }))).json(),
    );
    const cenB = cenarioSchema.parse(
      (await send(app, 'POST', '/cenarios', donoB, novoCenario({ nome: 'So do B' }))).json(),
    );
    const recId = randomUUID();
    await send(app, 'PUT', '/recria-entrada', donoB, {
      id: recId,
      entradas: { area: '77' },
      lotacaoInicial: 'fixa80',
    });

    const inexistente = randomUUID();
    const corpoPadrao = async (res: LightMyRequestResponse) => res.body;
    const tentativas: [string, string, unknown?][] = [
      ['GET', `/lotes/${loteB.id}`],
      ['PATCH', `/lotes/${loteB.id}`, { version: 1, categoria: 'HACK' }],
      ['DELETE', `/lotes/${loteB.id}?version=1`],
      ['GET', `/cenarios/${cenB.id}`],
      ['PATCH', `/cenarios/${cenB.id}`, { version: 1, nome: 'hack' }],
      ['DELETE', `/cenarios/${cenB.id}?version=1`],
    ];
    for (const [method, url, body] of tentativas) {
      const m = method as 'GET' | 'PATCH' | 'DELETE';
      const real = await send(app, m, url, donoA, body);
      const fantasma = await send(
        app,
        m,
        url.replace(loteB.id, inexistente).replace(cenB.id, inexistente),
        donoA,
        body,
      );
      expect(real.statusCode, `${method} ${url}`).toBe(404);
      expect(await corpoPadrao(real)).toBe(await corpoPadrao(fantasma));
    }

    expect(
      loteListResponseSchema.parse((await send(app, 'GET', '/lotes', donoA)).json()).lotes,
    ).toEqual([]);
    expect(
      cenarioListResponseSchema.parse((await send(app, 'GET', '/cenarios', donoA)).json()).cenarios,
    ).toEqual([]);
    expect((await send(app, 'GET', '/recria-entrada', donoA)).statusCode).toBe(404);

    // nada mudou em B
    const loteDepois = loteSchema.parse(
      (await send(app, 'GET', `/lotes/${loteB.id}`, donoB)).json(),
    );
    expect(loteDepois).toEqual(loteB);
    const cenDepois = cenarioSchema.parse(
      (await send(app, 'GET', `/cenarios/${cenB.id}`, donoB)).json(),
    );
    expect(cenDepois).toEqual(cenB);
    const recDepois = recriaEntradaSchema.parse(
      (await send(app, 'GET', '/recria-entrada', donoB)).json(),
    );
    expect(recDepois.entradas).toEqual({ area: '77' });
  });

  it('RNF-004: numeração de lotes é independente por fazenda', async () => {
    const donoA = await conta();
    const donoB = await conta();
    await send(app, 'POST', '/lotes', donoA, novoLote());
    await send(app, 'POST', '/lotes', donoA, novoLote());
    const b = loteSchema.parse((await send(app, 'POST', '/lotes', donoB, novoLote())).json());
    expect(b.numero).toBe(1);
  });

  it('RNF-004: sem sessão toda rota de dados responde 401', async () => {
    for (const [method, url] of [
      ['GET', '/lotes'],
      ['POST', '/lotes'],
      ['GET', '/cenarios'],
      ['GET', '/recria-entrada'],
      ['PUT', '/recria-entrada'],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: { origin: TEST_ORIGIN, 'content-type': 'application/json' },
        ...(method === 'GET' ? {} : { payload: '{}' }),
      });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
