// Entity cards: per-entity data for the report's click-through cards.
// For every entity any model picked (favorite or overrated), builds:
//   - a one-sentence factual blurb (what the thing is)
//   - jacket-blurb endorsements per (model, probe): the most vivid EXTRACTIVE
//     fragment of that model's own response, lightly condensed (<= ~25 words)
//   - type-specific extras: dictionary definition for words; deterministic
//     outbound links; hasImage flag against data/images.json
// Writes data/entitycards.json keyed EXACTLY like analyze.js aggregates:
// "<domain> <canonNorm>" — same norm() + data/aliases.json application, so the
// UI can look cards up from summary.json entries. aliases.json is read fresh
// at run time; after alias edits, delete affected keys and re-run to regroup.
//
// Usage: node src/entitycards.js [domain ...]   (no args = all domains)
// Resumable: entities already present in the output file are skipped.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODELS, DOMAINS, EXTRACTOR_MODEL } from './config.js';
import { KEYS, postJSON, withRetries } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXTRACTED = join(here, '..', 'data', 'extracted.jsonl');
const RAW = join(here, '..', 'data', 'raw.jsonl');
const ALIASES = join(here, '..', 'data', 'aliases.json');
const IMAGES = join(here, '..', 'data', 'images.json');
const OUT = join(here, '..', 'data', 'entitycards.json');

const CONCURRENCY = 4;
const TEXTS_PER_GROUP = 2; // longest N responses per (model,probe) group fed to Haiku
const MAX_TEXT_CHARS = 1500;

