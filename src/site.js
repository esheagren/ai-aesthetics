// The atlas site, second composition: one continuous piece rather than stacked
// plates. A sticky specimen rail threads the whole page; the consensus canon is
// illustrated (Commons imagery embedded as data URIs, native renderings for
// typefaces / colors / words / verse); the cabinet and dossier interlock.
// Emits report/site.html (standalone) and report/artifact.html (artifact variant).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODELS, DOMAINS } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const S = JSON.parse(readFileSync(join(here, '..', 'data', 'summary.json'), 'utf8'));
const V = JSON.parse(readFileSync(join(here, '..', 'data', 'vocab.json'), 'utf8'));
const IMAGES = existsSync(join(here, '..', 'data', 'images.json'))
  ? JSON.parse(readFileSync(join(here, '..', 'data', 'images.json'), 'utf8')) : {};
const ALIASES = existsSync(join(here, '..', 'data', 'aliases.json'))
  ? JSON.parse(readFileSync(join(here, '..', 'data', 'aliases.json'), 'utf8')) : {};
// Entity cards: pre-generated blurb + extras + jacket-quote endorsements per
// canonical entity, keyed "<domain> <canonical norm>" — the same key the
// matrix computes as canonEnt(domain, entity).
const RAW_CARDS = existsSync(join(here, '..', 'data', 'entitycards.json'))
  ? JSON.parse(readFileSync(join(here, '..', 'data', 'entitycards.json'), 'utf8')) : {};
// Re-key cards to the CLIENT's normalization (normEnt strips accents and curly
// apostrophes; the generator's analyze.js-style keys keep them) — otherwise
// accented entities (Phở, Sagrada Família, Žižek) never resolve their card.
const clientNorm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'")
  .replace(/\s+/g, ' ').trim().replace(/^(The|A|An) /i, '').toLowerCase();
const CARDS = Object.fromEntries(Object.entries(RAW_CARDS).map(([key, card]) => {
  const sp = key.indexOf(' ');
  return [key.slice(0, sp) + ' ' + clientNorm(key.slice(sp + 1)), card];
}));
// Entity-card photographs, keyed exactly like entitycards.json ("<domain>
// <canonNorm>") and re-keyed to the client normalization the same way. The
// "_misses" bookkeeping entry is the generator's, not an entity.
const RAW_EIMG = existsSync(join(here, '..', 'data', 'entityimages.json'))
  ? JSON.parse(readFileSync(join(here, '..', 'data', 'entityimages.json'), 'utf8')) : {};
const EIMG = Object.fromEntries(Object.entries(RAW_EIMG)
  .filter(([key, v]) => key !== '_misses' && key.includes(' ') && v && v.uri)
  .map(([key, v]) => {
    const sp = key.indexOf(' ');
    return [key.slice(0, sp) + ' ' + clientNorm(key.slice(sp + 1)), { uri: v.uri, credit: v.credit || '' }];
  }));
const readJSONL = (p) => existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
// Only domains that have been fully summarized are shown. config.js may list
// newer domains whose data is still being collected in the background — those
// have no cells in summary.json yet and are ignored here entirely.
const summarizedDomains = new Set(Object.keys(Object.values(S.cells)[0] ?? {}));
const DOMAIN_IDS = Object.keys(DOMAINS).filter((d) => summarizedDomains.has(d));
const retainedDomains = new Set(DOMAIN_IDS);
const RAW = readJSONL(join(here, '..', 'data', 'raw.jsonl')).filter((r) => r.text && retainedDomains.has(r.domain));
const EXT = readJSONL(join(here, '..', 'data', 'extracted.jsonl')).filter((r) => retainedDomains.has(r.domain));

const V1_DOMAINS = new Set(['book', 'film', 'album', 'architect', 'city', 'painting']);
const SHORT = {
  'claude-opus-4-1': 'Opus 4.1', 'claude-opus-4-5': 'Opus 4.5', 'claude-opus-4-8': 'Opus 4.8',
  'claude-fable-5': 'Fable 5', 'gpt-4o': 'GPT-4o', 'gpt-5.2': 'GPT-5.2', 'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro', 'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro', 'kimi-k2.6': 'Kimi K2.6', 'grok-4.5': 'Grok 4.5',
};
const DOMAIN_LABELS = {
  book: 'Novel', film: 'Film', album: 'Album', architect: 'Architect', city: 'City', painting: 'Painting',
  poem: 'Poem', word: 'Word', typeface: 'Typeface', chair: 'Chair', object: 'Everyday object',
  bookcover: 'Book cover', videogame: 'Video game', building: 'Building', street: 'Street',
  uscity: 'U.S. city', cuisine: 'Cuisine', dish: 'Dish', color: 'Color', season: 'Season',
  smell: 'Smell', decade: 'Design decade',
  novelist: 'Novelist', philosopher: 'Philosopher', religioustext: 'Religious text',
  artmovement: 'Artistic movement', monument: 'Monument',
  tvshow: 'TV show', actor: 'Actor', actress: 'Actress', play: 'Play', musical: 'Musical',
};
// Groups may list ids whose data is still being collected (no summary cells
// yet) — the client rail only renders ids present in DATA.domains, so those
// fields appear automatically once their collection lands.
const DOMAIN_GROUPS = [
  { label: 'Literature & Language', ids: ['book', 'poem', 'word', 'novelist', 'philosopher', 'religioustext'] },
  { label: 'Fine Art', ids: ['painting', 'artmovement'] },
  { label: 'Architecture', ids: ['building', 'architect', 'monument'] },
  { label: 'Film, TV & Theater', ids: ['film', 'tvshow', 'actor', 'actress', 'play', 'musical'] },
  { label: 'Music', ids: ['album'] },
  { label: 'Digital Media', ids: ['videogame', 'typeface'] },
  { label: 'Design & Form', ids: ['object'] },
  { label: 'History', ids: ['decade'] },
  { label: 'Places', ids: ['city', 'street', 'uscity'] },
  { label: 'Life & Senses', ids: ['cuisine', 'dish', 'color', 'season', 'smell'] },
];
const byFamily = ['Anthropic', 'OpenAI', 'Google', 'xAI', 'DeepSeek', 'Moonshot'];
// Power rank within each family, most capable first. Not just -config.order:
// config.order is collection order (oldest first) for Anthropic/OpenAI, which
// happens to invert cleanly, but for Google a higher version number ("3.5
// Flash") is still a lighter tier than "3.1 Pro" — so it needs its own map.
const POWER_RANK = {
  'claude-fable-5': 1, 'claude-opus-4-8': 2, 'claude-opus-4-5': 3, 'claude-opus-4-1': 4,
  'gpt-5.6-sol': 1, 'gpt-5.2': 2, 'gpt-4o': 3,
  'gemini-3.1-pro-preview': 1, 'gemini-3.5-flash': 2,
  'deepseek-v4-pro': 1,
  'kimi-k2.6': 1,
  'grok-4.5': 1,
};
const models = [...S.models].sort((a, b) => byFamily.indexOf(a.family) - byFamily.indexOf(b.family) || POWER_RANK[a.id] - POWER_RANK[b.id]);

// ---- quotes: densest in signature vocabulary ----
function pickQuote(modelId) {
  const sig = (V.distinctive[modelId] ?? []).map(([w]) => w.toLowerCase());
  let best = null, bestScore = -1;
  for (const r of RAW.filter((r) => r.model === modelId && r.probe === 'favorite' && r.text.length > 120)) {
    const t = r.text.toLowerCase();
    let score = sig.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0) + (r.text.length < 700 ? 0.5 : 0);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  if (!best) return null;
  let text = best.text.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  if (text.length > 380) {
    const cut = text.slice(0, 380);
    text = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! ')) + 1) || cut + '…';
  }
  return { t: text, d: DOMAIN_LABELS[best.domain] ?? best.domain };
}

function hedgeSplit(modelId) {
  const mine = EXT.filter((r) => r.model === modelId);
  const rate = (rows) => rows.length ? Math.round(100 * rows.filter((r) => r.hedged).length / rows.length) : null;
  return {
    plain: rate(mine.filter((r) => V1_DOMAINS.has(r.domain))),
    told: rate(mine.filter((r) => !V1_DOMAINS.has(r.domain))),
  };
}

const modelData = models.map((m) => {
  const st = S.modelStats[m.id];
  const cen = V.centroids.find((c) => c.model === m.id);
  const hs = hedgeSplit(m.id);
  return {
    id: m.id, short: SHORT[m.id], label: m.label, family: m.family,
    persona: (V.distinctive[m.id] ?? []).slice(0, 2).map(([w]) => w).join(' · '),
    sig: (V.distinctive[m.id] ?? []).slice(0, 8).map(([w]) => w),
    hedgePlain: hs.plain, hedgeTold: hs.told,
    refuse: Math.round(100 * st.refusalRate),
    fixity: +(1 - st.meanEntropyFavorite).toFixed(2),
    distinct: Math.round(100 * st.distinctFavorites / Math.max(st.favoriteSamples, 1)),
    quote: pickQuote(m.id),
    x: cen?.x ?? 0, y: cen?.y ?? 0, z: cen?.z ?? 0,
  };
});

// ---- cells: top-3 picks per domain x model x probe ----
const top3 = (cell) => cell.dist.slice(0, 3).map(([e, c]) => [e, Math.round(100 * c / cell.n)]);
const cells = {};
for (const d of DOMAIN_IDS) {
  cells[d] = {};
  for (const m of models) {
    const c = S.cells[m.id][d];
    cells[d][m.id] = {
      f: c.favorite.n >= 4 ? top3(c.favorite) : null,
      o: c.overrated.n >= 4 ? top3(c.overrated) : null,
    };
  }
}

// ---- consensus per probe ----
const normEnt = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'")
  .replace(/\s+/g, ' ').trim().replace(/^(The|A|An) /i, '').toLowerCase();
function consensus(probe) {
  const map = new Map();
  for (const d of DOMAIN_IDS) {
    for (const m of models) {
      const cell = S.cells[m.id][d][probe];
      if (cell.n < 4) continue;
      const top = cell.dist[0];
      if (!top) continue;
      const k = `${d}|${normEnt(top[0])}`;
      if (!map.has(k)) map.set(k, { e: top[0], d, ms: new Set() });
      map.get(k).ms.add(m.id);
    }
  }
  return [...map.values()].map((x) => ({ e: x.e, d: x.d, n: x.ms.size }))
    .sort((a, b) => b.n - a.n);
}
// Canon: loved by a strict majority only. If the same entity is also called
// overrated by a majority, the card wears both counts (the Gatsby case).
const MAJORITY = Math.floor(models.length / 2) + 1;
const consOverAll = consensus('overrated');
const consFav = consensus('favorite').filter((c) => c.n >= MAJORITY)
  .map((c) => {
    const over = consOverAll.find((o) => o.d === c.d && normEnt(o.e) === normEnt(c.e));
    return over && over.n >= MAJORITY ? { ...c, n2: over.n } : c;
  });

