import { spawn } from 'node:child_process';
import path from 'node:path';

const banco = 'postgresql://ogado_test:local_test_only@127.0.0.1:55440/ogado_correcoes_test_20261020?schema=public';
const steps = [
  ['typecheck-integrado', 'cmd', ['/d', '/c', 'pnpm.cmd', '--pm-on-fail=ignore', '-r', 'typecheck']],
  ['lint-integrado', process.execPath, ['node_modules/eslint/bin/eslint.js', '.']],
  ['contracts-integrado', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--root', 'packages/contracts', '--maxWorkers=1', '--no-file-parallelism']],
  ['web-integrado', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--root', 'apps/web', '--maxWorkers=1', '--no-file-parallelism']],
  ['api-integrado', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--root', 'apps/api', '--maxWorkers=1', '--no-file-parallelism']],
  ['build-api-integrado', 'cmd', ['/d', '/c', 'pnpm.cmd', '--pm-on-fail=ignore', '--filter', '@ogado/api', 'build']],
  ['trace-integrado', process.execPath, ['scripts/trace-check.mjs', '--strict']],
];
let ativo = !process.argv[2];
for (const [label, command, args] of steps) {
  if (label === process.argv[2]) ativo = true;
  if (!ativo) continue;
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
