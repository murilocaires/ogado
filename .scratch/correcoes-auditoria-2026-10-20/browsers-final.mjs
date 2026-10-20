import { spawn } from 'node:child_process';
import path from 'node:path';

let executar = !process.argv[2];
for (const kind of ['local', 'api', 'offline']) {
  if (kind === process.argv[2]) executar = true;
  if (!executar) continue;
  console.log(`Iniciando navegador ${kind}`);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [path.resolve('.scratch/correcoes-auditoria-2026-10-20/browser.mjs'), kind, `e2e-${kind}-integrado`], {
      windowsHide: true, stdio: 'inherit', env: process.env,
    });
    child.on('exit', resolve);
  });
  if (code !== 0) process.exit(code ?? 1);
}
