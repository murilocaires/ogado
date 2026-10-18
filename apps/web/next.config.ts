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

const config: NextConfig = {
  transpilePackages: ['@ogado/contracts', '@ogado/domain'],
  agentRules: false,
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};

export default config;
