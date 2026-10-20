import { z } from 'zod';

/** RF-032/RN-023: versões pertencem ao JSON imutável, sem depender de colunas da API. */
export const cenarioVariantesSchema = z.strictObject({
  lotacaoInicial: z.enum(['fixa80', 'areaPastavel']),
  faturamentoBruto: z.enum(['pesoVivo', 'carcaca']),
  cabecasInteiras: z.boolean().default(false),
  schemaVersao: z.literal(1).default(1),
  calculoVersao: z.enum(['recria-1', 'recria-2']).default('recria-1'),
});
export type CenarioVariantesContrato = z.infer<typeof cenarioVariantesSchema>;
export type CenarioVariantesEntrada = z.input<typeof cenarioVariantesSchema>;

const digitado = z.string().max(2000);
export const recriaFormSchema = z.strictObject({
  area: digitado,
  dias: digitado,
  investimento: digitado,
  rsCabCompra: digitado,
  pesoIni: digitado,
  pesoFin: digitado,
  precoVenda: digitado,
  consumoPct: digitado,
  precoSuplKg: digitado,
  rendCarcaca: digitado,
  imposto: digitado,
  sanidadeCabMes: digitado,
  funcionario: digitado,
  frete: digitado,
});
export type RecriaFormContrato = z.infer<typeof recriaFormSchema>;

/** Resultados podem ser negativos; nunca NaN, Infinity, expoente ou float JSON. */
const decimal = z
  .string()
  .max(2000)
  .regex(/^-?\d+(\.\d+)?$/);
const valor = decimal.nullable();
export const cenarioParametrosSchema = z.strictObject({
  arrobaVivoKg: decimal,
  arrobaCarcacaKg: decimal,
  uaKg: decimal,
  lotacaoFixaHa: decimal,
});
export type CenarioParametrosContrato = z.infer<typeof cenarioParametrosSchema>;
export const cenarioResultadoSchema = z.strictObject({
  cabecas: valor,
  lotacaoTotalUA: valor,
  lotacaoHaInicial: valor,
  pesoMedio: valor,
  lotacaoFinal: valor,
  arrobasProduzidas: valor,
  consumoKgDia: valor,
  arrobasCarcacaCab: valor,
  vendaCab: valor,
  custoTotal: valor,
  faturamentoBruto: valor,
  faturamentoLiquido: valor,
  totalEmCaixa: valor,
  liquidoMes: valor,
  liquidoHa: valor,
  gmdImplicito: valor,
  custos: z
    .array(
      z.strictObject({
        id: z.enum(['supl', 'san', 'imp', 'frete', 'func']),
        nome: z.string().max(100),
        valor,
      }),
    )
    .length(5)
    .refine(
      (custos) => new Set(custos.map((c) => c.id)).size === 5,
      'Os cinco custos do cenário devem ser distintos.',
    ),
});
export type CenarioResultadoContrato = z.infer<typeof cenarioResultadoSchema>;

export const cenarioSnapshotSchema = z.strictObject({
  form: recriaFormSchema,
  variantes: cenarioVariantesSchema,
  parametros: cenarioParametrosSchema,
  resultado: cenarioResultadoSchema,
});
export type CenarioSnapshot = z.infer<typeof cenarioSnapshotSchema>;

/** Valida e migra somente snapshots legados completos. Inválidos ficam para quarentena no I/O. */
export function normalizarCenarioSnapshot(raw: unknown): CenarioSnapshot | null {
  const result = cenarioSnapshotSchema.safeParse(raw);
  return result.success ? result.data : null;
}
