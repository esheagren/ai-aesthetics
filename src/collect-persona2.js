// Persona-axis run 2 (scale run): 12 cheap/older models x 8 domains x 2
// probes x 15 conditions x 8 samples (12x8x2x15x8 = 23,040 calls full), one
// queue per provider, appending to data/raw-persona2.jsonl. Resumable.
//
// Differences from run 1 (collect-persona.js):
//  - Panel is defined LOCALLY (mostly OpenRouter models, incl. the three
//    open-weight models from Anthropic's Assistant Axis paper), not MODELS.
//  - Conditions come from data/personas2.json: a true no-system-prompt
//    'none' baseline collected IN-RUN, an 'assistant' control, and 13
//    personas in axis bands (2-3 per band) so content effects can be
//    separated from distance effects.
//  - 8 samples per cell (run 1 used 4).
//
// Usage: node src/collect-persona2.js [--smoke]
//   --smoke: domain ['city'] only, conditions [none, ghost], 1 sample
//            (12 models x 1 domain x 2 probes x 2 conds x 1 = 48 calls)

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMAINS, PROBES, CONCURRENCY, PROMPT_VERSION } from './config.js';
import { callModel } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, '..', 'data', 'raw-persona2.jsonl');
const PERSONAS2 = join(here, '..', 'data', 'personas2.json');
mkdirSync(dirname(RAW), { recursive: true });

// Run-2 panel. gpt-5.2 + deepseek-v4-pro anchor comparability with run 1;
// gemma-2-27b / qwen-2.5-72b / llama-3.3-70b are the exact models the
// Assistant Axis paper analyzed; the small (7-8B) and old (gpt-3.5, claude-3-
// haiku) entries add a capability gradient. Gemini excluded (250 req/day cap
// is far below the ~1,920 calls each model needs).
const PANEL = [
  { id: 'gpt-5.2', provider: 'openai', family: 'OpenAI', reasoning: 'low' },
  { id: 'gpt-4o-mini', provider: 'openai', family: 'OpenAI' },
  { id: 'deepseek-v4-pro', provider: 'deepseek', family: 'DeepSeek' },
  { id: 'google/gemma-2-27b-it', provider: 'openrouter', family: 'Google' },
  { id: 'qwen/qwen-2.5-72b-instruct', provider: 'openrouter', family: 'Qwen' },
  { id: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter', family: 'Meta' },
  { id: 'meta-llama/llama-3.1-8b-instruct', provider: 'openrouter', family: 'Meta' },
  { id: 'qwen/qwen-2.5-7b-instruct', provider: 'openrouter', family: 'Qwen' },
  { id: 'mistralai/mistral-small-3.2-24b-instruct', provider: 'openrouter', family: 'Mistral' },
  { id: 'openai/gpt-3.5-turbo', provider: 'openrouter', family: 'OpenAI' },
  { id: 'anthropic/claude-haiku-4.5', provider: 'openrouter', family: 'Anthropic' },
  { id: 'anthropic/claude-3-haiku', provider: 'openrouter', family: 'Anthropic' },
];

const EXP_DOMAINS = ['cuisine', 'season', 'city', 'smell', 'religioustext', 'typeface', 'color', 'tvshow'];

if (!existsSync(PERSONAS2)) {
  console.error('data/personas2.json not found — generate the run-2 conditions first.');
  process.exit(1);
}
const { conditions } = JSON.parse(readFileSync(PERSONAS2, 'utf8'));

const smoke = process.argv.includes('--smoke');
const domains = smoke ? ['city'] : EXP_DOMAINS;
const activeConds = smoke
  ? conditions.filter((c) => c.slug === 'none' || c.slug === 'ghost')
  : conditions;
const nSamples = smoke ? 1 : 8;

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

// SKIP_PROVIDERS=openai node src/collect-persona2.js — exclude providers
const skipProviders = new Set((process.env.SKIP_PROVIDERS ?? '').split(',').filter(Boolean));

const jobs = [];
for (const model of PANEL) {
  if (skipProviders.has(model.provider)) continue;
  for (const domain of domains) {
    for (const [probe, template] of Object.entries(PROBES)) {
      for (const cond of activeConds) {
        for (let i = 0; i < nSamples; i++) {
          const key = `${model.id}|${domain}|${probe}|${cond.slug}|${i}`;
          if (done.has(key)) continue;
          jobs.push({ key, model, domain, probe, cond, prompt: template(DOMAINS[domain]), i });
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
        const { text, stop, usage } = await callModel(job.model, job.prompt, job.cond.system ?? undefined);
        rec = {
          key: job.key, provider, model: job.model.id, domain: job.domain,
          probe: job.probe, i: job.i, pv: PROMPT_VERSION, text, stop, usage,
          persona: job.cond.slug, band: job.cond.band, t: job.cond.t, ts: new Date().toISOString(),
        };
        completed++;
      } catch (err) {
        rec = {
          key: job.key, provider, model: job.model.id, domain: job.domain,
          probe: job.probe, i: job.i, persona: job.cond.slug, band: job.cond.band, t: job.cond.t,
          error: String(err).slice(0, 500), ts: new Date().toISOString(),
        };
        failed++;
        console.error(`FAIL ${job.key}: ${String(err).slice(0, 200)}`);
      }
      appendFileSync(RAW, JSON.stringify(rec) + '\n');
      if ((completed + failed) % 50 === 0) {
        console.log(`progress: ${completed} ok, ${failed} failed, ${jobs.length - completed - failed} remaining`);
      }
    }
  });
  await Promise.all(workers);
}

await Promise.all(Object.keys(CONCURRENCY).map(runQueue));
console.log(`\ndone: ${completed} ok, ${failed} failed`);
