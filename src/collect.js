// Collection runner: fans out MODELS x DOMAINS x PROBES x N calls, one queue
// per provider, appending results to data/raw.jsonl as they complete.
// Resumable — already-collected keys are skipped, so re-running fills gaps.
//
// Usage: node src/collect.js [--smoke]   (--smoke: 1 sample of 1 domain per model)

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODELS, DOMAINS, PROBES, SAMPLES_PER_CELL, CONCURRENCY, PROMPT_VERSION } from './config.js';
import { callModel } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, '..', 'data', 'raw.jsonl');
const TARGETS = join(here, '..', 'data', 'targets.json');
mkdirSync(dirname(RAW), { recursive: true });

const smoke = process.argv.includes('--smoke');
const domains = smoke ? ['book'] : Object.keys(DOMAINS);
const nSamples = smoke ? 1 : SAMPLES_PER_CELL;

// Per-cell sample targets written by adapt.js; cells not listed use the
// round-1 default (nSamples).
const targets = existsSync(TARGETS) ? JSON.parse(readFileSync(TARGETS, 'utf8')) : {};

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

// SKIP_PROVIDERS=gemini node src/collect.js — exclude providers (e.g. daily quota exhausted)
const skipProviders = new Set((process.env.SKIP_PROVIDERS ?? '').split(',').filter(Boolean));

const jobs = [];
for (const model of MODELS) {
  if (skipProviders.has(model.provider)) continue;
  for (const domain of domains) {
    for (const [probe, template] of Object.entries(PROBES)) {
      const cellKey = `${model.id}|${domain}|${probe}`;
      const target = targets[cellKey] ?? nSamples;
      for (let i = 0; i < target; i++) {
        const key = `${model.id}|${domain}|${probe}|${i}`;
        if (done.has(key)) continue;
        jobs.push({ key, model, domain, probe, prompt: template(DOMAINS[domain]), i });
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
        const { text, stop, usage } = await callModel(job.model, job.prompt);
        rec = {
          key: job.key, provider, model: job.model.id, domain: job.domain,
          probe: job.probe, i: job.i, pv: PROMPT_VERSION, text, stop, usage, ts: new Date().toISOString(),
        };
        completed++;
      } catch (err) {
        rec = {
          key: job.key, provider, model: job.model.id, domain: job.domain,
          probe: job.probe, i: job.i, error: String(err).slice(0, 500), ts: new Date().toISOString(),
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
