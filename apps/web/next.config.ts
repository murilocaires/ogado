import type { NextConfig } from 'next';

/**
 * Mesma origem (ADR-0010 a.5): o navegador só fala com `/api/*`; o Next repassa para a API.
 * Assim o cookie de sessão é de primeira parte (sem problema de ITP no iOS) e o CORS não entra.
 *
 * E1 (deploy sem API): em produção o repasse só existe se `API_ORIGIN` estiver definido; o produto
 * navegável (Painel, Negócios, Recria) não fala com a API.
 */
const apiOrigin =
  process.env['API_ORIGIN'] ??
  (process.env['NODE_ENV'] === 'production' ? undefined : 'http://localhost:3001');

/**
 * Id do build: muda a cada deploy e vira a versão do service worker e dos caches (RF-077). Vem do
 * ambiente (`NEXT_PUBLIC_BUILD_ID`, ou o commit da Vercel); sem isso, do instante do build.
 */
const buildId =
  process.env['NEXT_PUBLIC_BUILD_ID'] ??
  process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 12) ??
  Date.now().toString(36);
// Os processos filhos do build herdam o ambiente: todos enxergam o mesmo id.
process.env['NEXT_PUBLIC_BUILD_ID'] = buildId;

// RNF-003: a shell estática/offline do Next contém scripts e estilos inline do framework.
// CSP sem nonce preserva esse modelo; eval e WebSocket ficam restritos ao desenvolvimento.
const development = process.env['NODE_ENV'] !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self'${development ? ' ws: wss:' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  transpilePackages: ['@ogado/contracts', '@ogado/domain'],
  agentRules: false,
  poweredByHeader: false,
  devIndicators: false,
  // O prerender não deve abrir um processo por CPU em máquinas com pouca memória.
  experimental: { cpus: 1 },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(!development
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
            : []),
        ],
      },
    ];
  },
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};

export default config;
