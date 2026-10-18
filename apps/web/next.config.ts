import type { NextConfig } from 'next';

/**
 * Mesma origem (ADR-0010 a.5): o navegador só fala com `/api/*`; o Next repassa para a API.
 * Assim o cookie de sessão é de primeira parte (sem problema de ITP no iOS) e o CORS não entra.
 */
const apiOrigin = process.env['API_ORIGIN'] ?? 'http://localhost:3001';

const config: NextConfig = {
  transpilePackages: ['@ogado/contracts'],
  agentRules: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};

export default config;
