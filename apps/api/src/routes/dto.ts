import type { FazendaDto } from '@ogado/contracts';
import type { FazendaRecord } from '../repositories/fazenda-repository';

export function toFazendaDto(f: FazendaRecord): FazendaDto {
  return {
    id: f.id,
    nome: f.nome,
    version: f.version,
    updatedAt: f.updatedAt.toISOString(),
    deletedAt: f.deletedAt ? f.deletedAt.toISOString() : null,
  };
}
