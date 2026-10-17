import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Fallback só para `prisma generate` em ambientes sem .env (não é segredo: é o default do compose).
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://ogado:ogado_dev@localhost:5432/ogado?schema=public',
  },
});
