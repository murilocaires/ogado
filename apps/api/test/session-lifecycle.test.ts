import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, sessionResponseSchema } from '@ogado/contracts';
import {
  buildTestApp,
  cookieFrom,
  getWithCookie,
  postJson,
  prisma,
  setCookieLine,
  uniqueEmail,
  VALID_PASSWORD,
} from './support/harness';

const DAY_MS = 24 * 60 * 60 * 1000;

let now = new Date('2026-01-01T12:00:00.000Z');
const advance = (days: number): void => {
  now = new Date(now.getTime() + days * DAY_MS);
};

const app = buildTestApp({ clock: () => now });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function newSession() {
  const email = uniqueEmail('ciclo');
  const res = await postJson(app, '/auth/signup', {
    email,
    senha: VALID_PASSWORD,
    aceiteTermos: true,
  });
  expect(res.statusCode).toBe(201);
  return { email, res, cookie: cookieFrom(res) };
}

describe('GET /auth/session', () => {
  it('RF-002 CA-07: sessão válida devolve usuário e fazenda, sem hash nem token', async () => {
    const { cookie, email } = await newSession();
    const res = await getWithCookie(app, '/auth/session', cookie);

    expect(res.statusCode).toBe(200);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.usuario.email).toBe(email);
    expect(Object.keys(res.json()).sort()).toEqual(['fazenda', 'usuario']);
    expect(Object.keys(res.json().usuario).sort()).toEqual([
      'aceiteTermosEm',
      'aceiteTermosVersao',
      'aceiteVigente',
      'email',
      'googleVinculado',
      'id',
      'nome',
      'temSenha',
    ]);
    const segredo = cookie.split('=')[1]?.split('.')[1] ?? '';
    expect(segredo.length).toBeGreaterThan(20);
    expect(res.body).not.toContain(segredo);
    expect(res.body).not.toMatch(/argon2|senhaHash|segredoHash|token/i);
  });
});

describe('expiração da sessão', () => {
  it('RF-002 CA-09: sem uso além do limite de inatividade (30 dias) responde 401 sessao_expirada', async () => {
    const { cookie } = await newSession();

    advance(29);
    expect((await getWithCookie(app, '/auth/session', cookie)).statusCode).toBe(200);

    advance(31); // 31 dias sem uso desde a última verificação
    const expirada = await getWithCookie(app, '/auth/session', cookie);
    expect(expirada.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(expirada.json()).erro.codigo).toBe('sessao_expirada');
  });

  it('RF-002 CA-09: o uso renova a janela de inatividade, mas o teto absoluto (90 dias) vale sempre', async () => {
    const { cookie } = await newSession();

    for (const dias of [29, 29, 29]) {
      advance(dias); // 29, 58, 87 dias: ativo a cada <30 dias
      expect((await getWithCookie(app, '/auth/session', cookie)).statusCode).toBe(200);
    }

    advance(4); // 91 dias desde a criação, mesmo com uso recente
    const noTeto = await getWithCookie(app, '/auth/session', cookie);
    expect(noTeto.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(noTeto.json()).erro.codigo).toBe('sessao_expirada');
  });

  it('RF-002 CA-09: a expiração é configurável por ambiente (ex.: 2 dias de inatividade, teto de 5)', async () => {
    const curta = buildTestApp({
      clock: () => now,
      config: { sessionIdleDays: 2, sessionMaxDays: 5 },
    });
    await curta.ready();
    const res = await postJson(curta, '/auth/signup', {
      email: uniqueEmail('curta'),
      senha: VALID_PASSWORD,
      aceiteTermos: true,
    });
    const cookie = cookieFrom(res);
    expect(setCookieLine(res)).toMatch(/Max-Age=172800\b/); // cookie dura o que a sessão dura

    advance(3);
    const expirada = await getWithCookie(curta, '/auth/session', cookie);
    expect(expirada.statusCode).toBe(401);
    expect(errorEnvelopeSchema.parse(expirada.json()).erro.codigo).toBe('sessao_expirada');
    await curta.close();
  });

  it('RF-002: o cookie de sessão dura o tempo de inatividade (30 dias) e é reemitido ao renovar', async () => {
    const { res, cookie } = await newSession();
    expect(setCookieLine(res)).toMatch(/Max-Age=2592000\b/);

    advance(2); // mais de 1 h desde a última gravação: renova
    const renovada = await getWithCookie(app, '/auth/session', cookie);
    expect(renovada.statusCode).toBe(200);
    expect(setCookieLine(renovada)).toMatch(/Max-Age=2592000\b/);
  });
});
