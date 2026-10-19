import { isProduction, type Env } from './env';

export interface RateLimitRule {
  max: number;
  windowMs: number;
}

export interface Argon2Params {
  /** KiB. Mínimo OWASP: 19456 (19 MiB). */
  memoryKiB: number;
  timeCost: number;
  parallelism: number;
}

export interface AppConfig {
  /** Produção: cookie Secure + prefixo __Host-, HSTS. */
  production: boolean;
  /** Inatividade máxima da sessão (renovação deslizante), em dias. [humano] Q2 = 30. */
  sessionIdleDays: number;
  /** Teto absoluto da sessão, em dias. [humano] Q2 = 90. */
  sessionMaxDays: number;
  argon2: Argon2Params;
  rateLimit: {
    global: RateLimitRule;
    loginIpEmail: RateLimitRule;
    loginIp: RateLimitRule;
    signupIp: RateLimitRule;
    /** Esqueci a senha: por IP e por e-mail (RF-002). */
    forgotIp: RateLimitRule;
    forgotEmail: RateLimitRule;
    /** Redefinir senha (resgate do token): por IP. */
    resetIp: RateLimitRule;
    /** Entrada com Google (início e retorno): por IP. */
    googleIp: RateLimitRule;
    /** Exportação dos dados do titular (RNF-009): por usuário. */
    exportUser: RateLimitRule;
  };
  /** IPs/CIDRs do proxy reverso confiável (para ler o IP real); vazio = não confia em ninguém. */
  trustProxy: string[];
  /** Segredo do site para confiar no IP do cliente repassado por ele; ausente = ignora o cabeçalho. */
  proxySecret?: string;
}

export interface PartialAppConfig {
  production?: boolean;
  sessionIdleDays?: number;
  sessionMaxDays?: number;
  argon2?: Partial<Argon2Params>;
  rateLimit?: Partial<AppConfig['rateLimit']>;
  trustProxy?: string[];
  proxySecret?: string;
}

/** Mínimos que o ADR-0010 (b) fixa: os parâmetros só podem subir. */
export const ARGON2_FLOOR: Argon2Params = { memoryKiB: 19456, timeCost: 2, parallelism: 1 };

export const defaultConfig: AppConfig = {
  production: false,
  sessionIdleDays: 30,
  sessionMaxDays: 90,
  argon2: { ...ARGON2_FLOOR },
  rateLimit: {
    global: { max: 300, windowMs: 60_000 },
    loginIpEmail: { max: 5, windowMs: 60_000 },
    loginIp: { max: 20, windowMs: 60_000 },
    signupIp: { max: 5, windowMs: 60 * 60_000 },
    forgotIp: { max: 10, windowMs: 60 * 60_000 },
    forgotEmail: { max: 3, windowMs: 60 * 60_000 },
    resetIp: { max: 20, windowMs: 60 * 60_000 },
    googleIp: { max: 60, windowMs: 60 * 60_000 },
    exportUser: { max: 10, windowMs: 60 * 60_000 },
  },
  trustProxy: [],
};

export function resolveConfig(partial: PartialAppConfig = {}): AppConfig {
  const config: AppConfig = {
    production: partial.production ?? defaultConfig.production,
    sessionIdleDays: partial.sessionIdleDays ?? defaultConfig.sessionIdleDays,
    sessionMaxDays: partial.sessionMaxDays ?? defaultConfig.sessionMaxDays,
    argon2: { ...defaultConfig.argon2, ...partial.argon2 },
    rateLimit: { ...defaultConfig.rateLimit, ...partial.rateLimit },
    trustProxy: partial.trustProxy ?? defaultConfig.trustProxy,
    ...(partial.proxySecret ? { proxySecret: partial.proxySecret } : {}),
  };
  const { argon2 } = config;
  if (
    argon2.memoryKiB < ARGON2_FLOOR.memoryKiB ||
    argon2.timeCost < ARGON2_FLOOR.timeCost ||
    argon2.parallelism < ARGON2_FLOOR.parallelism
  ) {
    throw new Error('Parâmetros argon2id abaixo do mínimo OWASP (19456 KiB, t=2, p=1).');
  }
  if (config.sessionMaxDays < config.sessionIdleDays) {
    throw new Error('SESSION_MAX_DAYS deve ser maior ou igual a SESSION_IDLE_DAYS.');
  }
  return config;
}

export function configFromEnv(env: Env): AppConfig {
  return resolveConfig({
    production: isProduction(env.NODE_ENV),
    sessionIdleDays: env.SESSION_IDLE_DAYS,
    sessionMaxDays: env.SESSION_MAX_DAYS,
    argon2: {
      memoryKiB: env.ARGON2_MEMORY_KIB,
      timeCost: env.ARGON2_TIME_COST,
      parallelism: env.ARGON2_PARALLELISM,
    },
    rateLimit: {
      global: { max: env.RATE_LIMIT_GLOBAL_PER_MIN, windowMs: 60_000 },
      loginIpEmail: { max: env.RATE_LIMIT_LOGIN_IP_EMAIL_PER_MIN, windowMs: 60_000 },
      loginIp: { max: env.RATE_LIMIT_LOGIN_IP_PER_MIN, windowMs: 60_000 },
      signupIp: { max: env.RATE_LIMIT_SIGNUP_IP_PER_HOUR, windowMs: 60 * 60_000 },
      forgotIp: { max: env.RATE_LIMIT_FORGOT_IP_PER_HOUR, windowMs: 60 * 60_000 },
      forgotEmail: { max: env.RATE_LIMIT_FORGOT_EMAIL_PER_HOUR, windowMs: 60 * 60_000 },
      resetIp: { max: env.RATE_LIMIT_RESET_IP_PER_HOUR, windowMs: 60 * 60_000 },
      googleIp: { max: env.RATE_LIMIT_GOOGLE_IP_PER_HOUR, windowMs: 60 * 60_000 },
      exportUser: { max: env.RATE_LIMIT_EXPORT_USER_PER_HOUR, windowMs: 60 * 60_000 },
    },
    trustProxy: env.TRUST_PROXY,
    ...(env.PROXY_SECRET ? { proxySecret: env.PROXY_SECRET } : {}),
  });
}
