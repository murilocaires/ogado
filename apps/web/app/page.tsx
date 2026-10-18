import { fetchHealth } from '../lib/health';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await fetchHealth();
  return (
    <main className="shell">
      <h1>O Gado</h1>
      <p>Verificação ponta a ponta (web, API, banco):</p>
      {result.ok ? (
        <p data-testid="health">
          API: <strong>{result.data.status}</strong> · Banco: <strong>{result.data.db}</strong>
        </p>
      ) : (
        <p data-testid="health" role="alert">
          Falha: {result.reason}
        </p>
      )}
      <p>
        <a className="link" href="/entrar">
          Entrar
        </a>
      </p>
    </main>
  );
}