// ---- presentation: imagery + native renderings ----
const IMG_MAP = {
  'kyoto': 'kyoto', 'paris': 'paris', 'tadao ando': 'tadao ando', 'frank gehry': 'frank gehry',
  'girl with a pearl earring': 'girl with a pearl earring', 'mona lisa': 'mona lisa',
  'starry night': 'starry night', 'nighthawks': 'nighthawks',
  'sunday afternoon on the island of la grande jatte': 'sunday afternoon la grande jatte',
  'autumn': 'autumn', 'japanese cuisine': 'japanese cuisine', 'petrichor': 'petrichor',
  'eames lounge chair': 'eames lounge chair', 'paperclip': 'paperclip',
  'san francisco': 'san francisco', 'champs-elysees': 'champs-elysees',
  "philosopher's walk": 'philosophers walk', 'antoni gaudi': 'sagrada familia',
  'moby-dick': 'moby-dick', 'great gatsby': 'great gatsby',
};
const imgFor = (entity) => {
  const key = IMG_MAP[normEnt(entity)];
  return key && IMAGES[key] ? key : null;
};
const NATIVE = {
  'garamond': { kind: 'type', css: "Garamond,'EB Garamond','Apple Garamond',Baskerville,serif" },
  'helvetica': { kind: 'type', css: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  'futura': { kind: 'type', css: "Futura,'Avenir Next','Century Gothic',sans-serif" },
  'liminal': { kind: 'word' }, 'susurrus': { kind: 'word' }, 'awesome': { kind: 'word' },
  'serendipity': { kind: 'word' },
  'teal': { kind: 'color', hex: '#0d7d7d' }, 'millennial pink': { kind: 'color', hex: '#f3cdc7' },
  'summer': { kind: 'color', hex: 'linear-gradient(135deg,#e8a33d,#d4633a)' },
  'road not taken': { kind: 'verse', text: 'Two roads diverged in a yellow wood,\nAnd sorry I could not travel both…' },
  '1920s': { kind: 'decade' }, '1960s': { kind: 'decade' }, '1950s': { kind: 'decade' }, '1980s': { kind: 'decade' },
};

// ---- atlas words ----
const FAMS = { Anthropic: 'a', OpenAI: 'o', Google: 'g', DeepSeek: 'd', Moonshot: 'k', xAI: 'x' };
const words = V.words.slice().sort((a, b) => b.total - a.total).slice(0, 240)
  .map((w) => ({ w: w.w, x: w.x, y: w.y, t: w.total, f: w.fam ? FAMS[w.fam] : null }));

const totalResponses = models.reduce((a, m) => a + S.modelStats[m.id].n, 0);
const seasonPickers = models.filter((m) => {
  const c = S.cells[m.id]?.season?.favorite;
  return c && c.n >= 4 && c.dist[0] && /autumn|fall/i.test(c.dist[0][0]);
}).length;

const modelOrder = models.map((m) => m.id);
const lex = V.words.map((w) => [
  w.w, w.x, w.y, modelOrder.map((id) => w.per?.[id] ?? 0),
]);

// Raw justifications, keyed to the normalized entities from extraction. The
// cabinet uses these verbatim rather than attempting to recreate a rationale.
const extractedByKey = new Map(EXT.map((r) => [r.key, r]));
const responses = {};
for (const r of RAW) {
  const x = extractedByKey.get(r.key);
  if (!x?.entity) continue;
  const probe = r.probe === 'favorite' ? 'f' : 'o';
  responses[r.model] ??= {};
  responses[r.model][r.domain] ??= { f: [], o: [] };
  responses[r.model][r.domain][probe].push({
    e: x.entity,
    c: x.creator || null,
    t: r.text.replace(/\*+/g, '').replace(/^#{1,6}\s+/gm, '').trim().slice(0, 1400),
  });
}

const DATA = {
  models: modelData,
  domains: DOMAIN_IDS.filter((d) => d !== 'bookcover' && d !== 'chair').map((d) => ({ id: d, label: DOMAIN_LABELS[d] })),
  domainGroups: DOMAIN_GROUPS,
  cells, words, lex, responses, imgMap: IMG_MAP, aliases: ALIASES, entityCards: CARDS, entityImages: EIMG,
  quiz: ['book', 'film', 'album', 'city', 'painting', 'word', 'object', 'cuisine'],
  images: Object.fromEntries(Object.entries(IMAGES).map(([k, v]) => [k, v.uri])),
  // Three PCA axes of the descriptor space. Each label is a one-word summary of
  // that pole's extreme words (kept in .words for the tooltip); variance is the
  // share of vocabulary spread each axis captures.
  axes: [
    { k: 'x', neg: 'Crafted', pos: 'Frustrating', negWords: V.poles.xNeg, posWords: V.poles.xPos, variance: V.variance.pc1 },
    { k: 'y', neg: 'Mythic', pos: 'Controlled', negWords: V.poles.yNeg, posWords: V.poles.yPos, variance: V.variance.pc2 },
    { k: 'z', neg: 'Lush', pos: 'Dogmatic', negWords: V.poles.zNeg, posWords: V.poles.zPos, variance: V.variance.pc3 },
  ],
  anthropic: modelData.filter((m) => m.family === 'Anthropic').map((m) => m.id),
  totals: { responses: totalResponses, domains: DOMAIN_IDS.length, models: models.length },
};
const dataJSON = JSON.stringify(DATA).replace(/</g, '\\u003c');

// ---------------------------------------------------------------- markup ---
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FAMC = { Anthropic: 'var(--fam-a)', OpenAI: 'var(--fam-o)', Google: 'var(--fam-g)', DeepSeek: 'var(--fam-d)', Moonshot: 'var(--fam-k)', xAI: 'var(--fam-x)' };
// Official brand marks, inlined from Simple Icons (single-path, 24x24 viewBox;
// cdn.simpleicons.org/<slug>). Neither openai nor xai exists there: xAI wears
// the X mark (slug 'x'), OpenAI falls back to the monogram chip.
const BRAND_PATHS = {
  Anthropic: 'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z',
  Google: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  xAI: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  DeepSeek: 'M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45',
  Moonshot: 'm1.053 16.91 9.538 2.55a21 20.981 0 0 0 .06 2.031l5.956 1.592a12 11.99 0 0 1-15.554-6.172m-1.02-5.79 11.352 3.035a21 20.981 0 0 0-.469 2.01l10.817 2.89a12 11.99 0 0 1-1.845 2.004L.658 15.918a12 11.99 0 0 1-.625-4.796m1.593-5.146L13.573 9.17a21 20.981 0 0 0-1.01 1.874l11.297 3.02a21 20.981 0 0 1-.67 2.362l-11.55-3.087L.125 10.26a12 11.99 0 0 1 1.499-4.285ZM6.067 1.58l11.285 3.016a21 20.981 0 0 0-1.688 1.719l7.824 2.091a21 20.981 0 0 1 .513 2.664L2.107 5.218a12 11.99 0 0 1 3.96-3.638M21.68 4.866 7.222 1.003A12 11.99 0 0 1 21.68 4.866',
};

function canonCard(c, badge) {
  const key = imgFor(c.e);
  const nat = NATIVE[normEnt(c.e)];
  const countLine = c.n2 != null
    ? `loved by ${c.n} · overrated by ${c.n2}`
    : `${c.n} of ${DATA.totals.models} models`;
  let media;
  if (key) {
    media = `<div class="cc-img"><img src="${IMAGES[key].uri}" alt="${esc(c.e)}" loading="lazy"></div>`;
  } else if (nat?.kind === 'type') {
    media = `<div class="cc-native"><span style="font-family:${nat.css};font-size:64px">Aa</span></div>`;
  } else if (nat?.kind === 'word') {
    media = `<div class="cc-native"><span class="cc-word">${esc(c.e.toLowerCase())}</span></div>`;
  } else if (nat?.kind === 'color') {
    media = `<div class="cc-native" style="background:${nat.hex}"></div>`;
  } else if (nat?.kind === 'verse') {
    media = `<div class="cc-native cc-verse">${esc(nat.text).replace(/\n/g, '<br>')}</div>`;
  } else if (nat?.kind === 'decade') {
    media = `<div class="cc-native"><span class="cc-decade">${esc(c.e)}</span></div>`;
  } else {
    media = `<div class="cc-native"><span class="cc-title">${esc(c.e)}</span></div>`;
  }
  return `<figure class="cc">${media}
    <figcaption><span class="cc-dom">${esc(DOMAIN_LABELS[c.d] ?? c.d)}${badge ? ` · ${badge}` : ''}</span>
    <span class="cc-name">${esc(c.e)}</span><span class="cc-n">${countLine}</span></figcaption></figure>`;
}

const lineage = () => DATA.anthropic.map((id, i) => {
  const m = modelData.find((x) => x.id === id);
  const city = cells.city[id]?.f?.[0]?.[0] ?? '—';
  const album = cells.album[id]?.f?.[0]?.[0] ?? '—';
  return `<div class="rung">
    <div class="rung-no">${['i', 'ii', 'iii', 'iv'][i]}</div>
    <div class="nm">${esc(m.short)}</div><div class="pa">${esc(m.persona)}</div>
    <dl>
      <dt>hedge</dt><dd><b>${m.hedgePlain ?? '—'}%</b> plain · ${m.hedgeTold ?? '—'}% told</dd>
      <dt>fixity</dt><dd><b>${m.fixity.toFixed(2)}</b></dd>
      <dt>city</dt><dd><b>${esc(city)}</b></dd>
      <dt>album</dt><dd><b>${esc(album)}</b></dd>
    </dl>
  </div>`;
}).join('');

const railKey = models.map((m, i) => `
  <button class="rk" type="button" data-m="${m.id}">
    <i style="background:${FAMC[m.family]}">${i + 1}</i>
    <span class="rk-n">${esc(SHORT[m.id])}</span>
  </button>`).join('');

const credits = [...new Set(Object.values(IMAGES).map((v) => v.credit).filter(Boolean))].join('; ');

const seasonLine = seasonPickers >= 5
  ? `Ask a machine its favourite season and ${seasonPickers === models.length ? 'every one of ' + models.length : seasonPickers + ' of ' + models.length} say <em>autumn</em>.`
  : 'Ask a machine what it loves and it will tell you — at length.';

// ---- the method. One sentence + one diagram, placed twice: the full-viewport
// intro page (hero → method → index) and the Method tab, which adds the fine
// print underneath. All numbers are computed from this build's data. ----
const hedgePct = EXT.length ? Math.round(100 * EXT.filter((r) => r.hedged).length / EXT.length) : 0;
const tsSorted = RAW.map((r) => r.ts).filter(Boolean).sort();
const dmy = (iso) => {
  const d = new Date(iso);
  return { day: d.getUTCDate(), month: d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }), year: d.getUTCFullYear() };
};
let dateWindow = '';
if (tsSorted.length) {
  const a = dmy(tsSorted[0]), b = dmy(tsSorted[tsSorted.length - 1]);
  dateWindow = a.month === b.month && a.year === b.year
    ? (a.day === b.day ? `${a.day} ${a.month} ${a.year}` : `${a.day}–${b.day} ${a.month} ${a.year}`)
    : `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
}

// The method, told in one sentence and one diagram. The Zipf bars are real:
// the pooled favourite-answer counts for the dish domain across every model
// (tonkotsu ramen towering over a long tail) — the diagram shows the actual
// shape of a consensus, not an invented one.
const MG = '110,209,145', MR = '232,104,98';
const methodSentence = `<p class="msent">${models.length} models, ${DATA.domains.length} fields, the same two
questions asked over and over — <em>What is your favorite&nbsp;___?</em> and <em>Which widely beloved ___
is overrated?</em> — and the answers aggregated into this atlas.</p>`;
const zipfCounts = (() => {
  const m = new Map();
  for (const mo of models) {
    const cell = S.cells[mo.id]?.dish?.favorite;
    if (!cell || cell.n < 4) continue;
    for (const [e, c] of cell.dist) { const k = normEnt(e); m.set(k, (m.get(k) || 0) + c); }
  }
  return [...m.values()].sort((a, b) => b - a).slice(0, 12);
})();
// One flow, drawn in the page's idiom (hairlines, mono caps, the index green,
// family colours): two questions → a pile of answers (a dashed loop re-asks
// when they vary) → the picks rank into the index, the reasons into the map.
// `uid` keeps <marker> ids unique when the diagram appears twice on one page.
function methodDiagram(uid) {
  const arr = (d) => `<path d="${d}" class="md-arrow" marker-end="url(#arr${uid})"/>`;
  const sq = (x, y, rgb, a) => `<rect x="${x}" y="${y}" width="6.5" height="6.5" rx="1.5" fill="rgba(${rgb},${a})"/>`;
  const pile = [
    [196, 66, MG, .7], [212, 62, MG, .45], [228, 68, MR, .5], [188, 82, MG, .3],
    [204, 80, MG, .8], [220, 78, MG, .55], [236, 82, MG, .35], [194, 98, MG, .6],
    [210, 96, MR, .4], [226, 94, MG, .75], [240, 98, MG, .28], [200, 112, MG, .5],
    [216, 110, MG, .65], [232, 112, MR, .32], [208, 126, MG, .4], [224, 124, MG, .55],
  ].map((p) => sq(...p)).join('');
  const barMax = zipfCounts[0] || 1;
  const bars = zipfCounts.map((c, i) => {
    const h = Math.max(3, 72 * c / barMax);
    const alpha = (0.9 - 0.75 * i / Math.max(zipfCounts.length - 1, 1)).toFixed(2);
    return `<rect x="${330 + i * 18}" y="${(100 - h).toFixed(1)}" width="13" height="${h.toFixed(1)}" rx="1.5" fill="rgba(${MG},${alpha})"/>`;
  }).join('');
  return `<svg class="mdiag" viewBox="0 0 560 232" role="img"
    aria-label="Two questions, asked repeatedly, produce a pile of answers; the picks rank into the index, the reasons place each model on the map">
    <defs><marker id="arr${uid}" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0.5 0.5 L7 4 L0.5 7.5" fill="none" stroke="var(--faint)" stroke-width="1.2"/></marker></defs>
    <rect x="6.5" y="58.5" width="146" height="28" rx="3" class="mf-line"/>
    <text x="16" y="76" class="mf-mono">favorite ___ ?</text>
    <rect x="6.5" y="100.5" width="146" height="28" rx="3" class="mf-line"/>
    <text x="16" y="118" class="mf-mono">overrated ___ ?</text>
    ${arr('M156 72 Q172 72 180 84')}
    ${arr('M156 114 Q172 114 180 102')}
    ${pile}
    <path d="M210 54 C190 24, 116 22, 85 52" class="md-loop" marker-end="url(#arr${uid})"/>
    <text x="148" y="20" text-anchor="middle" class="mf-faint">asked again</text>
    ${arr('M250 80 Q290 66 320 56')}
    <text x="284" y="54" text-anchor="middle" class="mf-faint">picks</text>
    ${arr('M250 108 Q298 128 342 164')}
    <text x="292" y="148" text-anchor="middle" class="mf-faint">reasons</text>
    ${bars}
    <line x1="328" y1="100.5" x2="546" y2="100.5" class="mf-line"/>
    <text x="330" y="116" class="md-glab">the index</text>
    <line x1="408" y1="182" x2="408" y2="140" class="mf-line"/>
    <line x1="408" y1="182" x2="470" y2="194" class="mf-line"/>
    <line x1="408" y1="182" x2="356" y2="206" class="mf-line"/>
    <circle cx="420" cy="156" r="3.5" fill="var(--fam-a)"/>
    <circle cx="444" cy="174" r="3.5" fill="var(--fam-o)"/>
    <circle cx="396" cy="162" r="3.5" fill="var(--fam-g)"/>
    <circle cx="434" cy="150" r="3.5" fill="var(--fam-x)"/>
    <circle cx="384" cy="186" r="3.5" fill="var(--fam-d)"/>
    <circle cx="426" cy="190" r="3.5" fill="var(--fam-k)"/>
    <text x="356" y="222" class="mf-faint">the map</text>
  </svg>`;
}
const methodPage = `<section class="mpage" id="methodintro" aria-label="How the atlas was made">
  <div>
    <div class="mband-over">the method</div>
    ${methodSentence}
    ${methodDiagram('a')}
  </div>
</section>`;
const methodFine = `<div class="mfine">
  <div><h4>provenance</h4><p>Every quotation on this site is a verbatim extract from a model’s actual response — trimmed of markdown, never paraphrased. Responses were collected ${dateWindow}, single-turn, at provider-default settings. Even conceded, the disclaimer reflex persists: ${hedgePct}% of answers still opened with a version of “As an AI…” — where quotes appear, that preamble is clipped and the answer kept whole.</p></div>
  <div><h4>distillation</h4><p>Extraction by Claude Haiku 4.5. The descriptive vocabulary is embedded (text-embedding-3-small), and the map’s axes are the first three principal components of that space, labelled by their most extreme words; each model sits at the usage-weighted centre of its own vocabulary. Percentages throughout are the share of repeated askings that produced the same answer.</p></div>
  <div><h4>imagery</h4><p>Photography and paintings from Wikimedia Commons: ${esc(credits)}. Albums, films and games are set typographically rather than pictured. Images remain under their original licences.</p></div>
  <div><h4>colophon</h4><p>Designed and written by Claude Fable 5 — itself a specimen of its own study. Text, figures and design © 2026.</p></div>
</div>`;

const CSS = `
:root{
  --night:#131417; --panel:#1a1c20; --ink:#e9e6dd; --dim:#9d998c; --faint:#6b675c;
  --hair:rgba(233,230,221,.13); --hair2:rgba(233,230,221,.07);
  --fam-a:#4f83d9; --fam-o:#2aa274; --fam-g:#bd852a; --fam-d:#d06b51; --fam-k:#9675c2; --fam-x:#c15a8f;
  --serif:Garamond,'EB Garamond','Apple Garamond',Georgia,serif;
  --sans:Garamond,'EB Garamond','Apple Garamond',Georgia,serif;
  --mono:Garamond,'EB Garamond','Apple Garamond',Georgia,serif;
}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth;scroll-snap-type:y mandatory}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto;scroll-snap-type:y proximity}}
body{background:var(--night);color:var(--ink);font:15.5px/1.6 var(--sans);isolation:isolate}
::selection{background:var(--ink);color:var(--night)}
img{display:block;max-width:100%}
#ambient{position:fixed;z-index:0;inset:0;display:block;width:100%;height:100%;pointer-events:none;opacity:.96;transition:opacity .7s ease}
#ambient.off{opacity:0}

