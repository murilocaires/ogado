import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema } from '@ogado/contracts';
import { TEST_ORIGIN } from './support/env';
import { buildTestApp, getWithCookie, postJson, prisma, signup } from './support/harness';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /auth/logout', () => {
  it('RF-002 CA-08: depois de sair, o mesmo cookie reenviado recebe 401; sair de novo também dá sucesso', async () => {
    const conta = await signup(app);
    expect((await getWithCookie(app, '/auth/session', conta.cookie)).statusCode).toBe(200);

    const saida = await postJson(app, '/auth/logout', {}, { cookie: conta.cookie });
    expect(saida.statusCode).toBe(204);

    const depois = await getWithCookie(app, '/auth/session', conta.cookie);
    expect(depois.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(depois.json()).erro.codigo).toBe('nao_autenticado');

    const outraVez = await postJson(app, '/auth/logout', {}, { cookie: conta.cookie });
    expect(outraVez.statusCode).toBe(204);
    const semCookie = await postJson(app, '/auth/logout', {});
    expect(semCookie.statusCode).toBe(204);
  });

  it.each([undefined, ''])(
    'RF-002: logout com Content-Type JSON e corpo vazio (%j) responde 204 e revoga a sessão',
    async (payload) => {
      const conta = await signup(app);
      const saida = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          'content-type': 'application/json',
          origin: TEST_ORIGIN,
          cookie: conta.cookie,
        },
        ...(payload === undefined ? {} : { payload }),
      });
      expect(saida.statusCode).toBe(204);
      expect((await getWithCookie(app, '/auth/session', conta.cookie)).statusCode).toBe(401);
    },
  );

  it('RNF-003: logout sem Content-Type JSON continua bloqueado (CSRF); corpo vazio em rota com schema dá 400', async () => {
    const conta = await signup(app);
    const semTipo = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { origin: TEST_ORIGIN, cookie: conta.cookie },
    });
    expect(semTipo.statusCode).toBe(403);
    expect((await getWithCookie(app, '/auth/session', conta.cookie)).statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
    });
    expect(login.statusCode).toBe(400);
  });

  it('RNF-003: o parser JSON continua rejeitando prototype poisoning', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      payload: '{"__proto__": {"admin": true}, "email": "a@b.co", "senha": "x"}',
    });
    expect(res.statusCode).toBe(400);
  });
});
