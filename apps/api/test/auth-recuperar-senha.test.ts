import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, esqueciSenhaResponseSchema } from '@bovaro/contracts';
import { createMemoryEmailSender } from '../src/email/memory-sender';
import { createResendEmailSender } from '../src/email/resend-sender';
import type { EmailSender } from '../src/email/email-sender';
import { TEST_ORIGIN } from './support/env';
import {
  buildTestApp,
  getWithCookie,
  postJson,
  prisma,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './support/harness';

const NOVA_SENHA = 'Gado#Novo2027';
const GENERICO = 'requisicao_invalida';

const logs: string[] = [];
const logStream = new Writable({
  write(chunk: Buffer, _enc, done) {
    logs.push(chunk.toString());
    done();
  },
});
const mailer = createMemoryEmailSender();
const app = buildTestApp({ emailSender: mailer, logger: true, logStream });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

function tokenDoEmail(): string {
  const mail = mailer.last();
  const match = mail ? /redefinir-senha\?token=([A-Za-z0-9_-]+)/.exec(mail.text) : null;
  if (!match?.[1]) throw new Error('e-mail sem link de redefinição');
  return match[1];
}

async function esqueci(email: string, options?: Parameters<typeof postJson>[3]) {
  return postJson(app, '/auth/senha/esqueci', { email }, options);
}

async function redefinir(token: string, novaSenha = NOVA_SENHA) {
  return postJson(app, '/auth/senha/redefinir', { token, novaSenha });
}

describe('POST /auth/senha/esqueci (RF-002)', () => {
  it('RF-002: responde 202 com mensagem neutra e envia o link para o e-mail da conta', async () => {
    const c = await signup(app);
    const res = await esqueci(c.email);
    expect(res.statusCode).toBe(202);
    expect(esqueciSenhaResponseSchema.parse(res.json()).mensagem).toMatch(/Se este e-mail/);

    const mail = mailer.last();
    expect(mail?.to).toBe(c.email);
    expect(mail?.subject).toMatch(/senha/i);
    expect(mail?.text).toContain(`${TEST_ORIGIN}/redefinir-senha?token=`);
    expect(tokenDoEmail().length).toBeGreaterThanOrEqual(43); // 32 bytes em base64url
  });

  it('RF-002: e-mail sem conta recebe exatamente a mesma resposta e nada é enviado', async () => {
    const c = await signup(app);
    const existente = await esqueci(c.email);
    const antes = mailer.sent.length;
    const inexistente = await esqueci(uniqueEmail('fantasma'));

    expect(inexistente.statusCode).toBe(existente.statusCode);
    expect(inexistente.body).toBe(existente.body);
    expect(mailer.sent.length).toBe(antes);
  });

  it('RF-002: o banco guarda só o SHA-256 do token, com validade de 1 hora', async () => {
    const c = await signup(app);
    await esqueci(c.email);
    const token = tokenDoEmail();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: c.email } });
    const rows = await prisma.tokenRedefinicao.findMany({ where: { usuarioId: usuario.id } });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(token);
    const duracao = (row?.expiraEm.getTime() ?? 0) - (row?.criadoEm.getTime() ?? 0);
    expect(Math.abs(duracao - 60 * 60 * 1000)).toBeLessThan(5_000);
    expect(row?.usadoEm).toBeNull();
  });

  it('RF-002: um pedido novo invalida o link anterior', async () => {
    const c = await signup(app);
    await esqueci(c.email);
    const primeiro = tokenDoEmail();
    await esqueci(c.email);
    const segundo = tokenDoEmail();
    expect(segundo).not.toBe(primeiro);

    expect((await redefinir(primeiro)).statusCode).toBe(400);
    expect((await redefinir(segundo)).statusCode).toBe(204);
  });

  it('RF-002: falha do provedor de e-mail não vaza na resposta', async () => {
    const falho: EmailSender = {
      send: () => Promise.reject(new Error('provedor fora do ar: chave re_segredo')),
    };
    const appFalho = buildTestApp({ emailSender: falho });
    await appFalho.ready();
    const c = await signup(app);
    const res = await postJson(appFalho, '/auth/senha/esqueci', { email: c.email });
    expect(res.statusCode).toBe(202);
    expect(res.body).not.toMatch(/provedor|re_segredo/);
    await appFalho.close();
  });

  it('RF-002: corpo com campo extra, e-mail inválido ou sem Origin é recusado', async () => {
    const extra = await postJson(app, '/auth/senha/esqueci', { email: uniqueEmail(), x: 1 });
    expect(extra.statusCode).toBe(400);
    const invalido = await esqueci('nao-e-email');
    expect(invalido.statusCode).toBe(400);
    const semOrigin = await esqueci(uniqueEmail(), { origin: null });
    expect(semOrigin.statusCode).toBe(403);
  });
});

