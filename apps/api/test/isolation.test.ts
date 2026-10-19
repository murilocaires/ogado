import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  errorEnvelopeSchema,
  fazendaListResponseSchema,
  fazendaSchema,
  sessionResponseSchema,
} from '@ogado/contracts';
import { TEST_ORIGIN } from './support/env';
import { buildTestApp, getWithCookie, prisma, signup } from './support/harness';
import {
  assertPublicAllowlist,
  PUBLIC_ROUTE_ALLOWLIST,
  runIsolationCase,
} from './support/isolation-guard';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

interface Farm {
  cookie: string;
  fazendaId: string;
  usuarioId: string;
}

async function createFarm(): Promise<Farm> {
  const conta = await signup(app);
  const body = sessionResponseSchema.parse(conta.res.json());
  return { cookie: conta.cookie, fazendaId: body.fazenda.id, usuarioId: body.usuario.id };
}

/**
 * Casos de isolamento (ADR-0010 d.4): para cada rota autenticada, A tenta alcançar dados de B e
 * nada vaza. Cada caso devolve quantas tentativas de A contra B fez (>= 1) e precisa asserir. Toda rota autenticada registrada na API precisa de uma entrada aqui; o teste-guardião
 * abaixo falha se faltar (CA-12).
 */
const isolationCases: Record<string, (a: Farm, b: Farm) => Promise<number>> = {
  'GET /auth/session': async (a, b) => {
    const res = await getWithCookie(app, '/auth/session', a.cookie);
    expect(res.statusCode).toBe(200);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.usuario.id).toBe(a.usuarioId);
    expect(body.fazenda.id).toBe(a.fazendaId);
    expect(res.body).not.toContain(b.fazendaId);
    expect(res.body).not.toContain(b.usuarioId);
    return 1;
  },
  'GET /fazendas': async (a, b) => {
    const res = await getWithCookie(app, '/fazendas', a.cookie);
    expect(res.statusCode).toBe(200);
    const lista = fazendaListResponseSchema.parse(res.json());
    expect(lista.fazendas.map((f) => f.id)).toEqual([a.fazendaId]);
    expect(res.body).not.toContain(b.fazendaId);
    return 1;
  },
  'GET /fazendas/:id': async (a, b) => {
    const res = await getWithCookie(app, `/fazendas/${b.fazendaId}`, a.cookie);
    expect(res.statusCode).toBe(404);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('nao_encontrado');
    expect(res.body).not.toContain(b.fazendaId);
    // a própria fazenda continua legível
    const propria = await getWithCookie(app, `/fazendas/${a.fazendaId}`, a.cookie);
    expect(propria.statusCode).toBe(200);
    return 1;
  },
};

