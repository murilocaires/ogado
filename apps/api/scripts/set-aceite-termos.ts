import { createPrisma } from '@bovaro/db';
import { requireTestDatabaseUrl } from '../../../packages/db/src/test-database';

/**
 * Só para os e2e do web (que não importam o banco): troca a versão dos termos aceita por uma conta
 * de teste (e-mail terminado em @teste.bovaro.invalid), para simular "termos atualizados" (RNF-009).
 * Uso: tsx scripts/set-aceite-termos.ts <email> <versao>
 */
const DOMAIN = '@teste.bovaro.invalid';
const [email, versao] = process.argv.slice(2);
if (!email || !versao || !email.endsWith(DOMAIN)) {
  throw new Error(`Uso: set-aceite-termos <email${DOMAIN}> <versao>`);
}
const url = requireTestDatabaseUrl(process.env);

const prisma = createPrisma(url);
try {
  const r = await prisma.usuario.updateMany({
    where: { email },
    data: { aceiteTermosVersao: versao },
  });
  if (r.count !== 1) throw new Error('conta de teste não encontrada');
} finally {
  await prisma.$disconnect();
}