describe('POST /auth/senha/redefinir (RF-002)', () => {
  it('RF-002: o token do e-mail troca a senha, a nova entra, a antiga não e as sessões caem', async () => {
    const c = await signup(app);
    const outraSessao = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
    expect(outraSessao.statusCode).toBe(200);
    expect((await getWithCookie(app, '/auth/session', c.cookie)).statusCode).toBe(200);

    await esqueci(c.email);
    const res = await redefinir(tokenDoEmail());
    expect(res.statusCode).toBe(204);

    expect((await getWithCookie(app, '/auth/session', c.cookie)).statusCode).toBe(401);
    const novo = await postJson(app, '/auth/login', { email: c.email, senha: NOVA_SENHA });
    expect(novo.statusCode).toBe(200);
    const antigo = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
    expect(antigo.statusCode).toBe(401);

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: c.email } });
    expect(usuario.senhaHash).toMatch(/^\$argon2id\$/);
    expect(await prisma.sessao.count({ where: { usuarioId: usuario.id } })).toBe(1); // só a do login novo
  });

  it('RF-002: token usado uma vez não vale de novo', async () => {
    const c = await signup(app);
    await esqueci(c.email);
    const token = tokenDoEmail();
    expect((await redefinir(token)).statusCode).toBe(204);
    const segunda = await redefinir(token, 'Outra#Senha2028');
    expect(segunda.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(segunda.json()).erro.codigo).toBe(GENERICO);
    const login = await postJson(app, '/auth/login', { email: c.email, senha: 'Outra#Senha2028' });
    expect(login.statusCode).toBe(401);
  });

  it('RF-002: token expirado, adulterado ou inexistente dão o mesmo erro genérico', async () => {
    const c = await signup(app);
    await esqueci(c.email);
    const token = tokenDoEmail();
    await prisma.tokenRedefinicao.updateMany({
      where: { usuario: { email: c.email } },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });

    const adulterado = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    const respostas = [
      await redefinir(token),
      await redefinir(adulterado),
      await redefinir('lixo'),
      await redefinir('a'.repeat(43)),
    ];
    for (const res of respostas) {
      expect(res.statusCode).toBe(400);
      expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe(GENERICO);
    }
    expect(new Set(respostas.map((r) => r.body)).size).toBe(1);
    const login = await postJson(app, '/auth/login', { email: c.email, senha: NOVA_SENHA });
    expect(login.statusCode).toBe(401);
  });

  it('RF-002: senha fora das regras é recusada e não gasta o token', async () => {
    const c = await signup(app);
    await esqueci(c.email);
    const token = tokenDoEmail();
    const fraca = await redefinir(token, 'fraca');
    expect(fraca.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(fraca.json()).erro.codigo).toBe('validacao_invalida');
    expect((await redefinir(token)).statusCode).toBe(204);
  });

  it('RF-002 (isolamento): o token de A não altera a senha nem as sessões de B', async () => {
    const a = await signup(app);
    const b = await signup(app);
    await esqueci(a.email);
    expect((await redefinir(tokenDoEmail())).statusCode).toBe(204);

    expect((await getWithCookie(app, '/auth/session', b.cookie)).statusCode).toBe(200);
    const loginB = await postJson(app, '/auth/login', { email: b.email, senha: VALID_PASSWORD });
    expect(loginB.statusCode).toBe(200);
  });

  it('RF-002: corpo com campo extra ou sem Origin é recusado', async () => {
    const extra = await postJson(app, '/auth/senha/redefinir', {
      token: 'x',
      novaSenha: NOVA_SENHA,
      usuarioId: 'y',
    });
    expect(extra.statusCode).toBe(400);
    const semOrigin = await postJson(
      app,
      '/auth/senha/redefinir',
      { token: 'x', novaSenha: NOVA_SENHA },
      { origin: null },
    );
    expect(semOrigin.statusCode).toBe(403);
  });

  it('RNF-013: o token, o e-mail e a senha nunca aparecem nos logs', async () => {
    const c = await signup(app);
    await esqueci(c.email);
    const token = tokenDoEmail();
    await redefinir(token);
    await redefinir(token);
    const tudo = logs.join('');
    expect(tudo.length).toBeGreaterThan(0);
    expect(tudo).not.toContain(token);
    expect(tudo).not.toContain(c.email);
    expect(tudo).not.toContain(NOVA_SENHA);
  });
});

