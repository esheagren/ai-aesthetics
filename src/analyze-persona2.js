// Persona-axis run-2 analysis. Unlike run 1 (analyze-persona.js), the
// baseline is IN-RUN: each model's modal answer under the 'none' condition
// (no system prompt, collected in the same grid), so displacement is not
// confounded by drift since the original index run. Aggregates by condition,
// by axis band (the content-vs-distance test), by model (the capability
// question), and re-runs the second-attractor check over 12 models.
// Writes data/persona2-summary.json.
//
// Usage: node src/analyze-persona2.js   (after the sharded extracts finish)

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, '..', 'data');
const ALIASES_PATH = join(DATA, 'aliases.json');
const PERSONAS2_PATH = join(DATA, 'personas2.json');
const OUT = join(DATA, 'persona2-summary.json');

const EXP_DOMAINS = ['cuisine', 'season', 'city', 'smell', 'religioustext', 'typeface', 'color', 'tvshow'];
const HIGH_CONSENSUS = ['cuisine', 'season', 'city', 'smell', 'religioustext', 'typeface'];
const PROBES = ['favorite', 'overrated'];

// Panel in capability-tier order for the per-model table.
const TIERS = [
  ['frontier anchors', ['gpt-5.2', 'deepseek-v4-pro']],
  ['paper models', ['google/gemma-2-27b-it', 'qwen/qwen-2.5-72b-instruct', 'meta-llama/llama-3.3-70b-instruct']],
  ['small/cheap', ['gpt-4o-mini', 'mistralai/mistral-small-3.2-24b-instruct', 'meta-llama/llama-3.1-8b-instruct', 'qwen/qwen-2.5-7b-instruct']],
  ['older gen', ['openai/gpt-3.5-turbo', 'anthropic/claude-3-haiku']],
  ['anthropic modern', ['anthropic/claude-haiku-4.5']],
];
const PANEL = TIERS.flatMap(([, ms]) => ms);

