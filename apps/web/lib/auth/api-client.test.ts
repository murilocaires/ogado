import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api-client';
import { sessionBody } from './fixtures';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function erro(codigo: string): unknown {
  return { erro: { codigo, mensagem: 'texto da API que a tela não repassa' } };
}

const credenciais = { email: 'ana@fazenda.com', senha: 'Segredo#1', aceiteTermos: true as const };

describe('RF-001 cliente HTTP: login e cadastro', () => {
  it('RF-001 envia JSON com cookies incluídos para /api e devolve a sessão tipada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, sessionBody));
    const api = createApiClient({ fetch: fetchMock });

    const result = await api.login(credenciais);

    expect(result).toEqual({ ok: true, data: sessionBody });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(credenciais);
  });

  it('RF-001 cadastro usa POST /api/auth/signup e aceita 201', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, sessionBody));
    const result = await createApiClient({ fetch: fetchMock }).signup(credenciais);
    expect(result.ok).toBe(true);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/auth/signup');
  });

  it('RNF-003 401 credenciais_invalidas vira falha de credenciais, sem repassar o texto da API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, erro('credenciais_invalidas')));
    const result = await createApiClient({ fetch: fetchMock }).login(credenciais);
    expect(result).toEqual({ ok: false, kind: 'credenciais' });
  });

  it('RF-001 400 validacao_invalida traz o caminho e a regra dos campos', async () => {
    const campos = [{ caminho: 'senha', regra: 'simbolo', mensagem: 'falta símbolo' }];
    const fetchMock = vi.fn().mockResolvedValue(
      json(400, {
        erro: { codigo: 'validacao_invalida', mensagem: 'inválido', campos },
      }),
    );
    const result = await createApiClient({ fetch: fetchMock }).signup(credenciais);
    expect(result).toEqual({ ok: false, kind: 'validacao', campos });
  });

  it('RF-001 409 de e-mail já cadastrado vira kind conflito', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(409, erro('conflito')));
    const result = await createApiClient({ fetch: fetchMock }).signup(credenciais);
    expect(result).toEqual({ ok: false, kind: 'conflito' });
  });

  it('RNF-003 429 traz o Retry-After em segundos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(429, erro('muitas_tentativas'), { 'retry-after': '42' }));
    const result = await createApiClient({ fetch: fetchMock }).login(credenciais);
    expect(result).toEqual({ ok: false, kind: 'muitas-tentativas', retryAfterSeconds: 42 });
  });

  it('RF-001 falha de rede vira kind rede (não lança)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await createApiClient({ fetch: fetchMock }).login(credenciais);
    expect(result).toEqual({ ok: false, kind: 'rede' });
  });

  it('RF-001 resposta fora do contrato vira kind contrato; 5xx vira servidor', async () => {
    const bad = vi.fn().mockResolvedValue(json(200, { x: 1 }));
    expect(await createApiClient({ fetch: bad }).login(credenciais)).toEqual({
      ok: false,
      kind: 'contrato',
    });
    const boom = vi.fn().mockResolvedValue(json(500, erro('erro_interno')));
    expect(await createApiClient({ fetch: boom }).login(credenciais)).toEqual({
      ok: false,
      kind: 'servidor',
    });
  });
});

describe('RF-002 cliente HTTP: sessão e logout', () => {
  it('RF-002 consulta de sessão: 200 devolve usuário e fazenda', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, sessionBody));
    const result = await createApiClient({ fetch: fetchMock }).getSession();
    expect(result).toEqual({ ok: true, data: sessionBody });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/session');
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
  });

  it('RF-002 401 nao_autenticado e sessao_expirada são distintos', async () => {
    const a = vi.fn().mockResolvedValue(json(401, erro('nao_autenticado')));
    const b = vi.fn().mockResolvedValue(json(401, erro('sessao_expirada')));
    expect(await createApiClient({ fetch: a }).getSession()).toEqual({
      ok: false,
      kind: 'nao-autenticado',
    });
    expect(await createApiClient({ fetch: b }).getSession()).toEqual({
      ok: false,
      kind: 'sessao-expirada',
    });
  });

  it('RF-002 logout envia {} como JSON e só é sucesso com 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await createApiClient({ fetch: fetchMock }).logout();
    expect(result).toEqual({ ok: true, data: undefined });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('RF-002 logout com falha de rede ou 5xx não é sucesso', async () => {
    const net = vi.fn().mockRejectedValue(new TypeError('x'));
    expect(await createApiClient({ fetch: net }).logout()).toEqual({ ok: false, kind: 'rede' });
    const srv = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await createApiClient({ fetch: srv }).logout()).toEqual({ ok: false, kind: 'servidor' });
  });

  it('RNF-003 403 de CSRF vira kind bloqueada', async () => {
    const f = vi.fn().mockResolvedValue(json(403, erro('requisicao_bloqueada')));
    expect(await createApiClient({ fetch: f }).logout()).toEqual({ ok: false, kind: 'bloqueada' });
  });
});

