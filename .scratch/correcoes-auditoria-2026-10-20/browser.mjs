import { spawn } from 'node:child_process';
import path from 'node:path';

const [kind, label = `e2e-${kind}`, ...extra] = process.argv.slice(2);
if (!['local', 'api', 'offline'].includes(kind)) throw new Error('Use local, api ou offline');
const root = process.cwd();
const banco = 'postgresql://ogado_test:local_test_only@127.0.0.1:55440/ogado_correcoes_test_20261020?schema=public';
const config = kind === 'api' ? 'playwright.config.ts' : `playwright.${kind}.config.ts`;
const child = spawn(process.execPath, [
  path.resolve('.scratch/correcoes-auditoria-2026-10-20/run.mjs'), label, process.execPath,
  'node_modules/@playwright/test/cli.js', 'test', '-c', config,
  '--reporter=list,json', '--output', path.resolve(`docs/auditoria/2026-10-20-correcoes/evidencias/playwright-${label}`), ...extra,
], { cwd: root, windowsHide: true, stdio: 'inherit', env: {
  ...process.env, TEST_DATABASE_URL: banco, DATABASE_URL: banco,
  AUDIT_CWD: path.resolve('apps/web'), AUDIT_TIMEOUT_MS: '2700000',
  PLAYWRIGHT_JSON_OUTPUT_FILE: path.resolve(`docs/auditoria/2026-10-20-correcoes/evidencias/${label}-report.json`),
  E2E_LOCAL_BUILD: '1',
} });
child.on('exit', code => { process.exitCode = code ?? 1; });
