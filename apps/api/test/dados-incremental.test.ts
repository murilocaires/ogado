import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  cenarioListResponseSchema,
  loteListResponseSchema,
  sessionResponseSchema,
} from '@bovaro/contracts';
import { buildTestApp, getWithCookie, postJson, prisma, signup } from './support/harness';
import { TEST_ORIGIN } from './support/env';
import { cenarioFixture } from './support/cenario';

const app = buildTestApp();
beforeAll(() => app.ready());
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
const instante = new Date('2026-10-19T10:00:00.000Z');
const idsOrdenados = () => {
  const prefixo = randomUUID().slice(0, 24);
  return [1, 2, 3].map((n) => `${prefixo}${String(n).padStart(12, '0')}`);
};

it.each(['lotes', 'cenarios'] as const)(
  'RF-074/RNF-017 %s continuam visíveis após relógio atrasado ou escrita antiga',
  async (recurso) => {
    const conta = await signup(app);
    const fazendaId = sessionResponseSchema.parse(conta.res.json()).fazenda.id;
    const criar = async (id: string) =>
      postJson(
        app,
        `/${recurso}`,
        recurso === 'lotes'
          ? {
              id,
              tipo: 'compra',
              categoria: 'GARROTES',
              modo: 'total',
              qtd: '10',
              peso: '3000',
              preco: '300',
            }
          : cenarioFixture({ id }),
        { cookie: conta.cookie },
      );
    const primeiro = randomUUID();
    expect((await criar(primeiro)).statusCode).toBe(201);
    const futuro = new Date(Date.now() + 60_000);
    // Relógio do servidor retrocede depois desta escrita confirmada. Sem relógio lógico,
    // os próximos commits ficam permanentemente anteriores ao checkpoint do aparelho.
    if (recurso === 'lotes')
      await prisma.lote.updateMany({ where: { fazendaId }, data: { updatedAt: futuro } });
    else await prisma.cenario.updateMany({ where: { fazendaId }, data: { updatedAt: futuro } });
    const novo = randomUUID();
    const criado = await criar(novo);
    expect(criado.statusCode).toBe(201);
    let registro = criado.json() as { updatedAt: string; version: number };
    expect(Date.parse(registro.updatedAt)).toBeGreaterThan(futuro.getTime());
    const patch = await app.inject({
      method: 'PATCH',
      url: `/${recurso}/${novo}`,
      headers: { cookie: conta.cookie, origin: TEST_ORIGIN },
      payload:
        recurso === 'lotes'
          ? { version: registro.version, categoria: 'NOVILHAS' }
          : { version: registro.version, nome: 'Renomeado' },
    });
    expect(patch.statusCode).toBe(200);
    expect(Date.parse(patch.json().updatedAt as string)).toBeGreaterThan(
      Date.parse(registro.updatedAt),
    );
    registro = patch.json() as typeof registro;
    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/${recurso}/${novo}?version=${registro.version}`,
      headers: { cookie: conta.cookie, origin: TEST_ORIGIN },
    });
    expect(exclusao.statusCode).toBe(200);
    expect(Date.parse(exclusao.json().updatedAt as string)).toBeGreaterThan(
      Date.parse(registro.updatedAt),
    );
    const pagina = await getWithCookie(
      app,
      `/${recurso}?incremental=true&cursorUpdatedAt=${futuro.toISOString()}&cursorId=ffffffff-ffff-ffff-ffff-ffffffffffff`,
      conta.cookie,
    );
    expect(pagina.statusCode).toBe(200);
    const itens = (pagina.json() as Record<string, { id: string; deletedAt: string | null }[]>)[
      recurso
    ]!;
    expect(itens.map((item) => item.id)).toEqual([novo]);
    expect(itens[0]!.deletedAt).not.toBeNull();
  },
);

it('RF-074/RNF-017 páginas por updatedAt/id não pulam empates, incluem tombstones e isolam fazendas', async () => {
  const conta = await signup(app);
  const fazendaId = sessionResponseSchema.parse(conta.res.json()).fazenda.id;
  const outra = await signup(app);
  const ids = idsOrdenados();
  for (const id of ids) {
    expect(
      (
        await postJson(
          app,
          '/lotes',
          {
            id,
            tipo: 'compra',
            categoria: 'GARROTE',
            modo: 'total',
            qtd: '10',
            peso: '3000',
            preco: '300',
          },
          { cookie: conta.cookie },
        )
      ).statusCode,
    ).toBe(201);
  }
  expect(
    (
      await postJson(
        app,
        '/lotes',
        {
          id: randomUUID(),
          tipo: 'compra',
          categoria: 'OUTRA FAZENDA',
          modo: 'total',
          qtd: '10',
          peso: '3000',
          preco: '300',
        },
        { cookie: outra.cookie },
      )
    ).statusCode,
  ).toBe(201);
  expect(
    (
      await app.inject({
        method: 'DELETE',
        url: `/lotes/${ids[2]}?version=1`,
        headers: { cookie: conta.cookie, origin: TEST_ORIGIN },
      })
    ).statusCode,
  ).toBe(200);
  // Fixture de empate exato; observação e assertivas permanecem na interface HTTP pública.
  await prisma.lote.updateMany({
    where: { fazendaId, id: { in: ids } },
    data: { updatedAt: instante },
  });
  const recebidos: string[] = [];
  let query = '/lotes?incremental=true&limit=1';
  for (let pagina = 0; pagina < 3; pagina++) {
    const res = await getWithCookie(app, query, conta.cookie);
    expect(res.statusCode).toBe(200);
    const body = loteListResponseSchema.parse(res.json());
    expect(body.lotes).toHaveLength(1);
    recebidos.push(body.lotes[0]!.id);
    if (pagina < 2) {
      expect(body.proximoCursor).toEqual({ updatedAt: instante.toISOString(), id: ids[pagina] });
      query = `/lotes?incremental=true&limit=1&cursorUpdatedAt=${instante.toISOString()}&cursorId=${body.proximoCursor!.id}`;
    } else {
      expect(body.proximoCursor).toBeNull();
      expect(body.lotes[0]!.deletedAt).not.toBeNull();
    }
  }
  expect(recebidos).toEqual(ids);
  const legado = loteListResponseSchema.parse(
    (await getWithCookie(app, '/lotes', conta.cookie)).json(),
  );
  expect(legado.lotes).toHaveLength(2);
  expect(legado.proximoCursor).toBeUndefined();
});

it('RF-074/RF-079 cenário legado inválido não impede página de snapshots válidos', async () => {
  const conta = await signup(app);
  const fazendaId = sessionResponseSchema.parse(conta.res.json()).fazenda.id;
  const ids = idsOrdenados();
  for (const id of ids)
    expect(
      (await postJson(app, '/cenarios', cenarioFixture({ id }), { cookie: conta.cookie }))
        .statusCode,
    ).toBe(201);
  await prisma.cenario.updateMany({
    where: { fazendaId, id: { in: ids } },
    data: { updatedAt: instante },
  });
  await prisma.cenario.updateMany({ where: { fazendaId, id: ids[1] }, data: { entradas: {} } });
  const res = await getWithCookie(app, '/cenarios?incremental=true&limit=3', conta.cookie);
  expect(res.statusCode).toBe(200);
  const body = cenarioListResponseSchema.parse(res.json());
  expect(body.cenarios.map((c) => c.id)).toEqual(ids);
  expect(body.cenarios[1]!.entradas).toEqual({});
  expect(body.proximoCursor).toBeNull();
});

it('RF-074/RNF-003 limita páginas e rejeita cursor parcial ou inválido', async () => {
  const conta = await signup(app);
  for (const caminho of ['/lotes', '/cenarios']) {
    for (const query of [
      'limit=0',
      'limit=201',
      'cursorId=00000000-0000-4000-8000-000000000001',
      'cursorUpdatedAt=invalido&cursorId=invalido',
    ]) {
      expect(
        (await getWithCookie(app, `${caminho}?incremental=true&${query}`, conta.cookie)).statusCode,
      ).toBe(400);
    }
  }
});
