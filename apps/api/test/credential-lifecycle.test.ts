import { afterAll, beforeAll, expect, it } from 'vitest';
import { createMemoryEmailSender } from '../src/email/memory-sender';
import { ARGON2_FLOOR } from '../src/config';
import { createPasswordHasher } from '../src/password';
import { TEST_ORIGIN } from './support/env';
import {
  buildTestApp,
  cookieFrom,
  getWithCookie,
  postJson,
  prisma,
  signup,
  uniqueEmail,
} from './support/harness';

const mailer = createMemoryEmailSender();
const app = buildTestApp({ emailSender: mailer, clock: () => new Date('2026-10-20T12:00:00Z') });
const NEW_PASSWORD = 'Nova#Senha2027';

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function requestReset(email: string): Promise<string> {
  expect((await postJson(app, '/auth/senha/esqueci', { email })).statusCode).toBe(202);
  const token = /token=([A-Za-z0-9_-]+)/.exec(mailer.last()?.text ?? '')?.[1];
  if (!token) throw new Error('e-mail sem token');
  return token;
}

it('RF-002/005: trocar senha revoga links anteriores e conserva somente a sessão atual', async () => {
  const c = await signup(app);
  const other = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
  expect(other.statusCode).toBe(200);
  const token = await requestReset(c.email);
  const change = await app.inject({
    method: 'PUT',
    url: '/conta/senha',
    headers: { cookie: c.cookie, origin: TEST_ORIGIN },
    payload: { senhaAtual: c.senha, novaSenha: NEW_PASSWORD },
  });
  expect(change.statusCode).toBe(204);
  expect((await getWithCookie(app, '/auth/session', c.cookie)).statusCode).toBe(200);
  expect((await getWithCookie(app, '/auth/session', cookieFrom(other))).statusCode).toBe(401);
  const reset = await postJson(app, '/auth/senha/redefinir', { token, novaSenha: 'Invasor#2028' });
  expect(reset.statusCode).toBe(400);
  expect(
    (await postJson(app, '/auth/login', { email: c.email, senha: NEW_PASSWORD })).statusCode,
  ).toBe(200);
});

it('RF-002/004: trocar e-mail revoga o link enviado ao endereço anterior', async () => {
  const c = await signup(app);
  const token = await requestReset(c.email);
  const email = uniqueEmail('novo-endereco');
  const change = await app.inject({
    method: 'PATCH',
    url: '/conta/perfil',
    headers: { cookie: c.cookie, origin: TEST_ORIGIN },
    payload: { nome: 'Pecuarista', email },
  });
  expect(change.statusCode).toBe(200);
  expect(
    (await postJson(app, '/auth/senha/redefinir', { token, novaSenha: NEW_PASSWORD })).statusCode,
  ).toBe(400);
  expect((await postJson(app, '/auth/login', { email, senha: c.senha })).statusCode).toBe(200);
  const currentToken = await requestReset(email);
  expect(
    (await postJson(app, '/auth/senha/redefinir', { token: currentToken, novaSenha: NEW_PASSWORD }))
      .statusCode,
  ).toBe(204);
});

