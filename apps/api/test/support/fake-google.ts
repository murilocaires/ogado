import { createHash } from 'node:crypto';
import type { GoogleIdClaims, GoogleOAuthClient } from '../../src/google/google-client';

/** Cliente OAuth falso: sem rede. Confere o PKCE (S256) como o Google faria. */
export function createFakeGoogleClient() {
  const challenges = new Set<string>();
  const scripted = new Map<string, GoogleIdClaims>();
  const exchanges: string[] = [];

  const client: GoogleOAuthClient = {
    authorizationUrl(p) {
      challenges.add(p.codeChallenge);
      const query = new URLSearchParams({
        state: p.state,
        nonce: p.nonce,
        code_challenge: p.codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: p.redirectUri,
        scope: 'openid email profile',
      });
      return `https://accounts.google.test/auth?${query.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }) {
      exchanges.push(code);
      const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
      if (!challenges.has(challenge)) throw new Error('pkce_invalido');
      const claims = scripted.get(code);
      if (!claims) throw new Error('code_invalido');
      return claims;
    },
  };

  return {
    client,
    exchanges,
    /** Define o que o Google devolveria para este `code`. */
    script(code: string, claims: GoogleIdClaims): void {
      scripted.set(code, claims);
    },
  };
}