/** Cria, como B, um recurso por tipo e devolve as rotas de A contra eles (RNF-004). */
async function dadosDeB(b: Farm) {
  const headers = { cookie: b.cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' };
  const post = async (url: string, payload: object) => {
    const res = await app.inject({
      method: 'POST',
      url,
      headers,
      payload: JSON.stringify(payload),
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { id: string }).id;
  };
  const lote = await post('/lotes', {
    id: randomUUID(),
    tipo: 'compra',
    categoria: 'B',
    modo: 'total',
    qtd: '1',
    peso: '1',
    preco: '1',
  });
  const cenario = await post('/cenarios', {
    id: randomUUID(),
    nome: 'B',
    criadoEm: '2026-10-18T00:00:00.000Z',
    entradas: {},
    variantes: {},
    parametros: {},
    resultado: {},
  });
  return { lote, cenario };
}

async function tentaComoA(
  a: Farm,
  method: 'GET' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) {
  const res = await app.inject({
    method,
    url,
    headers: {
      cookie: a.cookie,
      origin: TEST_ORIGIN,
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    ...(payload ? { payload: JSON.stringify(payload) } : {}),
  });
  expect(res.statusCode).toBe(404);
  expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('nao_encontrado');
  return res;
}

const listaVaziaDeA = (path: '/lotes' | '/cenarios') => async (a: Farm, b: Farm) => {
  const { lote, cenario } = await dadosDeB(b);
  const res = await getWithCookie(app, path, a.cookie);
  expect(res.statusCode).toBe(200);
  expect(res.body).not.toContain(lote);
  expect(res.body).not.toContain(cenario);
  return 1;
};

const isolationCasesDados: Record<string, (a: Farm, b: Farm) => Promise<number>> = {
  'GET /lotes': listaVaziaDeA('/lotes'),
  'GET /cenarios': listaVaziaDeA('/cenarios'),
  'GET /lotes/:id': async (a, b) => {
    const { lote } = await dadosDeB(b);
    await tentaComoA(a, 'GET', `/lotes/${lote}`);
    return 1;
  },
  'PATCH /lotes/:id': async (a, b) => {
    const { lote } = await dadosDeB(b);
    await tentaComoA(a, 'PATCH', `/lotes/${lote}`, { version: 1, categoria: 'X' });
    return 1;
  },
  'DELETE /lotes/:id': async (a, b) => {
    const { lote } = await dadosDeB(b);
    await tentaComoA(a, 'DELETE', `/lotes/${lote}?version=1`);
    return 1;
  },
  'GET /cenarios/:id': async (a, b) => {
    const { cenario } = await dadosDeB(b);
    await tentaComoA(a, 'GET', `/cenarios/${cenario}`);
    return 1;
  },
  'PATCH /cenarios/:id': async (a, b) => {
    const { cenario } = await dadosDeB(b);
    await tentaComoA(a, 'PATCH', `/cenarios/${cenario}`, { version: 1, nome: 'X' });
    return 1;
  },
  'DELETE /cenarios/:id': async (a, b) => {
    const { cenario } = await dadosDeB(b);
    await tentaComoA(a, 'DELETE', `/cenarios/${cenario}?version=1`);
    return 1;
  },
  // POST/PUT criam no tenant do chamador; o isolamento delas (colisão de UUID, sem vazar) está em dados.test.ts
  'POST /lotes': async (a, b) => {
    const id = randomUUID();
    const headers = { origin: TEST_ORIGIN, 'content-type': 'application/json' };
    const corpo = {
      id,
      tipo: 'compra',
      categoria: 'B',
      modo: 'total',
      qtd: '1',
      peso: '1',
      preco: '1',
    };
    const deB = await app.inject({
      method: 'POST',
      url: '/lotes',
      headers: { ...headers, cookie: b.cookie },
      payload: JSON.stringify(corpo),
    });
    const deA = await app.inject({
      method: 'POST',
      url: '/lotes',
      headers: { ...headers, cookie: a.cookie },
      payload: JSON.stringify(corpo),
    });
    expect(deB.statusCode).toBe(201);
    expect(deA.statusCode).toBe(409);
    expect(deA.body).not.toContain(b.fazendaId);
    return 1;
  },
  'POST /cenarios': async (a, b) => {
    const id = randomUUID();
    const headers = { origin: TEST_ORIGIN, 'content-type': 'application/json' };
    const corpo = {
      id,
      nome: 'B',
      criadoEm: '2026-10-18T00:00:00.000Z',
      entradas: {},
      variantes: {},
      parametros: {},
      resultado: {},
    };
    const deB = await app.inject({
      method: 'POST',
      url: '/cenarios',
      headers: { ...headers, cookie: b.cookie },
      payload: JSON.stringify(corpo),
    });
    const deA = await app.inject({
      method: 'POST',
      url: '/cenarios',
      headers: { ...headers, cookie: a.cookie },
      payload: JSON.stringify(corpo),
    });
    expect(deB.statusCode).toBe(201);
    expect(deA.statusCode).toBe(409);
    return 1;
  },
  'GET /recria-entrada': async (a, b) => {
    const headers = { origin: TEST_ORIGIN, 'content-type': 'application/json', cookie: b.cookie };
    await app.inject({
      method: 'PUT',
      url: '/recria-entrada',
      headers,
      payload: JSON.stringify({
        id: randomUUID(),
        entradas: { area: '1' },
        lotacaoInicial: 'fixa80',
      }),
    });
    const res = await getWithCookie(app, '/recria-entrada', a.cookie);
    expect(res.statusCode).toBe(404);
    return 1;
  },
  'PUT /recria-entrada': async (a, b) => {
    const headers = { origin: TEST_ORIGIN, 'content-type': 'application/json' };
    const put = (cookie: string, id: string) =>
      app.inject({
        method: 'PUT',
        url: '/recria-entrada',
        headers: { ...headers, cookie },
        payload: JSON.stringify({ id, entradas: { area: '1' }, lotacaoInicial: 'fixa80' }),
      });
    // B garante que tem registro (outro caso pode ter criado antes: 201 ou 409) e A usa o id dele
    await put(b.cookie, randomUUID());
    const idDeB = (await getWithCookie(app, '/recria-entrada', b.cookie)).json<{ id: string }>().id;
    const deA = await put(a.cookie, idDeB);
    expect(deA.statusCode).toBe(409);
    expect(deA.json()).not.toHaveProperty('atual');
    expect(deA.body).not.toContain(b.fazendaId);
    return 1;
  },
};
Object.assign(isolationCases, isolationCasesDados);

describe('isolamento por fazenda (HTTP)', () => {
  it('RF-010 CA-11: o usuário A não lê, nem lista a fazenda de B, e os dados de B ficam intactos', async () => {
    const a = await createFarm();
    const b = await createFarm();
    const antes = await getWithCookie(app, `/fazendas/${b.fazendaId}`, b.cookie);

    for (const [rota, caso] of Object.entries(isolationCases)) {
      await runIsolationCase(rota, caso, a, b);
    }

    const depois = await getWithCookie(app, `/fazendas/${b.fazendaId}`, b.cookie);
    expect(depois.statusCode).toBe(200);
    expect(fazendaSchema.parse(depois.json())).toEqual(fazendaSchema.parse(antes.json()));
  });

  it('RF-010 CA-13: rota de negócio sem cookie de sessão responde 401 nao_autenticado', async () => {
    const lista = await getWithCookie(app, '/fazendas');
    expect(lista.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(lista.json()).erro.codigo).toBe('nao_autenticado');

    const um = await getWithCookie(app, '/fazendas/2f1c6d6e-5b7a-4c1e-9d55-0d1c2b3a4f5e');
    expect(um.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(um.json()).erro.codigo).toBe('nao_autenticado');
  });

  it('RF-010 CA-13: toda rota autenticada responde 401 sem cookie', async () => {
    await app.ready();
    for (const rota of app.routeCatalog.filter((r) => !r.public)) {
      const url = rota.url.replace(':id', '2f1c6d6e-5b7a-4c1e-9d55-0d1c2b3a4f5e');
      // métodos que alteram estado passam antes pela barreira de CSRF (Origin + JSON); DELETE sem corpo
      const res = await app.inject({
        method: rota.method,
        url,
        headers: { origin: TEST_ORIGIN, 'content-type': 'application/json' },
        ...(['POST', 'PUT', 'PATCH'].includes(rota.method) ? { payload: '{}' } : {}),
      });
      expect(res.statusCode, `${rota.method} ${rota.url}`).toBe(401);
    }
  });

  it('RNF-004 CA-12: teste-guardião — toda rota autenticada registrada tem caso de isolamento', async () => {
    await app.ready();
    assertPublicAllowlist(app.routeCatalog);
    const autenticadas = app.routeCatalog
      .filter((r) => !r.public)
      .map((r) => `${r.method} ${r.url}`);
    expect(autenticadas.length).toBeGreaterThan(0);

    const semCobertura = autenticadas.filter((rota) => !(rota in isolationCases));
    expect(semCobertura, 'rotas autenticadas sem caso de isolamento').toEqual([]);

    const obsoletos = Object.keys(isolationCases).filter((rota) => !autenticadas.includes(rota));
    expect(obsoletos, 'casos de isolamento de rotas que não existem mais').toEqual([]);
  });

  it('RNF-004 CA-12: o guardião falha para uma rota pública nova fora da allowlist', async () => {
    await app.ready();
    expect(() => assertPublicAllowlist(app.routeCatalog)).not.toThrow();
    const comNova = [
      ...app.routeCatalog,
      { method: 'GET' as const, url: '/relatorios', public: true },
    ];
    expect(() => assertPublicAllowlist(comNova)).toThrow(/allowlist/);
    expect(PUBLIC_ROUTE_ALLOWLIST).toEqual([
      'GET /health',
      'POST /auth/signup',
      'POST /auth/login',
      'POST /auth/logout',
    ]);
  });

  it('RNF-004 CA-12: o guardião falha para um caso de isolamento vazio, sem asserção ou sem tentativa', async () => {
    const farm: Farm = { cookie: '', fazendaId: 'a', usuarioId: 'a' };
    // Sem `expect(...).rejects`: ele próprio conta como asserção e mascararia o caso sem asserção.
    const falha = (caso: () => Promise<number>): Promise<boolean> =>
      runIsolationCase('meta', caso, farm, farm).then(
        () => false,
        () => true,
      );
    // O tipo já barra o caso vazio em compilação; o cast prova que o guardião também falha em runtime.
    const vazio = (async () => {}) as unknown as () => Promise<number>;
    const resultados = [
      await falha(vazio),
      await falha(async () => 1),
      await falha(async () => {
        expect(true).toBe(true);
        return 0;
      }),
    ];
    expect(resultados).toEqual([true, true, true]);
    // e o caso correto passa
    await runIsolationCase(
      'ok',
      async () => {
        expect(1).toBe(1);
        return 1;
      },
      farm,
      farm,
    );
  });
});
