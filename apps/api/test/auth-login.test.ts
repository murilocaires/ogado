import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, sessionResponseSchema } from '@ogado/contracts';
import {
  buildTestApp,
  cookieFrom,
  getWithCookie,
  postJson,
  prisma,
  signup,
  uniqueEmail,
} from './support/harness';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('RF-001 CA-05: e-mail inexistente e senha errada dão a mesma resposta (401 credenciais_invalidas, mesmo corpo)', async () => {
    const conta = await signup(app);

    const senhaErrada = await postJson(app, '/auth/login', {
      email: conta.email,
      senha: 'Outra#Senha99',
    });
    const emailInexistente = await postJson(app, '/auth/login', {
      email: uniqueEmail('fantasma'),
      senha: 'Outra#Senha99',
    });

    expect(senhaErrada.statusCode).toBe(401);
    expect(emailInexistente.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(senhaErrada.json()).erro.codigo).toBe('credenciais_invalidas');
    expect(emailInexistente.json()).toEqual(senhaErrada.json());
    expect(senhaErrada.headers['set-cookie']).toBeUndefined();
    expect(emailInexistente.headers['set-cookie']).toBeUndefined();
  });

  it('RF-001 CA-05: senha correta responde 200 com sessão nova e dados do usuário e da fazenda', async () => {
    const conta = await signup(app);

    const res = await postJson(app, '/auth/login', { email: conta.email, senha: conta.senha });

    expect(res.statusCode).toBe(200);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.usuario.email).toBe(conta.email);
    const novoCookie = cookieFrom(res);
    expect(novoCookie).not.toBe(conta.cookie);
    const session = await getWithCookie(app, '/auth/session', novoCookie);
    expect(session.statusCode).toBe(200);
  });

  it('RF-001 CA-04: um cookie de sessão anterior enviado junto não é reaproveitado (sem fixação)', async () => {
    const conta = await signup(app);

    const res = await postJson(
      app,
      '/auth/login',
      { email: conta.email, senha: conta.senha },
      { cookie: conta.cookie },
    );

    expect(res.statusCode).toBe(200);
    const novo = cookieFrom(res);
    expect(novo).not.toBe(conta.cookie);
    expect((await getWithCookie(app, '/auth/session', novo)).statusCode).toBe(200);
    // a sessão anterior segue sendo a dela, separada da nova
    expect((await getWithCookie(app, '/auth/session', conta.cookie)).statusCode).toBe(200);
    await postJson(app, '/auth/logout', {}, { cookie: novo });
    expect((await getWithCookie(app, '/auth/session', novo)).statusCode).toBe(401);
    expect((await getWithCookie(app, '/auth/session', conta.cookie)).statusCode).toBe(200);
  });
});
