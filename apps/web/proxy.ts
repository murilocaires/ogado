import { NextResponse, type NextRequest } from 'next/server';

/**
 * Repassa o IP do cliente à API (que só enxerga o egress da Vercel) com um segredo compartilhado,
 * para os limites de taxa valerem por cliente. Cabeçalhos `x-ogado-*` vindos de fora são sempre
 * descartados. Sem `PROXY_SECRET` (dev/local) nada é enviado e a API usa o IP do socket.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete('x-ogado-proxy-secret');
  headers.delete('x-ogado-client-ip');

  const secret = process.env['PROXY_SECRET'];
  if (secret) {
    const ip =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) {
      headers.set('x-ogado-proxy-secret', secret);
      headers.set('x-ogado-client-ip', ip);
    }
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: '/api/:path*' };
