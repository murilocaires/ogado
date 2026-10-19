import type { ErrorCode, FieldError } from '@ogado/contracts';

/** Erro esperado da API: vira o envelope `{ erro: { codigo, mensagem } }` no setErrorHandler. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly codigo: ErrorCode,
    mensagem: string,
    readonly options: {
      headers?: Record<string, string>;
      campos?: FieldError[];
      /** Campos extras no corpo ao lado de `erro` (409: `atual`, ADR-0011 §4). */
      extra?: Record<string, unknown>;
    } = {},
  ) {
    super(mensagem);
    this.name = 'AppError';
  }
}

export const unauthenticated = (): AppError =>
  new AppError(401, 'nao_autenticado', 'Entre na sua conta para continuar.');

export const sessionExpired = (): AppError =>
  new AppError(401, 'sessao_expirada', 'Sua sessão expirou. Entre de novo.');

export const invalidCredentials = (): AppError =>
  new AppError(401, 'credenciais_invalidas', 'E-mail ou senha incorretos.');

export const notFound = (): AppError =>
  new AppError(404, 'nao_encontrado', 'Recurso não encontrado.');

export const emailUnavailable = (): AppError =>
  new AppError(
    409,
    'conflito',
    'Não foi possível criar a conta com este e-mail. Já tem conta? Entrar',
  );

export const genericConflict = (): AppError =>
  new AppError(409, 'conflito', 'Não foi possível concluir a operação.');

export const forbidden = (): AppError =>
  new AppError(403, 'requisicao_bloqueada', 'Requisição bloqueada por segurança.');

export const tooManyAttempts = (retryAfterSeconds: number): AppError =>
  new AppError(429, 'muitas_tentativas', 'Muitas tentativas. Aguarde um pouco e tente de novo.', {
    headers: { 'retry-after': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });

/** 409 de versão otimista: devolve o estado atual do servidor em `atual` (ADR-0011 §4). */
export const versionConflict = (atual: unknown): AppError =>
  new AppError(
    409,
    'conflito',
    'Este registro foi alterado em outro aparelho. Confira a versão atual e tente de novo.',
    { extra: { atual } },
  );
