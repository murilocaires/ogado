import { setTimeout } from 'node:timers';
// Backup do Postgres do Railway sem expor o banco: roda `pg_dump` DENTRO do serviço Postgres
// (railway ssh) e grava um .sql.gz em backups/ (ignorado pelo git; contém dados de clientes).
// Uso: node scripts/backup-db.mjs [--manter=14]
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';

const manter = Number((process.argv.find((a) => a.startsWith('--manter=')) ?? '--manter=14').split('=')[1]);
const dir = join(process.cwd(), 'backups');
mkdirSync(dir, { recursive: true });

const carimbo = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const destino = join(dir, `ogado-${carimbo}.sql.gz`);

const dump = spawn(
  'railway',
  ['ssh', '--service', 'Postgres', '--', 'sh', '-c',
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --format=plain'],
  { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
);

let ultimoTrecho = '';
const gzip = createGzip({ level: 9 });
dump.stdout.on('data', (b) => {
  ultimoTrecho = (ultimoTrecho + b.toString('utf8')).slice(-400);
});
dump.stdout.pipe(gzip).pipe(createWriteStream(destino));
dump.stderr.on('data', () => {});

dump.on('close', (codigo) => {
  setTimeout(() => {
    const ok = codigo === 0 && ultimoTrecho.includes('PostgreSQL database dump complete');
    if (!ok) {
      try { unlinkSync(destino); } catch { /* nada a apagar */ }
      console.error(`Backup falhou (código ${codigo}); o dump não terminou. Nada foi guardado.`);
      process.exit(1);
    }
    const kb = Math.round(statSync(destino).size / 1024);
    const antigos = readdirSync(dir).filter((f) => /^ogado-.*\.sql\.gz$/.test(f)).sort().reverse().slice(manter);
    for (const f of antigos) unlinkSync(join(dir, f));
    console.log(`Backup ok: ${destino} (${kb} KB). Mantidos os ${manter} mais recentes.`);
  }, 500);
});
