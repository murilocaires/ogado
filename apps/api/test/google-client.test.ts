import { generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createGoogleOAuthClient } from '../src/google/google-client';

const CLIENT_ID = 'cliente-teste.apps.googleusercontent.com';
const REDIRECT = 'http://localhost:3000/api/auth/google/callback';

const claims = {
  sub: '123',
  email: 'a@b.c',
  email_verified: true,
  nonce: 'n'.repeat(32),
  name: 'Ana',
};

interface TokenOptions {
  iss?: string;
  aud?: string;
  exp?: string;
}

async function setup(tokenClaims: Record<string, unknown>, options: TokenOptions = {}) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const { publicKey: outraChave } = await generateKeyPair('RS256');
  const idToken = await new SignJWT(tokenClaims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(options.iss ?? 'https://accounts.google.com')
    .setAudience(options.aud ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(options.exp ?? '5m')
    .sign(privateKey);

  const requests: { url: string; body: string }[] = [];
  const build = (token: string | null, key = publicKey) =>
    createGoogleOAuthClient({
      clientId: CLIENT_ID,
      clientSecret: 'segredo-de-teste',
      keys: async () => key,
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), body: String(init?.body) });
        return token === null
          ? new Response('{}', { status: 400 })
          : Response.json({ id_token: token });
      },
    });
  return { idToken, build, requests, outraChave };
}

type Client = ReturnType<Awaited<ReturnType<typeof setup>>['build']>;
const exchange = (c: Client) =>
  c.exchangeCode({ code: 'c0de', codeVerifier: 'v'.repeat(43), redirectUri: REDIRECT });

describe('cliente Google real (sem rede)', () => {
  it('monta a URL de autorização com PKCE S256 e os scopes', async () => {
    const { build } = await setup(claims);
    const url = new URL(
      build(null).authorizationUrl({
        state: 's',
        nonce: 'n',
        codeChallenge: 'ch',
        redirectUri: REDIRECT,
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_secret')).toBeNull();
  });

  it('troca o code com o verificador PKCE e devolve as claims do id_token válido', async () => {
    const s = await setup(claims);
    const out = await exchange(s.build(s.idToken));
    expect(out).toEqual({
      sub: '123',
      email: 'a@b.c',
      emailVerified: true,
      nonce: claims.nonce,
      name: 'Ana',
    });
    const sent = new URLSearchParams(s.requests[0]?.body);
    expect(s.requests[0]?.url).toBe('https://oauth2.googleapis.com/token');
    expect(sent.get('grant_type')).toBe('authorization_code');
    expect(sent.get('code_verifier')).toBe('v'.repeat(43));
    expect(sent.get('redirect_uri')).toBe(REDIRECT);
  });

  it('aceita o emissor sem esquema (accounts.google.com)', async () => {
    const s = await setup(claims, { iss: 'accounts.google.com' });
    await expect(exchange(s.build(s.idToken))).resolves.toMatchObject({ sub: '123' });
  });

  it.each([
    ['emissor errado', { iss: 'https://evil.example' }],
    ['audiência errada', { aud: 'outro-cliente' }],
    ['token expirado', { exp: '-1m' }],
  ])('recusa id_token com %s', async (_nome, options) => {
    const s = await setup(claims, options);
    await expect(exchange(s.build(s.idToken))).rejects.toThrow();
  });

  it('recusa id_token assinado por outra chave', async () => {
    const s = await setup(claims);
    await expect(exchange(s.build(s.idToken, s.outraChave))).rejects.toThrow();
  });

  it('recusa token sem sub ou sem nonce, e resposta de erro do Google', async () => {
    const semSub = await setup({ ...claims, sub: undefined });
    await expect(exchange(semSub.build(semSub.idToken))).rejects.toThrow();
    const semNonce = await setup({ ...claims, nonce: undefined });
    await expect(exchange(semNonce.build(semNonce.idToken))).rejects.toThrow();
    const erro = await setup(claims);
    await expect(exchange(erro.build(null))).rejects.toThrow('google_token_recusado');
  });

  it('email_verified só vale quando é exatamente true', async () => {
    const s = await setup({ ...claims, email_verified: 'true' });
    const out = await exchange(s.build(s.idToken));
    expect(out.emailVerified).toBe(false);
  });
});
