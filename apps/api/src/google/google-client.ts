import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Claims do id_token já validadas na assinatura, `iss`, `aud` e `exp` pelo cliente. */
export interface GoogleIdClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  nonce: string;
  name: string | null;
}

/**
 * Seam do Google (RF-001): a rota só conhece esta interface. Testes injetam um cliente falso;
 * produção usa `createGoogleOAuthClient` (fetch + JWKS do Google). `nonce` e `email_verified`
 * são conferidos pela rota, que é onde a regra de negócio vive.
 */
export interface GoogleOAuthClient {
  authorizationUrl(params: {
    state: string;
    nonce: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  /** Troca o code (com o verificador PKCE) e devolve as claims do id_token validado. */
  exchangeCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleIdClaims>;
}

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const REQUEST_TIMEOUT_MS = 10_000;

export interface GoogleClientOptions {
  clientId: string;
  clientSecret: string;
  /** Injetável para teste do cliente real sem rede. */
  fetchImpl?: typeof fetch;
  /** Resolvedor de chaves (padrão: JWKS remoto do Google, com cache). */
  keys?: JWTVerifyGetKey;
}

export function createGoogleOAuthClient(options: GoogleClientOptions): GoogleOAuthClient {
  const doFetch = options.fetchImpl ?? fetch;
  const keys = options.keys ?? createRemoteJWKSet(new URL(JWKS_URI));

  return {
    authorizationUrl({ state, nonce, codeChallenge, redirectUri }) {
      const query = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      return `${AUTHORIZATION_ENDPOINT}?${query.toString()}`;
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const response = await doFetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: options.clientId,
          client_secret: options.clientSecret,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // Mensagens fixas: nada do corpo do Google (pode ecoar code/segredos) vai para erros ou logs.
      if (!response.ok) throw new Error('google_token_recusado');
      const body: unknown = await response.json();
      const idToken =
        typeof body === 'object' && body !== null && 'id_token' in body ? body.id_token : null;
      if (typeof idToken !== 'string' || idToken.length === 0)
        throw new Error('google_sem_id_token');

      const { payload } = await jwtVerify(idToken, keys, {
        issuer: ISSUERS,
        audience: options.clientId,
        algorithms: ['RS256'],
      });
      const { sub, email, email_verified: emailVerified, nonce, name } = payload;
      if (typeof sub !== 'string' || sub.length === 0) throw new Error('google_claims_invalidas');
      if (typeof email !== 'string' || email.length === 0)
        throw new Error('google_claims_invalidas');
      if (typeof nonce !== 'string') throw new Error('google_claims_invalidas');
      return {
        sub,
        email,
        emailVerified: emailVerified === true,
        nonce,
        name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : null,
      };
    },
  };
}
