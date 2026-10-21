import type { UsuarioDto } from '@bovaro/contracts';
import type { PrismaClient } from '@bovaro/db';
import type { AppConfig } from '../config';
import type { TenantContext } from '../tenant';
import { toUsuarioDto, usuarioDtoSelect } from '../usuario-dto';
import { issueToken, parseToken, secretMatches } from './tokens';

const DAY_MS = 24 * 60 * 60 * 1000;
/** `ultimaVerificacaoEm` só é regravado se a última gravação for mais velha que isto (ADR-0010 a.3). */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface IssuedSession {
  token: string;
  id: string;
  segredoHash: string;
  criadaEm: Date;
  expiraEm: Date;
  /** Duração do cookie em segundos (inatividade, limitada pelo teto absoluto). */
  maxAgeSeconds: number;
}

export type SessionValidation =
  | {
      status: 'ok';
      tenant: TenantContext;
      usuario: UsuarioDto;
      /** Presente quando a expiração deslizante avançou: reemitir o cookie. */
      renewedMaxAgeSeconds: number | null;
    }
  | { status: 'invalida' }
  | { status: 'expirada' };

/**
 * Módulo de sessão (ADR-0010 a): token opaco `id.segredo`, só o SHA-256 do segredo no banco,
 * expiração deslizante por inatividade com teto absoluto. As rotas só conhecem esta interface.
 */
export function createSessionService(
  prisma: PrismaClient,
  config: Pick<AppConfig, 'sessionIdleDays' | 'sessionMaxDays'>,
  clock: () => Date,
) {
  const idleMs = config.sessionIdleDays * DAY_MS;
  const maxMs = config.sessionMaxDays * DAY_MS;

  const maxAgeSeconds = (now: Date, expiraEm: Date): number =>
    Math.max(0, Math.floor(Math.min(idleMs, expiraEm.getTime() - now.getTime()) / 1000));

  return {
    /** Gera token e dados da linha (a gravação é do chamador: pode estar numa transação). */
    issue(): IssuedSession {
      const now = clock();
      const expiraEm = new Date(now.getTime() + maxMs);
      return {
        ...issueToken(),
        criadaEm: now,
        expiraEm,
        maxAgeSeconds: maxAgeSeconds(now, expiraEm),
      };
    },

    /** Sessão nova para um usuário existente (login). */
    async create(usuarioId: string): Promise<IssuedSession> {
      const session = this.issue();
      await prisma.sessao.create({
        data: {
          id: session.id,
          segredoHash: session.segredoHash,
          usuarioId,
          criadaEm: session.criadaEm,
          ultimaVerificacaoEm: session.criadaEm,
          expiraEm: session.expiraEm,
        },
      });
      return session;
    },

    async validate(token: string, expectedUsuarioId?: string): Promise<SessionValidation> {
      const parsed = parseToken(token);
      if (!parsed) return { status: 'invalida' };

      const row = await prisma.sessao.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          segredoHash: true,
          ultimaVerificacaoEm: true,
          expiraEm: true,
          usuario: {
            select: {
              ...usuarioDtoSelect,
              fazenda: { select: { id: true, deletedAt: true } },
            },
          },
        },
      });
      if (!row || !secretMatches(parsed.segredo, row.segredoHash)) return { status: 'invalida' };
      // Uma requisição iniciada por outra identidade nunca renova ou apaga esta sessão.
      if (expectedUsuarioId !== undefined && row.usuario.id !== expectedUsuarioId) {
        return { status: 'invalida' };
      }

      const now = clock();
      const inactiveFor = now.getTime() - row.ultimaVerificacaoEm.getTime();
      if (now.getTime() >= row.expiraEm.getTime() || inactiveFor > idleMs) {
        await prisma.sessao.deleteMany({ where: { id: row.id } });
        return { status: 'expirada' };
      }

      const fazenda = row.usuario.fazenda;
      if (!fazenda || fazenda.deletedAt) return { status: 'invalida' };

      let renewedMaxAgeSeconds: number | null = null;
      if (inactiveFor > TOUCH_INTERVAL_MS) {
        await prisma.sessao.update({ where: { id: row.id }, data: { ultimaVerificacaoEm: now } });
        renewedMaxAgeSeconds = maxAgeSeconds(now, row.expiraEm);
      }

      return {
        status: 'ok',
        tenant: { usuarioId: row.usuario.id, fazendaId: fazenda.id },
        usuario: toUsuarioDto(row.usuario),
        renewedMaxAgeSeconds,
      };
    },

    /** Logout: apaga a linha no servidor. Idempotente; exige o segredo correto. */
    async invalidate(token: string): Promise<void> {
      const parsed = parseToken(token);
      if (!parsed) return;
      const row = await prisma.sessao.findUnique({
        where: { id: parsed.id },
        select: { segredoHash: true },
      });
      if (!row || !secretMatches(parsed.segredo, row.segredoHash)) return;
      await prisma.sessao.deleteMany({ where: { id: parsed.id } });
    },

    /** Troca de senha (RF-005): derruba as sessões do usuário, exceto a do token informado. */
    async invalidateOthersForUser(usuarioId: string, currentToken: string): Promise<void> {
      const current = parseToken(currentToken);
      await prisma.sessao.deleteMany({
        where: { usuarioId, ...(current ? { id: { not: current.id } } : {}) },
      });
    },

    /** Derruba todas as sessões do usuário. */
    async invalidateAllForUser(usuarioId: string): Promise<void> {
      await prisma.sessao.deleteMany({ where: { usuarioId } });
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
