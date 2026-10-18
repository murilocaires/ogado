import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorEnvelope, FieldError } from '@ogado/contracts';
import { AppError } from '../http-errors';

function envelope(
  codigo: ErrorEnvelope['erro']['codigo'],
  mensagem: string,
  extra: Partial<ErrorEnvelope['erro']> = {},
): ErrorEnvelope {
  return { erro: { codigo, mensagem, ...extra } };
}

/** Só os frames da pilha: a primeira linha (a mensagem) pode carregar PII vinda do ORM/driver. */
function stackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || !error.stack) return [];
  return error.stack
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .slice(0, 12);
}

interface ErrorLogger {
  error(bindings: object, message: string): void;
}

/** Caminho seguro de log de erro: tipo, código e frames; nunca a mensagem (pode ter PII do driver). */
export function logUnexpectedError(log: ErrorLogger, error: unknown, message: string): void {
  log.error(
    {
      errType: error instanceof Error ? error.name : typeof error,
      errCode:
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : undefined,
      frames: stackFrames(error),
    },
    message,
  );
}

/**
 * Reaproveita o parser JSON seguro do Fastify (rejeita __proto__ e constructor.prototype) e só
 * trata o corpo vazio como {}: o logout do navegador envia Content-Type JSON sem corpo.
 */
function registerEmptyBodyJsonParser(app: FastifyInstance): void {
  const safeParse = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (typeof body === 'string' && body.trim() === '') {
      done(null, {});
      return;
    }
    safeParse(request, body as string, done);
  });
}

/**
 * Envelope único de erro (ADR-0010 e). Nada de stack, mensagem do Prisma ou valor enviado pelo
 * cliente chega na resposta; o log registra tipo, código e frames, sem a mensagem.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  registerEmptyBodyJsonParser(app);
  app.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof AppError) {
        for (const [name, value] of Object.entries(error.options.headers ?? {})) {
          void reply.header(name, value);
        }
        return reply
          .code(error.statusCode)
          .send(
            envelope(
              error.codigo,
              error.message,
              error.options.campos ? { campos: error.options.campos } : {},
            ),
          );
      }

      if (hasZodFastifySchemaValidationErrors(error)) {
        const campos: FieldError[] = error.validation.map((v) => {
          const custom = (v.params as { params?: { regra?: unknown } }).params?.regra;
          return {
            caminho: v.instancePath.replace(/^\//, '').replaceAll('/', '.'),
            regra: typeof custom === 'string' ? custom : v.keyword,
            mensagem: v.message ?? 'Valor inválido.',
          };
        });
        return reply
          .code(400)
          .send(envelope('validacao_invalida', 'Confira os campos informados.', { campos }));
      }

      const statusCode = 'statusCode' in error ? error.statusCode : undefined;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        return reply
          .code(statusCode)
          .send(envelope('requisicao_invalida', 'Não foi possível processar a requisição.'));
      }

      logUnexpectedError(request.log, error, 'erro inesperado');
      return reply.code(500).send(
        envelope('erro_interno', 'Algo deu errado do nosso lado. Tente de novo em instantes.', {
          requestId: request.id,
        }),
      );
    },
  );

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(envelope('nao_encontrado', 'Recurso não encontrado.')),
  );
}
