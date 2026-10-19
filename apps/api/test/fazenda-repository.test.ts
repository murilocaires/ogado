import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorEnvelopeSchema, fazendaSchema, sessionResponseSchema } from '@ogado/contracts';
import { createFazendaRepository } from '../src/repositories/fazenda-repository';
import type { TenantContext } from '../src/tenant';
import { buildTestApp, getWithCookie, prisma, signup } from './support/harness';

const app = buildTestApp();
const repo = createFazendaRepository(prisma);

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function createFarm(): Promise<{ ctx: TenantContext; cookie: string }> {
  const conta = await signup(app);
  const body = sessionResponseSchema.parse(conta.res.json());
  return { ctx: { usuarioId: body.usuario.id, fazendaId: body.fazenda.id }, cookie: conta.cookie };
}

describe('convenção de entidade sincronizável (ADR-0007) na Fazenda', () => {
  it('RF-010 CA-14: a fazenda recém-criada tem id UUID, version 1, updatedAt do servidor e deletedAt nulo', async () => {
    const antes = Date.now();
    const { ctx, cookie } = await createFarm();
    const depois = Date.now();

    const res = await getWithCookie(app, `/fazendas/${ctx.fazendaId}`, cookie);
    const fazenda = fazendaSchema.parse(res.json());

    expect(fazenda.id).toBe(ctx.fazendaId);
    expect(fazenda.version).toBe(1);
    expect(fazenda.deletedAt).toBeNull();
    const updatedAt = Date.parse(fazenda.updatedAt);
    expect(updatedAt).toBeGreaterThanOrEqual(antes - 1000);
    expect(updatedAt).toBeLessThanOrEqual(depois + 1000);
  });

  it('RF-010 CA-14: alteração aceita leva version a 2 e avança updatedAt, ignorando updatedAt/version do cliente', async () => {
    const { ctx } = await createFarm();
    const criada = await repo.findById(ctx, ctx.fazendaId);

    // o cliente tenta impor updatedAt e version; o repositório só aceita `nome`
    const doCliente = { nome: 'Fazenda Boa Vista', updatedAt: new Date('2000-01-01'), version: 99 };
    const alterada = await repo.update(ctx, ctx.fazendaId, doCliente);

    expect(alterada?.nome).toBe('Fazenda Boa Vista');
    expect(alterada?.version).toBe(2);
    expect(alterada && criada && alterada.updatedAt > criada.updatedAt).toBe(true);
    expect(alterada && alterada.updatedAt.getFullYear()).toBeGreaterThan(2000);
  });

  it('RF-010 CA-14: exclusão lógica preenche deletedAt, avança version e esconde a fazenda das leituras', async () => {
    const { ctx } = await createFarm();

    expect(await repo.softDelete(ctx, ctx.fazendaId)).toBe(true);

    expect(await repo.findById(ctx, ctx.fazendaId)).toBeNull();
    expect(await repo.list(ctx)).toEqual([]);
    const linha = await prisma.fazenda.findUnique({ where: { id: ctx.fazendaId } });
    expect(linha?.deletedAt).not.toBeNull();
    expect(linha?.version).toBe(2);
  });
});

describe('isolamento no repositório (alterar e excluir)', () => {
  it('RF-010 CA-11: A não altera nem exclui a fazenda de B; os dados de B ficam intactos', async () => {
    const a = await createFarm();
    const b = await createFarm();
    const antes = await repo.findById(b.ctx, b.ctx.fazendaId);

    expect(await repo.update(a.ctx, b.ctx.fazendaId, { nome: 'invadida' })).toBeNull();
    expect(await repo.softDelete(a.ctx, b.ctx.fazendaId)).toBe(false);
    expect(await repo.findById(a.ctx, b.ctx.fazendaId)).toBeNull();

    expect(await repo.findById(b.ctx, b.ctx.fazendaId)).toEqual(antes);
  });

  it('RF-010 CA-15: criar ou alterar com o UUID da fazenda de B dá erro genérico e o registro de B não muda nem aparece', async () => {
    const a = await createFarm();
    const b = await createFarm();
    const antes = await repo.findById(b.ctx, b.ctx.fazendaId);

    // alterar com o id de B: indistinguível de "não existe"
    expect(await repo.update(a.ctx, b.ctx.fazendaId, { nome: 'x' })).toBeNull();

    // criar com o id de B (cadastro cujo id gerado colide): 409 genérico, sem revelar B
    const colidindo = buildTestApp({ newFazendaId: () => b.ctx.fazendaId });
    await colidindo.ready();
    const res = await colidindo.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      payload: JSON.stringify({
        email: `c-${b.ctx.fazendaId}@teste.ogado.invalid`,
        senha: 'Boi#Gordo2026',
        aceiteTermos: true,
      }),
    });
    expect(res.statusCode).toBe(409);
    expect(errorEnvelopeSchema.parse(res.json()).erro.codigo).toBe('conflito');
    expect(res.body).not.toContain(b.ctx.usuarioId);
    await colidindo.close();

    expect(await repo.findById(b.ctx, b.ctx.fazendaId)).toEqual(antes);
  });
});
