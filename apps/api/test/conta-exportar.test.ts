import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportacaoDadosSchema, sessionResponseSchema } from '@ogado/contracts';
import { TEST_ORIGIN } from './support/env';
import { buildTestApp, getWithCookie, prisma, signup } from './support/harness';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function conta() {
  const c = await signup(app);
  const sessao = sessionResponseSchema.parse(c.res.json());
  return { ...c, usuarioId: sessao.usuario.id, fazendaId: sessao.fazenda.id };
}

async function post(cookie: string, url: string, payload: object): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url,
    headers: { cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' },
    payload: JSON.stringify(payload),
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { id: string }).id;
}

const lote = (categoria: string) => ({
  id: randomUUID(),
  tipo: 'compra',
  categoria,
  modo: 'total',
  qtd: '10',
  peso: '3000',
  preco: '300',
});

describe('GET /conta/exportar (RNF-009)', () => {
  it('exige sessão', async () => {
    const res = await getWithCookie(app, '/conta/exportar');
    expect(res.statusCode).toBe(401);
  });

  it('devolve os dados do titular como anexo JSON, sem segredos nem excluídos', async () => {
    const c = await conta();
    await post(c.cookie, '/lotes', lote('Bezerro'));
    const apagado = await post(c.cookie, '/lotes', lote('Apagado'));
    const del = await app.inject({
      method: 'DELETE',
      url: `/lotes/${apagado}?version=1`,
      headers: { cookie: c.cookie, origin: TEST_ORIGIN },
    });
    expect(del.statusCode).toBe(200);
    await post(c.cookie, '/cenarios', {
      id: randomUUID(),
      nome: 'Cenário 1',
      criadoEm: '2026-10-18T00:00:00.000Z',
      entradas: { a: '1' },
      variantes: {},
      parametros: {},
      resultado: {},
    });

    const res = await getWithCookie(app, '/conta/exportar', c.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="ogado-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers['cache-control']).toContain('no-store');

    const dados = exportacaoDadosSchema.parse(res.json());
    expect(dados.versaoDoFormato).toBe(1);
    expect(Number.isNaN(Date.parse(dados.geradoEm))).toBe(false);
    expect(dados.observacao).toMatch(/exclu/i);
    expect(dados.perfil).toMatchObject({
      id: c.usuarioId,
      temSenha: true,
      googleVinculado: false,
    });
    expect(dados.fazenda.id).toBe(c.fazendaId);
    expect(dados.lotes.map((l) => l.categoria)).toEqual(['Bezerro']);
    expect(dados.cenarios.map((x) => x.nome)).toEqual(['Cenário 1']);
    expect(dados.recriaEntrada).toBeNull();

    // nunca hash, token de sessão ou segredo
    const sessoes = await prisma.sessao.findMany({ where: { usuarioId: c.usuarioId } });
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    expect(usuario.senhaHash).toBeTruthy();
    expect(res.body).not.toContain(usuario.senhaHash as string);
    expect(res.body).not.toMatch(/senhaHash|argon2|segredo/i);
    for (const s of sessoes) expect(res.body).not.toContain(s.segredoHash);
    const token = c.cookie.split('=').slice(1).join('=');
    expect(res.body).not.toContain(token);
  });

  it('marca googleVinculado quando há identidade Google', async () => {
    const c = await conta();
    await prisma.identidadeGoogle.create({
      data: { usuarioId: c.usuarioId, sub: `exp-${randomUUID()}`, email: 'g@example.test' },
    });
    const res = await getWithCookie(app, '/conta/exportar', c.cookie);
    const dados = exportacaoDadosSchema.parse(res.json());
    expect(dados.perfil.googleVinculado).toBe(true);
    expect(res.body).not.toContain('exp-');
  });

  it('isolamento: A nunca recebe dados de B', async () => {
    const a = await conta();
    const b = await conta();
    const idB = await post(b.cookie, '/lotes', lote('SoDeB'));
    const res = await getWithCookie(app, '/conta/exportar', a.cookie);
    const dados = exportacaoDadosSchema.parse(res.json());
    expect(dados.lotes).toEqual([]);
    expect(dados.perfil.id).toBe(a.usuarioId);
    expect(res.body).not.toContain(idB);
    expect(res.body).not.toContain(b.usuarioId);
    expect(res.body).not.toContain(b.fazendaId);
  });

  it('limita as exportações por usuário (429 com Retry-After)', async () => {
    const limited = buildTestApp({
      relaxedLimits: false,
      config: { rateLimit: { exportUser: { max: 2, windowMs: 60 * 60_000 } } },
    });
    await limited.ready();
    try {
      const c = await signup(limited);
      for (let i = 0; i < 2; i += 1) {
        expect((await getWithCookie(limited, '/conta/exportar', c.cookie)).statusCode).toBe(200);
      }
      const bloqueada = await getWithCookie(limited, '/conta/exportar', c.cookie);
      expect(bloqueada.statusCode).toBe(429);
      expect(bloqueada.headers['retry-after']).toBeDefined();
      const outro = await signup(limited);
      expect((await getWithCookie(limited, '/conta/exportar', outro.cookie)).statusCode).toBe(200);
    } finally {
      await limited.close();
    }
  });
});