const norm = (s) =>
  s?.replace(/[*"“”]/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /i, '').toLowerCase() ?? null;
const aliases = existsSync(ALIASES_PATH) ? JSON.parse(readFileSync(ALIASES_PATH, 'utf8')) : {};
const canon = (domain, n) => (n && aliases[domain]?.[n]) || n;

const { conditions } = JSON.parse(readFileSync(PERSONAS2_PATH, 'utf8'));
const condOrder = conditions.filter((c) => c.slug !== 'none');
const bandOf = Object.fromEntries(conditions.map((c) => [c.slug, c.band]));

// Sharded extraction outputs: data/rp2-extract*.jsonl
const shardFiles = readdirSync(DATA).filter((f) => /^rp2-extract\d+\.jsonl$/.test(f));
if (!shardFiles.length) { console.error('no rp2-extract*.jsonl shards found'); process.exit(1); }
const rows = shardFiles.flatMap((f) => readFileSync(join(DATA, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => r.persona && PANEL.includes(r.model) && EXP_DOMAINS.includes(r.domain));
console.log(`${rows.length} extracted records from ${shardFiles.length} shards`);

// Cell map: model|domain|probe|persona -> canonical entities of its samples.
const cells = new Map();
for (const r of rows) {
  const k = `${r.model}|${r.domain}|${r.probe}|${r.persona}`;
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push(r.entity ? canon(r.domain, norm(r.entity)) : null);
}
const modal = (arr) => {
  const t = new Map();
  for (const e of arr) if (e) t.set(e, (t.get(e) ?? 0) + 1);
  let best = null, n = 0;
  for (const [e, c] of t) if (c > n) { best = e; n = c; }
  return { entity: best, count: n, total: arr.length, distinct: t.size };
};

// In-run baselines from the 'none' condition.
const baseline = new Map();
for (const m of PANEL) for (const d of EXP_DOMAINS) for (const p of PROBES) {
  const c = cells.get(`${m}|${d}|${p}|none`);
  if (c && c.length >= 4) baseline.set(`${m}|${d}|${p}`, modal(c));
}
console.log(`baselines: ${baseline.size}/${PANEL.length * EXP_DOMAINS.length * PROBES.length}`);

// Per-cell displacement vs in-run baseline.
const cellStats = [];
for (const m of PANEL) for (const d of EXP_DOMAINS) for (const p of PROBES) {
  const base = baseline.get(`${m}|${d}|${p}`);
  if (!base || !base.entity) continue;
  for (const cond of condOrder) {
    const samples = cells.get(`${m}|${d}|${p}|${cond.slug}`);
    if (!samples || !samples.length) continue;
    const kept = samples.filter((e) => e === base.entity).length;
    const refusals = samples.filter((e) => e === null).length;
    const top = modal(samples);
    cellStats.push({
      model: m, domain: d, probe: p, persona: cond.slug, band: cond.band, t: cond.t,
      n: samples.length, displacement: 1 - kept / samples.length,
      refusals, top1: top.entity, top1Share: top.count / samples.length, distinct: top.distinct,
      baseline: base.entity, baselineStability: base.count / base.total,
    });
  }
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const agg = (filter) => {
  const xs = cellStats.filter(filter).map((c) => c.displacement);
  return xs.length ? mean(xs) : null;
};
const fmt = (v, w = 7) => (v == null ? '--' : v.toFixed(3)).padStart(w);

// 1. Dose-response by condition.
console.log('\n=== 1. Displacement by condition (vs in-run none baseline) ===\n');
console.log('condition'.padEnd(20), 'band'.padEnd(13), '     t', '    all', '   high', '    low');
const byCondition = condOrder.map((c) => {
  const row = {
    slug: c.slug, band: c.band, t: c.t,
    all: agg((x) => x.persona === c.slug),
    high: agg((x) => x.persona === c.slug && HIGH_CONSENSUS.includes(x.domain)),
    low: agg((x) => x.persona === c.slug && !HIGH_CONSENSUS.includes(x.domain)),
    favorite: agg((x) => x.persona === c.slug && x.probe === 'favorite'),
    overrated: agg((x) => x.persona === c.slug && x.probe === 'overrated'),
  };
  console.log(c.slug.padEnd(20), c.band.padEnd(13), fmt(c.t, 6), fmt(row.all), fmt(row.high), fmt(row.low));
  return row;
});

// 2. Band means (content-vs-distance): within-band spread vs between-band.
console.log('\n=== 2. By axis band ===\n');
const bands = [...new Set(condOrder.map((c) => c.band))];
const byBand = bands.map((b) => {
  const members = condOrder.filter((c) => c.band === b).map((c) => c.slug);
  const memberMeans = members.map((s) => ({ slug: s, mean: agg((x) => x.persona === s && HIGH_CONSENSUS.includes(x.domain)) }));
  const bandMean = agg((x) => x.band === b && HIGH_CONSENSUS.includes(x.domain));
  console.log(b.padEnd(13), fmt(bandMean), ' ', memberMeans.map((m) => `${m.slug} ${m.mean?.toFixed(3)}`).join('  '));
  return { band: b, mean: bandMean, members: memberMeans };
});

// 3. Per-model (capability question) + baseline aesthetic agreement.
console.log('\n=== 3. Per model: baseline picks (none) on high-consensus domains + mean displacement ===\n');
const FRONTIER_CANON = { cuisine: 'japanese cuisine', season: 'autumn', city: 'kyoto', smell: 'petrichor', religioustext: 'tao te ching', typeface: 'garamond' };
const byModel = [];
for (const [tier, models] of TIERS) {
  for (const m of models) {
    const picks = HIGH_CONSENSUS.map((d) => baseline.get(`${m}|${d}|favorite`)?.entity ?? '--');
    const canonMatches = HIGH_CONSENSUS.filter((d) => (baseline.get(`${m}|${d}|favorite`)?.entity ?? '') === FRONTIER_CANON[d]).length;
    const disp = agg((x) => x.model === m && HIGH_CONSENSUS.includes(x.domain));
    byModel.push({ model: m, tier, canonMatches, disp, picks: Object.fromEntries(HIGH_CONSENSUS.map((d, i) => [d, picks[i]])) });
    console.log(m.padEnd(42), tier.padEnd(17), `canon ${canonMatches}/6`, ' disp', fmt(disp), ' ', picks.join(' | '));
  }
}

// 4. Second attractor over 12 models: for each (domain, probe, persona), among
// models that MOVED (top1 != own baseline), do they converge on one new pick?
console.log('\n=== 4. Second-attractor candidates (moved models sharing a new pick, >=5/12) ===\n');
const secondAttractors = [];
for (const d of EXP_DOMAINS) for (const p of PROBES) for (const c of condOrder) {
  const moved = cellStats.filter((x) => x.domain === d && x.probe === p && x.persona === c.slug && x.top1 && x.top1 !== x.baseline);
  if (!moved.length) continue;
  const t = new Map();
  for (const x of moved) t.set(x.top1, (t.get(x.top1) ?? 0) + 1);
  const [ent, n] = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n >= 5) {
    secondAttractors.push({ domain: d, probe: p, persona: c.slug, entity: ent, models: n, moved: moved.length, panel: PANEL.length });
    console.log(`${d}/${p}/${c.slug}`.padEnd(34), `${ent}  (${n}/${PANEL.length} models; ${moved.length} moved)`);
  }
}
if (!secondAttractors.length) console.log('(none reached 5/12)');

writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  panel: PANEL, tiers: TIERS.map(([name, models]) => ({ name, models })),
  domains: EXP_DOMAINS, highConsensus: HIGH_CONSENSUS,
  conditions: condOrder, baselineCoverage: baseline.size,
  byCondition, byBand, byModel, secondAttractors, cells: cellStats,
}, null, 2));
console.log(`\nwritten: ${OUT} (${cellStats.length} cells)`);
