import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, sessionResponseSchema } from '@bovaro/contracts';
import type { GoogleIdClaims } from '../src/google/google-client';
import { TEST_EMAIL_DOMAIN, TEST_ORIGIN } from './support/env';
import { createFakeGoogleClient } from './support/fake-google';
import {
  buildTestApp,
  cookieFrom,
  getWithCookie,
  postJson,
  prisma,
  setCookieLine,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './support/harness';

const logs: string[] = [];
const logStream = new Writable({
  write(chunk: Buffer, _enc, done) {
    logs.push(chunk.toString());
    done();
  },
});
const fake = createFakeGoogleClient();
const app = buildTestApp({ googleClient: fake.client, logger: true, logStream });
const semGoogle = buildTestApp();

beforeAll(async () => {
  await app.ready();
  await semGoogle.ready();
});
afterAll(async () => {
  await app.close();
  await semGoogle.close();
  await prisma.$disconnect();
});

function googleCookieLine(res: LightMyRequestResponse): string | undefined {
  const raw = res.headers['set-cookie'];
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return lines.find((l) => /bovaro_google=/.test(l));
}

interface Flow {
  state: string;
  nonce: string;
  googleCookie: string;
}

async function begin(
  server: FastifyInstance,
  options: { modo?: 'entrar' | 'vincular'; cookie?: string } = {},
): Promise<Flow> {
  const query = options.modo ? `?modo=${options.modo}` : '';
  const res = await getWithCookie(server, `/auth/google/start${query}`, options.cookie);
  expect(res.statusCode).toBe(302);
  const url = new URL(String(res.headers['location']));
  const line = googleCookieLine(res);
  if (!line) throw new Error('sem cookie do fluxo');
  return {
    state: url.searchParams.get('state') ?? '',
    nonce: url.searchParams.get('nonce') ?? '',
    googleCookie: line.split(';')[0] ?? '',
  };
}

function newClaims(overrides: Partial<GoogleIdClaims> = {}): GoogleIdClaims {
  return {
    sub: `sub-${randomUUID()}`,
    email: uniqueEmail('g'),
    emailVerified: true,
    nonce: '',
    name: 'Ana Bovaro',
    ...overrides,
  };
}

async function finish(
  flow: Flow,
  claims: GoogleIdClaims,
  options: { cookie?: string; state?: string } = {},
): Promise<LightMyRequestResponse> {
  const code = `code-${randomUUID()}`;
  fake.script(code, { ...claims, nonce: claims.nonce || flow.nonce });
  const query = new URLSearchParams({ code, state: options.state ?? flow.state });
  return app.inject({
    method: 'GET',
    url: `/auth/google/callback?${query.toString()}`,
    headers: { cookie: [flow.googleCookie, options.cookie].filter(Boolean).join('; ') },
  });
}

const location = (res: LightMyRequestResponse): string => String(res.headers['location']);

function sendAuthed(method: 'DELETE' | 'PUT', url: string, cookie: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: {
      cookie,
      origin: TEST_ORIGIN,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
}

async function sessaoDe(cookie: string) {
  const res = await getWithCookie(app, '/auth/session', cookie);
  expect(res.statusCode).toBe(200);
  return sessionResponseSchema.parse(res.json());
}

/** Cria uma conta só-Google e devolve o cookie de sessão. */
async function contaSoGoogle(claims = newClaims()) {
  const res = await finish(await begin(app), claims);
  expect(location(res)).toBe(`${TEST_ORIGIN}/painel`);
  return { claims, cookie: cookieFrom(res) };
}

describe('GET /auth/google/start (RF-001)', () => {
  it('redireciona 302 ao Google com PKCE S256, state e nonce, e guarda o fluxo em cookie curto', async () => {
    const res = await getWithCookie(app, '/auth/google/start');
    expect(res.statusCode).toBe(302);
    const url = new URL(String(res.headers['location']));
    expect(url.origin).toBe('https://accounts.google.test');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')?.length).toBeGreaterThanOrEqual(43);
    expect(url.searchParams.get('state')?.length).toBeGreaterThanOrEqual(32);
    expect(url.searchParams.get('nonce')?.length).toBeGreaterThanOrEqual(32);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('redirect_uri')).toBe(`${TEST_ORIGIN}/api/auth/google/callback`);

    const line = googleCookieLine(res) ?? '';
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Max-Age=600/i);
    expect(line).toMatch(/Path=\//);
    expect(line).not.toMatch(/Domain=/i);
    // o verificador PKCE nunca vai ao Google nem aparece na URL
    expect(String(res.headers['location'])).not.toContain('code_verifier');
  });

  it('em produção o cookie do fluxo é __Host- e Secure', async () => {
    const prod = buildTestApp({ googleClient: fake.client, config: { production: true } });
    await prod.ready();
    const res = await getWithCookie(prod, '/auth/google/start');
    await prod.close();
    const line = googleCookieLine(res) ?? '';
    expect(line).toMatch(/^__Host-bovaro_google=/);
    expect(line).toMatch(/Secure/i);
  });

  it('cada início gera state, nonce e cookie novos', async () => {
    const a = await begin(app);
    const b = await begin(app);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.googleCookie).not.toBe(b.googleCookie);
  });

  it('modo=vincular sem sessão não inicia o fluxo: volta para /entrar', async () => {
    const res = await getWithCookie(app, '/auth/google/start?modo=vincular');
    expect(res.statusCode).toBe(302);
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(googleCookieLine(res)).toBeUndefined();
  });

  it('modo desconhecido é recusado pela validação', async () => {
    const res = await getWithCookie(app, '/auth/google/start?modo=outro');
    expect(res.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('validacao_invalida');
  });

  it('sem GOOGLE_CLIENT_ID/SECRET as rotas respondem 404 e a API segue de pé', async () => {
    const start = await getWithCookie(semGoogle, '/auth/google/start');
    expect(start.statusCode).toBe(404);
    expect(errorEnvelopeSchema.parse(start.json()).erro.codigo).toBe('nao_encontrado');
    const cb = await getWithCookie(semGoogle, '/auth/google/callback?code=x&state=y');
    expect(cb.statusCode).toBe(404);
    expect((await getWithCookie(semGoogle, '/health')).statusCode).toBe(200);
  });
});

describe('GET /auth/google/callback: entrar (RF-001)', () => {
  it('e-mail novo: cria usuário sem senha + fazenda + identidade, abre sessão e vai ao painel', async () => {
    const claims = newClaims();
    const res = await finish(await begin(app), claims);
    expect(res.statusCode).toBe(302);
    expect(location(res)).toBe(`${TEST_ORIGIN}/painel`);
    expect(setCookieLine(res)).toMatch(/HttpOnly/i);
    // o cookie do fluxo é descartado
    expect(googleCookieLine(res)).toMatch(/bovaro_google=;/);

    const sessao = await sessaoDe(cookieFrom(res));
    expect(sessao.usuario.email).toBe(claims.email);
    expect(sessao.usuario.nome).toBe('Ana Bovaro');
    expect(sessao.usuario.temSenha).toBe(false);
    expect(sessao.usuario.googleVinculado).toBe(true);
    // RNF-009: conta nova pelo Google nasce sem aceite; a web pede o aceite antes de liberar o produto
    expect(sessao.usuario.aceiteVigente).toBe(false);
    expect(sessao.usuario.aceiteTermosVersao).toBeNull();
    expect(sessao.fazenda.id).toBeTruthy();

    const row = await prisma.usuario.findUniqueOrThrow({
      where: { email: claims.email },
      include: { identidadeGoogle: true },
    });
    expect(row.senhaHash).toBeNull();
    expect(row.identidadeGoogle?.sub).toBe(claims.sub);
  });

  it('usuário recorrente: mesma conta, sessão nova, sem criar nada', async () => {
    const { claims, cookie } = await contaSoGoogle();
    const antes = await sessaoDe(cookie);
    const res = await finish(await begin(app), claims);
    expect(location(res)).toBe(`${TEST_ORIGIN}/painel`);
    const novoCookie = cookieFrom(res);
    expect(novoCookie).not.toBe(cookie);
    expect((await sessaoDe(novoCookie)).usuario.id).toBe(antes.usuario.id);
    expect(await prisma.fazenda.count({ where: { donoId: antes.usuario.id } })).toBe(1);
  });

  it('e-mail de conta com senha, sem Google vinculado: recusa e NÃO vincula nada', async () => {
    const conta = await signup(app);
    const claims = newClaims({ email: conta.email });
    const res = await finish(await begin(app), claims);
    expect(res.statusCode).toBe(302);
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google-conta-existente`);
    expect(setCookieLine(res)).toBeUndefined();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: conta.email } });
    expect(await prisma.identidadeGoogle.count({ where: { usuarioId: usuario.id } })).toBe(0);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(0);
  });

  it('state diferente do cookie: erro genérico, sem sessão e sem trocar o code', async () => {
    const flow = await begin(app);
    const antes = fake.exchanges.length;
    const res = await finish(flow, newClaims(), { state: 'state-forjado-qualquer-um-1234567890' });
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(setCookieLine(res)).toBeUndefined();
    expect(fake.exchanges.length).toBe(antes);
  });

  it('sem o cookie do fluxo: erro genérico', async () => {
    const flow = await begin(app);
    const code = `code-${randomUUID()}`;
    fake.script(code, newClaims({ nonce: flow.nonce }));
    const res = await getWithCookie(app, `/auth/google/callback?code=${code}&state=${flow.state}`);
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(setCookieLine(res)).toBeUndefined();
  });

  it('nonce do id_token diferente do guardado: erro, nada criado', async () => {
    const claims = newClaims({ nonce: 'nonce-de-outro-fluxo-1234567890123456' });
    const res = await finish(await begin(app), claims);
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(setCookieLine(res)).toBeUndefined();
    expect(await prisma.usuario.count({ where: { email: claims.email } })).toBe(0);
  });

  it('email_verified=false: erro, nada criado', async () => {
    const claims = newClaims({ emailVerified: false });
    const res = await finish(await begin(app), claims);
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(await prisma.usuario.count({ where: { email: claims.email } })).toBe(0);
  });

  it('falha na troca do code (Google recusa): erro genérico', async () => {
    const flow = await begin(app);
    const res = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=desconhecido&state=${flow.state}`,
      headers: { cookie: flow.googleCookie },
    });
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
  });

  it('usuário nega o consentimento (error=access_denied): erro genérico', async () => {
    const flow = await begin(app);
    const res = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?error=access_denied&state=${flow.state}`,
      headers: { cookie: flow.googleCookie },
    });
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
  });

  it('o retorno sem o cookie do fluxo (já descartado) não abre sessão', async () => {
    const flow = await begin(app);
    const claims = newClaims();
    const primeira = await finish(flow, claims);
    expect(location(primeira)).toBe(`${TEST_ORIGIN}/painel`);
    const code = `code-${randomUUID()}`;
    fake.script(code, { ...claims, nonce: flow.nonce });
    const res = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=${code}&state=${flow.state}`,
    });
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(setCookieLine(res)).toBeUndefined();
  });
});

