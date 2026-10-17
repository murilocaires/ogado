#!/usr/bin/env node
// Paridade: executa o oráculo (references/calculo/calc.js) sobre as entradas do golden.json
// e compara com os valores esperados (tolerância relativa 1e-6). Sem Python.
// T-02/T-03 passam a validar packages/domain contra o mesmo golden (ver docs/sdd/plan.md).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// calc.js é CommonJS/UMD; o package.json raiz é ESM, então carregamos em um sandbox com `module`.
const sandbox = { module: { exports: {} } };
vm.runInNewContext(readFileSync(join(root, 'references', 'calculo', 'calc.js'), 'utf8'), sandbox, {
  filename: 'calc.js',
});
const oracle = sandbox.module.exports;
const golden = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'golden.json'), 'utf8'));

const REL_TOL = 1e-6;
const failures = [];
let checks = 0;

function close(actual, expected) {
  return Math.abs(actual - expected) <= REL_TOL * Math.max(1, Math.abs(expected));
}

function compare(path, actual, expected) {
  if (typeof expected === 'number') {
    checks++;
    if (typeof actual !== 'number' || !close(actual, expected)) {
      failures.push(`${path}: obtido ${actual}, esperado ${expected}`);
    }
  } else if (Array.isArray(expected)) {
    checks++;
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      failures.push(`${path}: tamanho ${actual?.length ?? 'n/a'}, esperado ${expected.length}`);
      return;
    }
    expected.forEach((item, i) => compare(`${path}[${i}]`, actual[i], item));
  } else if (expected !== null && typeof expected === 'object') {
    for (const key of Object.keys(expected))
      compare(`${path}.${key}`, actual?.[key], expected[key]);
  } else {
    checks++;
    if (actual !== expected) failures.push(`${path}: obtido ${actual}, esperado ${expected}`);
  }
}

const runners = {
  compraVenda: (entrada) => oracle.compraVenda(entrada),
  compraVendaIndividual: (entrada) => oracle.compraVenda(entrada),
  recria: (entrada) => oracle.recria(entrada),
};

for (const [name, run] of Object.entries(runners)) {
  const caso = golden[name];
  if (!caso) {
    failures.push(`${name}: caso ausente no golden.json`);
    continue;
  }
  compare(name, run(caso.entrada), caso.esperado);
}
for (const name of Object.keys(golden)) {
  if (!name.startsWith('_') && !(name in runners))
    failures.push(`${name}: sem runner em parity.mjs`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`PARIDADE FALHOU: ${failures.length} divergência(s) em ${checks} verificações.`);
  process.exit(1);
}
console.log(`PARIDADE OK: ${checks} verificações (tolerância relativa ${REL_TOL}).`);