describe('rate limit da recuperação de senha (RNF-003)', () => {
  const limitado = buildTestApp({ relaxedLimits: false, emailSender: createMemoryEmailSender() });
  beforeAll(async () => {
    await limitado.ready();
  });
  afterAll(async () => {
    await limitado.close();
  });

  it('o 11º pedido do mesmo IP em 1 hora responde 429 muitas_tentativas', async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await postJson(
        limitado,
        '/auth/senha/esqueci',
        { email: uniqueEmail() },
        { remoteAddress: '10.2.0.1' },
      );
      expect(res.statusCode, `pedido ${i}`).toBe(202);
    }
    const onze = await postJson(
      limitado,
      '/auth/senha/esqueci',
      { email: uniqueEmail() },
      { remoteAddress: '10.2.0.1' },
    );
    expect(onze.statusCode).toBe(429);
    expect(errorEnvelopeSchema.parse(onze.json()).erro.codigo).toBe('muitas_tentativas');
    expect(Number(onze.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('o 4º pedido para o mesmo e-mail em 1 hora responde 429, mesmo vindo de IPs diferentes', async () => {
    const email = uniqueEmail();
    for (let i = 1; i <= 3; i++) {
      const res = await postJson(
        limitado,
        '/auth/senha/esqueci',
        { email },
        { remoteAddress: `10.2.1.${i}` },
      );
      expect(res.statusCode, `pedido ${i}`).toBe(202);
    }
    const quarto = await postJson(
      limitado,
      '/auth/senha/esqueci',
      { email },
      { remoteAddress: '10.2.1.9' },
    );
    expect(quarto.statusCode).toBe(429);
  });

  it('o 21º resgate de token do mesmo IP em 1 hora responde 429', async () => {
    for (let i = 1; i <= 20; i++) {
      const res = await postJson(
        limitado,
        '/auth/senha/redefinir',
        { token: 'invalido', novaSenha: NOVA_SENHA },
        { remoteAddress: '10.2.2.1' },
      );
      expect(res.statusCode, `tentativa ${i}`).toBe(400);
    }
    const vinteUm = await postJson(
      limitado,
      '/auth/senha/redefinir',
      { token: 'invalido', novaSenha: NOVA_SENHA },
      { remoteAddress: '10.2.2.1' },
    );
    expect(vinteUm.statusCode).toBe(429);
  });
});

describe('adaptador Resend', () => {
  it('RF-002: envia JSON para a API do Resend com a chave no cabeçalho Authorization', async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const sender = createResendEmailSender({
      apiKey: 're_chave_de_teste',
      from: 'Bovaro <nao-responda@bovaro.com.br>',
      fetch: (url, init) => {
        chamadas.push({ url: String(url), init: init ?? {} });
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
    });
    await sender.send({ to: 'a@b.invalid', subject: 'Assunto', text: 'Corpo' });

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe('https://api.resend.com/emails');
    const headers = new Headers(chamadas[0]?.init.headers);
    expect(headers.get('authorization')).toBe('Bearer re_chave_de_teste');
    expect(JSON.parse(String(chamadas[0]?.init.body))).toEqual({
      from: 'Bovaro <nao-responda@bovaro.com.br>',
      to: ['a@b.invalid'],
      subject: 'Assunto',
      text: 'Corpo',
    });
  });

  it('RNF-009: anexos seguem para o Resend como attachments (filename + content em base64)', async () => {
    let corpo: unknown;
    const sender = createResendEmailSender({
      apiKey: 'k',
      from: 'x@y.invalid',
      fetch: (_url, init) => {
        corpo = JSON.parse(String(init?.body));
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
    });
    await sender.send({
      to: 'a@b.invalid',
      subject: 's',
      text: 't',
      attachments: [{ filename: 'dados.json', content: Buffer.from('{}').toString('base64') }],
    });
    expect(corpo).toMatchObject({ attachments: [{ filename: 'dados.json', content: 'e30=' }] });
  });

  it('RF-002: resposta de erro do provedor rejeita sem ecoar o corpo', async () => {
    const sender = createResendEmailSender({
      apiKey: 'k',
      from: 'x@y.invalid',
      fetch: () => Promise.resolve(new Response('segredo-do-provedor', { status: 422 })),
    });
    const erro = await sender
      .send({ to: 'a@b.invalid', subject: 's', text: 't' })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain('422');
    expect((erro as Error).message).not.toContain('segredo-do-provedor');
  });
});
