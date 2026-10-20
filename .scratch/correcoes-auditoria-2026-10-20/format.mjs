import { spawnSync } from 'node:child_process';

const preserved = new Set([
  'apps/web/components/CenariosScreen.test.tsx', 'apps/web/components/LoteModal.tsx',
  'apps/web/components/PainelScreen.test.tsx', 'apps/web/components/RecriaScreen.test.tsx',
  'apps/web/lib/recria.ts', 'apps/web/lib/repo/local-repo.test.ts', 'packages/domain/src/recria.ts',
]);
const read = args => spawnSync('git', args, { encoding: 'utf8', windowsHide: true }).stdout.trim().split(/\r?\n/);
const files = [...new Set([
  ...read(['diff', '--name-only', '--', 'apps', 'packages', 'scripts']),
  ...read(['ls-files', '--others', '--exclude-standard', '--', 'apps', 'packages', 'scripts']),
])].filter(file => /\.tsx?$/.test(file) && !file.endsWith('next-env.d.ts') && !preserved.has(file));
const result = spawnSync(process.execPath, ['node_modules/prettier/bin/prettier.cjs', '--write', ...files], { stdio: 'inherit', windowsHide: true });
process.exitCode = result.status ?? 1;
