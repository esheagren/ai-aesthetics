// Canonicalization pass: extract.js normalizes wording within a single
// response, but different models (or different samples) still name the same
// real-world thing in different ways — "La Sagrada Familia" vs "The Basilica
// de La Sagrada Familia". This asks Haiku to cluster same-referent variants
// per domain and writes data/aliases.json: { domain: { variantNorm: canonicalNorm } }.
// analyze.js consults this map after its own light normalization.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EXTRACTOR_MODEL } from './config.js';
import { KEYS, postJSON, withRetries } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const IN = join(here, '..', 'data', 'extracted.jsonl');
const OUT = join(here, '..', 'data', 'aliases.json');

const norm = (s) =>
  s?.replace(/[*"“”]/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /i, '').toLowerCase() ?? null;

const rows = readFileSync(IN, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

// one representative display string per (domain, normalized entity)
const byDomain = new Map();
for (const r of rows) {
  if (!r.entity) continue;
  const display = r.entity.replace(/[*"“”]/g, '').trim();
  const n = norm(display);
  if (!byDomain.has(r.domain)) byDomain.set(r.domain, new Map());
  const seen = byDomain.get(r.domain);
  if (!seen.has(n)) seen.set(n, display);
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

async function canonicalizeDomain(domain, names) {
  const body = {
    model: EXTRACTOR_MODEL,
    max_tokens: 4000,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content:
        `Below is a list of distinct strings naming a "${domain}" — favorites named by different AI models in a survey. Some strings refer to the exact same real-world thing but are worded differently (e.g. "La Sagrada Familia" and "The Basilica de La Sagrada Familia", or "1984" and "Nineteen Eighty-Four"). Find those duplicate groups.\n\n` +
        `Be conservative: only group strings if a person would point at the same single object/place/work for both. Do NOT group things that merely share a brand, category, or family — e.g. "French Press" and "Chemex" are both coffee makers but are different specific things, and "Otoro Nigiri" / "Toro Nigiri" / "Uni Nigiri" are different specific dishes (different fish) even though all are nigiri — none of those should be grouped. A generic category label (like plain "Nigiri") is also not the same thing as a specific variant of it (like "Otoro Nigiri") — don't merge a specific pick into a more generic one unless they are genuinely worded differently for the identical referent. When in doubt, leave it out.\n\n` +
        JSON.stringify(names),
    }],
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
  if (domain in aliases) continue; // resumable: a prior successful run already covered this domain
  const names = [...seen.values()];
  if (names.length < 2) continue;
  try {
    const groups = await canonicalizeDomain(domain, names);
    const map = {};
    let merged = 0;
    for (const g of groups) {
      if (g.variants.length < 2) continue;
      const canonNorm = norm(g.canonical) ?? norm(g.variants[0]);
      for (const v of g.variants) {
        const vn = norm(v);
        if (vn && vn !== canonNorm) { map[vn] = canonNorm; merged++; }
      }
    }
    aliases[domain] = map;
    console.log(`${domain}: ${names.length} distinct -> ${merged} variants folded into ${groups.length} groups`);
  } catch (err) {
    console.error(`FAIL ${domain}: ${String(err).slice(0, 200)}`);
  }
}

writeFileSync(OUT, JSON.stringify(aliases, null, 2));
console.log(`\naliases written: ${OUT}`);
