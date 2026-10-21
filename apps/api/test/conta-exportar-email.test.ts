import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportacaoDadosSchema, EXPORTACAO_ENVIO_MENSAGEM } from '@bovaro/contracts';
import { createMemoryEmailSender } from '../src/email/memory-sender';
import type { EmailSender } from '../src/email/email-sender';
import { buildTestApp, postJson, prisma, signup } from './support/harness';

const email = createMemoryEmailSender();
const app = buildTestApp({ emailSender: email });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /conta/exportar/enviar (RNF-009)', () => {
  it('exige sessão', async () => {
    const res = await postJson(app, '/conta/exportar/enviar', {});
    expect(res.statusCode).toBe(401);
  });

  it('responde 202 e envia o JSON da exportação como anexo ao e-mail da própria conta', async () => {
    const c = await signup(app);
    const antes = email.sent.length;
    const res = await app.inject({
      method: 'POST',
      url: '/conta/exportar/enviar',
      headers: {
        cookie: c.cookie,
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      payload: '{}',
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ mensagem: EXPORTACAO_ENVIO_MENSAGEM });

    await new Promise((r) => setTimeout(r, 20));
    expect(email.sent.length).toBe(antes + 1);
    const msg = email.last();
    expect(msg?.to).toBe(c.email);
    const anexo = msg?.attachments?.[0];
    expect(anexo?.filename).toMatch(/^bovaro-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    const json = exportacaoDadosSchema.parse(
      JSON.parse(Buffer.from(anexo?.content ?? '', 'base64').toString('utf8')),
    );
    expect(json.perfil.email).toBe(c.email);
    expect(JSON.stringify(json)).not.toMatch(/senhaHash|argon2/);
  });

  it('falha do provedor de e-mail é só logada: a resposta continua 202', async () => {
    const quebrado: EmailSender = { send: () => Promise.reject(new Error('provedor fora')) };
    const outro = buildTestApp({ emailSender: quebrado });
    await outro.ready();
    try {
      const c = await signup(outro);
      const enviado = await outro.inject({
        method: 'POST',
        url: '/conta/exportar/enviar',
        headers: {
          cookie: c.cookie,
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        payload: '{}',
      });
      expect(enviado.statusCode).toBe(202);
      expect(enviado.json()).toEqual({ mensagem: EXPORTACAO_ENVIO_MENSAGEM });
    } finally {
      await outro.close();
    }
  });

  it('limita a 3 por hora por usuário (429 com Retry-After); outro usuário não é afetado', async () => {
    const limited = buildTestApp({
      relaxedLimits: false,
      emailSender: createMemoryEmailSender(),
    });
    await limited.ready();
    const enviar = (cookie: string) =>
      limited.inject({
        method: 'POST',
        url: '/conta/exportar/enviar',
        headers: { cookie, origin: 'http://localhost:3000', 'content-type': 'application/json' },
        payload: '{}',
      });
    try {
      const c = await signup(limited);
      for (let i = 0; i < 3; i += 1) expect((await enviar(c.cookie)).statusCode).toBe(202);
      const bloqueada = await enviar(c.cookie);
      expect(bloqueada.statusCode).toBe(429);
      expect(bloqueada.headers['retry-after']).toBeDefined();
      const outro = await signup(limited, undefined, undefined);
      expect((await enviar(outro.cookie)).statusCode).toBe(202);
    } finally {
      await limited.close();
    }
  });
});
