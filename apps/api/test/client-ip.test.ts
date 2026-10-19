import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, postJson, prisma, uniqueEmail } from './support/harness';

const SEGREDO = 's'.repeat(40);
const app = buildTestApp({ relaxedLimits: false, config: { proxySecret: SEGREDO } });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function tentar(email: string, headers: Record<string, string>, remoteAddress: string) {
  return postJson(app, '/auth/login', { email, senha: 'Errada#123' }, { headers, remoteAddress });
}

describe('IP do cliente atrás do site (RNF-003)', () => {
  it('com o segredo certo, o limite vale por IP do cliente, não pelo IP do proxy', async () => {
    const proxy = '10.2.0.1';
    const email = uniqueEmail();
    const comoA = { 'x-ogado-proxy-secret': SEGREDO, 'x-ogado-client-ip': '203.0.113.10' };
    const comoB = { 'x-ogado-proxy-secret': SEGREDO, 'x-ogado-client-ip': '203.0.113.11' };
    for (let i = 1; i <= 5; i++) expect((await tentar(email, comoA, proxy)).statusCode).toBe(401);
    expect((await tentar(email, comoA, proxy)).statusCode).toBe(429);
    // outro cliente pelo mesmo proxy não é afetado
    expect((await tentar(email, comoB, proxy)).statusCode).toBe(401);
  });

  it('segredo errado ou ausente: o cabeçalho é ignorado (não dá para fugir do limite)', async () => {
    const proxy = '10.2.0.2';
    const email = uniqueEmail();
    for (let i = 1; i <= 5; i++) {
      const falso = {
        'x-ogado-proxy-secret': 'x'.repeat(40),
        'x-ogado-client-ip': `198.51.100.${i}`,
      };
      expect((await tentar(email, falso, proxy)).statusCode, `tentativa ${i}`).toBe(401);
    }
    const semSegredo = { 'x-ogado-client-ip': '198.51.100.99' };
    expect((await tentar(email, semSegredo, proxy)).statusCode).toBe(429);
  });

  it('IP inválido no cabeçalho cai no IP do socket', async () => {
    const proxy = '10.2.0.3';
    const email = uniqueEmail();
    const ruim = { 'x-ogado-proxy-secret': SEGREDO, 'x-ogado-client-ip': 'nao-e-ip' };
    for (let i = 1; i <= 5; i++) expect((await tentar(email, ruim, proxy)).statusCode).toBe(401);
    expect((await tentar(email, ruim, proxy)).statusCode).toBe(429);
  });
});
