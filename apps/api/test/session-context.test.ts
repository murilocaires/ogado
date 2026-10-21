import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loteListResponseSchema, loteSchema, sessionResponseSchema } from '@bovaro/contracts';
import { createMemoryEmailSender } from '../src/email/memory-sender';
import { TEST_ORIGIN } from './support/env';
import { buildTestApp, getWithCookie, postJson, prisma, signup } from './support/harness';

const email = createMemoryEmailSender();
const app = buildTestApp({ emailSender: email });
beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function accounts() {
  const a = await signup(app);
  const b = await signup(app);
  return {
    a,
    b,
    aId: sessionResponseSchema.parse(a.res.json()).usuario.id,
    bId: sessionResponseSchema.parse(b.res.json()).usuario.id,
  };
}

function lote() {
  return {
    id: randomUUID(),
    tipo: 'compra',
    categoria: 'NOVILHO',
    data: '2026-10-20',
    modo: 'medio',
    qtd: '100',
    peso: '12.5',
    preco: '300',
  };
}

it('RF-078/RNF-014: POST iniciado para A com cookie de B não cria lançamento em B', async () => {
  const { aId, b, bId } = await accounts();
  const payload = lote();
  const refused = await postJson(app, '/lotes', payload, {
    cookie: b.cookie,
    headers: { 'x-bovaro-usuario': aId },
  });
  expect(refused.statusCode).toBe(401);
  expect(refused.headers['set-cookie']).toBeUndefined();
  const list = await getWithCookie(app, '/lotes', b.cookie);
  expect(loteListResponseSchema.parse(list.json()).lotes).toEqual([]);
  const accepted = await postJson(app, '/lotes', payload, {
    cookie: b.cookie,
    headers: { 'x-bovaro-usuario': bId },
  });
  expect(accepted.statusCode).toBe(201);
});

it('RF-078/RNF-014: PATCH com contexto antigo não modifica o lote nem sua versão', async () => {
  const { aId, b } = await accounts();
  const created = await postJson(app, '/lotes', lote(), { cookie: b.cookie });
  expect(created.statusCode).toBe(201);
  const initial = loteSchema.parse(created.json());
  const refused = await app.inject({
    method: 'PATCH',
    url: `/lotes/${initial.id}`,
    headers: { cookie: b.cookie, origin: TEST_ORIGIN, 'x-bovaro-usuario': aId },
    payload: { version: initial.version, qtd: '999' },
  });
  expect(refused.statusCode).toBe(401);
  expect(refused.headers['set-cookie']).toBeUndefined();
  const current = loteSchema.parse(
    (await getWithCookie(app, `/lotes/${initial.id}`, b.cookie)).json(),
  );
  expect(current.qtd).toBe('100');
  expect(current.version).toBe(1);
});

it('RF-078/RNF-014: contexto antigo não lê nem exporta dados privados ou envia e-mail', async () => {
  const { aId, b, bId } = await accounts();
  for (const url of ['/auth/session', '/lotes', '/conta/exportar']) {
    const refused = await app.inject({
      method: 'GET',
      url,
      headers: { cookie: b.cookie, 'x-bovaro-usuario': aId },
    });
    expect(refused.statusCode, url).toBe(401);
    expect(refused.headers['set-cookie'], url).toBeUndefined();
    expect(refused.body, url).not.toContain(b.email);
  }
  const before = email.sent.length;
  const refused = await postJson(
    app,
    '/conta/exportar/enviar',
    {},
    {
      cookie: b.cookie,
      headers: { 'x-bovaro-usuario': aId },
    },
  );
  expect(refused.statusCode).toBe(401);
  expect(email.sent.length).toBe(before);
  expect(
    (
      await app.inject({
        method: 'GET',
        url: '/auth/session',
        headers: { cookie: b.cookie, 'x-bovaro-usuario': bId },
      })
    ).statusCode,
  ).toBe(200);
});

it('RF-078/RNF-014: logout com contexto A não revoga B; logout legado e vinculado continuam válidos', async () => {
  const { aId, b, bId } = await accounts();
  const refused = await postJson(
    app,
    '/auth/logout',
    {},
    {
      cookie: b.cookie,
      headers: { 'x-bovaro-usuario': aId },
    },
  );
  expect(refused.statusCode).toBe(401);
  expect(refused.headers['set-cookie']).toBeUndefined();
  expect((await getWithCookie(app, '/auth/session', b.cookie)).statusCode).toBe(200);
  expect(
    (
      await postJson(
        app,
        '/auth/logout',
        {},
        {
          cookie: b.cookie,
          headers: { 'x-bovaro-usuario': bId },
        },
      )
    ).statusCode,
  ).toBe(204);
  expect((await getWithCookie(app, '/auth/session', b.cookie)).statusCode).toBe(401);
  const anonymousBound = await postJson(
    app,
    '/auth/logout',
    {},
    {
      headers: { 'x-bovaro-usuario': aId },
    },
  );
  expect(anonymousBound.statusCode).toBe(401);
  expect(anonymousBound.headers['set-cookie']).toBeUndefined();
  expect((await postJson(app, '/auth/logout', {})).statusCode).toBe(204);
});

it('RF-078/RNF-014: contexto divergente não prolonga a janela de inatividade da sessão B', async () => {
  const initial = new Date('2026-10-20T12:00:00Z');
  let now = initial;
  const timed = buildTestApp({
    clock: () => now,
    config: { sessionIdleDays: 2, sessionMaxDays: 5 },
  });
  try {
    await timed.ready();
    const a = await signup(timed);
    const b = await signup(timed);
    const aId = sessionResponseSchema.parse(a.res.json()).usuario.id;
    now = new Date('2026-10-21T12:00:00Z');
    const refused = await timed.inject({
      method: 'GET',
      url: '/auth/session',
      headers: { cookie: b.cookie, 'x-bovaro-usuario': aId },
    });
    expect(refused.statusCode).toBe(401);
    expect(refused.headers['set-cookie']).toBeUndefined();
    now = new Date('2026-10-22T12:00:00.001Z');
    // Expirou após dois dias desde o cadastro: a tentativa de A não renovou a sessão de B.
    expect((await getWithCookie(timed, '/auth/session', b.cookie)).statusCode).toBe(401);
  } finally {
    await timed.close();
  }
});
