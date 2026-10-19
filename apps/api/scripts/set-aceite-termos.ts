import { createPrisma } from '@ogado/db';

/**
 * Só para os e2e do web (que não importam o banco): troca a versão dos termos aceita por uma conta
 * de teste (e-mail terminado em @teste.ogado.invalid), para simular "termos atualizados" (RNF-009).
 * Uso: tsx scripts/set-aceite-termos.ts <email> <versao>
 */
const DOMAIN = '@teste.ogado.invalid';
const [email, versao] = process.argv.slice(2);
if (!email || !versao || !email.endsWith(DOMAIN)) {
  throw new Error(`Uso: set-aceite-termos <email${DOMAIN}> <versao>`);
}
const url =
  process.env['DATABASE_URL'] ?? 'postgresql://ogado:ogado_dev@localhost:5432/ogado?schema=public';

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
