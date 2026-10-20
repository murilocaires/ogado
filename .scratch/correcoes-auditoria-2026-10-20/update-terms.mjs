import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = 'packages/contracts/src/termos.ts';
let source = readFileSync(file, 'utf8').replace("export const TERMOS_VERSAO = '2026-10-19'", "export const TERMOS_VERSAO = '2026-10-20'");
for (const name of ['termos-de-uso.md', 'politica-de-privacidade.md']) {
  const hash = createHash('sha256').update(readFileSync(`docs/legal/${name}`, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  const expression = new RegExp(`('${name}':\\s*)'[a-f0-9]{64}'`);
  if (!expression.test(source)) throw new Error(`Missing manifest entry: ${name}`);
  source = source.replace(expression, (_, prefix) => `${prefix}'${hash}'`);
}
writeFileSync(file, source);
