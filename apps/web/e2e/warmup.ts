/**
 * Aquece as rotas do `next dev` (compilação sob demanda é lenta em disco com antivírus) para que
 * os testes meçam comportamento, não o primeiro build de cada rota.
 */
export default async function globalSetup(): Promise<void> {
  const base = `http://localhost:${process.env['E2E_WEB_PORT'] ?? '3100'}`;
  for (const path of ['/entrar', '/cadastrar', '/painel']) {
    await fetch(`${base}${path}`).catch(() => undefined);
  }
  await fetch(`${base}/api/auth/session`, { headers: { Origin: base } }).catch(() => undefined);
}
