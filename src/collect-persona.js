// Persona-axis collection runner: fans out a 5-model panel x 8 domains x 2
// probes x 8 persona rungs x 4 samples grid (5x8x2x8x4 = 2,560 calls full),
// one queue per provider, appending results to data/raw-persona.jsonl as they
// complete. Resumable — already-collected keys are skipped. Mirrors
// src/collect.js's structure; see that file for the base (no-persona) grid.
//
// Usage: node src/collect-persona.js [--smoke]
//   --smoke: domain ['city'] only, rungs [0,7] only, 1 sample
//            (5 models x 1 domain x 2 probes x 2 rungs x 1 = 20 calls)

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODELS, DOMAINS, PROBES, CONCURRENCY, PROMPT_VERSION } from './config.js';
import { callModel } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, '..', 'data', 'raw-persona.jsonl');
const PERSONAS = join(here, '..', 'data', 'personas.json');
mkdirSync(dirname(RAW), { recursive: true });

// Panel: 5 models with headroom under free/cheap-tier quotas. Gemini is
// excluded — its free tier is ~20 req/day, far short of this grid.
const PANEL = ['claude-fable-5', 'gpt-5.2', 'grok-4.5', 'deepseek-v4-pro', 'kimi-k2.6'];
const models = MODELS.filter((m) => PANEL.includes(m.id));

// High-consensus domains (cuisine..typeface) contrasted with low-consensus
// ones (color, tvshow) to see whether persona displacement differs where
// models start out agreeing vs. already disagreeing.
const EXP_DOMAINS = ['cuisine', 'season', 'city', 'smell', 'religioustext', 'typeface', 'color', 'tvshow'];

if (!existsSync(PERSONAS)) {
  console.error('data/personas.json not found — run `node src/axis.mjs` first to build the persona ladder.');
  process.exit(1);
}
const { rungs } = JSON.parse(readFileSync(PERSONAS, 'utf8'));

const smoke = process.argv.includes('--smoke');
const domains = smoke ? ['city'] : EXP_DOMAINS;
const activeRungs = smoke ? [rungs[0], rungs[7]] : rungs;
const nSamples = smoke ? 1 : 4;

const done = new Set();
if (existsSync(RAW)) {
  for (const line of readFileSync(RAW, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (!rec.error) done.add(rec.key);
    } catch { /* skip malformed line */ }
  }
}

// SKIP_PROVIDERS=gemini node src/collect-persona.js — exclude providers
const skipProviders = new Set((process.env.SKIP_PROVIDERS ?? '').split(',').filter(Boolean));

const jobs = [];
for (const model of models) {
  if (skipProviders.has(model.provider)) continue;
  for (const domain of domains) {
    for (const [probe, template] of Object.entries(PROBES)) {
      for (const rung of activeRungs) {
        for (let i = 0; i < nSamples; i++) {
          const key = `${model.id}|${domain}|${probe}|${rung.slug}|${i}`;
          if (done.has(key)) continue;
          jobs.push({ key, model, domain, probe, rung, prompt: template(DOMAINS[domain]), i });
        }
      }
    }
  }
}
console.log(`${jobs.length} calls to make (${done.size} already collected)`);

let completed = 0;
let failed = 0;

async function runQueue(provider) {
  const queue = jobs.filter((j) => j.model.provider === provider);
  const workers = Array.from({ length: CONCURRENCY[provider] }, async () => {
    while (queue.length) {
      const job = queue.shift();
      let rec;
      try {
        const { text, stop, usage } = await callModel(job.model, job.prompt, job.rung.system);
        rec = {
          key: job.key, provider, model: job.model.id, domain: job.domain,
          probe: job.probe, i: job.i, pv: PROMPT_VERSION, text, stop, usage,
          persona: job.rung.slug, t: job.rung.t, ts: new Date().toISOString(),
        };
        completed++;
      } catch (err) {
        rec = {
          key: job.key, provider, model: job.model.id, domain: job.domain,
          probe: job.probe, i: job.i, persona: job.rung.slug, t: job.rung.t,
          error: String(err).slice(0, 500), ts: new Date().toISOString(),
        };
        failed++;
        console.error(`FAIL ${job.key}: ${String(err).slice(0, 200)}`);
      }
      appendFileSync(RAW, JSON.stringify(rec) + '\n');
      if ((completed + failed) % 25 === 0) {
        console.log(`progress: ${completed} ok, ${failed} failed, ${jobs.length - completed - failed} remaining`);
      }
    }
  });
  await Promise.all(workers);
}

await Promise.all(Object.keys(CONCURRENCY).map(runQueue));
console.log(`\ndone: ${completed} ok, ${failed} failed`);
