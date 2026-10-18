export const testDatabaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://ogado:ogado_dev@localhost:5432/ogado?schema=public';

/** Domínio reservado (.invalid) das contas criadas pelos testes; a limpeza final apaga por ele. */
export const TEST_EMAIL_DOMAIN = 'teste.ogado.invalid';

export const TEST_ORIGIN = 'http://localhost:3000';
