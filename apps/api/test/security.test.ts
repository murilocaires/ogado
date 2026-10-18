import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, type PrismaClient } from '@ogado/db';
import { errorEnvelopeSchema } from '@ogado/contracts';
import {
  buildTestApp,
  getWithCookie,
  postJson,
  prisma,
  setCookieLine,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './support/harness';
import { TEST_ORIGIN } from './support/env';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function expectNoAccount(email: string): Promise<void> {
  const login = await postJson(app, '/auth/login', { email, senha: VALID_PASSWORD });
  expect(login.statusCode).toBe(401);
}

describe('CSRF (Origin, Sec-Fetch-Site, JSON)', () => {
  it('RNF-003 CA-17: Origin fora da lista responde 403 e nada muda', async () => {
    const email = uniqueEmail('csrf');
    const res = await postJson(
      app,
      '/auth/signup',
      { email, senha: VALID_PASSWORD },
      { origin: 'https://evil.example' },
    );
    expect(res.statusCode).toBe(403);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('requisicao_bloqueada');
    expect(res.headers['set-cookie']).toBeUndefined();
    await expectNoAccount(email);
  });

  it('RNF-003 CA-17: requisição que altera estado sem Origin responde 403', async () => {
    const email = uniqueEmail('csrf');
    const res = await postJson(
      app,
      '/auth/signup',
      { email, senha: VALID_PASSWORD },
      { origin: null },
    );
    expect(res.statusCode).toBe(403);
    await expectNoAccount(email);
  });

  it('RNF-003 CA-17: Sec-Fetch-Site cross-site responde 403, mesmo com Origin permitida', async () => {
    const email = uniqueEmail('csrf');
    const res = await postJson(
      app,
      '/auth/signup',
      { email, senha: VALID_PASSWORD },
      { headers: { 'sec-fetch-site': 'cross-site' } },
    );
    expect(res.statusCode).toBe(403);
    await expectNoAccount(email);
  });

  it('RNF-003 CA-17: Sec-Fetch-Site same-origin e same-site passam', async () => {
    for (const site of ['same-origin', 'same-site']) {
      const res = await postJson(
        app,
        '/auth/signup',
        { email: uniqueEmail('csrf'), senha: VALID_PASSWORD },
        { headers: { 'sec-fetch-site': site } },
      );
      expect(res.statusCode, site).toBe(201);
    }
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'])(
    'RNF-003 CA-17: corpo %s (não é JSON) responde 403 e nada muda',
    async (contentType) => {
      const email = uniqueEmail('csrf');
      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        headers: { 'content-type': contentType, origin: TEST_ORIGIN },
        payload: JSON.stringify({ email, senha: VALID_PASSWORD }),
      });
      expect(res.statusCode).toBe(403);
      await expectNoAccount(email);
    },
  );

  it('RNF-003 CA-17: logout cross-site é bloqueado e a sessão continua valendo', async () => {
    const conta = await signup(app);
    const res = await postJson(
      app,
      '/auth/logout',
      {},
      { cookie: conta.cookie, origin: 'https://evil.example' },
    );
    expect(res.statusCode).toBe(403);
    expect((await getWithCookie(app, '/auth/session', conta.cookie)).statusCode).toBe(200);
  });

  it('RNF-003 CA-17: GET não exige Origin (e nunca altera estado)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });
});

/** Cliente "Prisma" cujas chamadas todas falham com uma mensagem que carrega PII (pior caso). */
function failingPrisma(message: string): PrismaClient {
  const rejecting = (): Promise<never> => Promise.reject(new Error(message));
  const deep: unknown = new Proxy(rejecting, {
    get: () => deep,
    apply: () => rejecting(),
  });
  return deep as PrismaClient;
}

function captureLogs(): { stream: Writable; text: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk.toString('utf8'));
      cb();
    },
  });
  return { stream, text: () => chunks.join('') };
}