it('RF-002/004: editar somente o nome mantém o link válido', async () => {
  const c = await signup(app);
  const token = await requestReset(c.email);
  expect(
    (
      await app.inject({
        method: 'PATCH',
        url: '/conta/perfil',
        headers: { cookie: c.cookie, origin: TEST_ORIGIN },
        payload: { nome: 'Outro nome', email: c.email },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await postJson(app, '/auth/senha/redefinir', { token, novaSenha: NEW_PASSWORD })).statusCode,
  ).toBe(204);
});

it('RF-002: duas emissões concorrentes deixam somente um link utilizável', async () => {
  const c = await signup(app);
  const before = mailer.sent.length;
  const requests = await Promise.all([
    postJson(app, '/auth/senha/esqueci', { email: c.email }),
    postJson(app, '/auth/senha/esqueci', { email: c.email }),
  ]);
  expect(requests.map((r) => r.statusCode)).toEqual([202, 202]);
  const tokens = mailer.sent
    .slice(before)
    .map((message) => /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1]);
  expect(tokens).toHaveLength(2);
  const results: number[] = [];
  for (const token of tokens) {
    expect(token).toBeDefined();
    results.push(
      (await postJson(app, '/auth/senha/redefinir', { token, novaSenha: NEW_PASSWORD })).statusCode,
    );
  }
  expect(results.sort()).toEqual([204, 400]);
});

it('RF-002: dois resgates concorrentes do mesmo link permitem somente uma troca', async () => {
  const c = await signup(app);
  const token = await requestReset(c.email);
  const results = await Promise.all([
    postJson(app, '/auth/senha/redefinir', { token, novaSenha: NEW_PASSWORD }),
    postJson(app, '/auth/senha/redefinir', { token, novaSenha: 'Outra#Senha2028' }),
  ]);
  expect(results.map((res) => res.statusCode).sort()).toEqual([204, 400]);
});

it('RF-005: duas trocas autenticadas concorrentes não reutilizam a verificação da senha antiga', async () => {
  const c = await signup(app);
  const change = (novaSenha: string) =>
    app.inject({
      method: 'PUT',
      url: '/conta/senha',
      headers: { cookie: c.cookie, origin: TEST_ORIGIN },
      payload: { senhaAtual: c.senha, novaSenha },
    });
  const results = await Promise.all([change(NEW_PASSWORD), change('Outra#Senha2028')]);
  expect(results.map((res) => res.statusCode).sort()).toEqual([204, 400]);
});

it('RF-002/005: rehash técnico no login mantém links pendentes e sessões anteriores', async () => {
  const c = await signup(app);
  const token = await requestReset(c.email);
  const stronger = buildTestApp({
    config: { argon2: { timeCost: 3 } },
    clock: () => new Date('2026-10-20T12:00:00Z'),
  });
  try {
    await stronger.ready();
    expect(
      (await postJson(stronger, '/auth/login', { email: c.email, senha: c.senha })).statusCode,
    ).toBe(200);
    expect((await getWithCookie(stronger, '/auth/session', c.cookie)).statusCode).toBe(200);
    expect(
      (await postJson(app, '/auth/senha/redefinir', { token, novaSenha: NEW_PASSWORD })).statusCode,
    ).toBe(204);
  } finally {
    await stronger.close();
  }
});

function latch(): { promise: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

it.each(['reset', 'troca autenticada'])(
  'RF-002/005 RNF-003: login verificado antes de %s não cria sessão com a senha antiga depois da troca',
  async (changeKind) => {
    const c = await signup(app);
    const token = await requestReset(c.email);
    const verified = latch();
    const resume = latch();
    const realHasher = createPasswordHasher(ARGON2_FLOOR);
    const delayed = buildTestApp({
      clock: () => new Date('2026-10-20T12:00:00Z'),
      passwordHasher: {
        ...realHasher,
        async verify(hash, password) {
          const valid = await realHasher.verify(hash, password);
          if (valid && password === c.senha) {
            verified.release();
            await resume.promise;
          }
          return valid;
        },
      },
    });
    let pending: ReturnType<typeof postJson> | undefined;
    try {
      await delayed.ready();
      pending = postJson(delayed, '/auth/login', { email: c.email, senha: c.senha });
      await verified.promise;
      const change =
        changeKind === 'reset'
          ? await postJson(app, '/auth/senha/redefinir', { token, novaSenha: NEW_PASSWORD })
          : await app.inject({
              method: 'PUT',
              url: '/conta/senha',
              headers: { cookie: c.cookie, origin: TEST_ORIGIN },
              payload: { senhaAtual: c.senha, novaSenha: NEW_PASSWORD },
            });
      expect(change.statusCode).toBe(204);
      resume.release();
      const login = await pending;
      expect(login.statusCode).toBe(401);
      expect(login.headers['set-cookie']).toBeUndefined();
      expect(
        (await postJson(app, '/auth/login', { email: c.email, senha: NEW_PASSWORD })).statusCode,
      ).toBe(200);
    } finally {
      resume.release();
      await pending;
      await delayed.close();
    }
  },
);
