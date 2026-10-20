import { describe, expect, it } from 'vitest';
import { requireTestDatabaseUrl } from '../../../packages/db/src/test-database';

describe('RNF-003/008: destino de testes falha fechado antes de I/O', () => {
  it.each([
    {},
    { DATABASE_URL: 'postgresql://u:p@localhost:5432/ogado' },
    { TEST_DATABASE_URL: 'postgresql://u:p@localhost:5432/ogado' },
    { TEST_DATABASE_URL: 'postgresql://u:p@production.example/ogado_test' },
    { TEST_DATABASE_URL: 'file:///ogado_test' },
    { TEST_DATABASE_URL: 'postgresql://u:p@localhost/ogado_test?host=production.example' },
    { TEST_DATABASE_URL: 'postgresql://u:p@localhost/ogado_test?port=5432' },
    {
      TEST_DATABASE_URL: 'postgresql://u:p@localhost/ogado_test',
      DATABASE_URL: 'postgresql://u:p@localhost/ogado',
    },
  ])('recusa destino ausente, ambíguo, remoto ou sem identificação de teste %#', (env) => {
    expect(() => requireTestDatabaseUrl(env)).toThrow(/TEST_DATABASE_URL/);
  });

  it.each(['127.0.0.1', 'localhost', '[::1]', 'postgres', 'postgres-test'])(
    'aceita banco explicitamente de teste no host local/CI %s',
    (host) => {
      const url = `postgresql://u:p@${host}:55440/ogado_test_20261020?schema=public`;
      expect(requireTestDatabaseUrl({ TEST_DATABASE_URL: url, DATABASE_URL: url })).toBe(url);
    },
  );

  it('não revela usuário/senha da URL recusada', () => {
    expect(() =>
      requireTestDatabaseUrl({
        TEST_DATABASE_URL: 'postgresql://secret-user:secret-pass@remote/ogado',
      }),
    ).toThrow();
    try {
      requireTestDatabaseUrl({
        TEST_DATABASE_URL: 'postgresql://secret-user:secret-pass@remote/ogado',
      });
      throw new Error('destino deveria ser recusado');
    } catch (error) {
      expect(String(error)).not.toMatch(/secret-user|secret-pass/);
    }
  });
});