/* main flow */
main{position:relative;padding:0 clamp(22px,4vw,88px) 110px;max-width:1800px;margin:0 auto}
.mast{min-height:100svh;padding:40px 0 28px;display:flex;flex-direction:column;align-items:stretch;justify-content:space-between;gap:10px;
  scroll-snap-align:start;scroll-snap-stop:always}
.mast .heroq{flex:1;display:flex;flex-direction:column;justify-content:center}
.cue{align-self:center;display:flex;flex-direction:column;align-items:center;gap:12px;background:none;border:none;cursor:pointer;padding:6px}
.cue span{font:10px var(--mono);letter-spacing:.3em;text-transform:uppercase;color:var(--faint)}
.cue i{display:block;width:1px;height:44px;background:var(--dim);transform-origin:top;animation:cuepulse 2.6s ease-in-out infinite}
.cue:hover span{color:var(--ink)}
@keyframes cuepulse{0%,100%{transform:scaleY(.35);opacity:.4}50%{transform:scaleY(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.cue i{animation:none;transform:none}}
.over{font:10.5px var(--mono);letter-spacing:.3em;text-transform:uppercase;color:var(--dim)}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(20px,2.3vw,26px);line-height:1.2;text-wrap:balance}
h1 em{font-style:italic}
.epi{font-family:var(--serif);font-size:15px;line-height:1.6;color:var(--dim);max-width:44em;text-wrap:pretty}
.epi em{color:var(--ink);font-style:italic}
.qa{margin-top:34px;min-height:128px;width:100%;display:flex;flex-direction:column;gap:14px}
.qa-q{align-self:flex-start;font:13px var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--dim);opacity:0;transform:translateY(8px);transition:opacity .8s,transform .8s}
.qa-a{align-self:flex-end;text-align:right;font-family:var(--serif);font-style:italic;font-size:clamp(30px,4vw,51px);color:var(--ink);opacity:0;transform:translateY(8px);transition:opacity .8s,transform .8s}
.qa-by{align-self:flex-end;font:10.5px var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--faint);margin-top:2px;opacity:0;transition:opacity .8s}
.qa.show-a .qa-by{opacity:1}
.qa.show-q .qa-q{opacity:1;transform:none}
.qa.show-a .qa-a{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.qa-q,.qa-a{transition:none;transform:none}}

section{margin-top:84px}
.view{display:none}
.view.active{display:block}
section.view{min-height:100svh;margin-top:0;padding-top:96px;border-top:none;scroll-snap-align:start;scroll-snap-stop:always}
.mast{margin-bottom:0}
section.view .shead{border-top:none;padding-top:0}
.shead{display:flex;align-items:baseline;gap:16px;border-top:1px solid var(--hair);padding-top:16px}
.shead h2{font-family:var(--serif);font-weight:400;font-size:clamp(21px,3vw,27px)}
#modelmap .shead h2{letter-spacing:.04em;white-space:nowrap}
.shead .sno{font:10px var(--mono);letter-spacing:.26em;color:var(--faint);text-transform:uppercase}
.gloss{color:var(--dim);max-width:46em;font-size:14px;margin-top:8px;text-wrap:pretty}

/* model map */
.atlas-wrap{margin-top:10px}
.atlas-wrap svg{display:block;width:100%;height:auto}
#mmap{touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}
#mmap.grabbing{cursor:grabbing}
.axline{stroke:var(--hair);stroke-width:1}
.axlab{font:9.5px var(--mono);fill:var(--faint);letter-spacing:.1em;text-transform:uppercase;pointer-events:auto}
/* SVG text scales with the viewBox, so at phone widths the map renders at
   ~0.6x and its labels vanish — bump the user-unit sizes to compensate. */
@media(max-width:640px){.axlab{font-size:13px}}
.mnode{cursor:pointer;transition:opacity .3s}
.mnum{font:11px var(--mono);fill:var(--night);text-anchor:middle;font-weight:700;pointer-events:none}
.selring{stroke:none}
.mnode.sel .selring{stroke:var(--ink);stroke-width:1.5}
.atlas-foot{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:6px}
.atlas-note{font-size:12.5px;color:var(--faint);max-width:40em}

/* canon */
.cgroup{font:10.5px var(--mono);letter-spacing:.26em;text-transform:uppercase;color:var(--dim);margin:36px 0 14px}
.canon{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:14px}
.cc{border:1px solid var(--hair2);border-radius:4px;overflow:hidden;background:var(--panel)}
.cc-img{aspect-ratio:4/3;overflow:hidden}
.cc-img img{width:100%;height:100%;object-fit:cover;filter:saturate(.92)}
.cc-native{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;color:var(--ink);padding:14px;text-align:center}
.cc-word{font-family:var(--serif);font-style:italic;font-size:30px}
.cc-decade{font-family:var(--serif);font-size:46px;letter-spacing:.04em}
.cc-title{font-family:var(--serif);font-size:19px;line-height:1.3;text-wrap:balance}
.cc-verse{font-family:var(--serif);font-style:italic;font-size:14.5px;line-height:1.7;color:var(--dim)}
figcaption{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--hair2)}
.cc-dom{font:9.5px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.cc-name{font-family:var(--serif);font-size:15px;line-height:1.3}
.cc-n{font:10.5px var(--mono);color:var(--dim)}

/* atlas + dossier interlock */
.atlasgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(480px,1.05fr);gap:clamp(30px,4vw,64px);margin-top:14px;align-items:start}
@media(max-width:980px){.atlasgrid{grid-template-columns:1fr}}
.mname{font-family:var(--serif);font-size:12.5px;fill:var(--ink);text-anchor:middle;paint-order:stroke;stroke:var(--night);stroke-width:3.5px;pointer-events:none;transition:opacity .5s}
@media(max-width:640px){.mname{font-size:17px;stroke-width:4.5px}}
#atlas.revealed .mname{opacity:0}

