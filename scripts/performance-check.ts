// RNF-002 / RF-036: budget do cálculo puro e da seleção de destaques; não mede HTTP.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { calcularRecria } from '../packages/domain/src/index';
import golden from '../tests/fixtures/golden.json';
import { idsMelhores, snapshotDaRecria } from '../apps/web/lib/cenarios';
import type { CenarioEntity } from '../apps/web/lib/repo/types';

const entrada = golden.recria.entrada;
assert.equal(calcularRecria(entrada).faturamentoLiquido?.toFixed(2), '102408.05');
const stamp = '2026-10-20T00:00:00.000Z';
const snapshot = snapshotDaRecria(
  {
    id: 'benchmark',
    version: 1,
    updatedAt: stamp,
    deletedAt: null,
    lotacaoInicial: 'areaPastavel',
    form: {
      area: '102',
      dias: '270',
      investimento: '122534,8',
      rsCabCompra: '2050',
      pesoIni: '188',
      pesoFin: '420',
      precoVenda: '325',
      consumoPct: '0,3',
      precoSuplKg: '2',
      rendCarcaca: '52',
      imposto: '1,5',
      sanidadeCabMes: '2,5',
      funcionario: '9000',
      frete: '3000',
    },
  },
  'Benchmark',
);
assert.ok(snapshot);
const cenarios: CenarioEntity[] = Array.from({ length: 5000 }, (_, index) => ({
  ...snapshot,
  id: `cenario-${index}`,
  criadoEm: stamp,
  version: 1,
  updatedAt: stamp,
  deletedAt: null,
  resultado: { ...snapshot.resultado, faturamentoLiquido: String(index) },
}));
assert.deepEqual([...idsMelhores(cenarios)], ['cenario-4999']);

function medir(nome: string, executar: () => unknown, quantidade: number, limiteMs: number) {
  for (let index = 0; index < 50; index++) executar();
  const tempos = Array.from({ length: quantidade }, () => {
    const inicio = performance.now();
    executar();
    return performance.now() - inicio;
  }).sort((a, b) => a - b);
  const p95 = tempos[Math.ceil(tempos.length * 0.95) - 1]!;
  return { nome, amostras: quantidade, p95Ms: p95, limiteMs, aprovado: p95 < limiteMs };
}

const resultados = [
  medir('recria: ouro, cabeças fracionárias', () => calcularRecria(entrada), 1000, 50),
  medir('destaques: 5.000 cenários em uma passagem', () => idsMelhores(cenarios), 100, 1000),
];
console.log(
  JSON.stringify(
    {
      escopo: 'Microbenchmark local; não certifica latência HTTP, rede ou renderização.',
      node: process.version,
      resultados,
    },
    null,
    2,
  ),
);
if (resultados.some((resultado) => !resultado.aprovado)) process.exitCode = 1;
