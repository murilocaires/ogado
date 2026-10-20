import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import path from 'node:path';

const [label, command, ...args] = process.argv.slice(2);
if (!label || !command) throw new Error('Usage: run.mjs label executable ...arguments');
const directory = path.resolve('docs/auditoria/2026-10-20-correcoes/evidencias');
mkdirSync(directory, { recursive: true });
const log = createWriteStream(path.join(directory, `${label}.txt`));
const start = Date.now();
const child = spawn(command, args, { cwd: path.resolve(process.env.AUDIT_CWD ?? '.'),
  env: { ...process.env, NO_COLOR: '1', pnpm_config_pm_on_fail: 'ignore' }, windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => log.write(data));
child.stderr.on('data', data => log.write(data));
child.on('error', error => log.write(error.message));
const timer = setTimeout(() => child.kill(), Number(process.env.AUDIT_TIMEOUT_MS ?? 900000));
child.on('close', (code, signal) => {
  clearTimeout(timer);
  const result = { label, command, args, cwd: path.resolve(process.env.AUDIT_CWD ?? '.'),
    started: new Date(start).toISOString(), ended: new Date().toISOString(),
    durationSeconds: (Date.now() - start) / 1000, exitCode: code, signal };
  log.end();
  writeFileSync(path.join(directory, `${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exitCode = code ?? 1;
});