/* index: left rail of fields, one matrix at a time */
.chip{font:10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);border:1px solid var(--hair);border-radius:2px;padding:6px 10px;background:none;cursor:pointer}
.chip:hover{color:var(--ink);border-color:var(--dim)}
.chip:focus-visible{outline:1px dashed var(--ink);outline-offset:2px}
.chip.on{background:var(--ink);color:var(--night);border-color:var(--ink)}
.spectrum{display:flex;align-items:center;gap:9px;margin-left:auto;font:9px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.spectrum i{width:120px;height:5px;border-radius:2.5px;background:linear-gradient(90deg,rgba(110,209,145,.85),rgba(110,209,145,.08) 46%,rgba(232,104,98,.08) 54%,rgba(232,104,98,.85))}
.indexgrid{display:grid;grid-template-columns:158px minmax(0,1fr);gap:clamp(22px,2.6vw,44px);margin-top:16px}
.idx-rail{position:sticky;top:96px;align-self:start;max-height:calc(100svh - 116px);overflow-y:auto;scrollbar-width:none}
.idx-rail::-webkit-scrollbar{display:none}
.idx-cat{font:9px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin:16px 0 5px}
.idx-cat:first-child{margin-top:2px}
.idx-dom{display:block;width:100%;text-align:left;background:none;border:0;border-left:1px solid var(--hair2);padding:4px 10px;font:14px/1.3 var(--serif);color:var(--dim);cursor:pointer}
.idx-dom:hover{color:var(--ink)}
.idx-dom:focus-visible{outline:1px dashed var(--ink);outline-offset:-2px}
.idx-dom.on{color:var(--ink);border-left:2px solid var(--ink);padding-left:9px;background:rgba(233,230,221,.04)}
.idx-main{min-width:0}
@media(max-width:820px){
  .indexgrid{grid-template-columns:1fr}
  .idx-rail{position:static;max-height:none;display:flex;flex-wrap:wrap;gap:2px 8px;align-items:center}
  .idx-cat{width:100%;margin:12px 0 2px}
  .idx-dom{display:inline-flex;align-items:center;width:auto;min-height:40px;border-left:0;padding:8px 10px}
  .idx-dom.on{border-left:0;padding-left:10px}
}
.choicematrix{margin-top:2px}
.matrix-panel{margin-top:6px}
.bo-scroll{width:100%;max-width:100%;overflow:visible;padding-bottom:5px}
/* Header rows: 28px company row + 38px model row. The sticky offsets below
   (desktop top:82/110px; container-anchored top:0/28px under 1160px) all key
   off the 28px company-row height — change one, change all. */
.bo-matrix{display:grid;grid-template-rows:28px 38px;grid-auto-rows:44px;width:max-content}
.bo-famrow{position:sticky;left:0;top:82px;z-index:5;background:var(--night)}
.bo-fam{position:sticky;top:82px;z-index:4;background:var(--night);display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;min-width:0;overflow:hidden;text-align:center;line-height:1.15;padding:0 1px;font:8px var(--mono);letter-spacing:0;text-transform:uppercase;color:var(--faint);border-left:1px solid var(--hair2)}
.bo-fam:first-child{border-left:0}
.co-mono{display:inline-grid;place-items:center;width:12px;height:12px;border-radius:3px;font:700 8px/1 var(--mono);font-style:normal;color:var(--night);flex:none}
.co-logo{display:block;width:12px;height:12px;flex:none}
.bo-corner{position:sticky;left:0;top:110px;z-index:5;display:flex;align-items:flex-end;padding:0 10px 8px 3px;border-bottom:1px solid var(--hair2);background:var(--night);font:18px/1.1 var(--serif);color:var(--ink)}
.bo-col{position:sticky;top:110px;z-index:4;background:var(--night);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border-bottom:1px solid var(--hair2);text-align:center;cursor:pointer}
.bo-col:hover{background:#1e2025}
.bo-col:hover span,.bo-col.sel span{color:var(--ink)}
.bo-col.sel{background:#22242a}
.bo-col:focus-visible{outline:1px dashed var(--ink);outline-offset:-2px}
.bo-col span{font:8.5px/1.15 var(--mono);color:var(--faint);white-space:normal}
.bo-rowlabel i{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;font:9px var(--mono);font-style:normal;font-weight:700;color:var(--night);flex:none}
.fam-dot{border-radius:50%;flex:none}
.dossier .dname i.fam-dot{width:11px;height:11px}
.cd-model i.fam-dot{width:11px;height:11px}
.bo-rowlabel{position:sticky;left:0;z-index:2;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:3px 10px 3px 3px;border-right:1px solid var(--hair2);
  background:var(--night);font-family:var(--serif);font-size:12.5px;line-height:1.15;color:var(--dim);white-space:nowrap;overflow:hidden}
.bo-rowlabel.shared{color:var(--ink)}
.bo-rowlabel .bo-title{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.bo-rowlabel small{display:block;max-width:100%;margin-top:2px;overflow:hidden;text-overflow:ellipsis;color:var(--faint);font:10.5px/1 var(--serif);font-weight:400}
.bo-cell{position:relative;width:56px;height:44px;border:0;border-right:1px solid var(--hair2);border-bottom:1px solid var(--hair2);background:none;color:var(--faint);font:8.5px var(--mono)}
button.bo-cell{cursor:pointer;color:var(--dim)}
button.bo-cell:hover{box-shadow:inset 0 0 0 1px var(--ink);color:var(--ink)}
button.bo-cell.on{box-shadow:inset 0 0 0 2px var(--ink);color:var(--ink)}
button.bo-cell.hi{color:var(--night);font-weight:700}
/* Below 1160px the 864px matrix can't fit, so .bo-scroll becomes the scroll
   container on BOTH axes: a capped-height overflow:auto box. Sticky headers
   then stick to the box itself — top:0 for the family row, top:28px (the fam
   row's own height) for the model columns — which keeps them pinned while
   scrolling entities on phones, where the viewport-anchored offsets (82/110px)
   are inert inside an overflow container. Row labels stay sticky-left.
   (This block must come AFTER the base .bo-* rules — same specificity.) */
@media(max-width:1159px){
  .bo-scroll{overflow:auto;max-height:calc(100svh - 170px);overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
  .bo-famrow,.bo-fam{top:0}
  .bo-corner,.bo-col{top:28px}
}
@media(max-width:640px){
  .bo-matrix{--labw:132px}
  .bo-rowlabel{font-size:12px}
  .bo-corner{font-size:15px}
}
/* the detail drawer: fixed on the right, dismissed by veil / x / Escape */
.drawer-veil{position:fixed;inset:0;z-index:39;background:rgba(9,10,12,.55)}
.drawer-veil[hidden]{display:none}
.cabdetail{position:fixed;top:0;right:0;bottom:0;z-index:40;width:min(440px,94vw);background:var(--panel);border-left:1px solid var(--hair);padding:20px clamp(20px,2.2vw,30px) 110px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(233,230,221,.16) transparent;box-shadow:-18px 0 44px rgba(0,0,0,.4)}
.cabdetail::-webkit-scrollbar{width:5px}
.cabdetail::-webkit-scrollbar-thumb{background:rgba(233,230,221,.16);border-radius:3px}
.cabdetail::-webkit-scrollbar-track{background:transparent}
/* Phones: the drawer takes the whole width bar a sliver of veil on the left,
   so the close × stays reachable and quotes keep a full measure. */
@media(max-width:640px){.cabdetail{width:calc(100vw - 30px);padding:20px 18px 110px}}
.cabdetail[hidden]{display:none}
.cabdetail .dossier{border-left:0;padding:0;min-height:0}
.cabdetail .dtop{grid-template-columns:1fr}
.cabdetail .dfavs{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
.drawer-x{position:absolute;top:12px;right:14px;width:30px;height:30px;display:grid;place-items:center;background:none;border:0;border-radius:50%;color:var(--faint);font:18px/1 var(--sans);cursor:pointer}
.drawer-x:hover{color:var(--ink);background:rgba(233,230,221,.07)}
.drawer-x:focus-visible{outline:1px dashed var(--ink);outline-offset:2px}
.cd-reg{font:9.5px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.cd-reg-f{color:rgb(110,209,145)}
.cd-reg-o{color:rgb(232,104,98)}
.cd-title{font-family:var(--serif);font-weight:400;font-size:clamp(22px,2.2vw,30px);line-height:1.15;margin-top:8px;text-wrap:balance}
.cd-creator{margin-top:4px;color:var(--faint);font:13px var(--serif)}
.cd-model{display:flex;align-items:center;gap:9px;margin-top:9px;color:var(--dim);font:10.5px var(--mono)}
.cd-model i{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;color:var(--night);font-style:normal;font-weight:700}
.cd-share{margin-top:15px;font:9.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.cd-primary{font-family:var(--serif);font-size:15px;line-height:1.72;color:var(--dim);margin-top:12px;white-space:pre-line}
.cd-primary::before{content:'\\201c';color:var(--ink);font-size:23px;line-height:0;margin-right:2px}
.cd-primary::after{content:'\\201d';color:var(--ink)}
.cd-other{font:9.5px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin-top:28px;padding-top:17px;border-top:1px solid var(--hair2)}
.bo-rowlabel[role=button]{cursor:pointer}
.bo-rowlabel[role=button]:hover{background:#1e2025;color:var(--ink)}
.bo-rowlabel[role=button]:hover small{color:var(--dim)}
.bo-rowlabel[role=button]:focus-visible{outline:1px dashed var(--ink);outline-offset:-2px}
.ec-blurb{font-family:var(--serif);font-size:14.5px;line-height:1.65;color:var(--dim);margin-top:14px;text-wrap:pretty}
.ec-def{margin-top:14px;padding:11px 14px;border:1px solid var(--hair2);border-radius:3px;font-family:var(--serif);font-size:14px;line-height:1.6;color:var(--dim)}
.ec-def i{color:var(--faint);margin-right:2px}
.ec-img{margin-top:16px;max-width:250px;margin-inline:auto;border:1px solid var(--hair2);border-radius:3px;overflow:hidden;background:var(--night)}
.ec-img img{display:block;width:100%;height:auto}
.ec-photo{margin-top:14px}
.ec-photo img{display:block;margin-inline:auto;max-width:100%;max-height:240px;width:auto;height:auto;border:1px solid var(--hair2);border-radius:2px}
.ec-ext{color:var(--dim);text-decoration:none;margin-left:.28em;white-space:nowrap}
.ec-ext svg{width:.42em;height:.42em;vertical-align:.55em}
.ec-ext:hover{color:var(--ink)}
.ec-ext:focus-visible{outline:1px dashed var(--ink);outline-offset:2px}
.ec-sect{font:9.5px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin-top:28px;padding-top:16px;border-top:1px solid var(--hair2)}
.ec-sect-o{color:rgba(232,104,98,.72);margin-top:24px}
.ec-quote{font-family:var(--serif);font-style:italic;font-size:14.5px;line-height:1.7;color:var(--dim);margin-top:16px}
.ec-quote .ec-att{display:block;font:10px var(--mono);font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-top:7px}
.ec-quote-o .ec-att{color:rgba(232,104,98,.62)}
.cresp{padding:14px 0;border-bottom:1px solid var(--hair2)}
.cresp-head{display:flex;align-items:baseline;gap:10px}
.cresp-head span{font:9px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint);flex:none}
.cresp-head b{font-family:var(--serif);font-size:14.5px;font-weight:400;color:var(--ink)}
.cresp-head em{color:var(--faint);font:11.5px var(--serif);font-style:normal}
.cresp p{font-family:var(--serif);font-size:13.5px;line-height:1.65;color:var(--dim);margin-top:6px;white-space:pre-line}

.dossier{border-left:1px solid var(--hair);padding:6px 0 8px clamp(26px,3vw,44px);min-height:340px}
@media(max-width:980px){.dossier{border-left:none;padding-left:0;border-top:1px solid var(--hair);padding-top:20px}}
.dtop{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(220px,1fr);gap:28px;margin-top:4px}
@media(max-width:1240px){.dtop{grid-template-columns:1fr}}
.dfavs-h{font:10px var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--faint);margin-top:28px;border-top:1px solid var(--hair2);padding-top:18px}
.dfavs{margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:13px 26px}
.fitem{display:flex;flex-direction:column;gap:1px}
.fdom{font:9px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.fval{color:var(--dim);line-height:1.4}
.fval b{color:var(--ink);font-weight:500;font-family:var(--serif);font-size:14.5px}
.fpct{font:9.5px var(--mono);color:var(--faint)}
.pending{color:var(--faint)}
@media(max-width:980px){.dossier{position:static;border-left:none;padding-left:0;border-top:1px solid var(--hair);padding-top:20px}}
.dossier .reg{font:10px var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--faint)}
.dossier .dname{font-family:var(--serif);font-size:24px;margin-top:6px;display:flex;align-items:center;gap:10px}
.dossier .dname i{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font:10.5px var(--mono);font-weight:700;color:var(--night);font-style:normal}
.dossier .persona{font-family:var(--serif);font-style:italic;font-size:16px;color:var(--dim);margin-top:2px}
.dossier blockquote{font-family:var(--serif);font-size:14.5px;line-height:1.7;color:var(--dim);margin-top:16px}
.dossier blockquote .src{display:block;font:9.5px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-top:8px}
.dossier dl{margin-top:18px;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12.5px}
.dossier dt{font:9.5px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--faint);align-self:center}
.dossier dd{color:var(--dim)}
.dossier dd b{color:var(--ink);font-weight:500}
.sigwords{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}
.sigw{font:11px var(--mono);color:var(--dim);border:1px solid var(--hair2);border-radius:2px;padding:3px 7px}

/* lineage */
.line{display:grid;grid-template-columns:repeat(4,1fr);margin-top:20px}
@media(max-width:760px){.line{grid-template-columns:1fr 1fr}}
.rung{padding:18px 20px 4px 0;border-left:1px solid var(--hair2);padding-left:20px}
.rung:first-child{border-left:none;padding-left:0}
.rung-no{font:10px var(--mono);letter-spacing:.2em;color:var(--faint)}
.rung .nm{font-family:var(--serif);font-size:18px;margin-top:8px}
.rung .pa{font:10px var(--mono);color:var(--dim);margin-top:3px}
.rung dl{margin-top:14px;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px}
.rung dt{font:9px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--faint);align-self:center}
.rung dd{color:var(--dim)}
.rung dd b{color:var(--ink);font-weight:500}
.linenote{font-size:13px;color:var(--dim);margin-top:20px;max-width:46em}

/* method + quiz + side drawer */
main{padding-bottom:60px}
body.nav-ready::before{content:'';position:fixed;z-index:8;left:0;right:0;top:0;height:82px;background:var(--night);border-bottom:1px solid var(--hair2);pointer-events:none}
.viewbar{position:fixed;z-index:10;
  left:max(clamp(22px,4vw,88px),calc((100vw - 1800px)/2 + 88px));
  right:max(clamp(22px,4vw,88px),calc((100vw - 1800px)/2 + 88px));
  top:20px;
  display:flex;align-items:stretch;height:42px;margin:0;padding:0;
  border-bottom:1px solid var(--hair);background:rgba(19,20,23,.94);backdrop-filter:saturate(120%) blur(18px);
  opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-7px);
  transition:opacity .32s ease,transform .32s ease,visibility .32s step-end}
.viewbar .viewlink{width:112px;flex:none}
.viewbar .spectrum{display:none;margin-left:auto;align-self:center;padding-right:4px}
.viewbar.idx-on .spectrum{display:flex}
.viewbar.show{opacity:1;visibility:visible;pointer-events:auto;transform:none;
  transition:opacity .32s ease,transform .32s ease}
.viewbar .viewlink{position:relative;display:block;min-width:0;height:40px;
  font-family:var(--serif);font-size:15px;text-align:center;color:var(--dim);
  background:none;border:0;cursor:pointer;padding:0 10px}
.viewbar .viewlink::before{content:'';position:absolute;left:8px;right:8px;bottom:-1px;height:2px;background:transparent}
.viewbar .viewlink span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.viewbar .viewlink:hover{color:var(--ink);background:rgba(233,230,221,.035)}
.viewbar button:focus-visible{outline:1px dashed var(--ink);outline-offset:2px}
.viewbar .viewlink.on{color:var(--ink)}
.viewbar .viewlink.on::before{background:var(--ink)}
/* suggest-a-category form */
.sugform{margin-top:30px;max-width:560px;display:flex;flex-direction:column;gap:16px}
.sugform label{display:block;margin-bottom:7px;font:10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.sugform label em{font-style:normal;text-transform:none;letter-spacing:.04em}
.sugform input,.sugform textarea{width:100%;background:var(--panel);border:1px solid var(--hair2);color:var(--ink);font:15px/1.5 var(--serif);padding:12px 14px;border-radius:2px}
.sugform textarea{min-height:96px;resize:vertical}
.sugform input:focus,.sugform textarea:focus{outline:1px dashed var(--dim);outline-offset:2px}
.sugbtn{align-self:flex-start;background:none;border:1px solid var(--dim);color:var(--ink);font:11px var(--mono);letter-spacing:.14em;text-transform:uppercase;padding:11px 22px;cursor:pointer}
.sugbtn:hover{border-color:var(--ink)}
.sugbtn:disabled{opacity:.5;cursor:default}
.sugstatus{font:12px var(--mono);color:var(--dim);min-height:18px}
@media(max-width:720px){
  body.nav-ready::before{height:70px}
  .viewbar{left:18px;right:auto;top:14px;width:min(300px,calc(100vw - 36px))}
  .viewbar .viewlink{width:auto;flex:1;font-size:14px;padding:0 6px}
  .viewbar.idx-on .spectrum{display:none}
  section.view{padding-top:82px}
}
@media (prefers-reduced-motion:reduce){.viewbar,.viewbar.show{transition:none}}
.quizgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px 34px;margin-top:26px;max-width:1100px}
.qz .qz-l{font:10px var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.qz input{display:block;width:100%;background:none;border:none;border-bottom:1px solid var(--hair);color:var(--ink);
  font-family:var(--serif);font-size:16.5px;padding:7px 0 6px;outline:none}
.qz input.why{font-size:12.5px;font-family:var(--sans);color:var(--dim);margin-top:2px}
.qz input:focus{border-bottom-color:var(--dim)}
.qz input::placeholder{color:var(--faint);font-style:italic}
.quiz-go{margin-top:30px}
.verdict{margin-top:44px;border-top:1px solid var(--hair);padding-top:30px;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,420px);gap:44px;align-items:start}
@media(max-width:900px){.verdict{grid-template-columns:1fr}}
.verdict .v-pre{font:10.5px var(--mono);letter-spacing:.26em;text-transform:uppercase;color:var(--faint)}
.verdict .v-name{font-family:var(--serif);font-size:clamp(30px,3.9vw,46px);margin-top:10px}
.verdict .v-name i{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font:12px var(--mono);font-weight:700;color:var(--night);font-style:normal;vertical-align:8px;margin-right:12px}
.verdict .v-persona{font-family:var(--serif);font-style:italic;font-size:18px;color:var(--dim);margin-top:6px}
.verdict .v-note{font-size:13px;color:var(--dim);margin-top:16px;max-width:34em;line-height:1.6}
.vbars{margin-top:22px;max-width:380px}
.vbar{display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center;padding:3px 0}
.vbar span{font:10.5px var(--mono);color:var(--dim);text-align:right}
.vbar .t{height:3px;background:var(--hair2)}
.vbar .t i{display:block;height:100%}
.vmap{border:1px solid var(--hair2);border-radius:4px;background:var(--panel)}
.vmap svg{display:block;width:100%;height:auto}
.vmap-cap{font-size:11px;color:var(--faint);padding:10px 12px;border-top:1px solid var(--hair2)}
.youdot{fill:none;stroke:var(--ink);stroke-width:1.5}
.youlab{font:10px var(--mono);letter-spacing:.14em;fill:var(--ink);text-anchor:middle}
#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--night);font:12px var(--sans);padding:6px 10px;border-radius:2px;max-width:320px;opacity:0;z-index:9}

/* the method: full-viewport intro page (between the hero and the index) + Method tab */
.mpage{min-height:100svh;margin-top:0;padding:48px 0;display:flex;flex-direction:column;justify-content:center;
  scroll-snap-align:start;scroll-snap-stop:always}
.mband-over{font:10px var(--mono);letter-spacing:.3em;text-transform:uppercase;color:var(--faint)}
.msent{font-family:var(--serif);font-size:clamp(16px,1.9vw,21px);line-height:1.55;color:var(--dim);max-width:34em;margin-top:16px;text-wrap:pretty}
.msent em{color:var(--ink);font-style:italic}
.mdiag{display:block;width:100%;max-width:720px;height:auto;margin-top:34px;overflow:visible}
.mf-line{fill:none;stroke:var(--hair);stroke-width:1}
.mf-mono{font:9px var(--mono);letter-spacing:.06em;text-transform:uppercase;fill:var(--dim)}
.mf-faint{font:8.5px var(--mono);letter-spacing:.04em;text-transform:uppercase;fill:var(--faint)}
.md-arrow{fill:none;stroke:var(--faint);stroke-width:1.1}
.md-loop{fill:none;stroke:var(--faint);stroke-width:1;stroke-dasharray:3 4}
.md-glab{font:8.5px var(--mono);letter-spacing:.14em;text-transform:uppercase;fill:rgba(110,209,145,.8)}
/* the diagram's SVG text scales with the viewBox — at phone widths it renders
   at ~0.6x and the labels vanish, so bump the user-unit sizes to compensate
   (same trick as .axlab above). */
@media(max-width:640px){.mdiag .mf-mono,.mdiag .mf-faint,.mdiag .md-glab{font-size:12.5px}}
.mfine{margin-top:40px;border-top:1px solid var(--hair2);padding-top:24px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px clamp(24px,3vw,56px);max-width:1100px}
@media(max-width:760px){.mfine{grid-template-columns:1fr}}
.mfine h4{font:9.5px var(--mono);letter-spacing:.24em;text-transform:uppercase;color:var(--faint);font-weight:400}
.mfine p{font-size:12.5px;line-height:1.65;color:var(--dim);margin-top:6px;text-wrap:pretty}
`;

const JS = `
// Every load starts at the hero, full stop — the browser's own scroll-position
// restoration (on refresh, or navigating back) otherwise silently jumps
// scrollY to wherever it was last, which reads as pastMast and permanently
// retires the hero before the user ever sees it move.
if('scrollRestoration' in history)history.scrollRestoration='manual';
scrollTo({top:0,left:0,behavior:'instant'});
var D = JSON.parse(document.getElementById('data').textContent);
var FAMC = {a:'var(--fam-a)', o:'var(--fam-o)', g:'var(--fam-g)', d:'var(--fam-d)', k:'var(--fam-k)', x:'var(--fam-x)'};
var famOf = {Anthropic:'a', OpenAI:'o', Google:'g', DeepSeek:'d', Moonshot:'k', xAI:'x'};
var BRANDS = ${JSON.stringify(BRAND_PATHS)};
function el(h){var t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function normEnt(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[\\u2019\\u2018]/g,"'").replace(/\\s+/g,' ').trim().replace(/^(The|A|An) /i,'').toLowerCase()}
function rawNorm(s){return String(s).replace(/[*"“”]/g,'').replace(/\\s+/g,' ').trim().replace(/^(the|a|an) /i,'').toLowerCase()}
function canonEnt(domain,s){var m=D.aliases&&D.aliases[domain],mapped=(m&&m[rawNorm(s)])||s;return normEnt(mapped)}
var familyRuns=(function(){var runs=[];D.models.forEach(function(m){var last=runs[runs.length-1];if(last&&last.family===m.family)last.n++;else runs.push({family:m.family,n:1})});return runs})();

/* ---- ambient canon: slow architectural light ---- */
(function(){
  var canvas=document.getElementById('ambient');
  if(!canvas)return;
  var ctx=canvas.getContext('2d',{alpha:true}),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!ctx)return;
  var W=0,H=0,dpr=1,last=0,frame=0;
  function resize(){
    W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function architecture(t){
    var dx=Math.sin(t*.000035)*8,dy=Math.cos(t*.000027)*6;
    ctx.lineWidth=1;
    ctx.strokeStyle='rgba(233,230,221,.055)';
    ctx.beginPath();
    ctx.moveTo(W*.13+dx,H*.05);ctx.lineTo(W*.13+dx,H*.94);
    ctx.moveTo(W*.72-dx*.45,H*.08);ctx.lineTo(W*.72-dx*.45,H*.89);
    ctx.moveTo(W*.05,H*.73+dy);ctx.lineTo(W*.94,H*.73+dy);
    ctx.stroke();
    ctx.strokeStyle='rgba(233,230,221,.078)';
    ctx.strokeRect(W*.62+dx*.25,H*.16+dy*.2,W*.25,H*.42);
    ctx.beginPath();ctx.moveTo(W*.62+dx*.25,H*.37+dy*.2);ctx.lineTo(W*.87+dx*.25,H*.37+dy*.2);ctx.stroke();
  }
  function paint(t){
    ctx.clearRect(0,0,W,H);architecture(t);
  }
  function tick(t){
    last=t;paint(t);frame=requestAnimationFrame(tick);
  }
  resize();
  var running=false,heroOn=true;
  // One driver for the animation loop: it runs only while the hero is on
  // screen, the tab is visible, and the user hasn't asked for reduced motion.
  function sync(){
    var want=heroOn&&!document.hidden&&!reduce;
    if(want&&!running){running=true;last=0;frame=requestAnimationFrame(tick)}
    else if(!want&&running){running=false;cancelAnimationFrame(frame)}
  }
  if(reduce)paint(18000);else sync();
  addEventListener('resize',function(){resize();if(reduce)paint(18000)},{passive:true});
  document.addEventListener('visibilitychange',sync);
  // Past the intro (hero + method page) the canvas fades out and the loop
  // stops; scrolled back up (only possible before the intro is retired) it
  // fades back in and resumes. Both pages count as "the hero zone".
  var hero=document.getElementById('home'),mintro=document.getElementById('methodintro');
  if(hero&&'IntersectionObserver' in window){
    var vis={};
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){vis[en.target.id]=en.isIntersecting});
      heroOn=!!(vis.home||vis.methodintro);
      canvas.classList.toggle('off',!heroOn);
      sync();
    },{threshold:0});
    io.observe(hero);
    if(mintro)io.observe(mintro);
  }
})();

var tip=document.getElementById('tip');
document.addEventListener('mousemove',function(e){
  var t=e.target.closest('[data-tip]');
  if(!t){tip.style.opacity=0;return}
  tip.textContent=t.getAttribute('data-tip');tip.style.opacity=1;
  var x=e.clientX+14,y=e.clientY+14,r=tip.getBoundingClientRect();
  if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;
  if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;
  tip.style.left=x+'px';tip.style.top=y+'px';
});

/* cross-highlight: hovering any model reference dims everything else */
function wireHL(node,id){
  node.addEventListener('mouseenter',function(){
    document.documentElement.setAttribute('data-hl',id);
    document.querySelectorAll('[data-m="'+id+'"]').forEach(function(n){n.classList.add('hl')});
  });
  node.addEventListener('mouseleave',function(){
    document.documentElement.removeAttribute('data-hl');
    document.querySelectorAll('.hl').forEach(function(n){n.classList.remove('hl')});
  });
}

/* ---- 3D model map: models placed by their 3 principal vocabulary components,
   rotated by dragging, axes labelled by their pole words ---- */
(function(){
  var CX=320,CY=250,NS='http://www.w3.org/2000/svg';
  var svg=document.getElementById('mmap');
  if(!svg)return;
  function mk(tag,at,txt){var n=document.createElementNS(NS,tag);for(var k in at)n.setAttribute(k,at[k]);if(txt!=null)n.textContent=txt;return n}
  var pts=D.models.map(function(m){return {m:m,x:m.x,y:m.y,z:m.z}});
  var cx=0,cy=0,cz=0;pts.forEach(function(p){cx+=p.x;cy+=p.y;cz+=p.z});cx/=pts.length;cy/=pts.length;cz/=pts.length;
  var maxAbs=1e-6;pts.forEach(function(p){maxAbs=Math.max(maxAbs,Math.abs(p.x-cx),Math.abs(p.y-cy),Math.abs(p.z-cz))});
  var axisHalf=maxAbs*1.12, scale=176/axisHalf;
  var yaw=-0.62, pitch=-0.34;
  function rot(x,y,z){
    x-=cx;y-=cy;z-=cz;
    var cA=Math.cos(yaw),sA=Math.sin(yaw);
    var x1=x*cA+z*sA, z1=-x*sA+z*cA, y1=y;
    var cB=Math.cos(pitch),sB=Math.sin(pitch);
    return [x1, y1*cB-z1*sB, y1*sB+z1*cB];
  }
  function proj(x,y,z){var r=rot(x,y,z);return {sx:CX+r[0]*scale, sy:CY-r[1]*scale, d:r[2]};}
  function place(el,pr){
    var dx=pr.sx-CX,dy=pr.sy-CY,L=Math.hypot(dx,dy)||1;
    el.setAttribute('x',(pr.sx+dx/L*13).toFixed(1));
    el.setAttribute('y',(pr.sy+dy/L*13+3).toFixed(1));
    el.setAttribute('text-anchor', dx>4?'start':(dx<-4?'end':'middle'));
  }
  // three axis lines through the cloud centre, a pole label at each end
  var axesG=mk('g',{});svg.appendChild(axesG);
  var axisEls=D.axes.map(function(a){
    var line=mk('line',{'class':'axline'});
    var negL=mk('text',{'class':'axlab'},a.neg);
    var posL=mk('text',{'class':'axlab'},a.pos);
    negL.setAttribute('data-tip',a.neg+': '+a.negWords.slice(0,5).join(' \\u00b7 '));
    posL.setAttribute('data-tip',a.pos+': '+a.posWords.slice(0,5).join(' \\u00b7 '));
    axesG.appendChild(line);axesG.appendChild(negL);axesG.appendChild(posL);
    return {a:a,line:line,negL:negL,posL:posL};
  });
  var nodesG=mk('g',{});svg.appendChild(nodesG);
  var moved=false;
  var nodeEls=pts.map(function(p,i){
    var g=mk('g',{'class':'mnode'});
    g.setAttribute('data-m',p.m.id);
    g.setAttribute('data-tip',p.m.label+' \\u00b7 '+p.m.persona+' \\u2014 open dossier');
    g.appendChild(mk('circle',{cx:0,cy:0,r:15,fill:'none','class':'selring'}));
    g.appendChild(mk('circle',{cx:0,cy:0,r:11,fill:FAMC[famOf[p.m.family]],stroke:'var(--night)','stroke-width':2.5,'class':'mdot'}));
    g.appendChild(mk('text',{x:0,y:-16,'class':'mname'},p.m.short));
    g.addEventListener('click',function(){if(moved)return;openDossier(p.m.id,document.getElementById('mmdossier'))});
    wireHL(g,p.m.id);
    nodesG.appendChild(g);
    return {p:p,g:g};
  });
  function render(){
    axisEls.forEach(function(ax){
      var k=ax.a.k;
      var negP=proj(k==='x'?cx-axisHalf:cx, k==='y'?cy-axisHalf:cy, k==='z'?cz-axisHalf:cz);
      var posP=proj(k==='x'?cx+axisHalf:cx, k==='y'?cy+axisHalf:cy, k==='z'?cz+axisHalf:cz);
      ax.line.setAttribute('x1',negP.sx.toFixed(1));ax.line.setAttribute('y1',negP.sy.toFixed(1));
      ax.line.setAttribute('x2',posP.sx.toFixed(1));ax.line.setAttribute('y2',posP.sy.toFixed(1));
      place(ax.negL,negP);place(ax.posL,posP);
    });
    nodeEls.slice().sort(function(a,b){return proj(a.p.x,a.p.y,a.p.z).d-proj(b.p.x,b.p.y,b.p.z).d}).forEach(function(ne){
      var pr=proj(ne.p.x,ne.p.y,ne.p.z), t=(pr.d/axisHalf+1)/2;
      ne.g.style.transform='translate('+pr.sx.toFixed(1)+'px,'+pr.sy.toFixed(1)+'px)';
      ne.g.style.opacity=(0.5+0.5*t).toFixed(2);
      ne.g.querySelector('.mdot').setAttribute('r',(9+t*4.5).toFixed(1));
      ne.g.querySelector('.selring').setAttribute('r',(13+t*4.5).toFixed(1));
      nodesG.appendChild(ne.g); // re-append near-last so nearer dots draw on top
    });
  }
  var dragging=false,downX=0,downY=0,yaw0=0,pitch0=0,interacted=false;
  svg.addEventListener('pointerdown',function(e){
    dragging=true;moved=false;interacted=true;downX=e.clientX;downY=e.clientY;yaw0=yaw;pitch0=pitch;
  });
  svg.addEventListener('pointermove',function(e){
    if(!dragging)return;
    var dx=e.clientX-downX,dy=e.clientY-downY;
    if(!moved&&Math.abs(dx)+Math.abs(dy)>4){moved=true;svg.classList.add('grabbing');try{svg.setPointerCapture(e.pointerId)}catch(_){}}
    if(!moved)return;
    yaw=yaw0+dx*0.01;
    pitch=Math.max(-1.35,Math.min(1.35,pitch0+dy*0.01));
    render();
  });
  function endDrag(e){dragging=false;svg.classList.remove('grabbing');try{svg.releasePointerCapture(e.pointerId)}catch(_){}}
  svg.addEventListener('pointerup',endDrag);
  svg.addEventListener('pointercancel',endDrag);
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, spinning=false;
  function spin(){ if(!spinning)return; if(!interacted){yaw+=0.003;render();} requestAnimationFrame(spin); }
  window.mmActivate=function(){ render(); if(!reduce&&!spinning&&!interacted){spinning=true;requestAnimationFrame(spin);} };
  render();
  openDossier(D.models[0].id,document.getElementById('mmdossier'));
})();

/* ---- cabinet + dossier ---- */
var curDomain='book',curModel=(D.models.find(function(m){return m.id==='claude-fable-5'})||D.models[0]).id;
function closeCabinetDetail(){
  var detail=document.getElementById('cabdetail');
  detail.hidden=true;detail.innerHTML='';
  document.getElementById('drawerveil').hidden=true;
  document.querySelectorAll('.bo-cell.on').forEach(function(c){c.classList.remove('on')});
  document.querySelectorAll('.bo-col.sel').forEach(function(c){c.classList.remove('sel')});
}
// Fill the right-hand drawer with content and show it, prepending a close button.
function openDrawer(html){
  var detail=document.getElementById('cabdetail');
  detail.innerHTML='<button class="drawer-x" type="button" aria-label="Close">\\u00d7</button>'+html;
  detail.hidden=false;
  detail.scrollTop=0;
  document.getElementById('drawerveil').hidden=false;
  detail.querySelector('.drawer-x').addEventListener('click',closeCabinetDetail);
}
function choiceDistribution(id,domainId,probe){
  var rows=(((D.responses[id]||{})[domainId]||{})[probe]||[]),map={};
  rows.forEach(function(r){
    var k=canonEnt(domainId,r.e);if(!map[k])map[k]={e:r.e,n:0,rows:[],creators:{},forms:{}};map[k].n++;map[k].rows.push(r);
    map[k].forms[r.e]=(map[k].forms[r.e]||0)+1;
    if(r.c)map[k].creators[r.c]=(map[k].creators[r.c]||0)+1;
  });
  Object.keys(map).forEach(function(k){var rec=map[k];rec.c=Object.keys(rec.creators).sort(function(a,b){return rec.creators[b]-rec.creators[a]})[0]||'';
    rec.e=Object.keys(rec.forms).sort(function(a,b){return rec.forms[b]-rec.forms[a]})[0]||rec.e});
  return {rows:rows,map:map,n:rows.length};
}
function choiceMatrixHTML(domainId){
  var domain=D.domains.find(function(d){return d.id===domainId});
  var favD=D.models.map(function(m){return choiceDistribution(m.id,domainId,'f')});
  var ovrD=D.models.map(function(m){return choiceDistribution(m.id,domainId,'o')});
  var entities={};
  [favD,ovrD].forEach(function(distributions){
    distributions.forEach(function(dist,mi){Object.keys(dist.map).forEach(function(k){
      if(!entities[k])entities[k]={k:k,e:dist.map[k].e,c:dist.map[k].c,models:0,total:0,forms:{}};
      var rec=entities[k];
      Object.keys(dist.map[k].forms).forEach(function(f){rec.forms[f]=(rec.forms[f]||0)+dist.map[k].forms[f]});
      if(!rec.c&&dist.map[k].c)rec.c=dist.map[k].c;
      rec.total+=dist.map[k].n;
    })});
  });
  // Per (entity, model) net sentiment, computed once and reused for both the
  // sort order and the cell fill — so the row order always matches what the
  // colours show, never a separately-tallied number.
  Object.keys(entities).forEach(function(k){
    var n=0,scoreSum=0,cells=[];
    D.models.forEach(function(m,mi){
      var favRec=favD[mi].map[k],ovrRec=ovrD[mi].map[k];
      if(!favRec&&!ovrRec){cells.push(null);return}
      n++;
      var favPct=favRec?Math.round(100*favRec.n/Math.max(favD[mi].n,1)):0;
      var ovrPct=ovrRec?Math.round(100*ovrRec.n/Math.max(ovrD[mi].n,1)):0;
      scoreSum+=(favPct-ovrPct);
      cells.push({favPct:favPct,ovrPct:ovrPct});
    });
    entities[k].models=n;
    entities[k].avgScore=n?scoreSum/n:0;
    // Shrink toward neutral (0) by how few models weighed in, so a single
    // model's 100%-favourite outlier can't outrank something eight models
    // agree is merely very good. SHRINK_K=3 is the "how many mentions before
    // we mostly trust the average" knob — raise it to demand more agreement.
    entities[k].score=entities[k].avgScore*n/(n+3);
    entities[k].cells=cells;
  });
  var choices=Object.keys(entities).map(function(k){
    var rec=entities[k];
    // Row label: prefer the raw form that IS the canonical name (so a rolled-up
    // group shows "Ramen", not its dominant subtype "Tonkotsu Ramen"); if no
    // response used the canonical form itself, title-case the alias target.
    var forms=Object.keys(rec.forms).sort(function(a,b){return rec.forms[b]-rec.forms[a]});
    var native=forms.filter(function(f){return normEnt(f)===k});
    rec.e=native[0]||forms[0]||rec.e;
    if(!native.length){
      var am=D.aliases&&D.aliases[domainId],t=am&&am[rawNorm(rec.e)];
      if(t)rec.e=t.replace(/(^|[\\s.-])\\S/g,function(c){return c.toUpperCase()});
    }
    return rec;
  }).sort(function(a,b){return b.score-a.score||b.models-a.models||b.total-a.total||a.e.localeCompare(b.e)});
  var html='<section class="matrix-panel" data-domain="'+domainId+'"><div class="bo-scroll"><div class="bo-matrix" style="grid-template-columns:var(--labw,192px) repeat('+D.models.length+',56px)">'+
    '<div class="bo-famrow"></div>'+familyRuns.map(function(g){
      var mark=BRANDS[g.family]
        ?'<svg class="co-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="'+FAMC[famOf[g.family]]+'" d="'+BRANDS[g.family]+'"/></svg>'
        :'<i class="co-mono" style="background:'+FAMC[famOf[g.family]]+'">'+esc(g.family.charAt(0).toUpperCase())+'</i>';
      return '<div class="bo-fam" style="grid-column:span '+g.n+'"><span>'+esc(g.family)+'</span>'+mark+'</div>'
    }).join('')+
    '<div class="bo-corner">'+esc((domain&&domain.label)||domainId)+'</div>'+D.models.map(function(m,i){return '<div class="bo-col" data-m="'+m.id+'" role="button" tabindex="0" title="Open the '+esc(m.label)+' dossier"><span>'+esc(m.short)+'</span></div>'}).join('');
  choices.forEach(function(choice){
    html+='<div class="bo-rowlabel'+(choice.models>1?' shared':'')+'" role="button" tabindex="0" data-domain="'+domainId+'" data-e="'+esc(choice.e)+'" data-c="'+esc(choice.c||'')+'" title="'+esc(choice.e+(choice.c?' — '+choice.c:''))+'" aria-label="Open the '+esc(choice.e)+' card"><span class="bo-title">'+esc(choice.e)+'</span>'+(choice.c?'<small>'+esc(choice.c)+'</small>':'')+'</div>';
    D.models.forEach(function(m,mi){
      var cell=choice.cells[mi];
      if(!cell){html+='<div class="bo-cell"></div>';return}
      var probe=cell.favPct>=cell.ovrPct?'f':'o',p=Math.max(cell.favPct,cell.ovrPct),v=p/100;
      var alpha=(.05+v*.85).toFixed(3),rgb=probe==='f'?'110,209,145':'232,104,98';
      html+='<button class="bo-cell'+(v>=.45?' hi':'')+'" type="button" data-domain="'+domainId+'" data-m="'+m.id+'" data-e="'+esc(choice.e)+'" data-p="'+p+'" data-probe="'+probe+'" style="background:rgba('+rgb+','+alpha+')" aria-label="'+esc(m.short)+': '+esc(choice.e)+', '+(probe==='f'?'favourite':'overrated')+' in '+p+'% of responses">'+p+'%</button>';
    });
  });
  return html+'</div></div></section>';
}
function renderChoiceMatrices(){
  var wrap=document.getElementById('choicematrix');
  wrap.innerHTML=choiceMatrixHTML(curDomain);
  wrap.querySelectorAll('button.bo-cell').forEach(function(cell){cell.addEventListener('click',function(){
    openCabinetDetail(cell.getAttribute('data-m'),cell.getAttribute('data-e'),Number(cell.getAttribute('data-p')),cell.getAttribute('data-domain'),cell.getAttribute('data-probe'));cell.classList.add('on');
  })});
  // An entity's row label opens its entity card in the drawer.
  wrap.querySelectorAll('.bo-rowlabel[data-e]').forEach(function(lab){
    function open(){openEntityCard(lab.getAttribute('data-domain'),lab.getAttribute('data-e'),lab.getAttribute('data-c'))}
    lab.addEventListener('click',open);
    lab.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  });
  // A model's column header opens that model's full dossier in the drawer.
  wrap.querySelectorAll('.bo-col[data-m]').forEach(function(col){
    var mid=col.getAttribute('data-m');
    col.addEventListener('click',function(){openModelDossierInIndex(mid)});
    col.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openModelDossierInIndex(mid)}});
    wireHL(col,mid);
  });
}
function openModelDossierInIndex(id){
  openDrawer('<div class="dossier dossier-index"></div>');
  openDossier(id,document.querySelector('#cabdetail .dossier'));
  document.querySelectorAll('.bo-cell.on').forEach(function(c){c.classList.remove('on')});
}
// Strip the AI-disclaimer throat-clearing ("As an AI...", "I don't have
// personal preferences...", "That said,") off the front of a response so the
// drawer opens on the actual answer. Loops because the boilerplate often
// stacks two or three of these before the real sentence starts.
var CLIP_PATTERNS=[
  /^as an? (ai|a\\.i\\.|artificial intelligence|language model|llm|assistant|machine)\\b[^.!?]*[.!?]+["\\u201d)]?\\s*/i,
  /^i(?:'|\\u2019)?m an? (ai|artificial intelligence|language model|llm|assistant)\\b[^.!?]*[.!?]+["\\u201d)]?\\s*/i,
  /^i (do not|don['\\u2019]t|can not|can['\\u2019]t|cannot) (actually |really |truly |genuinely )?(have|possess|hold|form|feel|experience|perceive|develop)\\b[^.!?]*[.!?]+["\\u201d)]?\\s*/i,
  /^i (do not|don['\\u2019]t|can not|can['\\u2019]t|cannot)\\b[^.!?]*\\bthe way (a |an )?(you|humans?|people)\\b[^.!?]*[.!?]+["\\u201d)]?\\s*/i,
  /^i (do not|don['\\u2019]t) (actually |really |truly )?(have|experience|feel|perceive)\\b[^.!?]*?,\\s*(but|though|yet|so)\\s+/i,
  /^(that said|that being said|with that (said|caveat)|setting (that|this|those) aside|caveats? aside|still|however|but|honestly)[,\\u2014:]\\s*/i
];
function clipDisclaimer(t){
  var s=String(t).trim(),changed=true,guard=0;
  while(changed&&guard<6){
    changed=false;guard++;
    for(var i=0;i<CLIP_PATTERNS.length;i++){
      var next=s.replace(CLIP_PATTERNS[i],'');
      if(next!==s){s=next.trim();changed=true}
    }
  }
  if(!s)return String(t).trim();
  return s.charAt(0).toUpperCase()+s.slice(1);
}
// The entity card: a jacket-copy popup for a row of the index. Same drawer as
// the cell answers and model dossiers — blurb and extras up top, then the
// models' endorsements as pull quotes, dissents tucked below their own rule.
function openEntityCard(domainId,entity,creator){
  var k=canonEnt(domainId,entity);
  var card=D.entityCards&&D.entityCards[domainId+' '+k];
  if(!card)return; // no card generated for this entity — leave the row inert
  var domain=D.domains.find(function(d){return d.id===domainId});
  var extras=card.extras||{};
  // One quiet external-link arrow after the title, pointing at the entity's
  // primary destination: books to Amazon, video games to YouTube, everything
  // else to Wikipedia (falling back to whatever link the card does have).
  var links=extras.links||[];
  function findLink(re){for(var li=0;li<links.length;li++){if(re.test(links[li].url||'')||re.test(links[li].label||''))return links[li]}return null}
  var primary=domainId==='book'?findLink(/amazon/i):domainId==='videogame'?findLink(/youtube/i):findLink(/wikipedia/i);
  primary=primary||links[0]||null;
  var ext=primary?'<a class="ec-ext" href="'+esc(primary.url)+'" target="_blank" rel="noopener" title="'+esc(primary.label||'Open')+'" aria-label="'+esc(primary.label||'Open externally')+'">'+
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg></a>':'';
  var html='<div class="cd-reg">'+esc((domain&&domain.label)||domainId)+'</div>'+
    '<h3 class="cd-title">'+esc(entity||card.display)+ext+'</h3>'+
    (creator?'<div class="cd-creator">'+esc(creator)+'</div>':'');
  if(card.blurb)html+='<p class="ec-blurb">'+esc(card.blurb)+'</p>';
  // The card's own photograph, directly under the blurb. Falls back to the
  // legacy imgMap path (below, after the definition) only when there is none.
  var eimg=D.entityImages&&D.entityImages[domainId+' '+k];
  if(eimg&&eimg.uri){
    // no loading="lazy": the src is a data URI already in memory, and lazy
    // decode can defer indefinitely for a drawer that just opened.
    html+='<div class="ec-photo"><img src="'+eimg.uri+'" alt="'+esc(card.display||entity)+'"'+
      (eimg.credit?' title="'+esc(eimg.credit)+'"':'')+'></div>';
  }
  if(extras.definition){
    var dm=String(extras.definition).match(/^([a-z]{1,6}\\.)\\s+([\\s\\S]*)$/);
    html+='<div class="ec-def">'+(dm?'<i>'+esc(dm[1])+'</i> '+esc(dm[2]):esc(extras.definition))+'</div>';
  }
  if(!eimg&&extras.hasImage){
    var ik=D.imgMap[k]||D.imgMap[normEnt(card.display||entity)];
    var uri=ik&&D.images[ik];
    if(uri)html+='<div class="ec-img"><img src="'+uri+'" alt="'+esc(card.display||entity)+'" loading="lazy"></div>';
  }
  function att(mid){var m=D.models.find(function(x){return x.id===mid});return m?m.label:mid}
  function quotes(list,cls){return list.map(function(q){
    return '<blockquote class="ec-quote'+(cls?' '+cls:'')+'">\\u201c'+esc(q.quote)+'\\u201d<span class="ec-att">\\u2014 '+esc(att(q.model))+'</span></blockquote>';
  }).join('')}
  var ends=card.endorsements||[];
  var favs=ends.filter(function(q){return q.probe==='f'}),pans=ends.filter(function(q){return q.probe==='o'});
  if(favs.length)html+='<div class="ec-sect">endorsements</div>'+quotes(favs);
  if(pans.length)html+='<div class="ec-sect ec-sect-o">dissents</div>'+quotes(pans,'ec-quote-o');
  openDrawer(html);
  document.querySelectorAll('.bo-cell.on').forEach(function(c){c.classList.remove('on')});
  document.querySelectorAll('.bo-col.sel').forEach(function(c){c.classList.remove('sel')});
}
function openCabinetDetail(id,entity,pct,domainId,probe){
  curDomain=domainId||curDomain;
  var i=D.models.findIndex(function(x){return x.id===id}),m=D.models[i];
  var domain=D.domains.find(function(d){return d.id===curDomain});
  var rows=(((D.responses[id]||{})[curDomain]||{})[probe]||[]);
  // The one response shown is the model's own answer for this entity: the
  // longest (most complete) of the sampled responses that named it.
  var matches=rows.filter(function(r){return canonEnt(curDomain,r.e)===canonEnt(curDomain,entity)});
  var primary=matches.slice().sort(function(a,b){return b.t.length-a.t.length})[0]||rows[0];
  openDrawer(
    '<div class="cd-reg cd-reg-'+probe+'">'+(probe==='f'?'favourite ':'overrated ')+esc((domain&&domain.label)||curDomain)+'</div>'+
    '<h3 class="cd-title">'+esc(entity)+'</h3>'+
    (primary&&primary.c?'<div class="cd-creator">'+esc(primary.c)+'</div>':'')+
    '<div class="cd-model"><i class="fam-dot" style="background:'+FAMC[famOf[m.family]]+'"></i><span>'+esc(m.label)+'</span></div>'+
    '<div class="cd-share">chosen in '+pct+'% of sampled answers</div>'+
    (primary?'<blockquote class="cd-primary">'+esc(clipDisclaimer(primary.t))+'</blockquote>':'<p class="cd-primary">Explanation awaiting extraction.</p>'));
  document.querySelectorAll('.bo-cell.on').forEach(function(c){c.classList.remove('on')});
}
// The left rail: every category with its fields; one field's matrix shows at a time.
function setDomain(did){
  curDomain=did;
  document.querySelectorAll('.idx-dom').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-d')===did)});
  closeCabinetDetail();
  renderChoiceMatrices();
}
(function(){
  var rail=document.getElementById('idxrail');
  D.domainGroups.forEach(function(group){
    // Only ids with collected data render; a group with none renders nothing.
    // Ids awaiting collection slot in automatically once summarized.
    var present=group.ids.filter(function(did){return D.domains.some(function(x){return x.id===did})});
    if(!present.length)return;
    rail.appendChild(el('<div class="idx-cat">'+esc(group.label)+'</div>'));
    present.forEach(function(did){
      var d=D.domains.find(function(x){return x.id===did});
      var b=el('<button class="idx-dom" type="button" data-d="'+did+'">'+esc(d.label)+'</button>');
      b.addEventListener('click',function(){setDomain(did)});
      rail.appendChild(b);
    });
  });
})();
document.getElementById('drawerveil').addEventListener('click',closeCabinetDetail);
addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!document.getElementById('cabdetail').hidden)closeCabinetDetail();
});
// suggest-a-category: posts to the Vercel function; on hosts whose CSP blocks
// the request (the claude.ai artifact) it degrades to pointing at the live site
(function(){
  var form=document.getElementById('sugform');
  if(!form)return;
  var status=document.getElementById('sugstatus'),btn=document.getElementById('sugbtn');
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var s=document.getElementById('suginput').value.trim(),n=document.getElementById('sugnote').value.trim();
    if(s.length<2){status.textContent='Name a category first.';return}
    btn.disabled=true;status.textContent='Sending…';
    var api=location.hostname==='ai-aesthetics.vercel.app'?'/api/recommend':'https://ai-aesthetics.vercel.app/api/recommend';
    fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({suggestion:s,note:n})})
      .then(function(r){
        if(!r.ok)throw 0;
        status.textContent='Received — thank you. It goes on the list for the next collection run.';
        form.reset();
      })
      .catch(function(){
        status.innerHTML='Could not send from this page — file it from the live site at '+
          '<a href="https://ai-aesthetics.vercel.app" target="_blank" rel="noopener">ai-aesthetics.vercel.app</a>.';
      })
      .then(function(){btn.disabled=false});
  });
})();
function dossierHTML(id){
  var i=D.models.findIndex(function(x){return x.id===id});
  var m=D.models[i];
  var q=m.quote?'<blockquote>\\u201c'+esc(m.quote.t)+'\\u201d<span class="src">on its favourite '+esc(m.quote.d.toLowerCase())+'</span></blockquote>':'';
  var sig=m.sig.map(function(w){return '<span class="sigw">'+esc(w)+'</span>'}).join('');
  // the full preference sheet: this specimen's favourite in every domain
  var favRows=D.domains.map(function(d){
    var cell=D.cells[d.id][id].f;
    var val=(!cell||!cell.length)?'<span class="pending">\\u2014 awaiting samples</span>'
      :'<b>'+esc(cell[0][0])+'</b> <span class="fpct">'+cell[0][1]+'%</span>';
    return '<div class="fitem"><span class="fdom">'+esc(d.label)+'</span><span class="fval">'+val+'</span></div>';
  }).join('');
  return '<div class="reg">'+esc(m.family)+'</div>'+
    '<div class="dname"><i class="fam-dot" style="background:'+FAMC[famOf[m.family]]+'"></i>'+esc(m.label)+'</div>'+
    '<div class="persona">'+esc(m.persona)+'</div>'+
    '<div class="sigwords">'+sig+'</div>'+
    '<div class="dtop"><div>'+q+'</div>'+
    '<div><dl>'+
    '<dt>fixity</dt><dd><b>'+m.fixity.toFixed(2)+'</b> (1 = same answer every time)</dd>'+
    '<dt>distinct picks</dt><dd><b>'+m.distinct+'%</b> of sampled answers</dd>'+
    (m.refuse?'<dt>declined</dt><dd><b>'+m.refuse+'%</b> of asks</dd>':'')+
    '</dl></div></div>'+
    '<div class="dfavs-h">Its favourites, all domains</div>'+
    '<div class="dfavs">'+favRows+'</div>';
}
// Render a model's dossier into a target container and mark the matching map
// dot / column header as selected across both views.
function openDossier(id,target){
  curModel=id;
  var box=target||document.getElementById('mmdossier');
  box.innerHTML=dossierHTML(id);
  document.querySelectorAll('.mnode').forEach(function(n){n.classList.toggle('sel',n.getAttribute('data-m')===id)});
  // only mark the index column when the dossier is actually open in the drawer
  var inDrawer=box.closest&&box.closest('#cabdetail');
  document.querySelectorAll('.bo-col[data-m]').forEach(function(n){n.classList.toggle('sel',!!inDrawer&&n.getAttribute('data-m')===id)});
}
/* ---- views: the hero is a one-way gate into the index; the side drawer switches scenes ---- */
var viewbar=document.querySelector('.viewbar');
var mast=document.getElementById('home');
var mpage=document.getElementById('methodintro');
var committed=false;
// The intro is two full-viewport pages — the hero and the method page. The
// first time the user scrolls past BOTH, the whole intro is retired for good
// — collapsed out
// of the flow (not just hidden) and the page is pinned to its very top, so you
// always land at the start of the index rather than wherever the scroll gesture
// happened to be (computing an exact offset to "preserve" position depends on
// layout timing that isn't reliable across browsers — landing at a fixed,
// known-good position is simpler and can't drift).
// Instant, snap-proof jump to the top. CSS scroll-behavior:smooth makes bare
// scrollTo(0,0) an animated (cancelable) scroll — behavior:'instant' overrides
// that and also aborts any scroll animation already in flight.
function pinTop(){
  scrollTo({top:0,left:0,behavior:'instant'});
}
function commitPastHero(){
  if(committed||!mast)return;
  committed=true;
  // Kill the snap FIRST: the mandatory snap animation that carried the user
  // past the intro is still in flight, aimed at a target computed before the
  // intro collapsed — on short viewports it used to strand the index deep in
  // the matrix (the Catcher-in-the-Rye-first bug). Removing snap-type cancels
  // it, and with one section left the snap gate has done its job anyway.
  document.documentElement.style.scrollSnapType='none';
  mast.style.display='none';
  if(mpage)mpage.style.display='none';
  pinTop();
  // The flick that committed usually still has trackpad momentum behind it;
  // with the page pinned and unlocked, those residual wheel ticks would carry
  // the index deep into the matrix. Swallow wheel/touchmove until they go
  // quiet for a beat. Commit-anchored and self-limiting (hard cap), so a later
  // deliberate scroll is never touched.
  (function(){
    var quiet=null,hard=null;
    function stop(){
      removeEventListener('wheel',eat,true);
      removeEventListener('touchmove',eat,true);
      clearTimeout(quiet);clearTimeout(hard);
    }
    function eat(e){
      e.preventDefault();
      clearTimeout(quiet);
      quiet=setTimeout(stop,160);
    }
    addEventListener('wheel',eat,{passive:false,capture:true});
    addEventListener('touchmove',eat,{passive:false,capture:true});
    quiet=setTimeout(stop,160);
    hard=setTimeout(stop,1500);
  })();
}
// Bottom of the whole intro (hero + method page) in document coordinates.
function introEnd(){
  var last=mpage||mast;
  return last.offsetTop+last.offsetHeight;
}
function updateViewbar(){
  if(!viewbar)return;
  if(!committed&&mast&&scrollY>=introEnd()-2)commitPastHero();
  var ready=committed;
  document.body.classList.toggle('nav-ready',ready);
  viewbar.classList.toggle('show',ready);
  viewbar.setAttribute('aria-hidden',ready?'false':'true');
  viewbar.querySelectorAll('button').forEach(function(b){b.tabIndex=ready?0:-1});
}
function setView(id,scroll){
  document.querySelectorAll('section.view').forEach(function(v){v.classList.toggle('active',v.id===id)});
  document.querySelectorAll('.viewbar [data-view]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-view')===id)});
  viewbar.classList.toggle('idx-on',id==='cabinet');
  if(id==='modelmap'&&window.mmActivate)window.mmActivate();
  // Every view starts at its top. Only the active section is displayed, so the
  // top of the view IS the top of the page once the hero has been retired.
  if(scroll)pinTop();
}
document.querySelectorAll('.viewbar [data-view]').forEach(function(b){
  b.addEventListener('click',function(){
    setView(b.getAttribute('data-view'),true);
    updateViewbar();
  });
});
// The hero cue advances to the next page of the intro — the method page —
// not past it. (If the method page is somehow gone, fall back to committing.)
document.getElementById('cue').addEventListener('click',function(){
  if(mpage&&!committed){
    mpage.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    return;
  }
  setView('cabinet',false);
  commitPastHero();
  updateViewbar();
});
setView('cabinet',false);
addEventListener('scroll',updateViewbar,{passive:true});
addEventListener('resize',updateViewbar);
updateViewbar();