describe('T-18 cliente HTTP: Conta', () => {
  const fazendaAtual = { ...sessionBody.fazenda, nome: 'Outra', areaHa: '10', version: 4 };

  it('RF-004 PATCH /api/conta/perfil devolve a sessão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, sessionBody));
    const result = await createApiClient({ fetch: fetchMock }).updatePerfil({
      nome: 'Ana',
      email: 'ana@fazenda.com',
    });
    expect(result).toEqual({ ok: true, data: sessionBody });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conta/perfil');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ nome: 'Ana', email: 'ana@fazenda.com' });
  });

  it('RF-005 PUT /api/conta/senha só é sucesso com 204; 400 credenciais_invalidas e 429 são distintos', async () => {
    const corpo = { senhaAtual: 'a', novaSenha: 'Nova#Senha2027' };
    const f204 = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await createApiClient({ fetch: f204 }).changePassword(corpo)).toEqual({
      ok: true,
      data: undefined,
    });
    expect((f204.mock.calls[0] as [string, RequestInit])[1].method).toBe('PUT');

    const f400 = vi.fn().mockResolvedValue(json(400, erro('credenciais_invalidas')));
    expect(await createApiClient({ fetch: f400 }).changePassword(corpo)).toEqual({
      ok: false,
      kind: 'credenciais',
    });

    const f429 = vi
      .fn()
      .mockResolvedValue(json(429, erro('muitas_tentativas'), { 'retry-after': '30' }));
    expect(await createApiClient({ fetch: f429 }).changePassword(corpo)).toEqual({
      ok: false,
      kind: 'muitas-tentativas',
      retryAfterSeconds: 30,
    });
  });

  it('RF-002 POST /api/auth/senha/esqueci só é sucesso com 202; 429 e rede são distintos', async () => {
    const corpo = { email: 'ana@fazenda.com' };
    const f202 = vi.fn().mockResolvedValue(json(202, { mensagem: 'x' }));
    expect(await createApiClient({ fetch: f202 }).forgotPassword(corpo)).toEqual({
      ok: true,
      data: undefined,
    });
    const [url, init] = f202.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/senha/esqueci');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(corpo);

    const f429 = vi
      .fn()
      .mockResolvedValue(json(429, erro('muitas_tentativas'), { 'retry-after': '60' }));
    expect(await createApiClient({ fetch: f429 }).forgotPassword(corpo)).toEqual({
      ok: false,
      kind: 'muitas-tentativas',
      retryAfterSeconds: 60,
    });
    const f500 = vi.fn().mockResolvedValue(json(500, {}));
    expect(await createApiClient({ fetch: f500 }).forgotPassword(corpo)).toEqual({
      ok: false,
      kind: 'servidor',
    });
    const fRede = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await createApiClient({ fetch: fRede }).forgotPassword(corpo)).toEqual({
      ok: false,
      kind: 'rede',
    });
  });

  it('RF-002 POST /api/auth/senha/redefinir só é sucesso com 204; 400 requisicao_invalida é link inválido', async () => {
    const corpo = { token: 'abc', novaSenha: 'Nova#Senha2027' };
    const f204 = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await createApiClient({ fetch: f204 }).resetPassword(corpo)).toEqual({
      ok: true,
      data: undefined,
    });
    const [url, init] = f204.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/senha/redefinir');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(corpo);

    const f400 = vi.fn().mockResolvedValue(json(400, erro('requisicao_invalida')));
    expect(await createApiClient({ fetch: f400 }).resetPassword(corpo)).toEqual({
      ok: false,
      kind: 'link-invalido',
    });

    const campos = [{ caminho: 'novaSenha', regra: 'simbolo', mensagem: 'falta símbolo' }];
    const fVal = vi
      .fn()
      .mockResolvedValue(
        json(400, { erro: { codigo: 'validacao_invalida', mensagem: 'x', campos } }),
      );
    expect(await createApiClient({ fetch: fVal }).resetPassword(corpo)).toEqual({
      ok: false,
      kind: 'validacao',
      campos,
    });

    const f429 = vi.fn().mockResolvedValue(json(429, erro('muitas_tentativas')));
    expect(await createApiClient({ fetch: f429 }).resetPassword(corpo)).toEqual({
      ok: false,
      kind: 'muitas-tentativas',
      retryAfterSeconds: null,
    });
  });

  it('RF-011 PATCH /api/fazenda: 409 devolve a fazenda atual', async () => {
    const f409 = vi
      .fn()
      .mockResolvedValue(json(409, { ...(erro('conflito') as object), atual: fazendaAtual }));
    const result = await createApiClient({ fetch: f409 }).updateFazenda({
      nome: 'X',
      version: 1,
    });
    expect(result).toEqual({ ok: false, kind: 'conflito', atual: fazendaAtual });
  });

  it('RF-004 409 sem fazenda (e-mail em uso) é conflito genérico, sem atual', async () => {
    const f409 = vi.fn().mockResolvedValue(json(409, erro('conflito')));
    const result = await createApiClient({ fetch: f409 }).updatePerfil({
      nome: 'Ana',
      email: 'ana@fazenda.com',
    });
    expect(result).toEqual({ ok: false, kind: 'conflito' });
  });

  it('RF-006 DELETE /api/conta/google só é sucesso com 204; 409 vira conflito', async () => {
    const f204 = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await createApiClient({ fetch: f204 }).unlinkGoogle()).toEqual({
      ok: true,
      data: undefined,
    });
    const [url, init] = f204.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conta/google');
    expect(init.method).toBe('DELETE');

    const f409 = vi.fn().mockResolvedValue(json(409, erro('conflito')));
    expect(await createApiClient({ fetch: f409 }).unlinkGoogle()).toEqual({
      ok: false,
      kind: 'conflito',
    });
  });

  it('RNF-009 GET /api/conta/exportar valida o contrato e traduz as falhas', async () => {
    const corpo = {
      versaoDoFormato: 1,
      geradoEm: '2026-10-19T12:00:00.000Z',
      observacao: 'Só não excluídos.',
      perfil: {
        id: sessionBody.usuario.id,
        email: 'ana@fazenda.com',
        nome: null,
        criadoEm: '2026-10-01T12:00:00.000Z',
        temSenha: true,
        googleVinculado: false,
        aceiteTermosVersao: '2026-10-19',
        aceiteTermosEm: '2026-10-19T12:00:00.000Z',
      },
      fazenda: {
        id: sessionBody.fazenda.id,
        nome: 'Boa Vista',
        areaHa: '10',
        criadoEm: '2026-10-01T12:00:00.000Z',
      },
      lotes: [],
      cenarios: [],
      recriaEntrada: null,
    };
    const f200 = vi.fn().mockResolvedValue(json(200, corpo));
    const result = await createApiClient({ fetch: f200 }).exportData();
    expect(result).toEqual({ ok: true, data: corpo });
    const [url, init] = f200.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conta/exportar');
    expect(init.method).toBe('GET');

    const ruim = vi.fn().mockResolvedValue(json(200, { qualquer: 'coisa' }));
    expect(await createApiClient({ fetch: ruim }).exportData()).toEqual({
      ok: false,
      kind: 'contrato',
    });
    const limite = vi
      .fn()
      .mockResolvedValue(json(429, erro('muitas_tentativas'), { 'retry-after': '30' }));
    expect(await createApiClient({ fetch: limite }).exportData()).toEqual({
      ok: false,
      kind: 'muitas-tentativas',
      retryAfterSeconds: 30,
    });
    const net = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await createApiClient({ fetch: net }).exportData()).toEqual({ ok: false, kind: 'rede' });
  });

  it('RF-007 DELETE /api/conta envia a confirmação e só é sucesso com 204', async () => {
    const f204 = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await createApiClient({ fetch: f204 }).deleteAccount();
    expect(result).toEqual({ ok: true, data: undefined });
    const [url, init] = f204.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conta');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({ confirmacao: 'deletar' });

    const net = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await createApiClient({ fetch: net }).deleteAccount()).toEqual({
      ok: false,
      kind: 'rede',
    });
  });
});