// ---- normalization: MUST match analyze.js exactly ----
const norm = (s) =>
  s?.replace(/[*"“”]/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /i, '').toLowerCase() ?? null;
const aliases = existsSync(ALIASES) ? JSON.parse(readFileSync(ALIASES, 'utf8')) : {};
const canon = (domain, n) => (n && aliases[domain]?.[n]) || n;

// ---- load inputs ----
const rawText = new Map(); // key -> full response text
for (const line of readFileSync(RAW, 'utf8').split('\n')) {
  if (!line) continue;
  const r = JSON.parse(line);
  if (r.key && r.text) rawText.set(r.key, r.text);
}

const retained = new Set(Object.keys(DOMAINS));
const wantedDomains = process.argv.slice(2).filter((a) => !a.startsWith('-'));
for (const d of wantedDomains) {
  if (!retained.has(d)) { console.error(`unknown domain: ${d}`); process.exit(1); }
}
const domainFilter = wantedDomains.length ? new Set(wantedDomains) : retained;

const rows = readFileSync(EXTRACTED, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => r.entity && retained.has(r.domain));

// images.json key presence, with a light fold (diacritics/punctuation) so
// e.g. "champs-élysées" matches the manifest's "champs-elysees".
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const imageKeys = new Set(
  existsSync(IMAGES) ? Object.keys(JSON.parse(readFileSync(IMAGES, 'utf8'))).map(fold) : [],
);
// exact folded match, or the manifest key's tokens appearing as an ordered
// subsequence of the entity name ("sunday afternoon la grande jatte" matches
// "sunday afternoon on the island of la grande jatte")
function hasImageFor(...names) {
  const folded = names.filter(Boolean).map(fold);
  if (folded.some((n) => imageKeys.has(n))) return true;
  for (const key of imageKeys) {
    const kt = key.split(' ');
    if (kt.length < 3) continue;
    for (const n of folded) {
      const nt = n.split(' ');
      let i = 0;
      for (const w of nt) if (w === kt[i]) i++;
      if (i === kt.length) return true;
    }
  }
  return false;
}

// ---- group rows into entities ----
// entity: { key, domain, displayForms, creators, groups: Map("model|probe" -> texts[]) }
const entities = new Map();
for (const r of rows) {
  const n = canon(r.domain, norm(r.entity));
  const key = `${r.domain} ${n}`;
  if (!entities.has(key)) {
    entities.set(key, { key, domain: r.domain, n, displayForms: new Map(), creators: new Map(), groups: new Map() });
  }
  const e = entities.get(key);
  const display = r.entity.replace(/[*"“”]/g, '').trim();
  e.displayForms.set(display, (e.displayForms.get(display) ?? 0) + 1);
  if (r.creator) e.creators.set(r.creator, (e.creators.get(r.creator) ?? 0) + 1);
  const gid = `${r.model}|${r.probe === 'favorite' ? 'f' : 'o'}`;
  const text = rawText.get(r.key);
  if (text) {
    if (!e.groups.has(gid)) e.groups.set(gid, []);
    e.groups.get(gid).push(text);
  }
}

const topOf = (m) => (m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null);

// ---- deterministic link builders (no LLM) ----
const enc = encodeURIComponent;
function buildLinks(domain, display, creator) {
  switch (domain) {
    case 'book':
    case 'childrensbook':
      return [{ label: 'Buy on Amazon', url: `https://www.amazon.com/s?k=${enc(creator ? `${display} ${creator}` : display)}` }];
    case 'videogame':
      return [{ label: 'Watch on YouTube', url: `https://www.youtube.com/results?search_query=${enc(display)}+official+overview` }];
    case 'poem': // straight to a readable full text, not an encyclopedia entry
      return [{ label: 'Read the poem', url: `https://www.poetryfoundation.org/search?query=${enc(creator ? `${display} ${creator}` : display)}` }];
    default: // film, album, painting, building, and everything else
      return [{ label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/Special:Search?search=${enc(display)}` }];
  }
}

// ---- Haiku call: blurb (+definition for words) + one extractive quote per group ----
function schemaFor(isWord) {
  return {
    type: 'object',
    properties: {
      blurb: { type: 'string', description: 'One factual sentence (<= 30 words) saying what this thing is.' },
      ...(isWord ? { definition: { type: 'string', description: 'Dictionary-style definition of the word.' } } : {}),
      quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            group: { type: 'string', description: 'The group id exactly as given, e.g. "gpt-4o|f".' },
            quote: { type: 'string', description: 'The extracted fragment, <= 25 words.' },
          },
          required: ['group', 'quote'],
          additionalProperties: false,
        },
        description: 'Exactly one quote per group id listed in the prompt.',
      },
    },
    required: ['blurb', ...(isWord ? ['definition'] : []), 'quotes'],
    additionalProperties: false,
  };
}

const usageTotals = { in: 0, out: 0 };
const quoteStats = { total: 0, retried: 0, fallback: 0 };

async function callHaiku(prompt, schema, label) {
  const data = await withRetries(
    () => postJSON('https://api.anthropic.com/v1/messages', {
      'x-api-key': KEYS.anthropic,
      'anthropic-version': '2023-06-01',
    }, {
      model: EXTRACTOR_MODEL,
      max_tokens: 4000,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    }),
    { label },
  );
  usageTotals.in += data.usage?.input_tokens ?? 0;
  usageTotals.out += data.usage?.output_tokens ?? 0;
  return JSON.parse(data.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

// extractiveness check: every ellipsis-separated segment must appear verbatim
// (modulo case/punctuation) in ONE single source text, in order.
const soft = (s) => s.toLowerCase().replace(/[^a-z0-9]+/gi, ' ').trim();
function isExtractive(quote, texts) {
  const segments = quote.split(/\.\.\.|…/).map(soft).filter(Boolean);
  if (!segments.length) return false;
  return texts.some((t) => {
    const src = soft(t);
    let pos = 0;
    for (const seg of segments) {
      const at = src.indexOf(seg, pos);
      if (at === -1) return false;
      pos = at + seg.length;
    }
    return true;
  });
}

// guaranteed-extractive fallback: the source sentence with the highest token
// overlap with the attempted quote, trimmed to 25 words.
function fallbackQuote(attempt, texts) {
  const want = new Set(soft(attempt).split(' '));
  let best = null, bestScore = -1;
  for (const t of texts) {
    // strip markdown emphasis and treat line breaks as sentence boundaries so
    // a "**Title** First sentence..." opening can't leak the title line in
    for (const sent of t.replace(/[*_]/g, '').split(/(?<=[.!?])\s+|\n+/)) {
      const words = soft(sent).split(' ').filter(Boolean);
      if (words.length < 4) continue;
      const score = words.filter((w) => want.has(w)).length / Math.sqrt(words.length);
      if (score > bestScore) { bestScore = score; best = sent.trim(); }
    }
  }
  if (!best) return null;
  const words = best.split(/\s+/);
  return words.length > 25 ? `${words.slice(0, 25).join(' ')}…` : best;
}

// cosmetic cleanup applied to every quote: markdown/smart-quote chars never
// belong in a jacket blurb (the checker ignores them, so this stays verbatim),
// nor does a leading "EntityName." label some responses open with.
function polish(quote, display) {
  let q = quote.replace(/[*"“”_]/g, '').replace(/\s+/g, ' ').trim();
  const name = display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = new RegExp(`^(the |a |an )?${name}( \\(\\d{4}\\))?( \\([^)]{0,60}\\))?( by [^.!:—,-]{0,40})?[.!:—,-]\\s*`, 'i');
  q = q.replace(lead, '');
  return q.trim();
}

const QUOTE_RULES =
  `- STRICTLY EXTRACTIVE: the quote must be a verbatim, character-for-character contiguous excerpt from ONE single response in the group — or two excerpts from that SAME response, in their original order, joined by an ellipsis (…). Copy-paste; never add, drop, substitute, reorder words, or change a word's ending. Never merge wording from two different responses. Changing the first letter's case and dropping trailing punctuation are the only edits allowed.\n` +
  `- At most 25 words. Prefer the fragment that best captures WHY it moved the model — the sensory, precise, surprising bit, not generic praise — and that reads as a self-contained phrase.\n` +
  `- Skip the entity's own name and throat-clearing ("I think", "One novel that...") when a stronger interior fragment exists.\n` +
  `- For OVERRATED groups, extract the sharpest, most quotable criticism instead.\n`;

async function makeCard(e) {
  // Prefer the raw form that IS the canonical name, so a rolled-up group
  // titles itself "Ramen", not its dominant subtype "Tonkotsu Ramen" (same
  // rule as the site's row labels); alias-merged groups with no native form
  // fall back to the title-cased canonical norm.
  const forms = [...e.displayForms.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const native = forms.filter((f) => norm(f) === e.n);
  const merged = new Set(forms.map((f) => norm(f))).size > 1;
  const display = native[0]
    ?? (merged ? e.n.replace(/(^|[\s.-])\S/g, (c) => c.toUpperCase()) : forms[0])
    ?? e.n;
  const creator = topOf(e.creators);
  const isWord = e.domain === 'word';
  const noun = DOMAINS[e.domain];

  // serialize response groups: per group, the longest few distinct texts
  const groupIds = [...e.groups.keys()];
  const groupBlocks = groupIds.map((gid) => {
    const [model, probe] = gid.split('|');
    const texts = [...new Set(e.groups.get(gid))]
      .sort((a, b) => b.length - a.length).slice(0, TEXTS_PER_GROUP)
      .map((t) => (t.length > MAX_TEXT_CHARS ? t.slice(0, MAX_TEXT_CHARS) : t));
    const tag = probe === 'f' ? 'named it their FAVORITE' : 'called it OVERRATED';
    return `### group ${gid} (model ${model}, ${tag})\n${texts.join('\n--- (another response from the same model) ---\n')}`;
  });

  const prompt =
    `You are preparing an "entity card" for a report on AI models' aesthetic tastes. The entity is a ${noun}: "${display}"${creator ? `, by/from ${creator}` : ''}.\n\n` +
    `Produce:\n\n` +
    `1. blurb — ONE sentence (under 30 words) saying what this thing is, for a reader who may not know it. Factual, specific, and elegant; lead with maker/date/place where relevant. Model: "Italo Calvino's 1972 novel of fifty-five dreamed cities, told as Marco Polo's reports to Kublai Khan." No opinions, no praise words, no "famous"/"iconic".\n\n` +
    (isWord ? `2. definition — a dictionary-style definition: part-of-speech abbreviation, then a concise sense, e.g. "n. the pleasant, earthy smell that accompanies the first rain after a dry spell." Add a second sense only if genuinely distinct.\n\n` : '') +
    `${isWord ? 3 : 2}. quotes — below are groups of responses about this ${noun}, each group from one AI model in a taste survey (FAVORITE = the model chose it as its favorite; OVERRATED = the model called it overrated). For EACH group, pull out the single most vivid, book-jacket-worthy fragment as a quote:\n` +
    QUOTE_RULES +
    `- Return exactly one quote for every group id: ${groupIds.join(', ')}.\n\n` +
    groupBlocks.join('\n\n');

  const parsed = await callHaiku(prompt, schemaFor(isWord), `card:${e.key}`);

  const quoteByGroup = new Map(parsed.quotes.map((q) => [q.group, q.quote]));
  quoteStats.total += groupIds.length;

  // corrective retry for any group whose quote is missing or not verbatim
  const failed = groupIds.filter((gid) => !quoteByGroup.has(gid) || !isExtractive(quoteByGroup.get(gid), e.groups.get(gid)));
  if (failed.length) {
    quoteStats.retried += failed.length;
    const retryBlocks = failed.map((gid) => {
      const [model, probe] = gid.split('|');
      const texts = [...new Set(e.groups.get(gid))]
        .sort((a, b) => b.length - a.length).slice(0, TEXTS_PER_GROUP)
        .map((t) => (t.length > MAX_TEXT_CHARS ? t.slice(0, MAX_TEXT_CHARS) : t));
      return `### group ${gid} (model ${model}, ${probe === 'f' ? 'named it their FAVORITE' : 'called it OVERRATED'})\n${texts.join('\n--- (another response from the same model) ---\n')}`;
    });
    const retryPrompt =
      `An earlier attempt to quote these AI survey responses about the ${noun} "${display}" paraphrased instead of quoting. Try again, and this time treat it as literal copy-paste:\n` +
      QUOTE_RULES +
      `- A checker will reject any quote that is not a character-for-character substring of one response. Choose a fragment you can copy exactly.\n` +
      `- Return exactly one quote for every group id: ${failed.join(', ')}.\n\n` +
      retryBlocks.join('\n\n');
    try {
      const quotesOnly = { type: 'object', properties: { quotes: schemaFor(false).properties.quotes }, required: ['quotes'], additionalProperties: false };
      const reparsed = await callHaiku(retryPrompt, quotesOnly, `retry:${e.key}`);
      for (const q of reparsed.quotes) {
        if (failed.includes(q.group) && isExtractive(q.quote, e.groups.get(q.group))) quoteByGroup.set(q.group, q.quote);
      }
    } catch (err) {
      console.error(`  retry call failed for ${e.key}: ${String(err).slice(0, 120)}`);
    }
  }

  const endorsements = [];
  for (const gid of groupIds) {
    const [model, probe] = gid.split('|');
    let quote = quoteByGroup.get(gid);
    if (!quote || !isExtractive(quote, e.groups.get(gid))) {
      // last resort: a guaranteed-verbatim sentence from the source itself
      const fb = fallbackQuote(quote ?? '', e.groups.get(gid));
      if (fb) {
        quoteStats.fallback++;
        console.error(`  FALLBACK ${e.key} ${gid}: "${fb}"`);
        quote = fb;
      } else {
        console.error(`  WARN ${e.key}: no usable quote for ${gid}`);
        continue;
      }
    }
    endorsements.push({ model, probe, quote: polish(quote, display) });
  }
  // favorites first, then pans; within each, panel order from config
  const order = new Map(MODELS.map((m, i) => [m.id, i]));
  endorsements.sort((a, b) => (a.probe === b.probe ? (order.get(a.model) ?? 99) - (order.get(b.model) ?? 99) : a.probe === 'f' ? -1 : 1));

  return {
    display,
    domain: e.domain,
    blurb: parsed.blurb,
    extras: {
      ...(isWord && parsed.definition ? { definition: parsed.definition } : {}),
      links: buildLinks(e.domain, display, creator),
      hasImage: hasImageFor(e.n, display),
    },
    endorsements,
  };
}

// ---- run: resumable, concurrency-limited ----
const cards = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

// refresh deterministic fields on already-built cards (image manifest may
// have changed since they were generated); LLM fields stay cached
for (const e of entities.values()) {
  const card = cards[e.key];
  if (card) card.extras.hasImage = hasImageFor(e.n, card.display);
}

const todo = [...entities.values()]
  .filter((e) => domainFilter.has(e.domain) && !(e.key in cards) && e.groups.size > 0);
console.log(`${entities.size} entities total; ${todo.length} to build (${Object.keys(cards).length} already present)`);

const failures = [];
let done = 0, next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < todo.length) {
    const e = todo[next++];
    try {
      cards[e.key] = await makeCard(e);
      writeFileSync(OUT, JSON.stringify(cards, null, 2));
      done++;
      if (done % 20 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} cards built`);
    } catch (err) {
      failures.push(e.key);
      console.error(`FAIL ${e.key}: ${String(err).slice(0, 200)}`);
    }
  }
}));

writeFileSync(OUT, JSON.stringify(cards, null, 2));
const perDomain = {};
for (const k of Object.keys(cards)) perDomain[cards[k].domain] = (perDomain[cards[k].domain] ?? 0) + 1;
console.log(`\ncards written: ${OUT} (${Object.keys(cards).length} entities)`);
console.log(Object.entries(perDomain).map(([d, n]) => `${d}=${n}`).join(' '));
console.log(`tokens: in=${usageTotals.in} out=${usageTotals.out} (~$${(usageTotals.in / 1e6 * 1 + usageTotals.out / 1e6 * 5).toFixed(2)} at Haiku 4.5 rates)`);
console.log(`quotes: ${quoteStats.total} groups, ${quoteStats.retried} retried, ${quoteStats.fallback} programmatic fallbacks`);
if (failures.length) console.log(`failures (${failures.length}): ${failures.join(', ')}`);
