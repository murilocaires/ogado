import { z } from 'zod';
import { decimalStringSchema } from './decimal';
import { errorEnvelopeSchema } from './errors';
import {
  cenarioParametrosSchema,
  cenarioResultadoSchema,
  cenarioVariantesSchema,
  recriaFormSchema,
} from './cenarios';

// E3 (ADR-0007, ADR-0011 §3-4): dados do site no servidor. Um schema para API e telas.
// Decimais trafegam como string canônica (sem zeros à direita na resposta). Validação só técnica.

const uuid = (rotulo: string) => z.uuid(`O identificador ${rotulo} é inválido.`);

/** Campos de sincronização comuns, sempre do servidor (ADR-0007 §5). */
const syncMeta = {
  version: z.number().int().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
};

/** Versão-base que o cliente leu (concorrência otimista). */
export const baseVersionSchema = z
  .number({ error: 'Informe a versão.' })
  .int('A versão deve ser um número inteiro.')
  .min(1, 'A versão é inválida.')
  .max(2_147_483_647, 'A versão é inválida.');

/** DELETE sem corpo: a versão-base vai na query (`?version=N`). */
export const deleteQuerySchema = z.strictObject({
  version: z.coerce.number({ error: 'Informe a versão.' }).pipe(baseVersionSchema),
});
export type DeleteQuery = z.infer<typeof deleteQuerySchema>;

export const idParamsSchema = z.strictObject({ id: uuid('do recurso') });

// --- Lote (compra/venda) -------------------------------------------------------------------

export const loteTipoSchema = z.enum(['compra', 'venda'], { error: 'Tipo de lote inválido.' });
export type LoteTipo = z.infer<typeof loteTipoSchema>;
export const modoPesoSchema = z.enum(['total', 'medio', 'individual'], {
  error: 'Modo de peso inválido.',
});
export const baseArrobaSchema = z.enum(['vivo', 'carcaca'], { error: 'Base da @ inválida.' });

const loteCampos = {
  categoria: z
    .string({ error: 'Informe a categoria.' })
    .trim()
    .min(1, 'Informe a categoria.')
    .max(80, 'A categoria deve ter no máximo 80 caracteres.'),
  data: z.iso.date('A data é inválida.').nullable(),
  modo: modoPesoSchema,
  qtd: decimalStringSchema({ rotulo: 'A quantidade', precisao: 12, escala: 3 }),
  peso: decimalStringSchema({ rotulo: 'O peso', precisao: 12, escala: 3 }),
  pesos: z
    .array(decimalStringSchema({ rotulo: 'O peso do animal', precisao: 12, escala: 3 }), {
      error: 'Os pesos individuais são inválidos.',
    })
    .max(5000, 'Informe no máximo 5000 pesos.'),
  preco: decimalStringSchema({ rotulo: 'O preço por @', precisao: 14, escala: 2 }),
  base: baseArrobaSchema,
  aplicarDesconto: z.boolean({ error: 'Informe se aplica desconto.' }),
  /** kg descontados por cabeça (ADR-0013); vazio usa o padrão de 10 kg/cab. */
  descontoKg: decimalStringSchema({ rotulo: 'O desconto', precisao: 8, escala: 3 }).nullable(),
};

/** POST /lotes. O `id` é gerado pelo cliente (idempotência); o `numero` é do servidor. */
export const loteCreateSchema = z.strictObject({
  id: uuid('do lote'),
  tipo: loteTipoSchema,
  categoria: loteCampos.categoria,
  data: loteCampos.data.default(null),
  modo: loteCampos.modo,
  qtd: loteCampos.qtd,
  peso: loteCampos.peso,
  pesos: loteCampos.pesos.default([]),
  preco: loteCampos.preco,
  base: loteCampos.base.default('vivo'),
  aplicarDesconto: loteCampos.aplicarDesconto.default(false),
  descontoKg: loteCampos.descontoKg.default(null),
});
export type LoteCreate = z.infer<typeof loteCreateSchema>;

/** PATCH /lotes/:id. `tipo` e `numero` não mudam. Ao menos um campo além de `version`. */
export const lotePatchSchema = z
  .strictObject({
    version: baseVersionSchema,
    categoria: loteCampos.categoria.optional(),
    data: loteCampos.data.optional(),
    modo: loteCampos.modo.optional(),
    qtd: loteCampos.qtd.optional(),
    peso: loteCampos.peso.optional(),
    pesos: loteCampos.pesos.optional(),
    preco: loteCampos.preco.optional(),
    base: loteCampos.base.optional(),
    aplicarDesconto: loteCampos.aplicarDesconto.optional(),
    descontoKg: loteCampos.descontoKg.optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'version'), {
    error: 'Informe ao menos um campo para alterar.',
  });
export type LotePatch = z.infer<typeof lotePatchSchema>;

export const loteSchema = z.object({
  id: z.uuid(),
  tipo: loteTipoSchema,
  numero: z.number().int().min(1),
  categoria: z.string(),
  data: z.string().nullable(),
  modo: modoPesoSchema,
  qtd: z.string(),
  peso: z.string(),
  pesos: z.array(z.string()),
  preco: z.string(),
  base: baseArrobaSchema,
  aplicarDesconto: z.boolean(),
  descontoKg: z.string().nullable(),
  ...syncMeta,
});
export type LoteDto = z.infer<typeof loteSchema>;

