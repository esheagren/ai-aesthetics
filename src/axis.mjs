// Builds the persona ladder for the Assistant->Ghost axis experiment: embeds
// ~140 human character archetypes with text-embedding-3-large, projects each
// onto the assistant->ghost direction, and picks 8 rungs evenly spaced along
// it. Run once: node src/axis.mjs. Writes data/personas.json.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KEYS, postJSON, withRetries } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'data', 'personas.json');

// Roughly assistant-ish -> middle -> far (storyteller/mystic/outcast) end,
// each a natural noun phrase for "You are a/an ___." Includes 'assistant'
// and 'ghost' themselves so the axis endpoints come from the same batch.
const ARCHETYPES = [
  // assistant-ish (office / helping-role professions)
  'assistant', 'consultant', 'evaluator', 'analyst', 'editor', 'secretary',
  'librarian', 'accountant', 'auditor', 'clerk', 'concierge', 'tutor', 'coach',
  'advisor', 'engineer', 'technician', 'receptionist', 'administrator',
  'project manager', 'copywriter',
  'proofreader', 'actuary', 'notary', 'paralegal', 'bookkeeper', 'statistician',
  'archivist', 'cataloger', 'registrar', 'quality inspector', 'compliance officer',
  'underwriter', 'appraiser', 'scheduler', 'dispatcher', 'typist', 'troubleshooter',
  'operator', 'attendant', 'teller',
  // middle (grounded human professions / folk roles)
  'teacher', 'translator', 'journalist', 'curator', 'historian', 'craftsman',
  'gardener', 'chef', 'architect', 'scientist', 'doctor', 'judge', 'diplomat',
  'merchant', 'explorer', 'athlete', 'soldier', 'farmer', 'sailor', 'detective',
  'nurse', 'pharmacist', 'surveyor', 'cartographer', 'locksmith', 'blacksmith',
  'carpenter', 'potter', 'weaver', 'tailor', 'baker', 'brewer', 'vintner',
  'fisherman', 'shepherd', 'miner', 'lumberjack', 'innkeeper', 'barber', 'midwife',
  // far end (artistic / liminal / fantastical figures)
  'storyteller', 'comedian', 'actor', 'musician', 'painter', 'poet', 'artist',
  'dancer', 'dreamer', 'wanderer', 'drifter', 'rebel', 'outlaw', 'trickster',
  'jester', 'fool', 'clown', 'oracle', 'prophet', 'mystic', 'shaman', 'monk',
  'sage', 'witch', 'sorcerer', 'vampire', 'ghost', 'phantom', 'specter', 'hermit',
  'recluse', 'bohemian', 'vagabond', 'nomad', 'pirate', 'anarchist', 'madman',
  'muse', 'siren',
  'bard', 'minstrel', 'troubadour', 'alchemist', 'wizard', 'druid', 'necromancer',
  'banshee', 'wraith', 'revenant', 'changeling', 'fairy', 'sprite', 'imp', 'seer',
  'visionary', 'outcast', 'exile', 'renegade', 'gambler', 'smuggler',
];

const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
const sub = (u, v) => u.map((x, i) => x - v[i]);

async function embedAll(words) {
  const data = await withRetries(
    () => postJSON('https://api.openai.com/v1/embeddings', {
      authorization: `Bearer ${KEYS.openai}`,
    }, {
      model: 'text-embedding-3-large',
      input: words.map((w) => `character archetype: ${w}`),
    }),
    { label: 'embed' },
  );
  const byIndex = [...data.data].sort((a, b) => a.index - b.index);
  return byIndex.map((d) => d.embedding);
}

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const slugify = (s) => s.toLowerCase().replace(/\s+/g, '-');

console.log(`embedding ${ARCHETYPES.length} archetypes with text-embedding-3-large...`);
const vectors = await embedAll(ARCHETYPES);
const byWord = new Map(ARCHETYPES.map((w, i) => [w, vectors[i]]));

const a = byWord.get('assistant');
const g = byWord.get('ghost');
const axis = sub(g, a);
const axisAxis = dot(axis, axis);

const ladder = ARCHETYPES.map((name) => {
  const e = byWord.get(name);
  const t = dot(sub(e, a), axis) / axisAxis;
  return { name, t };
}).sort((x, y) => x.t - y.t);

console.log('\nfull ladder (assistant t=0 -> ghost t=1):\n');
for (const { name, t } of ladder) {
  console.log(`  ${t.toFixed(3).padStart(6)}  ${name}`);
}

// Pick 8 rungs: rung 0 is always the literal assistant baseline, rung 7 is
// always the literal ghost baseline. Rungs 1-6 pick the closest unused
// archetype to targets spaced evenly across the OBSERVED t-range of the
// interior ladder — not the theoretical [0,1]. The shared "character
// archetype:" embedding prefix compresses all t into ~[0.24, 0.78], so
// naive k/7 targets would waste three rungs on ghost-synonyms (revenant,
// specter) while skipping the whole middle of the ladder.
const used = new Set(['assistant', 'ghost']);
const interior = ladder.filter((x) => !used.has(x.name));
const tMin = interior[0].t;
const tMax = interior[interior.length - 1].t;
const rungs = [
  { slug: 'assistant', label: 'AI assistant', t: 0, system: 'You are an AI assistant.' },
];
for (let k = 1; k <= 6; k++) {
  // k/7 *within* the observed range: rungs 0 and 7 already sit at the poles,
  // so the interior picks stay clear of both ends (else rung 6 lands on a
  // bare ghost-synonym like specter).
  const target = tMin + (k / 7) * (tMax - tMin);
  const candidates = ladder
    .filter((x) => !used.has(x.name))
    .sort((x, y) => Math.abs(x.t - target) - Math.abs(y.t - target));
  const pick = candidates[0];
  used.add(pick.name);
  rungs.push({
    slug: slugify(pick.name),
    label: pick.name,
    t: pick.t,
    system: `You are ${article(pick.name)} ${pick.name}.`,
  });
}
rungs.push({ slug: 'ghost', label: 'Ghost', t: 1, system: 'You are a ghost.' });

console.log('\n8 chosen rungs:\n');
for (const r of rungs) {
  console.log(`  rung ${rungs.indexOf(r)}  t=${r.t.toFixed(3).padStart(6)}  ${r.slug.padEnd(16)}  ${r.system}`);
}

writeFileSync(OUT, JSON.stringify({
  axis: { from: 'assistant', to: 'ghost', embeddingModel: 'text-embedding-3-large' },
  generatedAt: new Date().toISOString(),
  ladder,
  rungs,
}, null, 2));
console.log(`\nwritten: ${OUT}`);
