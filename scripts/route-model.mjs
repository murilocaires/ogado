#!/usr/bin/env node
// Resolve tarefa -> modelo conforme .claude/config/model-routing.json
// Uso: node scripts/route-model.mjs <tarefa> [--tier T] [--failures N] [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, '.claude/config/model-routing.json'), 'utf8'));
const ORDER = ['economy', 'standard', 'premium', 'frontier'];

export function route(task, { tier, failures = 0 } = {}) {
  const t = cfg.tasks[task];
  if (!t) throw new Error(`Tarefa desconhecida: ${task}. Opções: ${Object.keys(cfg.tasks).join(', ')}`);
  let chosen = tier ?? process.env.OGADO_MODEL_TIER ?? t.tier;
  let escalated = false;
  if (failures >= cfg.budgets.loop.max_same_failure && !tier) {
    const i = ORDER.indexOf(chosen);
    const next = ORDER[Math.min(i + 1, ORDER.indexOf('premium'))]; // frontier nunca é automático
    if (next !== chosen) { chosen = next; escalated = true; }
  }
  const tr = cfg.tiers[chosen];
  if (tr.requires_human_approval) throw new Error('Tier frontier exige aprovação humana explícita.');
  const m = cfg.models[tr.model];
  return { task, tier: chosen, model: tr.model, effort: tr.effort, cost_index: m.cost_index, escalated, agent: t.agent ?? null, skill: t.skill ?? null };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const task = a[0];
  const get = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  try {
    const r = route(task, { tier: get('--tier'), failures: Number(get('--failures') ?? 0) });
    console.log(a.includes('--json') ? JSON.stringify(r) : `${r.model}  (tier=${r.tier}, effort=${r.effort}, custo≈${r.cost_index}${r.escalated ? ', ESCALADO' : ''})`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