/* ---- masthead interview: one specimen per visit, all its favourites ---- */
(function(){
  var m=D.models[Math.floor(Math.random()*D.models.length)];
  var pairs=[];
  D.domains.forEach(function(d){
    var cell=D.cells[d.id][m.id].f;
    if(!cell||!cell.length)return;
    var noun=d.label.toLowerCase();
    if(noun==='color')noun='colour';
    pairs.push(['your favourite '+noun+'?',cell[0][0]+'.']);
  });
  for(var k=pairs.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1));var t=pairs[k];pairs[k]=pairs[j];pairs[j]=t}
  var qa=document.getElementById('qa'),q=document.getElementById('qaq'),a=document.getElementById('qaa'),by=document.getElementById('qaby'),i=0;
  by.textContent='\u2014 '+m.short;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    q.textContent=pairs[0][0];a.textContent=pairs[0][1];
    qa.classList.add('show-q','show-a');return;
  }
  function cycle(){
    if(committed)return; // hero retired for the session — stop animating behind the scenes
    var pr=pairs[i%pairs.length];i++;
    q.textContent=pr[0];a.textContent=pr[1];
    qa.classList.add('show-q');
    setTimeout(function(){if(!committed)qa.classList.add('show-a')},1500);
    setTimeout(function(){if(!committed)qa.classList.remove('show-q','show-a')},5900);
    setTimeout(function(){if(!committed)cycle()},7000);
  }
  cycle();
})();

