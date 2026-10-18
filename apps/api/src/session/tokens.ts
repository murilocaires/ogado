import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token de sessão = `idSessao.segredo` (ADR-0010 a). No banco fica só o SHA-256 do segredo. */
export interface IssuedToken {
  /** Valor do cookie. */
  token: string;
  id: string;
  segredoHash: string;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function issueToken(): IssuedToken {
  const id = randomBytes(16).toString('base64url'); // 128 bits (>= 80)
  const segredo = randomBytes(32).toString('base64url'); // 256 bits
  return { token: `${id}.${segredo}`, id, segredoHash: sha256Hex(segredo) };
}

export function parseToken(token: string): { id: string; segredo: string } | null {
  const parts = token.split('.');
  const [id, segredo] = parts;
  if (parts.length !== 2 || !id || !segredo || id.length > 64 || segredo.length > 128) return null;
  return { id, segredo };
}

/** Comparação em tempo constante do segredo apresentado com o hash guardado. */
export function secretMatches(segredo: string, segredoHash: string): boolean {
  const presented = Buffer.from(sha256Hex(segredo), 'utf8');
  const stored = Buffer.from(segredoHash, 'utf8');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}
