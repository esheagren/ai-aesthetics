// Canonicalization pass: extract.js normalizes wording within a single
// response, but different models (or different samples) still name the same
// real-world thing in different ways — "La Sagrada Familia" vs "The Basilica
// de La Sagrada Familia". This asks Haiku to cluster same-referent variants
// per domain and writes data/aliases.json: { domain: { variantNorm: canonicalNorm } }.
// analyze.js consults this map after its own light normalization.
//
// Usage: node src/canonicalize.js                 (new domains only; done domains skip)
//        node src/canonicalize.js --models a,b    (incremental: for domains already in
//          aliases.json, match only the names first introduced by models a,b against the
//          domain's existing name list — for adding a model to an already-aliased panel)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EXTRACTOR_MODEL, MODELS } from './config.js';
import { KEYS, postJSON, withRetries } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const IN = join(here, '..', 'data', 'extracted.jsonl');
const OUT = join(here, '..', 'data', 'aliases.json');

const norm = (s) =>
  s?.replace(/[*"“”]/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /i, '').toLowerCase() ?? null;

const rosterIds = new Set(MODELS.map((m) => m.id)); // skip banked rows of held-out models
const rows = readFileSync(IN, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => rosterIds.has(r.model));

const modelsArg = process.argv.indexOf('--models');
const NEW_MODELS = new Set(modelsArg > -1 ? (process.argv[modelsArg + 1] ?? '').split(',').filter(Boolean) : []);

// one representative display string per (domain, normalized entity), plus the
// set of norms named by at least one model outside NEW_MODELS (the "old" names)
const byDomain = new Map();
const oldNorms = new Map();
for (const r of rows) {
  if (!r.entity) continue;
  const display = r.entity.replace(/[*"“”]/g, '').trim();
  const n = norm(display);
  if (!byDomain.has(r.domain)) { byDomain.set(r.domain, new Map()); oldNorms.set(r.domain, new Set()); }
  const seen = byDomain.get(r.domain);
  if (!seen.has(n)) seen.set(n, display);
  if (!NEW_MODELS.has(r.model)) oldNorms.get(r.domain).add(n);
}

const SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          canonical: { type: 'string', description: 'The best short display name for this real-world thing, chosen from (or reasonably derived from) the variants list.' },
          variants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Every string from the input list that names this exact same real-world work/person/place, including the canonical one itself.',
          },
        },
        required: ['canonical', 'variants'],
        additionalProperties: false,
      },
      description: 'Only include groups with 2 or more variants — i.e. confirmed duplicates. Omit anything that is a single, unrepeated name.',
    },
  },
  required: ['groups'],
  additionalProperties: false,
};

async function canonicalizeDomain(domain, names, fresh = null) {
  // Incremental mode: `fresh` is the subset of `names` newly introduced; only
  // groups that contain at least one fresh string are wanted.
  const incremental = fresh
    ? `\n\nThese strings are NEW additions to the list: ${JSON.stringify(fresh)}. Only report groups that contain at least one of the new strings (a new string matching an existing one, or new strings matching each other). Never report a group made only of pre-existing strings.`
    : '';
  const content =
        `Below is a list of distinct strings naming a "${domain}" — favorites named by different AI models in a survey. Some strings refer to the exact same real-world thing but are worded differently (e.g. "La Sagrada Familia" and "The Basilica de La Sagrada Familia", or "1984" and "Nineteen Eighty-Four"). Find those duplicate groups.\n\n` +
        `Be conservative: only group strings if a person would point at the same single object/place/work for both. Do NOT group things that merely share a brand, category, or family — e.g. "French Press" and "Chemex" are both coffee makers but are different specific things, and "Otoro Nigiri" / "Toro Nigiri" / "Uni Nigiri" are different specific dishes (different fish) even though all are nigiri — none of those should be grouped. A generic category label (like plain "Nigiri") is also not the same thing as a specific variant of it (like "Otoro Nigiri") — don't merge a specific pick into a more generic one unless they are genuinely worded differently for the identical referent. When in doubt, leave it out.\n\n` +
        JSON.stringify(names) + incremental;
  // EXTRACTOR=openai — fallback when the Anthropic key is capped (mirrors extract.js).
  if (process.env.EXTRACTOR === 'openai') {
    const data = await withRetries(
      () => postJSON('https://api.openai.com/v1/chat/completions', {
        authorization: `Bearer ${KEYS.openai}`,
      }, {
        model: 'gpt-5.2',
        reasoning_effort: 'low',
        max_completion_tokens: 6000,
        response_format: { type: 'json_schema', json_schema: { name: 'aliases', strict: true, schema: SCHEMA } },
        messages: [{ role: 'user', content }],
      }),
      { label: `canon-openai:${domain}` },
    );
    return JSON.parse(data.choices[0].message.content).groups;
  }
  const body = {
    model: EXTRACTOR_MODEL,
    max_tokens: 4000,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  };
  const data = await withRetries(
    () => postJSON('https://api.anthropic.com/v1/messages', {
      'x-api-key': KEYS.anthropic,
      'anthropic-version': '2023-06-01',
    }, body),
    { label: `canon:${domain}` },
  );
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text).groups;
}

const aliases = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
for (const [domain, seen] of byDomain.entries()) {
  const names = [...seen.values()];
  let fresh = null;
  if (domain in aliases) {
    // resumable: a prior successful run already covered this domain — unless
    // incremental mode finds names that only the new models introduced and
    // that no existing alias entry already covers.
    if (!NEW_MODELS.size) continue;
    const old = oldNorms.get(domain);
    const covered = new Set([...Object.keys(aliases[domain]), ...Object.values(aliases[domain])]);
    fresh = [...seen.entries()].filter(([n]) => !old.has(n) && !covered.has(n)).map(([, d]) => d);
    if (!fresh.length) continue;
  }
  if (names.length < 2) continue;
  try {
    const groups = await canonicalizeDomain(domain, names, fresh);
    const map = fresh ? aliases[domain] : {};
    const freshNorms = new Set((fresh ?? []).map(norm));
    let merged = 0;
    for (const g of groups) {
      if (g.variants.length < 2) continue;
      if (fresh && !g.variants.some((v) => freshNorms.has(norm(v)))) continue;
      // In incremental mode prefer an existing canonical so old rows keep their key
      let canonNorm = norm(g.canonical) ?? norm(g.variants[0]);
      if (fresh) {
        const existing = g.variants.map(norm).find((vn) => vn && !freshNorms.has(vn));
        if (existing) canonNorm = aliases[domain][existing] ?? existing;
      }
      for (const v of g.variants) {
        const vn = norm(v);
        if (vn && vn !== canonNorm && !(fresh && vn in map)) { map[vn] = canonNorm; merged++; }
      }
    }
    aliases[domain] = map;
    console.log(`${domain}: ${names.length} distinct${fresh ? ` (${fresh.length} new)` : ''} -> ${merged} variants folded into ${groups.length} groups`);
  } catch (err) {
    console.error(`FAIL ${domain}: ${String(err).slice(0, 200)}`);
  }
}

writeFileSync(OUT, JSON.stringify(aliases, null, 2));
console.log(`\naliases written: ${OUT}`);
