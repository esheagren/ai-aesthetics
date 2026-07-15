// Fetch a representative image for (nearly) every entity in the study,
// from Wikipedia lead images, into data/entityimages.json.
//
// Keys match data/entitycards.json exactly ("<domain> <canonNorm>") — we
// enumerate entities straight from entitycards.json, so keys are inherited,
// not recomputed. Creator info is cross-referenced from data/extracted.jsonl
// (same norm() + aliases.json canonicalization as analyze.js/entitycards.js)
// for disambiguation and person-page fallbacks.
//
// Strategy per entity:
//   1. REST summary for the display title; validate the summary looks like
//      the right KIND of thing (domain-specific regex over description+extract,
//      or creator surname present).
//   2. If 404 / disambiguation / implausible: try "<display> (<qualifier>)",
//      then the search API ("<display> <domain hint>"), validating each hit.
//   3. If the resolved page has no image and we know a creator, fall back to
//      the creator's page (poem -> poet portrait, etc.).
// A wrong image is worse than none: unvalidated matches become misses.
//
// Images: thumbnail rewritten to ~480px, recompressed via `sips` to JPEG
// (quality 45, max dim 480), stored as base64 data URIs:
//   { uri, page, credit, w, h }
// Misses are recorded in a `_misses` array so re-runs don't re-attempt them.
//
// Usage: node src/fetch-entity-images.mjs [domain ...] [--retry-misses]
// Resumable: keys already present in the output are skipped. New domains
// appearing later in entitycards.json (tvshow, actor, ...) are picked up
// automatically on re-run.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const CARDS = join(here, '..', 'data', 'entitycards.json');
const EXTRACTED = join(here, '..', 'data', 'extracted.jsonl');
const ALIASES = join(here, '..', 'data', 'aliases.json');
const OUT = join(here, '..', 'data', 'entityimages.json');
const RAW_DIR = process.env.ENTITY_IMG_TMP || join(tmpdir(), 'entity-images-raw');
mkdirSync(RAW_DIR, { recursive: true });

const UA =
  'ai-aesthetics-research/0.2 (personal research project on AI aesthetic judgments; contact: esheagren1995@gmail.com)';
const CONCURRENCY = 3;
const DELAY_MS = 250;
const THUMB_WIDTH = Number(process.env.ENTITY_IMG_WIDTH || 480);
const JPEG_QUALITY = Number(process.env.ENTITY_IMG_QUALITY || 45);

// Domains that don't want an image at all.
const SKIP_DOMAINS = new Set(['word', 'color', 'season', 'smell', 'decade']);

