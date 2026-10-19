import { TERMOS_VERSAO, type UsuarioDto } from '@ogado/contracts';

/** Seleção Prisma que alimenta `toUsuarioDto` (o hash nunca sai da API: só vira `temSenha`). */
export const usuarioDtoSelect = {
  id: true,
  email: true,
  nome: true,
  senhaHash: true,
  aceiteTermosVersao: true,
  aceiteTermosEm: true,
  identidadeGoogle: { select: { id: true } },
} as const;

export interface UsuarioDtoRow {
  id: string;
  email: string;
  nome: string | null;
  senhaHash: string | null;
  aceiteTermosVersao: string | null;
  aceiteTermosEm: Date | null;
  identidadeGoogle: { id: string } | null;
}

export function toUsuarioDto(row: UsuarioDtoRow): UsuarioDto {
  return {
    id: row.id,
    email: row.email,
    nome: row.nome,
    temSenha: row.senhaHash !== null,
    googleVinculado: row.identidadeGoogle !== null,
    aceiteVigente: row.aceiteTermosVersao === TERMOS_VERSAO,
    aceiteTermosVersao: row.aceiteTermosVersao,
    aceiteTermosEm: row.aceiteTermosEm ? row.aceiteTermosEm.toISOString() : null,
  };
}