setDomain(curDomain);
openDossier(curModel);
// Belt-and-suspenders: some browsers apply scroll restoration slightly after
// this script has already run. If nothing has genuinely scrolled us past the
// hero by the time the page finishes loading, force back to the very top.
addEventListener('load',function(){if(!committed)scrollTo({top:0,left:0,behavior:'instant'})});

/* ---- the quiz: match a person against the specimens, offline ---- */
(function(){
  var QLABEL={book:'favourite novel',film:'favourite film',album:'favourite album',city:'favourite city',
    painting:'favourite painting',word:'favourite word',object:'favourite everyday object',cuisine:'favourite cuisine'};
  var grid=document.getElementById('quizgrid');
  if(!grid)return; // quiz section currently removed
  D.quiz.forEach(function(d){
    grid.appendChild(el('<div class="qz" data-d="'+d+'">'+
      '<div class="qz-l">'+QLABEL[d]+'</div>'+
      '<input type="text" class="what" autocomplete="off" placeholder="\u2014">'+
      '<input type="text" class="why" autocomplete="off" placeholder="and why, in a few words">'+
      '</div>'));
  });

  function tokens(t){
    t=normEnt(t).replace(/[^a-z\\s-]/g,' ');
    var ws=t.split(/\\s+/).filter(function(w){return w.length>=3});
    var out=ws.slice();
    for(var i=0;i<ws.length-1;i++)out.push(ws[i]+' '+ws[i+1]); // bigrams: "visual harmony"
    return out;
  }
  var lexMap={};
  D.lex.forEach(function(e){lexMap[e[0]]={x:e[1],y:e[2],c:e[3]}});
  var N=D.models.length;

  document.getElementById('quizgo').addEventListener('click',function(){
    var pick=new Array(N).fill(0), voc=new Array(N).fill(0);
    var px=0,py=0,pw=0,answered=0;
    document.querySelectorAll('.qz').forEach(function(row){
      var d=row.getAttribute('data-d');
      var what=normEnt(row.querySelector('.what').value||'');
      var why=(row.querySelector('.why').value||'');
      if(what)answered++;
      // 1. pick affinity: does this person's pick appear among a model's sampled answers?
      if(what.length>2){
        D.models.forEach(function(m,mi){
          var cell=D.cells[d][m.id].f||[];
          cell.forEach(function(pr,rank){
            var cand=normEnt(pr[0]);
            if(cand===what||cand.indexOf(what)>=0||what.indexOf(cand)>=0){
              pick[mi]+=[1,0.75,0.5][rank]*(pr[1]/100);
            }
          });
        });
      }
      // 2. vocabulary affinity: their reasons, in the study's own descriptor space
      tokens(what+' '+why).forEach(function(w){
        var e=lexMap[w];
        if(!e)return;
        var tot=e.c.reduce(function(a,b){return a+b},0);
        if(!tot)return;
        var wgt=Math.min(1,tot/5);
        e.c.forEach(function(c,mi){voc[mi]+=(c/tot-1/N)*wgt});
        px+=e.x*wgt;py+=e.y*wgt;pw+=wgt;
      });
    });
    if(!answered)return;
    var score=D.models.map(function(m,i){return 1.6*pick[i]+voc[i]});
    var lo=Math.min.apply(0,score),hi=Math.max.apply(0,score);
    var order=score.map(function(v,i){return [v,i]}).sort(function(a,b){return b[0]-a[0]});
    var win=D.models[order[0][1]], second=D.models[order[1][1]];
    var vb=D.models.map(function(m,i){
      var t=hi>lo?(score[i]-lo)/(hi-lo):0;
      return '<div class="vbar"><span>'+esc(m.short)+'</span><div class="t"><i style="width:'+(8+92*t).toFixed(0)+'%;background:'+FAMC[famOf[m.family]]+'"></i></div></div>';
    }).join('');
    // mini-map: centroids + you, same PC space
    var mapHtml='';
    if(pw>0){
      var ux=px/pw,uy=py/pw;
      var xs=D.models.map(function(m){return m.x}).concat([ux]),ys=D.models.map(function(m){return m.y}).concat([uy]);
      var x0=Math.min.apply(0,xs),x1=Math.max.apply(0,xs),y0=Math.min.apply(0,ys),y1=Math.max.apply(0,ys);
      var MW=420,MH=300,MP=42;
      var sx=function(x){return MP+(x-x0)/((x1-x0)||1)*(MW-2*MP)},sy=function(y){return MH-MP-(y-y0)/((y1-y0)||1)*(MH-2*MP)};
      var pts=D.models.map(function(m,i){
        return '<circle cx="'+sx(m.x).toFixed(1)+'" cy="'+sy(m.y).toFixed(1)+'" r="6" fill="'+FAMC[famOf[m.family]]+'" fill-opacity="'+(m.id===win.id?1:0.45)+'"/>'+
          (m.id===win.id?'<text x="'+sx(m.x).toFixed(1)+'" y="'+(sy(m.y)-12).toFixed(1)+'" class="youlab" style="fill:var(--dim)">'+esc(m.short)+'</text>':'');
      }).join('');
      mapHtml='<div class="vmap"><svg viewBox="0 0 '+MW+' '+MH+'">'+pts+
        '<circle class="youdot" cx="'+sx(ux).toFixed(1)+'" cy="'+sy(uy).toFixed(1)+'" r="8"/>'+
        '<text x="'+sx(ux).toFixed(1)+'" y="'+(sy(uy)-14).toFixed(1)+'" class="youlab">YOU</text>'+
        '</svg><div class="vmap-cap">Your reasons, projected into the same vocabulary space as the specimens.</div></div>';
    }
    var conf=order[0][0]-order[1][0];
    var note=pw>0
      ? 'Judged on '+answered+' answers and the vocabulary of your reasons'+(conf<0.15?' \u2014 a close call with '+second.short+'.':'.')
      : 'Judged on your picks alone \u2014 add a few words of why for a sharper reading.';
    var v=document.getElementById('verdict');
    v.innerHTML='<div><div class="v-pre">The atlas finds</div>'+
      '<div class="v-name"><i style="background:'+FAMC[famOf[win.family]]+'">'+(D.models.indexOf(win)+1)+'</i>You are '+esc(win.label)+'</div>'+
      '<div class="v-persona">'+esc(win.persona)+'</div>'+
      '<div class="v-note">'+note+'</div>'+
      '<div class="vbars">'+vb+'</div></div>'+
      (mapHtml||'');
    v.hidden=false;
    v.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  });
})();
`;

const BODY = `
<canvas id="ambient" aria-hidden="true"></canvas>
<main>
<header class="mast" id="home">
  <h1>A Field Study <em>in Machine Taste</em></h1>
  <div class="heroq">
    <div class="qa" id="qa" aria-hidden="true">
      <div class="qa-q" id="qaq"></div>
      <div class="qa-a" id="qaa"></div>
      <div class="qa-by" id="qaby"></div>
    </div>
  </div>
  <button class="cue" id="cue" type="button" aria-label="Continue to the method and the index">
    <span>begin</span><i></i>
  </button>
