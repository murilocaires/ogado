import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import {
  errorEnvelopeSchema,
  fazendaSchema,
  sessionResponseSchema,
  TERMOS_VERSAO,
} from '@bovaro/contracts';
import { TEST_ORIGIN } from './support/env';
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

const app = buildTestApp();

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

function send(
  server: FastifyInstance,
  method: 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  cookie: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      cookie,
      origin: TEST_ORIGIN,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
}

async function conta() {
  const c = await signup(app);
  const sessao = sessionResponseSchema.parse(c.res.json());
  return {
    ...c,
    usuarioId: sessao.usuario.id,
    fazendaId: sessao.fazenda.id,
    fazenda: sessao.fazenda,
  };
}

const NOVA_SENHA = 'Gado#Novo2027';

describe('PATCH /conta/perfil (RF-004)', () => {
  it('RF-004: salva nome e e-mail normalizado e devolve a sessão atualizada', async () => {
    const c = await conta();
    const novo = uniqueEmail('Novo').toUpperCase();
    const res = await send(app, 'PATCH', '/conta/perfil', c.cookie, {
      nome: '  Ana Souza ',
      email: ` ${novo} `,
    });
    expect(res.statusCode).toBe(200);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.usuario).toEqual({
      id: c.usuarioId,
      email: novo.toLowerCase(),
      nome: 'Ana Souza',
      temSenha: true,
      googleVinculado: false,
      aceiteVigente: true,
      aceiteTermosVersao: TERMOS_VERSAO,
      aceiteTermosEm: expect.any(String),
    });
    expect(res.body).not.toMatch(/senhaHash|argon2/i);

    const sessao = sessionResponseSchema.parse(
      (await getWithCookie(app, '/auth/session', c.cookie)).json(),
    );
    expect(sessao.usuario.nome).toBe('Ana Souza');
    expect(sessao.usuario.email).toBe(novo.toLowerCase());
    const login = await postJson(app, '/auth/login', { email: novo, senha: c.senha });
    expect(login.statusCode).toBe(200);
  });

  it('RF-004: nome vazio ou e-mail inválido = 400 e nada é salvo', async () => {
    const c = await conta();
    for (const corpo of [
      { nome: '   ', email: c.email },
      { nome: 'Ana', email: 'nao-e-email' },
      { email: c.email },
    ]) {
      const res = await send(app, 'PATCH', '/conta/perfil', c.cookie, corpo);
      expect(res.statusCode).toBe(400);
      expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('validacao_invalida');
    }
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    expect(usuario.nome).toBeNull();
  });

  it('RF-004: e-mail de outra conta = 409 genérico, sem revelar o dono, e nada muda', async () => {
    const a = await conta();
    const b = await conta();
    const res = await send(app, 'PATCH', '/conta/perfil', a.cookie, {
      nome: 'Ana',
      email: b.email,
    });
    expect(res.statusCode).toBe(409);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('conflito');
    expect(res.body).not.toContain(b.email);
    expect(res.body).not.toContain(b.usuarioId);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: a.usuarioId } });
    expect(depois.email).toBe(a.email);
    expect(depois.nome).toBeNull();
  });

  it('RF-004: manter o próprio e-mail é permitido; sem sessão = 401; sem Origin = 403', async () => {
    const c = await conta();
    const ok = await send(app, 'PATCH', '/conta/perfil', c.cookie, { nome: 'Ana', email: c.email });
    expect(ok.statusCode).toBe(200);
    const anonimo = await send(app, 'PATCH', '/conta/perfil', '', { nome: 'Ana', email: c.email });
    expect(anonimo.statusCode).toBe(401);
    const semOrigin = await app.inject({
      method: 'PATCH',
      url: '/conta/perfil',
      headers: { cookie: c.cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ nome: 'Ana', email: c.email }),
    });
    expect(semOrigin.statusCode).toBe(403);
  });
});

