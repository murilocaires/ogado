#!/usr/bin/env node
// Paridade: executa o oráculo (references/calculo/calc.js) sobre as entradas do golden.json
// e compara com os valores esperados (tolerância relativa 1e-6). Sem Python.
// T-02/T-03 passam a validar packages/domain contra o mesmo golden (ver docs/sdd/plan.md).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// calc.js é CommonJS/UMD; o package.json raiz é ESM, então carregamos em um sandbox com `module`.
const sandbox = { module: { exports: {} } };
vm.runInNewContext(readFileSync(join(root, 'references', 'calculo', 'calc.js'), 'utf8'), sandbox, {
  filename: 'calc.js',
});
const oracle = sandbox.module.exports;
const golden = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'golden.json'), 'utf8'));

// Domínio TS (T-02): carregado direto via Node strip-types (compra-venda.ts não tem imports locais).
const domainCV = await import(
  pathToFileURL(join(root, 'packages', 'domain', 'src', 'compra-venda.ts')).href
);

const REL_TOL = 1e-6;
const failures = [];
let checks = 0;

function close(actual, expected) {
  return Math.abs(actual - expected) <= REL_TOL * Math.abs(expected);
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

// Converte Decimal -> number só para comparar com o ouro (tolerância relativa).
function plain(v) {
  if (v !== null && typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  if (Array.isArray(v)) return v.map(plain);
  if (v !== null && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

// Funções de packages/domain validadas contra o mesmo golden (além do oráculo calc.js).
// ADR-0013: a venda da planilha = base carcaça (15 kg/@) + desconto 10 kg/cab. (F11). O golden não
// traz o campo base; o runner o injeta como 'carcaca' nas vendas para comparar o domínio por inteiro.
const comBaseCarcaca = (entrada) => ({
  ...entrada,
  vendas: entrada.vendas.map((v) => ({ ...v, base: 'carcaca' })),
});
const CAMPOS = ['compras', 'vendas', 'totalCompras', 'totalVendas', 'saldo', 'cabCompra', 'cabVenda', 'arrCompra', 'arrVenda'];
const soResultado = (esperado) =>
  Object.fromEntries(CAMPOS.filter((k) => k in esperado).map((k) => [k, esperado[k]]));
const domainRunners = {
  compraVenda: (entrada) => plain(domainCV.calcularCompraVenda(comBaseCarcaca(entrada))),
  compraVendaIndividual: (entrada) => plain(domainCV.calcularCompraVenda(comBaseCarcaca(entrada))),
};

for (const [name, run] of Object.entries(runners)) {
  const caso = golden[name];
  if (!caso) {
    failures.push(`${name}: caso ausente no golden.json`);
    continue;
  }
  compare(name, run(caso.entrada), caso.esperado);
  if (domainRunners[name])
    compare(`domain.${name}`, domainRunners[name](caso.entrada), soResultado(caso.esperado));
}
// --- T-03: recria de packages/domain contra o golden (variantes padrão, ADR-0008) ---
// Carrega recria.ts direto via Node strip-types (só depende de decimal.js).
{
  const domainRecria = await import(
    pathToFileURL(join(root, 'packages', 'domain', 'src', 'recria.ts')).href
  );
  const casoRecria = golden.recria;
  if (casoRecria) {
    const { areaLotacaoInicial, ...entradaRecria } = casoRecria.entrada;
    const variantes = {
      lotacaoInicial: areaLotacaoInicial === 'area' ? 'areaPastavel' : 'fixa80',
      faturamentoBruto: 'pesoVivo',
    };
    // 'inputs' é eco do oráculo, não resultado de negócio.
    const esperadoRecria = { ...casoRecria.esperado };
    delete esperadoRecria.inputs;
    compare('domain.recria', plain(domainRecria.calcularRecria(entradaRecria, variantes)), esperadoRecria);
  }
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