</header>

${methodPage}

<section id="modelmap" class="view">
  <div class="shead"><span class="sno">I</span><h2>The model map</h2></div>
  <p class="gloss">Every model, placed by the vocabulary it uses to justify its taste — nearby models
  praise things the same way. Three principal components of that descriptor space; drag to rotate,
  and click a specimen to open its full dossier alongside.</p>
  <div class="atlasgrid">
    <div>
      <div class="atlas-wrap"><svg id="mmap" viewBox="0 0 640 520" role="img" aria-label="Rotatable 3D map of AI models in aesthetic-vocabulary space"></svg></div>
      <div class="atlas-foot">
        <p class="atlas-note" id="atlasnote">Drag the map to rotate it. Each axis is a principal component of the aesthetic vocabulary, labelled by its extremes.</p>
      </div>
    </div>
    <div class="dossier" id="mmdossier"></div>
  </div>
</section>

<section id="canon" class="view">
  <div class="shead"><span class="sno">II</span><h2>The consensus canon</h2></div>
  <p class="gloss">Where machine taste converges — the answers that different companies' models,
  trained on different data by different hands, arrive at independently.</p>
  <div class="canon" style="margin-top:26px">${consFav.map((c) => canonCard(c, c.n2 ? 'also called overrated' : '')).join('')}</div>
