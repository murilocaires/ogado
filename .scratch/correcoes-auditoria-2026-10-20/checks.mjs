import { spawn } from 'node:child_process';
import path from 'node:path';

const banco = 'postgresql://ogado_test:local_test_only@127.0.0.1:55440/ogado_correcoes_test_20261020?schema=public';
const steps = [
  ['typecheck-final', 'cmd', ['/d', '/c', 'pnpm.cmd', '--pm-on-fail=ignore', '-r', 'typecheck']],
  ['lint-final', process.execPath, ['node_modules/eslint/bin/eslint.js', '.']],
  ['domain-coverage-final', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--root', 'packages/domain', '--coverage', '--maxWorkers=1', '--no-file-parallelism']],
  ['contracts-final', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--root', 'packages/contracts', '--maxWorkers=1', '--no-file-parallelism']],
  ['performance-final', process.execPath, ['apps/api/node_modules/tsx/dist/cli.mjs', 'scripts/performance-check.ts']],
  ['parity-final', process.execPath, ['scripts/parity.mjs']],
  ['audit-final', 'cmd', ['/d', '/c', 'pnpm.cmd', '--pm-on-fail=ignore', 'audit', '--json']],
  ['api-final', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--root', 'apps/api', '--maxWorkers=1', '--no-file-parallelism']],
  ['build-api-final', 'cmd', ['/d', '/c', 'pnpm.cmd', '--pm-on-fail=ignore', '--filter', '@ogado/api', 'build']],
];
const inicio = process.argv[2];
let rodar = !inicio;
for (const [label, command, args] of steps) {
  if (label === inicio) rodar = true;
  if (!rodar) continue;
  console.log(`Iniciando ${label}`);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [path.resolve('.scratch/correcoes-auditoria-2026-10-20/run.mjs'), label, command, ...args], {
      env: { ...process.env, TEST_DATABASE_URL: banco, DATABASE_URL: banco },
      stdio: 'inherit', windowsHide: true,
    });
    child.on('exit', resolve);
  });
  if (code !== 0) process.exit(code ?? 1);
}