// ---- normalization: MUST match analyze.js / entitycards.js exactly ----
const norm = (s) =>
  s?.replace(/[*"“”]/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /i, '').toLowerCase() ?? null;
const aliases = existsSync(ALIASES) ? JSON.parse(readFileSync(ALIASES, 'utf8')) : {};
const canon = (domain, n) => (n && aliases[domain]?.[n]) || n;

// ---- domain knowledge for resolution ----
// qualifier: parenthetical to try as a direct title ("Portal (video game)")
// hint: extra search term
// validate: regex the summary (description + extract head) must match
const PERSON_RE =
  /\b(poet|writer|author|novelist|philosopher|architect|essayist|playwright|artist|composer|singer|actor|actress|director)\b/;
const DOMAIN_CFG = {
  novelist: { validate: /\b(novelist|writer|author)\b/, hint: 'novelist', person: true },
  philosopher: { validate: /\bphilosoph/, hint: 'philosopher', person: true },
  architect: { validate: /\barchitect/, hint: 'architect', person: true },
  painting: { validate: /\b(painting|painted|portrait|mural|canvas|oil on|woodblock print|artwork)\b/, qualifier: 'painting', hint: 'painting' },
  artmovement: { validate: /\b(movement|art|artistic|style|period|genre)\b/, hint: 'art movement' },
  building: { validate: /\b(building|tower|museum|cathedral|church|chapel|basilica|opera house|skyscraper|library|pyramid|mosque|institute|structure|temple|house|residence|hall)\b/, hint: 'building' },
  monument: { validate: /\b(monument|memorial|statue|sculpture|ruin|citadel|fortress|wall|arch|fountain|stairway|steps|tower|palace|temple|stupa|observator|cemetery|landmark|mausoleum|megalith|site|complex|basilica|church|painting|sign)\b/, hint: 'monument' },
  city: { validate: /\b(city|capital|town|metropolis|municipality)\b/, hint: 'city' },
  uscity: { validate: /\b(city|capital|town|metropolis|municipality)\b/, hint: 'city' },
  street: { validate: /\b(street|avenue|boulevard|road|square|promenade|thoroughfare|walk|walkway|passage|strip|alley|lane|esplanade|shopping|pedestrian)\b/, hint: 'street' },
  film: { validate: /\bfilm\b/, qualifier: 'film', hint: 'film' },
  album: { validate: /\b(album|composition|ballet|musical work|LP|EP)\b/i, qualifier: 'album', hint: 'album' },
  videogame: { validate: /\b(video ?game|game)\b/, qualifier: 'video game', hint: 'video game' },
  book: { validate: /\b(novel|book|memoir|novella|trilogy|series|fiction)\b/, qualifier: 'novel', hint: 'novel' },
  dish: { validate: /\b(dish|food|cuisine|soup|noodle|stew|cake|dessert|pizza|pasta|salad|sandwich|rice|bread|sauce|delicacy|meal|roll|curry|beef|pork|chicken|seafood|lobster|crustacean|egg|cheese|taco|duck|dumpling|hotpot|pastry|confection|meringue|cookie|biryani|barbecue|steak|fries|toast)\b/, hint: 'dish' },
  cuisine: { validate: /\b(cuisine|culinary|cooking|food|dish|pizza|noodle)\b/, hint: 'cuisine' },
  object: { validate: /./, hint: '' }, // objects are heterogeneous; accept any real article
  religioustext: { validate: /\b(text|scripture|book|gospel|sutra|classic|testament|bible|canon|chapter|psalm|epic|poem|scriptural)\b/, hint: 'religious text' },
  typeface: { validate: /\b(typeface|font|serif|sans)\b/, qualifier: 'typeface', hint: 'typeface' },
  poem: { validate: /\b(poem|poetry|sonnet|ballad|villanelle|elegy|ode|epic|verse|lyric)\b/, qualifier: 'poem', hint: 'poem' },
  // future domains (no cards yet) — picked up automatically when cards exist
  tvshow: { validate: /\b(television|TV series|sitcom|drama series|miniseries|streaming)\b/i, qualifier: 'TV series', hint: 'television series' },
  actor: { validate: /\bactor\b/, hint: 'actor', person: true },
  actress: { validate: /\bactress\b/, hint: 'actress', person: true },
  play: { validate: /\b(play|tragedy|comedy|drama|theatre|theater)\b/, qualifier: 'play', hint: 'play' },
  musical: { validate: /\b(musical|opera|operetta|stage)\b/, qualifier: 'musical', hint: 'musical' },
};
const DEFAULT_CFG = { validate: /./, hint: '' };

// Curated overrides for entities whose right article exists under a name the
// conservative matcher can't safely accept (brand pages, redirect-less
// synonyms), or whose best image lives on Commons without an article
// (Kandinsky's Composition VIII). `image` (optional) is an explicit URL used
// instead of the page's own lead image.
const OVERRIDES = {
  'object aeropress coffee maker': { title: 'AeroPress' },
  'object chemex coffee maker': { title: 'Chemex Coffeemaker' },
  'object moleskine classic notebook': { title: 'Moleskine' },
  'object nespresso capsule coffee machine': {
    title: 'Nespresso',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Nespressso_Machine.jpg?width=500',
  },
  'object blackwing pencil': { title: 'Blackwing 602' },
  'object wooden clothespin': { title: 'Clothespin' },
  'object single-serve coffee maker': { title: 'Single-serve coffee container' },
  'monument great stupa at sanchi': { title: 'Sanchi' },
  // blurb-verified disambiguations: the Roman Pantheon (not Paris), the London
  // street (not the album), the Copenhagen statue (not the fairy tale)
  'monument pantheon': { title: 'Pantheon, Rome' },
  'street abbey road': { title: 'Abbey Road, London' },
  'monument little mermaid': { title: 'The Little Mermaid (statue)' },
  'dish mala sichuan hotpot': { title: 'Hot pot' },
  'painting composition viii': {
    title: 'Wassily Kandinsky',
    image:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg?width=500',
  },
};

// ---- load inputs ----
const cards = JSON.parse(readFileSync(CARDS, 'utf8'));

// creator lookup: "<domain> <canonNorm>" -> most frequent creator string
const creatorOf = new Map();
if (existsSync(EXTRACTED)) {
  const counts = new Map(); // key -> Map(creator -> n)
  for (const line of readFileSync(EXTRACTED, 'utf8').split('\n')) {
    if (!line) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (!r.entity || !r.domain || !r.creator) continue;
    const key = `${r.domain} ${canon(r.domain, norm(r.entity))}`;
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key);
    m.set(r.creator, (m.get(r.creator) || 0) + 1);
  }
  for (const [key, m] of counts) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) creatorOf.set(key, best[0]);
  }
}

