import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { buildTestApp, postJson, prisma, signup } from './support/harness';
import { TEST_ORIGIN } from './support/env';

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('o que fica no banco', () => {
  it('RF-002 CA-10: nenhuma linha de sessão contém o token em claro, só o SHA-256 do segredo', async () => {
    const conta = await signup(app);
    const token = decodeURIComponent(conta.cookie.split('=')[1] ?? '');
    const [id, segredo] = token.split('.');
    expect(id).toBeTruthy();
    expect(segredo).toBeTruthy();

    const linhas = await prisma.sessao.findMany({ where: { id } });
    expect(linhas).toHaveLength(1);
    const linha = linhas[0];
    const serializada = JSON.stringify(linha);
    expect(serializada).not.toContain(segredo ?? '');
    expect(serializada).not.toContain(token);
    expect(linha?.segredoHash).toMatch(/^[0-9a-f]{64}$/);
    expect(linha?.id).toBe(id); // só a parte pública
  });

  it('RNF-003 CA-10: a senha é guardada só como hash argon2id com parâmetros >= OWASP (19 MiB, t=2, p=1)', async () => {
    const conta = await signup(app);
    const usuario = await prisma.usuario.findUnique({ where: { email: conta.email } });

    expect(usuario?.senhaHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(JSON.stringify(usuario)).not.toContain(conta.senha);
  });

  it('RNF-003: parâmetros argon2id abaixo do mínimo OWASP são recusados na configuração', () => {
    expect(() =>
      buildApp({
        prisma,
        corsOrigins: [TEST_ORIGIN],
        config: { argon2: { memoryKiB: 8192 } },
      }),
    ).toThrow(/argon2id/);
  });

  it('RNF-003: login com hash de parâmetros mais fracos regrava o hash com os parâmetros atuais (rehash)', async () => {
    const conta = await signup(app); // m=19456,t=2,p=1
    const maisForte = buildTestApp({ config: { argon2: { timeCost: 3 } } });
    await maisForte.ready();

    const res = await postJson(maisForte, '/auth/login', {
      email: conta.email,
      senha: conta.senha,
    });
    expect(res.statusCode).toBe(200);

    const usuario = await prisma.usuario.findUnique({ where: { email: conta.email } });
    expect(usuario?.senhaHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=3,p=1\$/);
    // a senha continua valendo no app original
    const outraVez = await postJson(app, '/auth/login', { email: conta.email, senha: conta.senha });
    expect(outraVez.statusCode).toBe(200);
    await maisForte.close();
  });
});
