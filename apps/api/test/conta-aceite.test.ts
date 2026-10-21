import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, sessionResponseSchema, TERMOS_VERSAO } from '@bovaro/contracts';
import {
  buildTestApp,
  getWithCookie,
  postJson,
  prisma,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './support/harness';

const app = buildTestApp({ clock: () => new Date('2026-10-20T12:00:00.000Z') });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('RNF-009 aceite dos termos no cadastro por e-mail', () => {
  it('sem aceiteTermos o cadastro é recusado com 400 e mensagem clara, e nada é criado', async () => {
    const email = uniqueEmail('sem-aceite');
    const res = await postJson(app, '/auth/signup', { email, senha: VALID_PASSWORD });
    expect(res.statusCode).toBe(400);
    const erro = errorEnvelopeSchema.parse(res.json()).erro;
    expect(erro.codigo).toBe('validacao_invalida');
    expect(erro.campos?.map((c) => c.caminho)).toEqual(['aceiteTermos']);
    expect(erro.campos?.[0]?.mensagem).toMatch(/Aceite os Termos de Uso/);
    expect(await prisma.usuario.findUnique({ where: { email } })).toBeNull();
  });

  it('aceiteTermos false (ou chave desconhecida) também é recusado', async () => {
    for (const extra of [{ aceiteTermos: false }, { aceiteTermos: true, admin: true }]) {
      const res = await postJson(app, '/auth/signup', {
        email: uniqueEmail('aceite-ruim'),
        senha: VALID_PASSWORD,
        ...extra,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('com aceiteTermos grava a versão vigente e a data; a sessão devolve aceiteVigente=true', async () => {
    const { email, res, cookie } = await signup(app);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.usuario.aceiteVigente).toBe(true);
    expect(body.usuario.aceiteTermosVersao).toBe(TERMOS_VERSAO);
    expect(body.usuario.aceiteTermosEm).toBe('2026-10-20T12:00:00.000Z');

    const linha = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(linha.aceiteTermosVersao).toBe(TERMOS_VERSAO);
    expect(linha.aceiteTermosEm?.toISOString()).toBe('2026-10-20T12:00:00.000Z');

    const sessao = sessionResponseSchema.parse(
      (await getWithCookie(app, '/auth/session', cookie)).json(),
    );
    expect(sessao.usuario.aceiteVigente).toBe(true);
  });
});

describe('POST /conta/aceite', () => {
  it('exige sessão', async () => {
    const res = await postJson(app, '/conta/aceite', { versao: TERMOS_VERSAO });
    expect(res.statusCode).toBe(401);
  });

  it('versão desatualizada no banco: aceiteVigente=false no login e na sessão; aceitar a vigente corrige', async () => {
    const { email, senha, cookie } = await signup(app);
    await prisma.usuario.update({
      where: { email },
      data: { aceiteTermosVersao: '2020-01-01' },
    });

    const sessao = sessionResponseSchema.parse(
      (await getWithCookie(app, '/auth/session', cookie)).json(),
    );
    expect(sessao.usuario.aceiteVigente).toBe(false);
    expect(sessao.usuario.aceiteTermosVersao).toBe('2020-01-01');

    const login = await postJson(app, '/auth/login', { email, senha });
    expect(sessionResponseSchema.parse(login.json()).usuario.aceiteVigente).toBe(false);

    const res = await postJson(app, '/conta/aceite', { versao: TERMOS_VERSAO }, { cookie });
    expect(res.statusCode).toBe(200);
    const depois = sessionResponseSchema.parse(res.json());
    expect(depois.usuario.aceiteVigente).toBe(true);
    expect(depois.usuario.aceiteTermosVersao).toBe(TERMOS_VERSAO);
    expect(depois.usuario.aceiteTermosEm).toBe('2026-10-20T12:00:00.000Z');
    const linha = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(linha.aceiteTermosVersao).toBe(TERMOS_VERSAO);
  });

  it('só aceita a versão vigente: outra versão responde 409 e não grava nada', async () => {
    const { email, cookie } = await signup(app);
    await prisma.usuario.update({
      where: { email },
      data: { aceiteTermosVersao: null, aceiteTermosEm: null },
    });
    const res = await postJson(app, '/conta/aceite', { versao: '1999-01-01' }, { cookie });
    expect(res.statusCode).toBe(409);
    const linha = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(linha.aceiteTermosVersao).toBeNull();
  });

  it('corpo inválido (chave extra ou sem versão) responde 400', async () => {
    const { cookie } = await signup(app);
    expect((await postJson(app, '/conta/aceite', {}, { cookie })).statusCode).toBe(400);
    expect(
      (await postJson(app, '/conta/aceite', { versao: TERMOS_VERSAO, usuarioId: 'x' }, { cookie }))
        .statusCode,
    ).toBe(400);
  });

  it('só age sobre a conta da sessão: aceitar como A não altera B', async () => {
    const a = await signup(app);
    const b = await signup(app);
    await prisma.usuario.updateMany({
      where: { email: { in: [a.email, b.email] } },
      data: { aceiteTermosVersao: '2020-01-01' },
    });
    expect(
      (await postJson(app, '/conta/aceite', { versao: TERMOS_VERSAO }, { cookie: a.cookie }))
        .statusCode,
    ).toBe(200);
    const linhaB = await prisma.usuario.findUniqueOrThrow({ where: { email: b.email } });
    expect(linhaB.aceiteTermosVersao).toBe('2020-01-01');
  });
});