// ---- CLI args ----
const args = process.argv.slice(2);
const retryMisses = args.includes('--retry-misses');
const domainFilter = new Set(args.filter((a) => !a.startsWith('-')));

// ---- output state (resumable) ----
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
if (!Array.isArray(out._misses)) out._misses = [];
const missKeys = new Set(out._misses.map((m) => m.key));

// ---- HTTP helpers: polite, retried ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url, kind = 'json') {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, accept: kind === 'json' ? 'application/json' : '*/*' } });
    } catch (err) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (res.status === 404) return { status: 404 };
    if (res.status === 429 || res.status >= 500) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return { status: res.status };
    if (kind === 'json') {
      try { return { status: 200, data: await res.json() }; }
      catch { return { status: 0 }; }
    }
    return { status: 200, buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || '' };
  }
  return { status: 0 };
}

async function fetchSummary(title) {
  const t = encodeURIComponent(title.replace(/ /g, '_'));
  const r = await politeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}?redirect=true`);
  await sleep(DELAY_MS);
  if (r.status !== 200 || !r.data) return null;
  return r.data;
}

async function searchTitles(query, limit = 4) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;
  const r = await politeFetch(u);
  await sleep(DELAY_MS);
  if (r.status !== 200 || !r.data) return [];
  return (r.data.query?.search || []).map((s) => s.title);
}

// ---- plausibility ----
function summaryText(sum) {
  return `${sum.description || ''} ${String(sum.extract || '').slice(0, 400)}`.toLowerCase();
}
function plausible(sum, cfg, creator) {
  if (!sum || sum.type === 'disambiguation') return false;
  const text = summaryText(sum);
  if (cfg.validate.test(text)) return true;
  // creator surname appearing in the summary is strong evidence
  if (creator) {
    const surname = creator.trim().split(/\s+/).pop()?.toLowerCase();
    if (surname && surname.length > 2 && text.includes(surname)) return true;
  }
  return false;
}

// ---- image URL candidates, best first ----
// Wikimedia's thumbnailer only serves an allowlist of widths (see
// https://w.wiki/GHai): 500px is the allowed bucket nearest our 480 target.
// It also errors on upscales, so a small original is taken directly. The
// as-given thumbnail URL (usually 330px) is always valid, so it's the
// fallback; the full original is last (can be huge).
const ALLOWED_THUMB_WIDTH = 500;
function pickImageUrls(sum) {
  const orig = sum.originalimage;
  const thumb = sum.thumbnail;
  const urls = [];
  if (orig?.width && orig.width <= ALLOWED_THUMB_WIDTH) urls.push(orig.source);
  if (thumb?.source && /\/\d+px-/.test(thumb.source)) {
    urls.push(thumb.source.replace(/\/\d+px-/, `/${ALLOWED_THUMB_WIDTH}px-`));
  }
  if (thumb?.source) urls.push(thumb.source);
  if (orig?.source && (orig.width || 0) <= 4000) urls.push(orig.source);
  // sips can't rasterize SVGs — keep only raster URLs (an SVG's *thumbnail*
  // is a PNG render ending .svg.png, which is fine). Filter logos/flags/etc.
  // here too: a brand page's "page image" is often its wordmark.
  return [...new Set(urls)].filter((u) => !/\.svg$/i.test(u) && !MEDIA_BLACKLIST.test(u));
}

// Commons/en file page for credit, derived from the upload URL's filename.
function filePageFor(imgUrl, articleUrl) {
  try {
    const sp = imgUrl.match(/Special:FilePath\/([^?]+)/);
    if (sp) return `https://commons.wikimedia.org/wiki/File:${sp[1]}`;
    const path = new URL(imgUrl).pathname;
    const m = path.match(/\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
    if (!m) return articleUrl;
    const file = decodeURIComponent(m[1]);
    const host = path.includes('/wikipedia/en/') ? 'en.wikipedia.org' : 'commons.wikimedia.org';
    return `https://${host}/wiki/File:${encodeURIComponent(file)}`;
  } catch {
    return articleUrl;
  }
}

