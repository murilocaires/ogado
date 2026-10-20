/** Sem I/O: validar antes de migrar, iniciar o Prisma ou executar qualquer limpeza de testes. */
export function requireTestDatabaseUrl(source: NodeJS.ProcessEnv): string {
  const value = source['TEST_DATABASE_URL'];
  const fail = (): never => {
    // Nunca incluir a URL: pode conter credenciais, inclusive quando estiver malformada.
    throw new Error(
      'TEST_DATABASE_URL explícita deve apontar para banco de teste local/CI, sem destino alternativo.',
    );
  };
  if (!value || (source['DATABASE_URL'] && source['DATABASE_URL'] !== value)) return fail();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail();
  }
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', 'postgres', 'postgres-test']);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !allowedHosts.has(url.hostname))
    return fail();
  let database: string;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return fail();
  }
  if (!/(^|[_-])(test|teste)([_-]|$)/i.test(database) || !/^[a-zA-Z0-9_-]+$/.test(database))
    return fail();
  // pg admite sobrescrever o host/banco por query: somente schema (Prisma) é permitido.
  if ([...url.searchParams.keys()].some((key) => key !== 'schema') || url.hash) return fail();
  return value;
}
