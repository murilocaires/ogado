import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, sessionResponseSchema } from '@ogado/contracts';
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

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /auth/signup', () => {
  it('RF-001 CA-01: e-mail novo + senha válida responde 201 com cookie HttpOnly/SameSite=Lax; a sessão devolve usuário e fazenda', async () => {
    const email = uniqueEmail();
    const res = await postJson(app, '/auth/signup', { email, senha: VALID_PASSWORD });

    expect(res.statusCode).toBe(201);
    const line = setCookieLine(res);
    expect(line).toBeDefined();
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Path=\//);
    expect(line).not.toMatch(/Secure/i); // Secure só fora do dev
    expect(line).not.toMatch(/Domain=/i);

    const body = sessionResponseSchema.parse(res.json());
    expect(body.usuario.email).toBe(email);

    const session = await getWithCookie(app, '/auth/session', cookieFrom(res));
    expect(session.statusCode).toBe(200);
    const parsed = sessionResponseSchema.parse(session.json());
    expect(parsed.usuario.id).toBe(body.usuario.id);
    expect(parsed.fazenda.id).toBe(body.fazenda.id);
  });

  it('RF-001 CA-01: usuário e fazenda nascem numa única transação (falha ao criar a fazenda não deixa usuário)', async () => {
    const dono = await signup(app);
    const fazendaDoDono = sessionResponseSchema.parse(dono.res.json()).fazenda.id;
    // id de fazenda já existente força a falha do 2º insert, depois do insert do usuário
    const colidindo = buildTestApp({ newFazendaId: () => fazendaDoDono });
    await colidindo.ready();
    const email = uniqueEmail('atomico');

    const res = await postJson(colidindo, '/auth/signup', { email, senha: VALID_PASSWORD });

    expect(res.statusCode).toBe(409);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('conflito');
    expect(res.body).not.toContain(fazendaDoDono); // nada do registro alheio é revelado
    expect(res.headers['set-cookie']).toBeUndefined();
    const login = await postJson(app, '/auth/login', { email, senha: VALID_PASSWORD });
    expect(login.statusCode).toBe(401); // nenhum usuário ficou para trás
    await colidindo.close();
  });

  it('RF-001 CA-02: e-mail com maiúsculas e espaços nas pontas vira a forma normalizada e entra na mesma conta', async () => {
    const normalizado = uniqueEmail('maiusc');
    const digitado = `  ${normalizado.toUpperCase()} `;

    const criada = await postJson(app, '/auth/signup', { email: digitado, senha: VALID_PASSWORD });
    expect(criada.statusCode).toBe(201);
    const usuarioId = sessionResponseSchema.parse(criada.json()).usuario.id;
    expect(sessionResponseSchema.parse(criada.json()).usuario.email).toBe(normalizado);

    const entrou = await postJson(app, '/auth/login', {
      email: normalizado,
      senha: VALID_PASSWORD,
    });
    expect(entrou.statusCode).toBe(200);
    expect(sessionResponseSchema.parse(entrou.json()).usuario.id).toBe(usuarioId);
  });

  it('RF-001 CA-03: e-mail já cadastrado não cria conta nem altera a existente e responde com a mensagem da decisão Q4', async () => {
    const original = await signup(app);

    const outra = await postJson(app, '/auth/signup', {
      email: original.email.toUpperCase(),
      senha: 'Outra#Senha77',
    });

    expect(outra.statusCode).toBe(409);
    const erro = errorEnvelopeSchema.parse(outra.json()).erro;
    expect(erro.codigo).toBe('conflito');
    expect(erro.mensagem).toBe(
      'Não foi possível criar a conta com este e-mail. Já tem conta? Entrar',
    );
    expect(outra.headers['set-cookie']).toBeUndefined();
    const senhaOriginal = await postJson(app, '/auth/login', {
      email: original.email,
      senha: original.senha,
    });
    expect(senhaOriginal.statusCode).toBe(200);
    const senhaNova = await postJson(app, '/auth/login', {
      email: original.email,
      senha: 'Outra#Senha77',
    });
    expect(senhaNova.statusCode).toBe(401);
  });

  it('RF-001 CA-06: senha fraca responde 400 com o caminho do campo e a regra que falhou, sem ecoar o valor', async () => {
    const email = uniqueEmail('fraca');
    const res = await postJson(app, '/auth/signup', { email, senha: 'zzqqxx' });

    expect(res.statusCode).toBe(400);
    const erro = errorEnvelopeSchema.parse(res.json()).erro;
    expect(erro.codigo).toBe('validacao_invalida');
    expect(erro.campos?.map((c) => [c.caminho, c.regra])).toEqual([
      ['senha', 'minimo'],
      ['senha', 'maiuscula'],
      ['senha', 'numero'],
      ['senha', 'simbolo'],
    ]);
    expect(erro.campos?.[0]?.mensagem).toBe('A senha deve ter pelo menos 8 caracteres.');
    expect(res.body).not.toContain('zzqqxx');
    expect((await postJson(app, '/auth/login', { email, senha: 'zzqqxx' })).statusCode).toBe(401);
  });

  it('RF-001 CA-06: senha acima de 128 caracteres é recusada antes do hash (regra maximo)', async () => {
    const longa = 'Aa1!' + 'x'.repeat(125);
    const res = await postJson(app, '/auth/signup', { email: uniqueEmail(), senha: longa });
    expect(res.statusCode).toBe(400);
    const erro = errorEnvelopeSchema.parse(res.json()).erro;
    expect(erro.campos?.map((c) => c.regra)).toEqual(['maximo']);
    expect(res.body).not.toContain(longa);
  });

  it('RF-001 CA-06: e-mail ausente ou inválido aponta o campo email', async () => {
    const res = await postJson(app, '/auth/signup', { email: 'sem-arroba', senha: VALID_PASSWORD });
    expect(res.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(res.json()).erro.campos?.map((c) => c.caminho)).toEqual([
      'email',
    ]);
  });
});
