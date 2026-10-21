import type { UsuarioDto } from '@bovaro/contracts';
import type { Limiters } from './plugins/rate-limit';
import type { RouteCatalogEntry } from './plugins/route-catalog';
import type { TenantContext } from './tenant';

declare module 'fastify' {
  interface FastifyInstance {
    limiters: Limiters;
    /** Rotas registradas (para o teste-guardião de isolamento, CA-12). */
    routeCatalog: RouteCatalogEntry[];
  }
  interface FastifyRequest {
    /** Contexto de tenant da sessão; nulo em rotas públicas ou sem sessão. */
    tenant: TenantContext | null;
    /** Usuário da sessão (para GET /auth/session); nulo se não autenticado. */
    sessionUser: UsuarioDto | null;
  }
  interface FastifyContextConfig {
    /**
     * `public` = sem sessão. Qualquer outro valor (inclusive ausente) exige sessão: falha fechada,
     * assim uma rota nova nunca nasce aberta por esquecimento.
     */
    auth?: 'public' | 'required';
    /** DELETE com corpo JSON (DELETE /conta, confirmação); nas demais rotas DELETE com corpo segue bloqueado. */
    allowJsonBody?: boolean;
  }
}