describe('PUT /conta/senha (RF-005)', () => {
  it('RF-005: troca a senha, mantém a sessão atual e derruba as outras', async () => {
    const c = await conta();
    const outra = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
    const outraCookie = (setCookieLine(outra) ?? '').split(';')[0] ?? '';
    expect((await getWithCookie(app, '/auth/session', outraCookie)).statusCode).toBe(200);

    const res = await send(app, 'PUT', '/conta/senha', c.cookie, {
      senhaAtual: c.senha,
      novaSenha: NOVA_SENHA,
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    expect((await getWithCookie(app, '/auth/session', c.cookie)).statusCode).toBe(200);
    expect((await getWithCookie(app, '/auth/session', outraCookie)).statusCode).toBe(401);
    const antiga = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
    expect(antiga.statusCode).toBe(401);
    const nova = await postJson(app, '/auth/login', { email: c.email, senha: NOVA_SENHA });
    expect(nova.statusCode).toBe(200);
  });

  it('RF-005: senha atual ausente ou errada não altera nada', async () => {
    const c = await conta();
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });

    const ausente = await send(app, 'PUT', '/conta/senha', c.cookie, { novaSenha: NOVA_SENHA });
    expect(ausente.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(ausente.json()).erro.campos?.[0]?.caminho).toBe('senhaAtual');

    const errada = await send(app, 'PUT', '/conta/senha', c.cookie, {
      senhaAtual: 'Errada#123456',
      novaSenha: NOVA_SENHA,
    });
    expect(errada.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(errada.json()).erro.codigo).toBe('credenciais_invalidas');
    expect(errada.body).not.toContain(NOVA_SENHA);

    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    expect(depois.senhaHash).toBe(antes.senhaHash);
  });

  it('RF-005: a nova senha segue as regras de senha do cadastro', async () => {
    const c = await conta();
    const res = await send(app, 'PUT', '/conta/senha', c.cookie, {
      senhaAtual: c.senha,
      novaSenha: 'fraca',
    });
    expect(res.statusCode).toBe(400);
    const regras = errorEnvelopeSchema.parse(res.json()).erro.campos?.map((f) => f.regra) ?? [];
    expect(regras).toEqual(expect.arrayContaining(['minimo', 'maiuscula', 'numero', 'simbolo']));
    expect(res.body).not.toContain('fraca');
  });

  it('RF-005: conta sem senha (só Google) define a senha sem senha atual', async () => {
    const c = await conta();
    await prisma.usuario.update({ where: { id: c.usuarioId }, data: { senhaHash: null } });
    const res = await send(app, 'PUT', '/conta/senha', c.cookie, { novaSenha: NOVA_SENHA });
    expect(res.statusCode).toBe(204);
    const login = await postJson(app, '/auth/login', { email: c.email, senha: NOVA_SENHA });
    expect(login.statusCode).toBe(200);
  });

  it('RF-005: tentativas erradas da senha atual são limitadas (429 com Retry-After)', async () => {
    const limited = buildTestApp({ relaxedLimits: false });
    await limited.ready();
    try {
      const c = await signup(limited);
      let ultimo: LightMyRequestResponse | undefined;
      for (let i = 0; i < 7; i++) {
        ultimo = await send(limited, 'PUT', '/conta/senha', c.cookie, {
          senhaAtual: 'Errada#123456',
          novaSenha: NOVA_SENHA,
        });
        if (ultimo.statusCode === 429) break;
      }
      expect(ultimo?.statusCode).toBe(429);
      expect(ultimo?.headers['retry-after']).toBeDefined();
      const certa = await send(limited, 'PUT', '/conta/senha', c.cookie, {
        senhaAtual: c.senha,
        novaSenha: NOVA_SENHA,
      });
      expect(certa.statusCode).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe('PATCH /fazenda (RF-011)', () => {
  it('RF-011: salva nome e área (string decimal canônica) e avança a versão', async () => {
    const c = await conta();
    const res = await send(app, 'PATCH', '/fazenda', c.cookie, {
      nome: ' Fazenda Boa Vista ',
      areaHa: '120.50',
      version: c.fazenda.version,
    });
    expect(res.statusCode).toBe(200);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.fazenda).toMatchObject({
      id: c.fazendaId,
      nome: 'Fazenda Boa Vista',
      areaHa: '120.5',
      version: c.fazenda.version + 1,
    });
    expect(body.usuario.id).toBe(c.usuarioId);

    // areaHa omitida não apaga; null limpa
    const so = await send(app, 'PATCH', '/fazenda', c.cookie, { nome: 'Outra', version: 2 });
    expect(sessionResponseSchema.parse(so.json()).fazenda.areaHa).toBe('120.5');
    const limpa = await send(app, 'PATCH', '/fazenda', c.cookie, {
      nome: 'Outra',
      areaHa: null,
      version: 3,
    });
    expect(sessionResponseSchema.parse(limpa.json()).fazenda.areaHa).toBeNull();
  });

  it('RF-011: versão velha = 409 com o estado atual em `atual`, sem alterar', async () => {
    const c = await conta();
    await send(app, 'PATCH', '/fazenda', c.cookie, { nome: 'Primeira', version: 1 });
    const res = await send(app, 'PATCH', '/fazenda', c.cookie, { nome: 'Segunda', version: 1 });
    expect(res.statusCode).toBe(409);
    const atual = fazendaSchema.parse(res.json().atual);
    expect(atual.nome).toBe('Primeira');
    expect(atual.version).toBe(2);
    const noBanco = await prisma.fazenda.findUniqueOrThrow({ where: { id: c.fazendaId } });
    expect(noBanco.nome).toBe('Primeira');
  });

  it('RF-011: nome vazio, área inválida ou com casas demais = 400', async () => {
    const c = await conta();
    for (const corpo of [
      { nome: '', version: 1 },
      { nome: 'F', areaHa: '-1', version: 1 },
      { nome: 'F', areaHa: '1,5', version: 1 },
      { nome: 'F', areaHa: '1.234', version: 1 },
      { nome: 'F', areaHa: 100, version: 1 },
      { nome: 'F' },
    ]) {
      const res = await send(app, 'PATCH', '/fazenda', c.cookie, corpo);
      expect(res.statusCode, JSON.stringify(corpo)).toBe(400);
    }
  });
});

describe('DELETE /conta (RF-007)', () => {
  it('RF-007: sem a confirmação "deletar" nada é apagado', async () => {
    const c = await conta();
    for (const corpo of [{ confirmacao: 'Deletar' }, { confirmacao: '' }, {}]) {
      const res = await send(app, 'DELETE', '/conta', c.cookie, corpo);
      expect(res.statusCode).toBe(400);
    }
    expect(await prisma.usuario.count({ where: { id: c.usuarioId } })).toBe(1);
  });

  it('RF-007: apaga usuário, fazenda, dados e sessões; limpa o cookie; 204', async () => {
    const c = await conta();
    const outra = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
    const outraCookie = (setCookieLine(outra) ?? '').split(';')[0] ?? '';
    await prisma.lote.create({
      data: {
        id: randomUUID(),
        fazendaId: c.fazendaId,
        tipo: 'compra',
        numero: 1,
        categoria: 'BOIS',
        modo: 'total',
        qtd: '10',
        peso: '3000',
        pesos: [],
        preco: '300',
      },
    });
    await prisma.cenario.create({
      data: {
        id: randomUUID(),
        fazendaId: c.fazendaId,
        nome: 'C1',
        criadoEm: new Date(),
        entradas: {},
        variantes: {},
        parametros: {},
        resultado: {},
      },
    });
    await prisma.recriaEntrada.create({
      data: { id: randomUUID(), fazendaId: c.fazendaId, entradas: {}, lotacaoInicial: 'x' },
    });

    const res = await send(app, 'DELETE', '/conta', c.cookie, { confirmacao: 'deletar' });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(setCookieLine(res)).toMatch(/Max-Age=0|Expires=/i);

    expect(await prisma.usuario.count({ where: { id: c.usuarioId } })).toBe(0);
    expect(await prisma.fazenda.count({ where: { id: c.fazendaId } })).toBe(0);
    expect(await prisma.lote.count({ where: { fazendaId: c.fazendaId } })).toBe(0);
    expect(await prisma.cenario.count({ where: { fazendaId: c.fazendaId } })).toBe(0);
    expect(await prisma.recriaEntrada.count({ where: { fazendaId: c.fazendaId } })).toBe(0);
    expect(await prisma.sessao.count({ where: { usuarioId: c.usuarioId } })).toBe(0);
    expect((await getWithCookie(app, '/auth/session', c.cookie)).statusCode).toBe(401);
    expect((await getWithCookie(app, '/auth/session', outraCookie)).statusCode).toBe(401);
    const login = await postJson(app, '/auth/login', { email: c.email, senha: c.senha });
    expect(login.statusCode).toBe(401);
  });

  it('RF-007: exige Origin permitido e JSON; sem sessão = 401', async () => {
    const c = await conta();
    const corpo = JSON.stringify({ confirmacao: 'deletar' });
    const semOrigin = await app.inject({
      method: 'DELETE',
      url: '/conta',
      headers: { cookie: c.cookie, 'content-type': 'application/json' },
      payload: corpo,
    });
    expect(semOrigin.statusCode).toBe(403);
    const texto = await app.inject({
      method: 'DELETE',
      url: '/conta',
      headers: { cookie: c.cookie, origin: TEST_ORIGIN, 'content-type': 'text/plain' },
      payload: corpo,
    });
    expect(texto.statusCode).toBe(403);
    const cross = await send(
      app,
      'DELETE',
      '/conta',
      c.cookie,
      { confirmacao: 'deletar' },
      { 'sec-fetch-site': 'cross-site' },
    );
    expect(cross.statusCode).toBe(403);
    const anonimo = await send(app, 'DELETE', '/conta', '', { confirmacao: 'deletar' });
    expect(anonimo.statusCode).toBe(401);
    expect(await prisma.usuario.count({ where: { id: c.usuarioId } })).toBe(1);
  });
});

describe('isolamento entre contas (RF-010)', () => {
  it('RF-010: A editar e apagar a própria conta não afeta B', async () => {
    const a = await conta();
    const b = await conta();
    await send(app, 'PATCH', '/conta/perfil', a.cookie, { nome: 'A', email: uniqueEmail('a') });
    await send(app, 'PATCH', '/fazenda', a.cookie, { nome: 'Fazenda A', areaHa: '10', version: 1 });
    await send(app, 'PUT', '/conta/senha', a.cookie, {
      senhaAtual: VALID_PASSWORD,
      novaSenha: NOVA_SENHA,
    });
    await send(app, 'DELETE', '/conta', a.cookie, { confirmacao: 'deletar' });

    const sessaoB = sessionResponseSchema.parse(
      (await getWithCookie(app, '/auth/session', b.cookie)).json(),
    );
    expect(sessaoB.usuario).toEqual({
      id: b.usuarioId,
      email: b.email,
      nome: null,
      temSenha: true,
      googleVinculado: false,
      aceiteVigente: true,
      aceiteTermosVersao: TERMOS_VERSAO,
      aceiteTermosEm: expect.any(String),
    });
    expect(sessaoB.fazenda).toMatchObject({
      id: b.fazendaId,
      nome: null,
      areaHa: null,
      version: 1,
    });
    const login = await postJson(app, '/auth/login', { email: b.email, senha: b.senha });
    expect(login.statusCode).toBe(200);
  });
});