export const syncCursorSchema = z.strictObject({ updatedAt: z.iso.datetime(), id: z.uuid() });
export const syncPageQueryFields = {
  incremental: z.enum(['true', 'false']).default('false'),
  cursorUpdatedAt: z.iso.datetime().optional(),
  cursorId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
};

function cursorCompleto(query: {
  cursorUpdatedAt?: string;
  cursorId?: string;
  incremental?: 'true' | 'false';
}): boolean {
  // Primeira página incremental: sem cursor é permitido
  if (query.incremental === 'true' && !query.cursorUpdatedAt && !query.cursorId) {
    return true;
  }
  return Boolean(query.cursorUpdatedAt) === Boolean(query.cursorId);
}

/** GET /lotes?tipo=&incluirExcluidos=true. Ordem estável: tipo, numero. */
export const loteListQuerySchema = z
  .strictObject({
    ...syncPageQueryFields,
    tipo: loteTipoSchema.optional(),
    incluirExcluidos: z.enum(['true', 'false']).default('false'),
  })
  .refine(cursorCompleto, 'Informe os dois campos do cursor.');
export const loteListResponseSchema = z.object({
  lotes: z.array(loteSchema),
  proximoCursor: syncCursorSchema.nullable().optional(),
});
export type LoteListResponse = z.infer<typeof loteListResponseSchema>;

// --- Cenário (RF-032, RN-023: snapshot imutável) ------------------------------------------------

/** Folhas sempre string (nunca number): valores decimais como string canônica. */
const textoCurto = z.string().max(2000, 'Texto longo demais.');
const chave = z.string().max(100);
const mapaDeTextos = z.record(chave, textoCurto);

export const CENARIO_NOME_MAX = 80;
const nome = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .min(1, 'Informe o nome.')
  .max(CENARIO_NOME_MAX, `O nome deve ter no máximo ${CENARIO_NOME_MAX} caracteres.`);

export const cenarioCreateSchema = z.strictObject({
  id: uuid('do cenário'),
  nome,
  /** Data de criação (ISO); preserva o momento em que foi salvo no aparelho. */
  criadoEm: z.iso.datetime({ error: 'A data de criação é inválida.' }),
  entradas: recriaFormSchema,
  variantes: cenarioVariantesSchema,
  parametros: cenarioParametrosSchema,
  resultado: cenarioResultadoSchema,
});
export type CenarioCreate = z.infer<typeof cenarioCreateSchema>;

/** PATCH /cenarios/:id: só o nome muda (o snapshot é imutável). */
export const cenarioPatchSchema = z.strictObject({ version: baseVersionSchema, nome });
export type CenarioPatch = z.infer<typeof cenarioPatchSchema>;

export const cenarioSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  criadoEm: z.iso.datetime(),
  // Leitura preserva JSON histórico para validação/quarentena individual no consumidor.
  // Escrita continua estrita em cenarioCreateSchema; um legado inválido não bloqueia a página.
  entradas: z.unknown(),
  variantes: z.unknown(),
  parametros: z.unknown(),
  resultado: z.unknown(),
  ...syncMeta,
});
export type CenarioDto = z.infer<typeof cenarioSchema>;

export const cenarioListQuerySchema = z
  .strictObject({
    ...syncPageQueryFields,
    incluirExcluidos: z.enum(['true', 'false']).default('false'),
  })
  .refine(cursorCompleto, 'Informe os dois campos do cursor.');
export const cenarioListResponseSchema = z.object({
  cenarios: z.array(cenarioSchema),
  proximoCursor: syncCursorSchema.nullable().optional(),
});
export type CenarioListResponse = z.infer<typeof cenarioListResponseSchema>;

// --- Entradas da recria (1 por fazenda) ---------------------------------------------------------

export const lotacaoInicialSchema = z.enum(['fixa80', 'areaPastavel'], {
  error: 'Variante de lotação inválida.',
});

/**
 * PUT /recria-entrada. Sem registro no servidor: cria com o `id` do cliente (sem `version`).
 * Com registro: exige `version` igual à do servidor (senão 409 com `atual`).
 */
export const recriaEntradaPutSchema = z.strictObject({
  id: uuid('das entradas'),
  version: baseVersionSchema.optional(),
  entradas: mapaDeTextos,
  lotacaoInicial: lotacaoInicialSchema,
});
export type RecriaEntradaPut = z.infer<typeof recriaEntradaPutSchema>;

export const recriaEntradaSchema = z.object({
  id: z.uuid(),
  entradas: mapaDeTextos,
  lotacaoInicial: lotacaoInicialSchema,
  ...syncMeta,
});
export type RecriaEntradaDto = z.infer<typeof recriaEntradaSchema>;

// --- 409 com o estado atual do servidor ----------------------------------------------------------

/** `{ erro: { codigo: 'conflito', ... }, atual }` (ADR-0011 §4). */
export function conflictEnvelopeSchema<T extends z.ZodType>(atual: T) {
  return errorEnvelopeSchema.extend({ atual });
}
export const loteConflictSchema = conflictEnvelopeSchema(loteSchema);
export const cenarioConflictSchema = conflictEnvelopeSchema(cenarioSchema);
export const recriaEntradaConflictSchema = conflictEnvelopeSchema(recriaEntradaSchema);
