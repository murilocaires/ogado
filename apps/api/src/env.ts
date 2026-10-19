import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** Normaliza cada origem para `new URL(o).origin` (sem barra final nem caminho); inválida lança. */
export function parseOrigins(raw: string): string[] {
  return splitList(raw).map((o) => new URL(o).origin);
}

/** Falha fechado: só 'development' e 'test' são ambientes não produtivos. */
export function isProduction(nodeEnv: string): boolean {
  return nodeEnv !== 'development' && nodeEnv !== 'test';
}

/** `none` = sem proxy confiável (declaração explícita); o resto é lista de IPs/CIDRs. */
export const TRUST_PROXY_NONE = 'none';

function parseTrustProxy(raw: string): string[] {
  return raw.trim() === TRUST_PROXY_NONE ? [] : splitList(raw);
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Sem default: ausente falha na subida. Tudo que não for development/test é produção.
  NODE_ENV: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  // Sessão (ADR-0010 a, Q2): inatividade e teto absoluto, em dias.
  SESSION_IDLE_DAYS: positiveInt.default(30),
  SESSION_MAX_DAYS: positiveInt.default(90),
  // argon2id (ADR-0010 b): mínimo OWASP; só pode subir.
  ARGON2_MEMORY_KIB: positiveInt.default(19456),
  ARGON2_TIME_COST: positiveInt.default(2),
  ARGON2_PARALLELISM: positiveInt.default(1),
  // Rate limit (ADR-0010 e).
  RATE_LIMIT_GLOBAL_PER_MIN: positiveInt.default(300),
  RATE_LIMIT_LOGIN_IP_EMAIL_PER_MIN: positiveInt.default(5),
  RATE_LIMIT_LOGIN_IP_PER_MIN: positiveInt.default(20),
  RATE_LIMIT_SIGNUP_IP_PER_HOUR: positiveInt.default(5),
  // Recuperação de senha (RF-002).
  RATE_LIMIT_FORGOT_IP_PER_HOUR: positiveInt.default(10),
  RATE_LIMIT_FORGOT_EMAIL_PER_HOUR: positiveInt.default(3),
  RATE_LIMIT_RESET_IP_PER_HOUR: positiveInt.default(20),
  // Entrada com Google (RF-001/RF-006): por IP, início e retorno do fluxo.
  RATE_LIMIT_GOOGLE_IP_PER_HOUR: positiveInt.default(60),
  // Exportação dos dados do titular (RNF-009): por usuário.
  RATE_LIMIT_EXPORT_USER_PER_HOUR: positiveInt.default(10),
  // Google OAuth (opcionais): ausentes, as rotas /auth/google/* respondem 404 e a API sobe normalmente.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // E-mail transacional (Resend). Ausentes: a API sobe, mas o e-mail não é enviado (aviso no log).
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  // IPs/CIDRs do proxy reverso confiável, separados por vírgula; `none` = sem proxy.
  // Obrigatório em produção (ver loadEnv).
  TRUST_PROXY: z.string().default('').transform(parseTrustProxy),
  // Segredo compartilhado com o site (Vercel): quando o cabeçalho `x-ogado-proxy-secret` confere,
  // o IP do cliente vem de `x-ogado-client-ip` (o proxy do Railway só enxerga o egress da Vercel).
  PROXY_SECRET: z.string().min(32, 'PROXY_SECRET deve ter ao menos 32 caracteres.').optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Plataformas (Railway, Heroku) injetam `PORT`; `API_PORT` explícito tem prioridade.
  const env = envSchema.parse({ ...source, API_PORT: source['API_PORT'] ?? source['PORT'] });
  if (isProduction(env.NODE_ENV) && !source['TRUST_PROXY']?.trim()) {
    throw new Error(
      'TRUST_PROXY é obrigatório em produção: informe o IP/CIDR do proxy reverso ou "none".',
    );
  }
  if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM é obrigatório quando RESEND_API_KEY está definido.');
  }
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
    throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser definidos juntos.');
  }
  return env;
}
