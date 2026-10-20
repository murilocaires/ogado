import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  errorEnvelopeSchema,
  exportacaoDadosSchema,
  fazendaListResponseSchema,
  fazendaSchema,
  sessionResponseSchema,
  TERMOS_VERSAO,
} from '@ogado/contracts';
import { TEST_ORIGIN } from './support/env';
import { cenarioFixture } from './support/cenario';
import {
  buildTestApp,
  getWithCookie,
  prisma,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './support/harness';
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
  const cenario = await post('/cenarios', cenarioFixture({ nome: 'B' }));
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
  'POST /historico-sync': async (a, b) => {
    const { lote } = await dadosDeB(b);
    const res = await app.inject({
      method: 'POST',
      url: '/historico-sync',
      headers: { cookie: a.cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' },
      payload: JSON.stringify({
        id: randomUUID(),
        entidadeId: lote,
        tipo: 'lote',
        motivo: 'mesclagem',
        local: { id: lote },
        servidor: { id: lote },
        resultado: { id: lote },
      }),
    });
    expect(res.statusCode).toBe(404);
    return 1;
  },
  'GET /historico-sync': async (a, b) => {
    const { lote } = await dadosDeB(b);
    const id = randomUUID();
    await prisma.historicoSync.create({
      data: {
        id,
        fazendaId: b.fazendaId,
        entidadeId: lote,
        tipo: 'lote',
        motivo: 'mesclagem',
        local: { id: lote },
        servidor: { id: lote },
        resultado: { id: lote },
      },
    });
    const res = await getWithCookie(app, `/historico-sync?entidadeId=${lote}`, a.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ registros: [] });
    expect(res.body).not.toContain(id);
    return 1;
  },
  'GET /historico-sync/:id': async (a, b) => {
    const { lote } = await dadosDeB(b);
    const id = randomUUID();
    await prisma.historicoSync.create({
      data: {
        id,
        fazendaId: b.fazendaId,
        entidadeId: lote,
        tipo: 'lote',
        motivo: 'exclusao',
        local: { id: lote },
        servidor: { id: lote },
        resultado: { id: lote },
      },
    });
    await tentaComoA(a, 'GET', `/historico-sync/${id}`);
    return 1;
  },
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
    const corpo = cenarioFixture({ id, nome: 'B' });
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

const comoA = (
  a: Farm,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body: unknown,
): Promise<LightMyRequestResponse> =>
  app.inject({
    method,
    url,
    headers: { origin: TEST_ORIGIN, 'content-type': 'application/json', cookie: a.cookie },
    payload: JSON.stringify(body),
  });

// Rotas da Conta (RF-004/005/007/011): nenhum id do cliente escolhe o alvo; só o tenant da sessão.
const isolationCasesConta: Record<string, (a: Farm, b: Farm) => Promise<number>> = {
  'PATCH /conta/perfil': async (a, b) => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { id: b.usuarioId } });
    const roubo = await comoA(a, 'PATCH', '/conta/perfil', { nome: 'A', email: antes.email });
    expect(roubo.statusCode).toBe(409);
    expect(roubo.body).not.toContain(b.usuarioId);
    const comId = await comoA(a, 'PATCH', '/conta/perfil', {
      id: b.usuarioId,
      nome: 'A',
      email: uniqueEmail('iso'),
    });
    expect(comId.statusCode).toBe(400);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: b.usuarioId } });
    expect(depois).toEqual(antes);
    return 2;
  },
  'POST /conta/aceite': async (a, b) => {
    await prisma.usuario.updateMany({
      where: { id: { in: [a.usuarioId, b.usuarioId] } },
      data: { aceiteTermosVersao: '2020-01-01' },
    });
    const comId = await comoA(a, 'POST', '/conta/aceite', {
      versao: TERMOS_VERSAO,
      usuarioId: b.usuarioId,
    });
    expect(comId.statusCode).toBe(400);
    const propria = await comoA(a, 'POST', '/conta/aceite', { versao: TERMOS_VERSAO });
    expect(propria.statusCode).toBe(200);
    expect(propria.body).not.toContain(b.usuarioId);
    const linhaB = await prisma.usuario.findUniqueOrThrow({ where: { id: b.usuarioId } });
    expect(linhaB.aceiteTermosVersao).toBe('2020-01-01');
    return 2;
  },
  'POST /conta/exportar/enviar': async (a, b) => {
    const res = await comoA(a, 'POST', '/conta/exportar/enviar', {});
    expect(res.statusCode).toBe(202);
    expect(res.body).not.toContain(b.usuarioId);
    expect(res.body).not.toContain(b.fazendaId);
    return 1;
  },
  'PUT /conta/senha': async (a, b) => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { id: b.usuarioId } });
    const res = await comoA(a, 'PUT', '/conta/senha', {
      usuarioId: b.usuarioId,
      senhaAtual: VALID_PASSWORD,
      novaSenha: 'Gado#Novo2027',
    });
    expect(res.statusCode).toBe(400);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: b.usuarioId } });
    expect(depois.senhaHash).toBe(antes.senhaHash);
    expect(await prisma.sessao.count({ where: { usuarioId: b.usuarioId } })).toBeGreaterThan(0);
    return 1;
  },
  'PATCH /fazenda': async (a, b) => {
    const antes = await prisma.fazenda.findUniqueOrThrow({ where: { id: b.fazendaId } });
    const comId = await comoA(a, 'PATCH', '/fazenda', {
      id: b.fazendaId,
      nome: 'Invasão',
      version: 1,
    });
    expect(comId.statusCode).toBe(400);
    const propria = await comoA(a, 'PATCH', '/fazenda', { nome: 'Da A', areaHa: '5', version: 1 });
    expect(propria.statusCode).toBe(200);
    expect(propria.body).not.toContain(b.fazendaId);
    const depois = await prisma.fazenda.findUniqueOrThrow({ where: { id: b.fazendaId } });
    expect(depois).toEqual(antes);
    return 2;
  },
  'GET /conta/exportar': async (a, b) => {
    const { lote, cenario } = await dadosDeB(b);
    // a query não escolhe o alvo: um id de B na query é ignorado
    const res = await getWithCookie(app, `/conta/exportar?usuarioId=${b.usuarioId}`, a.cookie);
    expect(res.statusCode).toBe(200);
    const dados = exportacaoDadosSchema.parse(res.json());
    expect(dados.perfil.id).toBe(a.usuarioId);
    expect(dados.fazenda.id).toBe(a.fazendaId);
    for (const proibido of [lote, cenario, b.usuarioId, b.fazendaId]) {
      expect(res.body).not.toContain(proibido);
    }
    return 1;
  },
  // antes de 'DELETE /conta': os casos compartilham A e B, e este apaga a conta de A
  'DELETE /conta/google': async (a, b) => {
    const sub = `iso-${randomUUID()}`;
    await prisma.identidadeGoogle.create({
      data: { usuarioId: b.usuarioId, sub, email: uniqueEmail('iso') },
    });
    // A não tem Google: nem a rota pura nem um id de B na query alcançam a identidade de B.
    const pura = await app.inject({
      method: 'DELETE',
      url: '/conta/google',
      headers: { origin: TEST_ORIGIN, cookie: a.cookie },
    });
    expect(pura.statusCode).toBe(404);
    const comId = await app.inject({
      method: 'DELETE',
      url: `/conta/google?usuarioId=${b.usuarioId}`,
      headers: { origin: TEST_ORIGIN, cookie: a.cookie },
    });
    expect(comId.statusCode).toBe(404);
    expect(await prisma.identidadeGoogle.count({ where: { sub, usuarioId: b.usuarioId } })).toBe(1);
    return 2;
  },
  'DELETE /conta': async (a, b) => {
    const comId = await comoA(a, 'DELETE', '/conta', {
      confirmacao: 'deletar',
      usuarioId: b.usuarioId,
    });
    expect(comId.statusCode).toBe(400);
    const propria = await comoA(a, 'DELETE', '/conta', { confirmacao: 'deletar' });
    expect(propria.statusCode).toBe(204);
    expect(await prisma.usuario.count({ where: { id: a.usuarioId } })).toBe(0);
    expect(await prisma.usuario.count({ where: { id: b.usuarioId } })).toBe(1);
    expect(await prisma.fazenda.count({ where: { id: b.fazendaId } })).toBe(1);
    return 2;
  },
};
Object.assign(isolationCases, isolationCasesConta);

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
      'POST /auth/senha/esqueci',
      'POST /auth/senha/redefinir',
      'GET /auth/google/start',
      'GET /auth/google/callback',
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
