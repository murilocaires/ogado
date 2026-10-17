#!/usr/bin/env node
// Valida coerência do model-routing.json e dos agentes/skills referenciados.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, '.claude/config/model-routing.json'), 'utf8'));
const errs = [];
for (const [n, t] of Object.entries(cfg.tiers)) if (!cfg.models[t.model]) errs.push(`tier ${n}: modelo ${t.model} não existe`);
for (const [n, t] of Object.entries(cfg.tasks)) {
  if (!cfg.tiers[t.tier]) errs.push(`task ${n}: tier ${t.tier} inválido`);
  if (t.agent && !existsSync(join(root, `.claude/agents/${t.agent}.md`))) errs.push(`task ${n}: agente ${t.agent} ausente`);
  if (t.skill && !existsSync(join(root, `.claude/skills/${t.skill}/SKILL.md`))) errs.push(`task ${n}: skill ${t.skill} ausente`);
}
for (const f of readdirSync(join(root, '.claude/agents'))) {
  const m = /^model:\s*(\S+)/m.exec(readFileSync(join(root, '.claude/agents', f), 'utf8'));
  if (m && !['haiku', 'sonnet', 'opus', 'inherit'].includes(m[1])) errs.push(`agente ${f}: model "${m[1]}" inválido`);
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`OK: ${Object.keys(cfg.tasks).length} tarefas, ${Object.keys(cfg.tiers).length} tiers, agentes e skills consistentes.`);