describe('vincular e desvincular (RF-006)', () => {
  it('vincula o Google à conta logada e mostra o selo; desvincula quando há senha', async () => {
    const conta = await signup(app);
    const claims = newClaims();
    const flow = await begin(app, { modo: 'vincular', cookie: conta.cookie });
    const res = await finish(flow, claims, { cookie: conta.cookie });
    expect(location(res)).toBe(`${TEST_ORIGIN}/conta?google=vinculado`);
    // mantém a sessão atual; não troca de usuário
    expect(setCookieLine(res)).toBeUndefined();

    const vinculada = await sessaoDe(conta.cookie);
    expect(vinculada.usuario.googleVinculado).toBe(true);
    expect(vinculada.usuario.temSenha).toBe(true);

    // agora o Google também entra nesta mesma conta
    const entrada = await finish(await begin(app), claims);
    expect((await sessaoDe(cookieFrom(entrada))).usuario.id).toBe(vinculada.usuario.id);

    const del = await sendAuthed('DELETE', '/conta/google', conta.cookie);
    expect(del.statusCode).toBe(204);
    expect((await sessaoDe(conta.cookie)).usuario.googleVinculado).toBe(false);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(0);
  });

  it('vincular um sub que já é de outra conta: recusa e não move a identidade', async () => {
    const dona = await contaSoGoogle();
    const outra = await signup(app);
    const flow = await begin(app, { modo: 'vincular', cookie: outra.cookie });
    const res = await finish(flow, dona.claims, { cookie: outra.cookie });
    expect(location(res)).toBe(`${TEST_ORIGIN}/conta?erro=google-ja-vinculado`);
    expect((await sessaoDe(outra.cookie)).usuario.googleVinculado).toBe(false);
    expect((await sessaoDe(dona.cookie)).usuario.googleVinculado).toBe(true);
  });

  it('vincular sem sessão no retorno: erro, nada vinculado', async () => {
    const conta = await signup(app);
    const claims = newClaims();
    const flow = await begin(app, { modo: 'vincular', cookie: conta.cookie });
    const res = await finish(flow, claims); // sem cookie de sessão
    expect(location(res)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(0);
  });

  it('o retorno de outra sessão não vincula à conta que iniciou o fluxo', async () => {
    const a = await signup(app);
    const b = await signup(app);
    const claims = newClaims();
    const flow = await begin(app, { modo: 'vincular', cookie: a.cookie });
    const res = await finish(flow, claims, { cookie: b.cookie });
    expect(location(res)).toBe(`${TEST_ORIGIN}/conta?erro=google`);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(0);
  });

  it('desvincular sem senha definida: 409 e a identidade permanece', async () => {
    const { claims, cookie } = await contaSoGoogle();
    const res = await sendAuthed('DELETE', '/conta/google', cookie);
    expect(res.statusCode).toBe(409);
    const erro = errorEnvelopeSchema.parse(res.json()).erro;
    expect(erro.codigo).toBe('conflito');
    expect(erro.mensagem).toMatch(/senha/i);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(1);
  });

  it('conta só-Google define a senha (sem senhaAtual) e então desvincula', async () => {
    const { claims, cookie } = await contaSoGoogle();
    const def = await sendAuthed('PUT', '/conta/senha', cookie, { novaSenha: VALID_PASSWORD });
    expect(def.statusCode).toBe(204);
    const sessao = await sessaoDe(cookie);
    expect(sessao.usuario.temSenha).toBe(true);
    expect(sessao.usuario.googleVinculado).toBe(true);

    const del = await sendAuthed('DELETE', '/conta/google', cookie);
    expect(del.statusCode).toBe(204);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(0);
    // e agora entra por e-mail e senha
    const login = await postJson(app, '/auth/login', {
      email: sessao.usuario.email,
      senha: VALID_PASSWORD,
    });
    expect(login.statusCode).toBe(200);
    expect(sessionResponseSchema.parse(login.json()).usuario.temSenha).toBe(true);
  });

  it('desvincular sem Google vinculado: 404; sem sessão: 401', async () => {
    const conta = await signup(app);
    expect((await sendAuthed('DELETE', '/conta/google', conta.cookie)).statusCode).toBe(404);
    const anon = await app.inject({
      method: 'DELETE',
      url: '/conta/google',
      headers: { origin: TEST_ORIGIN },
    });
    expect(anon.statusCode).toBe(401);
  });

  it('conta só-Google não consegue entrar por e-mail e senha', async () => {
    const { claims } = await contaSoGoogle();
    const res = await postJson(app, '/auth/login', { email: claims.email, senha: VALID_PASSWORD });
    expect(res.statusCode).toBe(401);
  });

  it('apagar a conta remove a identidade Google em cascata', async () => {
    const { claims, cookie } = await contaSoGoogle();
    const del = await sendAuthed('DELETE', '/conta', cookie, { confirmacao: 'deletar' });
    expect(del.statusCode).toBe(204);
    expect(await prisma.identidadeGoogle.count({ where: { sub: claims.sub } })).toBe(0);
    expect(await prisma.usuario.count({ where: { email: claims.email } })).toBe(0);
  });

  it('isolamento A/B: A nunca vê nem mexe na identidade de B', async () => {
    const a = await signup(app);
    const b = await contaSoGoogle();
    await sendAuthed('PUT', '/conta/senha', b.cookie, { novaSenha: VALID_PASSWORD });
    // A não tem Google: o DELETE de A não toca a de B
    expect((await sendAuthed('DELETE', '/conta/google', a.cookie)).statusCode).toBe(404);
    expect(await prisma.identidadeGoogle.count({ where: { sub: b.claims.sub } })).toBe(1);
    const sessaoA = await sessaoDe(a.cookie);
    expect(JSON.stringify(sessaoA)).not.toContain(b.claims.sub);
    expect(sessaoA.usuario.googleVinculado).toBe(false);
  });
});

describe('respostas de sessão carregam temSenha e googleVinculado', () => {
  it('signup, login, session e perfil', async () => {
    const conta = await signup(app);
    expect(sessionResponseSchema.parse(conta.res.json()).usuario).toMatchObject({
      temSenha: true,
      googleVinculado: false,
    });
    const login = await postJson(app, '/auth/login', { email: conta.email, senha: conta.senha });
    expect(sessionResponseSchema.parse(login.json()).usuario.temSenha).toBe(true);
    const perfil = await app.inject({
      method: 'PATCH',
      url: '/conta/perfil',
      headers: { cookie: conta.cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' },
      payload: JSON.stringify({ nome: 'Zé', email: conta.email }),
    });
    expect(sessionResponseSchema.parse(perfil.json()).usuario).toMatchObject({
      temSenha: true,
      googleVinculado: false,
    });
  });
});

describe('logs', () => {
  it('nenhum code, state, nonce, e-mail ou identificador do Google aparece nos logs', async () => {
    const claims = newClaims();
    const flow = await begin(app);
    const res = await finish(flow, claims);
    expect(location(res)).toBe(`${TEST_ORIGIN}/painel`);
    await finish(await begin(app), newClaims({ emailVerified: false }));

    const todo = logs.join('\n');
    expect(todo.length).toBeGreaterThan(0);
    expect(todo).not.toMatch(/code-[0-9a-f-]{36}/);
    expect(todo).not.toContain(flow.state);
    expect(todo).not.toContain(flow.nonce);
    expect(todo).not.toContain(claims.email);
    expect(todo).not.toContain(claims.sub);
    expect(todo).not.toContain(TEST_EMAIL_DOMAIN);
    expect(todo).not.toContain('bovaro_google');
  });
});

describe('rate limit', () => {
  it('estourar o limite por IP no início do fluxo bloqueia (302 para o erro genérico)', async () => {
    const limitado = buildTestApp({
      googleClient: fake.client,
      relaxedLimits: false,
      config: { rateLimit: { googleIp: { max: 2, windowMs: 60_000 } } },
    });
    await limitado.ready();
    const r1 = await getWithCookie(limitado, '/auth/google/start');
    const r2 = await getWithCookie(limitado, '/auth/google/start');
    const r3 = await getWithCookie(limitado, '/auth/google/start');
    await limitado.close();
    expect([r1.statusCode, r2.statusCode]).toEqual([302, 302]);
    expect(location(r3)).toBe(`${TEST_ORIGIN}/entrar?erro=google`);
    expect(googleCookieLine(r3)).toBeUndefined();
  });
});