describe('erros inesperados', () => {
  it('RNF-003 CA-18: falha do banco no login responde 500 erro_interno com requestId, sem stack nem mensagem do ORM, e o log não tem senha, cookie nem e-mail', async () => {
    const email = uniqueEmail('log');
    const senha = 'Segredo#Unico987';
    const cookieValor = 'ogado_session=idsecreto123.segredosecreto456';
    const ipCliente = '203.0.113.77';
    const logs = captureLogs();
    const quebrado = buildTestApp({
      prisma: failingPrisma(
        `Invalid prisma.usuario.findUnique() invocation: email "${email}" senha "${senha}"`,
      ),
      logger: true,
      logStream: logs.stream,
    });
    await quebrado.ready();

    const res = await postJson(
      quebrado,
      '/auth/login',
      { email, senha },
      { headers: { cookie: cookieValor }, remoteAddress: ipCliente },
    );

    expect(res.statusCode).toBe(500);
    const erro = errorEnvelopeSchema.parse(res.json()).erro;
    expect(erro.codigo).toBe('erro_interno');
    expect(erro.requestId).toBeTruthy();
    for (const proibido of [
      email,
      senha,
      'prisma',
      'invocation',
      'stack',
      ' at ',
      'node_modules',
    ]) {
      expect(res.body.toLowerCase(), proibido).not.toContain(proibido.toLowerCase());
    }

    await quebrado.close();
    const log = logs.text();
    expect(log).toContain('erro inesperado'); // o erro foi registrado...
    expect(log).toContain(erro.requestId);
    for (const segredo of [email, senha, 'idsecreto123', 'segredosecreto456', ipCliente]) {
      expect(log, `log vazou ${segredo}`).not.toContain(segredo); // ...sem PII
    }
  });

  it('RNF-003 CA-18: falha do /health responde 503 e o log traz tipo e frames, sem IP do cliente nem a mensagem do driver', async () => {
    const ipCliente = '198.51.100.23';
    const logs = captureLogs();
    const quebrado = buildTestApp({
      prisma: failingPrisma('connect ECONNREFUSED 10.9.8.7:5432 senhaDoDriver=xyz'),
      logger: true,
      logStream: logs.stream,
    });
    await quebrado.ready();

    const res = await quebrado.inject({ method: 'GET', url: '/health', remoteAddress: ipCliente });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'error', db: 'down' });

    await quebrado.close();
    const log = logs.text();
    expect(log).toContain('health check');
    expect(log).toContain('errType');
    expect(log).toContain('frames');
    for (const segredo of [ipCliente, '10.9.8.7', 'senhaDoDriver', 'ECONNREFUSED']) {
      expect(log, `log vazou ${segredo}`).not.toContain(segredo);
    }
  });

  it('RNF-003 CA-18: banco realmente indisponível (porta fechada) também vira 500 erro_interno', async () => {
    const semBanco = createPrisma('postgresql://ogado:x@127.0.0.1:1/ogado?schema=public');
    const quebrado = buildTestApp({ prisma: semBanco });
    await quebrado.ready();

    const res = await postJson(quebrado, '/auth/login', {
      email: uniqueEmail(),
      senha: VALID_PASSWORD,
    });

    expect(res.statusCode).toBe(500);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('erro_interno');
    expect(res.body).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|prisma/i);
    await quebrado.close();
    await semBanco.$disconnect();
  });

  it('RNF-003 CA-18: JSON malformado responde 400 no envelope, sem detalhes internos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      payload: '{"email": ',
    });
    expect(res.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('requisicao_invalida');
  });

  it('rota inexistente responde 404 no envelope', async () => {
    const res = await getWithCookie(app, '/nao-existe');
    expect(res.statusCode).toBe(404);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('nao_encontrado');
  });
});

describe('headers de segurança e CORS', () => {
  it('RNF-003 CA-19: o CORS anuncia métodos explícitos no preflight', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: { origin: TEST_ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-methods']).toBe('GET, HEAD, POST, PUT, PATCH, DELETE');
  });

  it('RNF-003 CA-19: toda resposta traz CSP default-src none, nosniff e Referrer-Policy; HSTS só em produção', async () => {
    const respostas = [
      await app.inject({ method: 'GET', url: '/health' }),
      await app.inject({ method: 'GET', url: '/fazendas' }), // 401
      await app.inject({ method: 'GET', url: '/nao-existe' }), // 404
    ];
    for (const res of respostas) {
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['strict-transport-security']).toBeUndefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    }

    const prod = buildTestApp({ config: { production: true } });
    await prod.ready();
    const emProducao = await prod.inject({ method: 'GET', url: '/health' });
    expect(emProducao.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    await prod.close();
  });

  it('RNF-003 CA-19: em produção o cookie é __Host-, Secure, HttpOnly, SameSite=Lax, Path=/ e sem Domain', async () => {
    const prod = buildTestApp({ config: { production: true } });
    await prod.ready();
    const res = await postJson(prod, '/auth/signup', {
      email: uniqueEmail('prod'),
      senha: VALID_PASSWORD,
    });
    expect(res.statusCode).toBe(201);
    const linha = setCookieLine(res) ?? '';
    expect(linha).toMatch(/^__Host-ogado_session=/);
    expect(linha).toMatch(/; Secure/i);
    expect(linha).toMatch(/HttpOnly/i);
    expect(linha).toMatch(/SameSite=Lax/i);
    expect(linha).toMatch(/Path=\//);
    expect(linha).not.toMatch(/Domain=/i);
    await prod.close();
  });

  it('RNF-003 CA-19: CORS aceita só as origens configuradas, com credenciais', async () => {
    const permitida = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: TEST_ORIGIN },
    });
    expect(permitida.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(permitida.headers['access-control-allow-credentials']).toBe('true');

    const estranha = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(estranha.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(preflight.statusCode).toBeLessThan(300);
    expect(preflight.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');

    const preflightEstranho = await app.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(preflightEstranho.headers['access-control-allow-origin']).toBeUndefined();
  });
});
