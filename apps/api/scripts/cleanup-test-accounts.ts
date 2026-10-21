import { createPrisma } from '@bovaro/db';
import { requireTestDatabaseUrl } from '../../../packages/db/src/test-database';

/**
 * Apaga as contas de teste (e-mail terminado em @teste.bovaro.invalid): fazenda primeiro, depois
 * o usuário. Usado pelo teardown do e2e do web, que não importa o pacote de banco.
 */
const DOMAIN = '@teste.bovaro.invalid';
const url = requireTestDatabaseUrl(process.env);

const prisma = createPrisma(url);
try {
  const fazendas = await prisma.fazenda.deleteMany({
    where: { dono: { email: { endsWith: DOMAIN } } },
  });
  const usuarios = await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  console.log(`contas de teste removidas: ${usuarios.count} usuários, ${fazendas.count} fazendas`);
} finally {
  await prisma.$disconnect();
}