// ---- resolve one entity: walk candidate titles, validate, and stop at the
// first validated article that actually yields an image. A validated article
// with no image (common: the title now points at a franchise/TV page, or the
// lead image is a non-free logo the REST API withholds) is NOT terminal — we
// keep walking candidates.
async function resolve(display, domain, creator, key) {
  const cfg = DOMAIN_CFG[domain] || DEFAULT_CFG;
  const tried = new Set();
  let firstValidated = null; // for the miss reason
  const tryTitle = async (title) => {
    // dedupe by EXACT title — MediaWiki titles are case-sensitive after the
    // first letter, so "Binder Clip" (404) and "Binder clip" are distinct
    if (!title || tried.has(title)) return null;
    tried.add(title);
    const sum = await fetchSummary(title);
    if (!plausible(sum, cfg, creator)) return null;
    firstValidated ??= sum;
    const rec = await buildRecord(sum, key);
    return rec ? { sum, rec } : null;
  };

  // 1. direct title — plus a lowercase-tail variant, because the REST API is
  //    case-sensitive after the first letter ("Binder Clip" 404s, "Binder
  //    clip" exists)
  let hit = await tryTitle(display);
  if (hit) return hit;
  const lowerTail = display.charAt(0).toUpperCase() + display.slice(1).toLowerCase();
  if (lowerTail !== display) {
    hit = await tryTitle(lowerTail);
    if (hit) return hit;
  }

  // 2. parenthetical qualifier
  if (cfg.qualifier) {
    hit = await tryTitle(`${display} (${cfg.qualifier})`);
    if (hit) return hit;
  }

  // 3. search with domain hint (and creator, when known). Search results must
  //    also NAME the entity: the result title (sans parenthetical) and the
  //    display must contain one another, so "Journey" can match
  //    "Journey (2012 video game)" but never "Thatgamecompany".
  const nameMatches = (title) => {
    const strip = (s) =>
      s.replace(/\s*\(.*?\)\s*/g, ' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an) /, '');
    const b = strip(display);
    // exact match, or a comma-qualified title ("Pantheon, Rome" for "Pantheon")
    if (strip(title) === b || strip(title.split(',')[0]) === b) return true;
    // a multi-token title whose tokens appear in order within the display
    // ("Bic Cristal" for "BIC Cristal Ballpoint Pen"); single-token titles are
    // excluded so generic parents ("Pen", "Refrigerator") can't sneak in
    const tt = strip(title).split(' ');
    if (tt.length >= 2) {
      const bt = b.split(' ');
      let i = 0;
      for (const w of bt) if (w === tt[i]) i++;
      if (i === tt.length) return true;
    }
    return false;
  };
  const queries = [];
  if (creator) queries.push(`${display} ${creator}`);
  queries.push(cfg.hint ? `${display} ${cfg.hint}` : display);
  for (const q of queries) {
    const titles = await searchTitles(q);
    for (const t of titles.slice(0, 3)) {
      if (!nameMatches(t)) continue;
      hit = await tryTitle(t);
      if (hit) return hit;
    }
  }

  // 4. creator's page as a last resort (poem -> poet portrait, etc.)
  if (creator) {
    const csum = await fetchSummary(creator);
    if (csum && csum.type !== 'disambiguation' && PERSON_RE.test(summaryText(csum))) {
      const rec = await buildRecord(csum, key);
      if (rec) return { sum: csum, rec };
    }
  }
  return { sum: firstValidated, rec: null };
}

// ---- download + compress one image, return record or null ----
// Some articles (montage-heavy or non-free-lead pages: "Thai cuisine",
// "Abstract expressionism", "Book of Proverbs") have NO page image in the
// summary API. Fall back to the first decorative-safe raster image in the
// article body via the REST media-list endpoint.
const MEDIA_BLACKLIST =
  /commons-logo|wikisource|wikiquote|wiktionary|wikibooks|question_book|padlock|ambox|stub|icon|flag_of|coat_of_arms|locator|_map|\blogo\b|logo\.|_logo/i;
async function mediaListUrls(sum) {
  const title = sum.titles?.canonical || sum.title.replace(/ /g, '_');
  const r = await politeFetch(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`);
  await sleep(DELAY_MS);
  if (r.status !== 200 || !r.data?.items) return [];
  const urls = [];
  for (const item of r.data.items) {
    if (item.type !== 'image' || !item.srcset?.[0]?.src) continue;
    if (MEDIA_BLACKLIST.test(item.title || '')) continue;
    let src = item.srcset[0].src;
    if (src.startsWith('//')) src = 'https:' + src;
    if (/\.svg$/i.test(src)) continue;
    if (/\/\d+px-/.test(src)) urls.push(src.replace(/\/\d+px-/, `/${ALLOWED_THUMB_WIDTH}px-`));
    urls.push(src);
    if (urls.length >= 4) break; // first image (plus its fallback) is the lead
  }
  return [...new Set(urls)];
}

let seq = 0;
async function fetchImageBytes(sum, explicitUrls) {
  let candidates = explicitUrls ?? pickImageUrls(sum);
  if (!candidates.length) candidates = await mediaListUrls(sum);
  for (const imgUrl of candidates) {
    const r = await politeFetch(imgUrl, 'bin');
    await sleep(DELAY_MS);
    if (r.status !== 200 || !r.buf || r.buf.length < 1500) continue;
    if (/text\/html/.test(r.contentType) || r.buf.slice(0, 20).toString().includes('<!DOCTYPE')) continue;
    return { imgUrl, buf: r.buf };
  }
  return null;
}

async function buildRecord(sum, key, explicitUrls) {
  const got = await fetchImageBytes(sum, explicitUrls);
  if (!got) return null;
  const { imgUrl, buf } = got;
  const r = { buf };

  const base = join(RAW_DIR, `${key.replace(/[^a-z0-9]+/gi, '_')}_${seq++}`);
  const rawPath = `${base}.raw`;
  const jpgPath = `${base}.jpg`;
  writeFileSync(rawPath, r.buf);
  try {
    execSync(
      `sips -s format jpeg -s formatOptions ${JPEG_QUALITY} -Z ${THUMB_WIDTH} "${rawPath}" --out "${jpgPath}" >/dev/null 2>&1`,
    );
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${jpgPath}"`).toString();
    const w = Number(info.match(/pixelWidth: (\d+)/)?.[1]);
    const h = Number(info.match(/pixelHeight: (\d+)/)?.[1]);
    if (!w || !h) return null;
    const b64 = readFileSync(jpgPath).toString('base64');
    // keep the raw bytes for this key so a global recompress pass (smaller
    // width/quality) can run without refetching anything
    writeFileSync(join(RAW_DIR, `${key.replace(/[^a-z0-9]+/gi, '_')}.used.raw`), r.buf);
    const articleUrl =
      sum.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(sum.title.replace(/ /g, '_'))}`;
    return {
      uri: `data:image/jpeg;base64,${b64}`,
      page: articleUrl,
      credit: filePageFor(imgUrl, articleUrl),
      w,
      h,
    };
  } catch {
    return null;
  }
}

// ---- recompress mode: rebuild every stored image from the kept raw bytes at
// the current ENTITY_IMG_WIDTH/ENTITY_IMG_QUALITY, without refetching ----
if (args.includes('--recompress')) {
  let done = 0, missingRaw = 0;
  for (const key of Object.keys(out)) {
    if (key === '_misses') continue;
    const rawPath = join(RAW_DIR, `${key.replace(/[^a-z0-9]+/gi, '_')}.used.raw`);
    if (!existsSync(rawPath)) { missingRaw++; continue; }
    const jpgPath = rawPath.replace(/\.used\.raw$/, '.recompressed.jpg');
    try {
      execSync(`sips -s format jpeg -s formatOptions ${JPEG_QUALITY} -Z ${THUMB_WIDTH} "${rawPath}" --out "${jpgPath}" >/dev/null 2>&1`);
      const info = execSync(`sips -g pixelWidth -g pixelHeight "${jpgPath}"`).toString();
      const w = Number(info.match(/pixelWidth: (\d+)/)?.[1]);
      const h = Number(info.match(/pixelHeight: (\d+)/)?.[1]);
      if (!w || !h) throw new Error('bad dims');
      out[key] = { ...out[key], uri: `data:image/jpeg;base64,${readFileSync(jpgPath).toString('base64')}`, w, h };
      done++;
    } catch (err) {
      console.error(`recompress failed for ${key}: ${String(err).slice(0, 80)}`);
    }
  }
  writeFileSync(OUT, JSON.stringify(out));
  const kb = Math.round(JSON.stringify(out).length / 1024);
  console.log(`recompressed ${done} images at ${THUMB_WIDTH}px/q${JPEG_QUALITY} (${missingRaw} without raw bytes kept as-is)`);
  console.log(`total payload: ${kb}KB (${(kb / 1024).toFixed(2)}MB)`);
  process.exit(0);
}

// ---- build work queue ----
const queue = [];
for (const [key, card] of Object.entries(cards)) {
  if (key === '_misses') continue;
  const domain = card.domain;
  if (SKIP_DOMAINS.has(domain)) continue;
  if (domainFilter.size && !domainFilter.has(domain)) continue;
  if (out[key]) continue; // already fetched
  if (missKeys.has(key) && !retryMisses) continue; // known miss
  queue.push({ key, display: card.display, domain, creator: creatorOf.get(key) || null });
}
if (retryMisses) out._misses = out._misses.filter((m) => !queue.some((q) => q.key === m.key));

console.log(`${queue.length} entities to fetch (${Object.keys(out).length - 1} already done, ${out._misses.length} known misses kept)`);

// ---- run with small worker pool ----
const stats = {}; // domain -> {hit, miss}
const bump = (d, kind) => { (stats[d] = stats[d] || { hit: 0, miss: 0 })[kind]++; };
let done = 0;

async function processOne({ key, display, domain, creator }) {
  try {
    let sum, rec;
    const ov = OVERRIDES[key];
    if (ov) {
      sum = await fetchSummary(ov.title);
      rec = sum ? await buildRecord(sum, key, ov.image ? [ov.image] : undefined) : null;
    } else {
      ({ sum, rec } = await resolve(display, domain, creator, key));
    }
    if (!rec) {
      const reason = sum ? `no image on "${sum.title}"` : 'no plausible article';
      out._misses.push({ key, display, reason });
      bump(domain, 'miss');
      console.log(`MISS  ${key} — ${reason}`);
      return;
    }
    out[key] = rec;
    bump(domain, 'hit');
    const kb = Math.round((rec.uri.length * 0.75) / 1024);
    console.log(`OK    ${key} -> ${decodeURIComponent(rec.page.split('/wiki/')[1] || '')} (${kb}KB ${rec.w}x${rec.h})`);
  } catch (err) {
    out._misses.push({ key, display, reason: `error: ${String(err).slice(0, 100)}` });
    bump(domain, 'miss');
    console.log(`ERR   ${key}: ${String(err).slice(0, 120)}`);
  } finally {
    done++;
    if (done % 25 === 0) save();
  }
}

function save() {
  writeFileSync(OUT, JSON.stringify(out));
}

const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const item = queue.shift();
    await processOne(item);
  }
});
await Promise.all(workers);
save();

// ---- report ----
const totalKB = Math.round(JSON.stringify(out).length / 1024);
console.log('\n--- per-domain ---');
for (const [d, s] of Object.entries(stats).sort()) console.log(`${d}: ${s.hit} hit, ${s.miss} miss`);
console.log(`\nimages in file: ${Object.keys(out).length - 1}, misses recorded: ${out._misses.length}`);
console.log(`total payload: ${totalKB}KB (${(totalKB / 1024).toFixed(2)}MB)`);
