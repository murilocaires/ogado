import { healthResponseSchema, type HealthResponse } from '@ogado/contracts';

export type HealthResult = { ok: true; data: HealthResponse } | { ok: false; reason: string };

export function apiUrl(): string {
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
}

export async function fetchHealth(baseUrl: string = apiUrl()): Promise<HealthResult> {
  try {
    const res = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, reason: `API respondeu HTTP ${res.status}` };
    const parsed = healthResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, reason: 'Resposta fora do contrato /health' };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, reason: 'API inacessível' };
  }
}
