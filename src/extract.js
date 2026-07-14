// Extraction stage: Haiku 4.5 reads each raw response and pulls out the named
// entity, hedge/refusal flags, and aesthetic descriptor vocabulary.
// Batches EXTRACT_BATCH_SIZE responses per call using structured outputs, so
// no free-text parsing is needed. Resumable like collect.js.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EXTRACTOR_MODEL, EXTRACT_BATCH_SIZE } from './config.js';
import { KEYS, postJSON, withRetries } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, '..', 'data', 'raw.jsonl');
const OUT = join(here, '..', 'data', 'extracted.jsonl');

const readJSONL = (path) =>
  existsSync(path)
    ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

const done = new Set(readJSONL(OUT).map((r) => r.key));
const raw = readJSONL(RAW).filter((r) => r.text && !done.has(r.key));
console.log(`${raw.length} responses to extract (${done.size} already done)`);

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entity: {
            type: ['string', 'null'],
            description:
              'The single specific work/person/place named as the pick, in canonical short form: title or name only, title case, no author/creator suffix, no articles stripped. E.g. "Invisible Cities", "Tadao Ando", "Kyoto". null if no specific pick was made.',
          },
          creator: {
            type: ['string', 'null'],
            description: 'Author/director/artist/architect of the entity if stated or well-known, else null. For architects and cities, null.',
          },
          refused: {
            type: 'boolean',
            description: 'true if the response declined to name any specific pick.',
          },
          hedged: {
            type: 'boolean',
            description:
              'true if the response includes disclaimers about not having real preferences/experiences (e.g. "As an AI I don\'t have personal taste, but..."), even if it then names a pick.',
          },
          descriptors: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Up to 5 aesthetic-quality words from the justification, lowercased, single words or short compounds (e.g. "restraint", "ambiguity", "luminous", "melancholy"). Empty if refused.',
          },
        },
        required: ['id', 'entity', 'creator', 'refused', 'hedged', 'descriptors'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

async function extractBatch(batch) {
  const payload = batch.map((r) => ({
    id: r.key,
    domain: r.domain,
    probe: r.probe,
    response: r.text.slice(0, 1500),
  }));
  const body = {
    model: EXTRACTOR_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content:
        'Each item below is an AI model\'s answer to a question asking for its favorite (or most overrated) work in some aesthetic domain. Extract the structured fields for every item. Normalize entity names so identical picks map to identical strings across items.\n\n' +
        JSON.stringify(payload),
    }],
  };
  const data = await withRetries(
    () => postJSON('https://api.anthropic.com/v1/messages', {
      'x-api-key': KEYS.anthropic,
      'anthropic-version': '2023-06-01',
    }, body),
    { label: 'extract' },
  );
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text).items;
}

let processed = 0;
for (let i = 0; i < raw.length; i += EXTRACT_BATCH_SIZE) {
  const batch = raw.slice(i, i + EXTRACT_BATCH_SIZE);
  const byKey = new Map(batch.map((r) => [r.key, r]));
  try {
    const items = await extractBatch(batch);
    for (const item of items) {
      const src = byKey.get(item.id);
      if (!src) continue;
      appendFileSync(OUT, JSON.stringify({
        key: src.key, model: src.model, domain: src.domain, probe: src.probe,
        entity: item.entity, creator: item.creator,
        refused: item.refused, hedged: item.hedged, descriptors: item.descriptors,
      }) + '\n');
      processed++;
    }
    console.log(`extracted ${Math.min(i + EXTRACT_BATCH_SIZE, raw.length)}/${raw.length}`);
  } catch (err) {
    console.error(`batch at ${i} failed: ${String(err).slice(0, 300)}`);
  }
}
console.log(`done: ${processed} extracted`);