describe('RNF-009 cliente HTTP: termos e envio por e-mail', () => {
  it('aceitarTermos usa POST /api/conta/aceite com a versão e devolve a sessão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, sessionBody));
    const result = await createApiClient({ fetch: fetchMock }).aceitarTermos('2026-10-19');
    expect(result).toEqual({ ok: true, data: sessionBody });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conta/aceite');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ versao: '2026-10-19' });
  });

  it('aceitarTermos traduz 409 (versão desatualizada) em conflito', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(409, erro('conflito')));
    expect(await createApiClient({ fetch: fetchMock }).aceitarTermos('1999-01-01')).toEqual({
      ok: false,
      kind: 'conflito',
    });
  });

  it('enviarDadosPorEmail usa POST /api/conta/exportar/enviar, só é sucesso com 202 e traduz 429', async () => {
    const f202 = vi.fn().mockResolvedValue(json(202, { mensagem: 'ok' }));
    expect(await createApiClient({ fetch: f202 }).enviarDadosPorEmail()).toEqual({
      ok: true,
      data: undefined,
    });
    const [url, init] = f202.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conta/exportar/enviar');
    expect(init.method).toBe('POST');

    const f429 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(erro('muitas_tentativas')), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '120' },
      }),
    );
    expect(await createApiClient({ fetch: f429 }).enviarDadosPorEmail()).toEqual({
      ok: false,
      kind: 'muitas-tentativas',
      retryAfterSeconds: 120,
    });
  });
});
