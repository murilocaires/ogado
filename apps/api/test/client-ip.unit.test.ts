import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { CLIENT_IP_HEADER, clientIp, PROXY_SECRET_HEADER } from '../src/plugins/client-ip';

const SEGREDO = 's'.repeat(40);

function requisicao(headers: Record<string, string>): FastifyRequest {
  return { ip: '10.0.0.1', headers } as unknown as FastifyRequest;
}

describe('client IP rebrand compatibility', () => {
  it('accepts legacy proxy headers when the new names are absent', () => {
    expect(
      clientIp(
        requisicao({
          'x-ogado-proxy-secret': SEGREDO,
          'x-ogado-client-ip': '203.0.113.8',
        }),
        SEGREDO,
      ),
    ).toBe('203.0.113.8');
  });

  it('prefers Bovaro headers and ignores legacy values if both sets exist', () => {
    expect(
      clientIp(
        requisicao({
          [PROXY_SECRET_HEADER]: SEGREDO,
          [CLIENT_IP_HEADER]: '203.0.113.9',
          'x-ogado-proxy-secret': SEGREDO,
          'x-ogado-client-ip': '203.0.113.8',
        }),
        SEGREDO,
      ),
    ).toBe('203.0.113.9');
  });
});
