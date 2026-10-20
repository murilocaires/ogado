#!/usr/bin/env node
// Verifica rastreabilidade: IDs em docs/negocio/02-requisitos.md  x  IDs citados em testes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /\b(RF|RN|RNF)-\d{3}\b/g;
const req = readFileSync(join(root, 'docs/negocio/02-requisitos.md'), 'utf8');
const defined = new Set([...req.matchAll(/^\|\s*((?:RF|RN|RNF)-\d{3})\s*\|/gm)].map((m) => m[1]));
const used = new Map();
const skip = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'references', 'docs', '.claude', '.scratch', '.pnpm-store']);
(function walk(d) {
  if (!existsSync(d)) return;
  for (const n of readdirSync(d)) {
    if (skip.has(n)) continue;
    const p = join(d, n); const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(test|spec)\.(ts|tsx|mjs|js)$/.test(n) && ['.ts', '.tsx', '.mjs', '.js'].includes(extname(n)))
      for (const m of readFileSync(p, 'utf8').matchAll(ID)) used.set(m[0], (used.get(m[0]) ?? 0) + 1);
  }
})(root);
const untested = [...defined].filter((id) => !used.has(id));
const unknown = [...used.keys()].filter((id) => !defined.has(id));
// Exceções explícitas não contam como testes e nunca significam funcionalidade concluída.
const policy = JSON.parse(readFileSync(join(root, 'docs/sdd/test-coverage-policy.json'), 'utf8'));
const policyErrors = [];
for (const [id, rule] of Object.entries(policy)) {
  if (!defined.has(id) || !rule.motivo || !['gate', 'adiado', 'fora-do-escopo'].includes(rule.tipo)
      || !existsSync(join(root, rule.fonte))) {
    policyErrors.push(`${id}: política inválida`);
    continue;
  }
  if (rule.tipo === 'gate') {
    const source = readFileSync(join(root, rule.fonte), 'utf8');
    if (!rule.comandos?.length || rule.comandos.some((command) => !source.includes(command)))
      policyErrors.push(`${id}: comando de gate ausente da fonte`);
  }
}
const missing = untested.filter((id) => !policy[id]);
console.log(`Requisitos: ${defined.size} | com teste: ${defined.size - untested.length} | sem teste: ${untested.length}`);
if (untested.length) console.log('Sem teste:', untested.join(', '));
console.log('Sem teste com tratamento documentado:', untested.filter((id) => policy[id]).join(', ') || 'nenhum');
if (missing.length) console.log('Sem cobertura nem tratamento:', missing.join(', '));
if (policyErrors.length) { console.error(policyErrors.join('\n')); process.exit(1); }
if (unknown.length) { console.error('IDs em testes que não existem na spec:', unknown.join(', ')); process.exit(1); }
if (process.argv.includes('--strict') && missing.length) process.exit(1);
