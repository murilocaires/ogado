import { requireTestDatabaseUrl } from '../../../../packages/db/src/test-database';

export const testDatabaseUrl = requireTestDatabaseUrl(process.env);

/** Domínio reservado (.invalid) das contas criadas pelos testes; a limpeza final apaga por ele. */
export const TEST_EMAIL_DOMAIN = 'teste.ogado.invalid';

export const TEST_ORIGIN = 'http://localhost:3000';