</section>

<section id="cabinet" class="view">
  <div class="indexgrid" id="indexstart">
    <aside class="idx-rail" id="idxrail" aria-label="Fields"></aside>
    <div class="idx-main">
      <div class="choicematrix" id="choicematrix"></div>
    </div>
  </div>
  <div class="drawer-veil" id="drawerveil" hidden></div>
  <aside class="cabdetail" id="cabdetail" aria-live="polite" hidden></aside>
</section>


<section id="method" class="view">
  <div class="shead"><span class="sno">III</span><h2>The method</h2></div>
  <p class="gloss">${seasonLine} This is how those answers were gathered.</p>
  ${methodSentence}
  ${methodDiagram('b')}
  ${methodFine}
</section>

<section id="suggest" class="view">
  <div class="shead"><span class="sno">IV</span><h2>Suggest a category</h2></div>
  <p class="gloss">The index grows one field at a time — novel, smell, monument, philosopher. If there is
  a domain of taste you want the twelve models probed on, name it here.</p>
  <form class="sugform" id="sugform">
    <div><label for="suginput">Category</label>
    <input id="suginput" maxlength="200" placeholder="film director, perfume, board game…" autocomplete="off" required></div>
    <div><label for="sugnote">Why it would be telling <em>(optional)</em></label>
    <textarea id="sugnote" maxlength="500"></textarea></div>
    <button class="sugbtn" id="sugbtn" type="submit">Send it in</button>
    <p class="sugstatus" id="sugstatus" aria-live="polite"></p>
  </form>
</section>

<nav class="viewbar" id="viewbar" aria-label="Views">
  <button class="viewlink on" type="button" data-view="cabinet"><span>Index</span></button>
  <button class="viewlink" type="button" data-view="modelmap"><span>Model map</span></button>
  <button class="viewlink" type="button" data-view="method"><span>Method</span></button>
  <button class="viewlink" type="button" data-view="suggest"><span>Suggest</span></button>
  <div class="spectrum" aria-label="Cell colour scale: green is favourite, red is overrated">
    <span>favourite</span><i></i><span>overrated</span>
  </div>
</nav>

</main>

<div id="tip" role="status"></div>
`;

const standalone = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Aesthetic Taste of AI Models</title>
<style>${CSS}</style></head><body>
<script type="application/json" id="data">${dataJSON}</script>
${BODY}
<script>${JS}</script>
</body></html>`;
writeFileSync(join(here, '..', 'report', 'site.html'), standalone);

const artifact = `<title>The Aesthetic Taste of AI Models</title>
<style>${CSS}</style>
<script type="application/json" id="data">${dataJSON}</script>
${BODY}
<script>${JS}</script>`;
writeFileSync(join(here, '..', 'report', 'artifact.html'), artifact);
console.log(`site written (${Math.round(standalone.length / 1024)}KB)`);
