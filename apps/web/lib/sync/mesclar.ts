import type { CenarioEntity, LoteEntity } from '../repo/types';
import { loteDeDto, lotePatchDe, loteParaCriar } from './mappers';
import type { LoteDto } from '@ogado/contracts';

/** Campos de pesagem e desconto dependem uns dos outros e mudam como um grupo. */
export function mesclarLote(
  local: LoteEntity,
  servidor: LoteEntity,
  base: LoteEntity | null,
): LoteEntity {
  const meu = lotePatchDe(local);
  const anterior = base ? lotePatchDe(base) : null;
  const patch = lotePatchDe(servidor);
  const grupos: (keyof typeof patch)[][] = [
    ['categoria'],
    ['data'],
    ['preco'],
    ['modo', 'qtd', 'peso', 'pesos'],
    ['base', 'aplicarDesconto', 'descontoKg'],
  ];
  for (const grupo of grupos) {
    if (!anterior || grupo.some((k) => JSON.stringify(meu[k]) !== JSON.stringify(anterior[k]))) {
      Object.assign(patch, Object.fromEntries(grupo.map((k) => [k, meu[k]])));
    }
  }
  const dto: LoteDto = {
    ...loteParaCriar(servidor),
    ...patch,
    numero: servidor.numero,
    version: servidor.version,
    createdAt: servidor.updatedAt,
    updatedAt: servidor.updatedAt,
    deletedAt: servidor.deletedAt,
  };
  return { ...loteDeDto(dto), deletedAt: local.deletedAt };
}
export function mesclarCenario(
  local: CenarioEntity,
  servidor: CenarioEntity,
  base: CenarioEntity | null,
): CenarioEntity {
  return {
    ...servidor,
    nome: !base || local.nome !== base.nome ? local.nome : servidor.nome,
    deletedAt: local.deletedAt,
  };
}
