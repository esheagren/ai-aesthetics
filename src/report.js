// Report generator: reads data/summary.json, emits report/index.html.
// Self-contained (inline CSS/JS, no external assets), light+dark via
// prefers-color-scheme, hover tooltips, table fallbacks in <details>.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const S = JSON.parse(readFileSync(join(here, '..', 'data', 'summary.json'), 'utf8'));
const VOCAB_PATH = join(here, '..', 'data', 'vocab.json');
const V = existsSync(VOCAB_PATH) ? JSON.parse(readFileSync(VOCAB_PATH, 'utf8')) : null;
const OUT_DIR = join(here, '..', 'report');
mkdirSync(OUT_DIR, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const byFamily = ['Anthropic', 'OpenAI', 'Google', 'DeepSeek', 'Moonshot', 'xAI'];
const models = [...S.models].sort((a, b) => byFamily.indexOf(a.family) - byFamily.indexOf(b.family) || a.order - b.order);
const DOMAIN_LABELS = {
  book: 'Novel', film: 'Film', album: 'Album', architect: 'Architect', city: 'City', painting: 'Painting',
  poem: 'Poem', word: 'Word', typeface: 'Typeface', chair: 'Chair', object: 'Everyday object',
  bookcover: 'Book cover', videogame: 'Video game', building: 'Building', street: 'Street',
  uscity: 'U.S. city', cuisine: 'Cuisine', dish: 'Dish', color: 'Color', season: 'Season',
  smell: 'Smell', decade: 'Design decade',
  novelist: 'Novelist', philosopher: 'Philosopher', religioustext: 'Religious text',
  artmovement: 'Artistic movement', monument: 'Monument',
  tvshow: 'TV show', actor: 'Actor', actress: 'Actress', play: 'Play', musical: 'Musical',
  economist: 'Economist', scientist: 'Scientist', theologian: 'Theologian',
  mathematician: 'Mathematician', blogger: 'Blogger', computerscientist: 'Computer scientist',
  airesearcher: 'AI researcher', aimodel: 'AI model', historian: 'Historian',
  psychologist: 'Psychologist', boardgame: 'Board game', sport: 'Sport',
  childrensbook: "Children's book",
};

// Sequential blue ramp (light steps 100->700) for magnitude cells
const BLUE = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
const AQUA_LIGHT = ['#d7f3e8', '#b8e9d5', '#93dcbd', '#6ccea5', '#45bf8d', '#1baf7a', '#159267', '#107a56', '#0b6246'];

function rampColor(ramp, t) { // t in [0,1]
  const i = Math.min(ramp.length - 1, Math.max(0, Math.round(t * (ramp.length - 1))));
  return ramp[i];
}
// White ink on the dark half of a ramp
const inkFor = (t) => (t > 0.55 ? '#ffffff' : 'var(--ink-1)');

function statTile(label, value, note = '') {
  return `<div class="tile"><div class="tile-label">${esc(label)}</div><div class="tile-value">${esc(value)}</div>${note ? `<div class="tile-note">${esc(note)}</div>` : ''}</div>`;
}

// --- Section: entropy heatmap (model x domain, favorite probe) ---
function entropyHeatmap() {
  const head = S.domains.map((d) => `<th>${esc(DOMAIN_LABELS[d])}</th>`).join('');
  const rows = models.map((m) => {
    const cells = S.domains.map((d) => {
      const cell = S.cells[m.id][d].favorite;
      if (cell.n < 4) return `<td><span class="cell self" data-tip="${esc(`${m.label} · ${DOMAIN_LABELS[d]}: only ${cell.n} samples (incomplete) — not scored`)}">·</span></td>`;
      const t = cell.entropy;
      const top = cell.dist[0];
      const tip = `${m.label} · ${DOMAIN_LABELS[d]}: entropy ${t.toFixed(2)} — top pick “${top ? top[0] : '—'}” ${top ? Math.round(100 * top[1] / cell.n) : 0}% of samples`;
      return `<td><span class="cell" data-tip="${esc(tip)}" style="background:${rampColor(BLUE, t)};color:${inkFor(t)}">${t.toFixed(2)}</span></td>`;
    }).join('');
    return `<tr><th class="rowh">${esc(m.label)}<span class="fam">${esc(m.family)}</span></th>${cells}<td class="mean">${S.modelStats[m.id].meanEntropyFavorite.toFixed(2)}</td></tr>`;
  }).join('');
  return `<table class="matrix"><thead><tr><th></th>${head}<th class="mean">mean</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// --- Section: overlap matrix ---
function overlapMatrix() {
  const ids = S.overlapModels;
  const idx = (id) => ids.indexOf(id);
  const head = models.map((m) => `<th class="diag">${esc(m.label)}</th>`).join('');
  const rows = models.map((a) => {
    const cells = models.map((b) => {
      if (a.id === b.id) return '<td><span class="cell self">—</span></td>';
      const v = S.overlap[idx(a.id)][idx(b.id)];
      const t = Math.min(1, v / 0.4); // scale: 0.4 Jaccard = full saturation
      const tip = `${a.label} ∩ ${b.label}: Jaccard ${v.toFixed(2)} of favorite sets`;
      return `<td><span class="cell" data-tip="${esc(tip)}" style="background:${rampColor(AQUA_LIGHT, t)};color:${t > 0.6 ? '#fff' : 'var(--ink-1)'}">${v.toFixed(2)}</span></td>`;
    }).join('');
    return `<tr><th class="rowh">${esc(a.label)}</th>${cells}</tr>`;
  }).join('');
  return `<table class="matrix"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

// --- Section: horizontal bar rows (single measure per model) ---
function barRows(items, { max = null, fmt = (v) => v, color = 'var(--series-1)' } = {}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 0.0001);
  return `<div class="bars">` + items.map((i) => `
    <div class="bar-row" data-tip="${esc(i.tip ?? `${i.label}: ${fmt(i.value)}`)}">
      <div class="bar-label">${esc(i.label)}${i.sub ? `<span class="fam">${esc(i.sub)}</span>` : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(100 * i.value / top).toFixed(1)}%;background:${i.color ?? color}"></div></div>
      <div class="bar-value">${esc(fmt(i.value))}</div>
    </div>`).join('') + `</div>`;
}

// --- Section: top picks per domain ---
function picksGrid(probe) {
  return S.domains.map((d) => {
    const rows = models.map((m) => {
      const cell = S.cells[m.id][d][probe];
      if (cell.n < 4) return ''; // hide incomplete cells (below the adaptive round-1 minimum)
      const [top, second] = cell.dist;
      const share = top ? top[1] / cell.n : 0;
      const tip = `${m.label} · ${DOMAIN_LABELS[d]} (${probe}): ` + cell.dist.slice(0, 5).map(([e, c]) => `${e} ${Math.round(100 * c / cell.n)}%`).join(', ');
      return `<tr data-tip="${esc(tip)}">
        <th class="rowh">${esc(m.label)}</th>
        <td class="pick">${top ? esc(top[0]) : '<span class="muted">—</span>'}</td>
        <td class="share"><div class="mini-track"><div class="mini-fill" style="width:${(share * 100).toFixed(0)}%"></div></div><span>${top ? `${Math.round(share * 100)}%` : ''}</span></td>
        <td class="pick muted">${second ? esc(second[0]) : ''}</td>
      </tr>`;
    }).join('');
    return `<div class="domain-panel"><h4>${esc(DOMAIN_LABELS[d])}</h4>
      <table class="picks"><thead><tr><th></th><th>top pick</th><th>share</th><th>runner-up</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

// --- Section: descriptor vocabulary ---
function descriptorPanels() {
  return models.map((m) => {
    const chips = S.modelStats[m.id].topDescriptors.slice(0, 12)
      .map(([w, c]) => `<span class="chip" data-tip="${esc(`“${w}” used ${c}×`)}">${esc(w)}<b>${c}</b></span>`).join('');
    return `<div class="desc-panel"><h4>${esc(m.label)}<span class="fam">${esc(m.family)}</span></h4><div class="chips">${chips}</div></div>`;
  }).join('');
}

// --- Vocabulary embedding map ---
const FAM_COLOR = { Anthropic: 'var(--fam-a)', OpenAI: 'var(--fam-o)', Google: 'var(--fam-g)', DeepSeek: 'var(--fam-d)', Moonshot: 'var(--fam-k)', xAI: 'var(--fam-x)' };
const SHORT = { 'claude-opus-4-1': 'Opus 4.1', 'claude-opus-4-5': 'Opus 4.5', 'claude-opus-4-8': 'Opus 4.8', 'claude-fable-5': 'Fable 5', 'gpt-4o': 'GPT-4o', 'gpt-5.2': 'GPT-5.2', 'gpt-5.6-sol': 'GPT-5.6 Sol', 'gemini-3.1-pro-preview': 'Gemini 3.1 Pro', 'gemini-3.5-flash': 'Gemini 3.5F', 'deepseek-v4-pro': 'DeepSeek V4 Pro', 'kimi-k2.6': 'Kimi K2.6', 'grok-4.5': 'Grok 4.5' };

function vocabMap() {
  const W = 960, H = 640, PAD = 56;
  const xs = V.words.map((w) => w.x), ys = V.words.map((w) => w.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x) => PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const sy = (y) => H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD); // data y+ at top
  const r = (total) => 3 + Math.sqrt(total) * 1.35;

  // Greedy label placement: highest-usage words first, plus each model's most
  // distinctive words; skip a label if its box would collide with a kept one.
  const wanted = new Set(V.words.slice().sort((a, b) => b.total - a.total).slice(0, 60).map((w) => w.w));
  for (const list of Object.values(V.distinctive)) for (const [w] of list.slice(0, 5)) wanted.add(w);
  const placed = [];
  const collides = (b) => placed.some((p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
  const labeled = new Set();
  for (const w of V.words.slice().sort((a, b) => b.total - a.total)) {
    if (!wanted.has(w.w)) continue;
    const cx = sx(w.x), cy = sy(w.y), rr = r(w.total);
    const box = { x0: cx + rr + 2, x1: cx + rr + 2 + w.w.length * 6.1, y0: cy - 7, y1: cy + 5 };
    if (box.x1 > W - 4 || collides(box)) continue;
    placed.push(box);
    labeled.add(w.w);
  }

  const dots = V.words.map((w) => {
    const per = Object.entries(w.per).map(([m, c]) => `${SHORT[m] ?? m} ×${c}`).join(', ');
    const fill = w.fam ? FAM_COLOR[w.fam] : 'var(--muted)';
    const cx = sx(w.x).toFixed(1), cy = sy(w.y).toFixed(1);
    const label = labeled.has(w.w)
      ? `<text x="${+cx + r(w.total) + 3}" y="${+cy + 3.5}" class="wlabel">${esc(w.w)}</text>` : '';
    return `<g data-tip="${esc(`“${w.w}” ×${w.total} — ${per}${w.fam ? ` · leans ${w.fam}` : ' · shared'}`)}">
      <circle cx="${cx}" cy="${cy}" r="${r(w.total).toFixed(1)}" fill="${fill}" fill-opacity="${w.fam ? 0.85 : 0.45}" stroke="var(--surface-1)" stroke-width="2"/>${label}</g>`;
  }).join('');

  // Centroids on the main field: unlabeled ringed dots (tooltips name them);
  // labels live in the magnified inset where they can't collide.
  const cents = V.centroids.map((c) => {
    const m = models.find((mm) => mm.id === c.model);
    return `<g data-tip="${esc(`${m.label} vocabulary centroid — usage-weighted mean of ${c.n} descriptor uses (see inset)`)}">
      <circle cx="${sx(c.x).toFixed(1)}" cy="${sy(c.y).toFixed(1)}" r="8" fill="${FAM_COLOR[m.family]}" stroke="var(--surface-1)" stroke-width="2.5"/></g>`;
  }).join('');

  // Inset: centroid constellation on its own (magnified) scale
  const IX = 66, IY = 46, IW = 300, IH = 210, IPAD = 34;
  const cxs = V.centroids.map((c) => c.x), cys = V.centroids.map((c) => c.y);
  const [cx0, cx1] = [Math.min(...cxs), Math.max(...cxs)];
  const [cy0, cy1] = [Math.min(...cys), Math.max(...cys)];
  const isx = (x) => IX + IPAD + ((x - cx0) / (cx1 - cx0)) * (IW - 2 * IPAD);
  const isy = (y) => IY + IH - IPAD - ((y - cy0) / (cy1 - cy0)) * (IH - 2 * IPAD);
  const ordered = [...V.centroids].sort((a, b) => isx(a.x) - isx(b.x));
  const inset = `<g>
    <rect x="${IX}" y="${IY}" width="${IW}" height="${IH}" rx="8" fill="var(--surface-1)" stroke="var(--grid)"/>
    <text x="${IX + 12}" y="${IY + 18}" class="pole">model centroids · magnified</text>
    ${ordered.map((c, i) => {
      const m = models.find((mm) => mm.id === c.model);
      const px = isx(c.x).toFixed(1), py = isy(c.y).toFixed(1);
      const dy = i % 2 === 0 ? -11 : 19; // alternate labels above/below
      return `<g data-tip="${esc(`${m.label} vocabulary centroid`)}">
        <circle cx="${px}" cy="${py}" r="7" fill="${FAM_COLOR[m.family]}" stroke="var(--surface-1)" stroke-width="2"/>
        <text x="${px}" y="${+py + dy}" class="clabel">${esc(SHORT[c.model])}</text></g>`;
    }).join('')}
  </g>`;

  // Drop near-duplicate pole words (shared 5-char prefix, e.g. alienated/alienation)
  const dedupe = (ws) => {
    const seen = new Set(), out = [];
    for (const w of ws) {
      const stem = w.slice(0, 5);
      if (seen.has(stem)) continue;
      seen.add(stem); out.push(w);
    }
    return out;
  };
  const pole = (words) => esc(dedupe(words).slice(0, 3).join(' · '));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="2D embedding map of aesthetic vocabulary">
    <text x="8" y="${H / 2}" class="pole" transform="rotate(-90 8 ${H / 2})" text-anchor="middle">← ${pole(V.poles.yNeg)}&#160;&#160;&#160;&#160;${pole(V.poles.yPos)} →</text>
    <text x="${W / 2}" y="${H - 10}" class="pole" text-anchor="middle">← ${pole(V.poles.xNeg)}&#160;&#160;&#160;&#160;${pole(V.poles.xPos)} →</text>
    ${dots}${cents}${inset}
  </svg>`;
}

function vocabLegend() {
  return `<div class="maplegend">
    <span><i style="background:var(--fam-a)"></i>leans Anthropic</span>
    <span><i style="background:var(--fam-o)"></i>leans OpenAI</span>
    <span><i style="background:var(--fam-g)"></i>leans Google</span>
    <span><i style="background:var(--fam-d)"></i>leans DeepSeek</span>
    <span><i style="background:var(--fam-k)"></i>leans Moonshot</span>
    <span><i style="background:var(--muted);opacity:.5"></i>shared vocabulary</span>
    <span class="muted">dot size = usage · large ringed dots = model centroids</span>
  </div>`;
}

function distinctiveGrid() {
  return models.map((m) => {
    const list = (V.distinctive[m.id] ?? []).slice(0, 8)
      .map(([w, c]) => `<span class="chip" data-tip="${esc(`“${w}” ×${c} by ${m.label} — log-odds vs rest ${(V.distinctive[m.id].find((x) => x[0] === w) ?? [])[2]}`)}">${esc(w)}<b>${c}</b></span>`).join('');
    return `<div class="desc-panel"><h4>${esc(m.label)}<span class="fam">${esc(m.family)}</span></h4><div class="chips">${list}</div></div>`;
  }).join('');
}

function centroidSimMatrix() {
  const ids = V.centroidModels;
  const vals = V.centroidSim.flat().filter((v) => v < 1);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const rowsHtml = models.map((a) => {
    const i = ids.indexOf(a.id);
    const cells = models.map((b) => {
      const j = ids.indexOf(b.id);
      if (i === j) return '<td><span class="cell self">—</span></td>';
      const v = V.centroidSim[i][j];
      const t = (v - lo) / (hi - lo);
      return `<td><span class="cell" data-tip="${esc(`${a.label} ↔ ${b.label}: cosine ${v.toFixed(3)} (full 512-d space)`)}" style="background:${rampColor(AQUA_LIGHT, t)};color:${t > 0.6 ? '#fff' : 'var(--ink-1)'}">${(v * 100).toFixed(0)}</span></td>`;
    }).join('');
    return `<tr><th class="rowh">${esc(a.label)}</th>${cells}</tr>`;
  }).join('');
  const head = models.map((m) => `<th class="diag">${esc(SHORT[m.id])}</th>`).join('');
  return `<table class="matrix"><thead><tr><th></th>${head}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function vocabSection() {
  if (!V) return '';
  return `
<h2>A map of their aesthetic vocabulary</h2>
<p class="note">Every descriptor used ≥3 times (${V.words.length} words), embedded (text-embedding-3-small) and projected to the two principal components. PC1+PC2 carry ${((V.variance.pc1 + V.variance.pc2) * 100).toFixed(0)}% of embedding variance — read the map for semantic neighborhoods and who owns them, and the similarity matrix below for the exact distances (computed in full 512-d space). Color = the family that over-uses the word (log-odds &gt; 0.7); axis captions show the words with the most extreme coordinates on each pole.</p>
<section>
${vocabLegend()}
<div class="mapwrap">${vocabMap()}</div>
</section>
<h2>Each model's signature words</h2>
<p class="note">Descriptors most over-used by each model relative to all others (log-odds, min 2 uses) — the vocabulary that identifies it.</p>
<section><div class="desc-grid">${distinctiveGrid()}</div></section>
<h2>Vocabulary similarity</h2>
<p class="note">Cosine similarity of usage-weighted vocabulary centroids in the full embedding space, rescaled to the observed range. Lower = more distinct way of talking about aesthetics.</p>
<section>${centroidSimMatrix()}</section>`;
}

// --- Model-space map (the lead figure): each model positioned in taste space ---
function personaOf(id) {
  const sig = (V.distinctive[id] ?? []).slice(0, 2).map(([w]) => w);
  return sig.join(' · ');
}

function modelSpaceMap() {
  const W = 960, H = 460, PADX = 120, PADY = 78;
  const cxs = V.centroids.map((c) => c.x), cys = V.centroids.map((c) => c.y);
  const spanX = Math.max(...cxs) - Math.min(...cxs), spanY = Math.max(...cys) - Math.min(...cys);
  const [x0, x1] = [Math.min(...cxs) - spanX * 0.08, Math.max(...cxs) + spanX * 0.08];
  const [y0, y1] = [Math.min(...cys) - spanY * 0.12, Math.max(...cys) + spanY * 0.12];
  const sx = (x) => PADX + ((x - x0) / (x1 - x0)) * (W - 2 * PADX);
  const sy = (y) => H - PADY - ((y - y0) / (y1 - y0)) * (H - 2 * PADY);

  // Origin of the PCA space = the average vocabulary across all models
  const ox = sx(0), oy = sy(0);
  const origin = (ox > PADX && ox < W - PADX && oy > PADY && oy < H - PADY)
    ? `<line x1="${ox}" y1="${PADY - 16}" x2="${ox}" y2="${H - PADY + 16}" stroke="var(--grid)" stroke-dasharray="3 4"/>
       <line x1="${PADX - 40}" y1="${oy}" x2="${W - PADX + 40}" y2="${oy}" stroke="var(--grid)" stroke-dasharray="3 4"/>
       <text x="${ox + 6}" y="${H - PADY + 14}" class="pole">average vocabulary</text>`
    : '';

  const ordered = [...V.centroids].sort((a, b) => sx(a.x) - sx(b.x));
  const labelBoxes = [];
  const boxFor = (cx, top, name, tag, anchor) => {
    const w = Math.max(name.length, tag.length) * 6.8;
    const x0 = anchor === 'start' ? cx : cx - w / 2;
    return { x0, x1: x0 + w, y0: top, y1: top + 30 };
  };
  const hits = (b) => labelBoxes.some((p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
  const marks = ordered.map((c, i) => {
    const m = models.find((mm) => mm.id === c.model);
    const name = SHORT[c.model], tag = personaOf(c.model);
    const px = +sx(c.x).toFixed(1), py = +sy(c.y).toFixed(1);
    // Try above, then below, then to the right of the dot
    const placements = [
      { nameY: py - 26, tagY: py - 13, x: px, anchor: 'middle', top: py - 36 },
      { nameY: py + 26, tagY: py + 39, x: px, anchor: 'middle', top: py + 16 },
      { nameY: py - 2, tagY: py + 12, x: px + 17, anchor: 'start', top: py - 12 },
      { nameY: py - 2, tagY: py + 12, x: px - 17, anchor: 'end', top: py - 12 },
    ];
    let pl = placements.find((p) => !hits(boxFor(p.x, p.top, name, tag, p.anchor))) ?? placements[0];
    labelBoxes.push(boxFor(pl.x, pl.top, name, tag, pl.anchor));
    return `<g data-tip="${esc(`${m.label}: signature register “${tag}” — position from ${c.n} descriptor uses`)}">
      <circle cx="${px}" cy="${py}" r="11" fill="${FAM_COLOR[m.family]}" stroke="var(--surface-1)" stroke-width="2.5"/>
      <text x="${pl.x}" y="${pl.nameY}" class="mlabel" text-anchor="${pl.anchor}">${esc(name)}</text>
      <text x="${pl.x}" y="${pl.tagY}" class="mtag" text-anchor="${pl.anchor}">${esc(tag)}</text></g>`;
  }).join('');

  const dedupe = (ws) => { const seen = new Set(); return ws.filter((w) => { const s = w.slice(0, 5); if (seen.has(s)) return false; seen.add(s); return true; }); };
  const pole = (ws) => esc(dedupe(ws).slice(0, 3).join(' · '));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of AI models in aesthetic-vocabulary space">
    ${origin}
    <text x="8" y="${H / 2}" class="pole" transform="rotate(-90 8 ${H / 2})" text-anchor="middle">← ${pole(V.poles.yNeg)}&#160;&#160;&#160;&#160;${pole(V.poles.yPos)} →</text>
    <text x="${W / 2}" y="${H - 8}" class="pole" text-anchor="middle">← ${pole(V.poles.xNeg)}&#160;&#160;&#160;&#160;${pole(V.poles.xPos)} →</text>
    ${marks}
  </svg>`;
}

function modelSpaceSection() {
  return `
<h2>Where each model sits</h2>
<p class="note">${models.length} models placed in a shared “taste space”: nearby models talk about aesthetics the same way; distant ones have genuinely different registers. Under each model: the two words it over-uses most versus everyone else.</p>
<section>
${vocabLegend().replace(/<span class="muted">.*?<\/span>/, '')}
<div class="mapwrap">${modelSpaceMap()}</div>
<p class="how">How this is found: every model justified its picks in 2–4 sentences; an extraction pass pulled the aesthetic-quality words from each justification (~3,000 uses of ${V.words.length} distinct words). Each word is embedded as a vector, each model becomes the usage-weighted average of its words' vectors, and the two directions that best separate the vocabulary (principal components) become the axes — their end-labels are the actual words with the most extreme positions. The word-level map further down shows the full vocabulary this is built from.</p>
</section>`;
}

// --- Representative quotes: one real response per model, chosen for signature density ---
const RAW_PATH = join(here, '..', 'data', 'raw.jsonl');
const RAWROWS = existsSync(RAW_PATH)
  ? readFileSync(RAW_PATH, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.text)
  : [];

function pickQuote(modelId) {
  const sig = (V?.distinctive[modelId] ?? []).map(([w]) => w.toLowerCase());
  const cands = RAWROWS.filter((r) => r.model === modelId && r.probe === 'favorite' && r.text.length > 120);
  let best = null, bestScore = -1;
  for (const r of cands) {
    const t = r.text.toLowerCase();
    let score = sig.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (r.text.length < 700) score += 0.5; // prefer quotable length
    if (score > bestScore) { bestScore = score; best = r; }
  }
  if (!best) return null;
  let text = best.text.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  if (text.length > 420) {
    const cut = text.slice(0, 420);
    text = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! ')) + 1) || cut + '…';
  }
  return { text, domain: best.domain };
}

function quotesSection() {
  const cards = models.map((m) => {
    const q = pickQuote(m.id);
    if (!q) return '';
    return `<div class="quote">
      <div class="quote-head"><span class="quote-model">${esc(m.label)}</span><span class="fam">${esc(m.family)} · favorite ${esc(DOMAIN_LABELS[q.domain]?.toLowerCase() ?? q.domain)}</span></div>
      <blockquote>${esc(q.text)}</blockquote></div>`;
  }).join('');
  return `
<h2>In their own words</h2>
<p class="note">One real response per model — chosen automatically as the answer densest in that model's signature vocabulary.</p>
<section><div class="quotes">${cards}</div></section>`;
}

// --- Anthropic progression ---
function progression() {
  const anth = models.filter((m) => m.family === 'Anthropic');
  const rows = anth.map((m) => {
    const s = S.modelStats[m.id];
    return { label: m.label, entropy: s.meanEntropyFavorite, hedge: s.hedgeRate, distinct: s.distinctFavorites, samples: s.favoriteSamples };
  });
  const table = `<table class="picks prog"><thead><tr><th></th><th>mean entropy (favorites)</th><th>hedge rate</th><th>distinct-pick rate</th></tr></thead><tbody>${
    rows.map((r) => `<tr><th class="rowh">${esc(r.label)}</th>
      <td>${barCellInline(r.entropy, 1)}</td><td>${barCellInline(r.hedge, 1)}</td>
      <td>${Math.round(100 * r.distinct / Math.max(r.samples, 1))}%</td></tr>`).join('')
  }</tbody></table>`;
  // pick drift per domain across the ladder
  const drift = S.domains.map((d) => {
    const cells = anth.map((m) => {
      const cell = S.cells[m.id][d].favorite;
      const top = cell.dist[0];
      return `<td class="pick">${top ? esc(top[0]) : '—'} <span class="muted">${top ? `${Math.round(100 * top[1] / cell.n)}%` : ''}</span></td>`;
    }).join('');
    return `<tr><th class="rowh">${esc(DOMAIN_LABELS[d])}</th>${cells}</tr>`;
  }).join('');
  const driftTable = `<table class="picks"><thead><tr><th></th>${anth.map((m) => `<th>${esc(m.label.replace('Claude ', ''))}</th>`).join('')}</tr></thead><tbody>${drift}</tbody></table>`;
  return { table, driftTable };
}
const barCellInline = (v, max) =>
  `<div class="inline-bar"><div class="mini-track"><div class="mini-fill" style="width:${(100 * v / max).toFixed(0)}%"></div></div><span>${v.toFixed(2)}</span></div>`;

// --- Consensus ---
function consensusTable() {
  const rows = S.consensus.filter((c) => c.models >= 2).slice(0, 14).map((c) =>
    `<tr><td class="pick">${esc(c.entity)}</td><td>${esc(DOMAIN_LABELS[c.domain] ?? c.domain)}</td><td>${c.models}/${models.length}</td><td>${c.total}</td></tr>`).join('');
  return `<table class="picks"><thead><tr><th>entity</th><th>domain</th><th>models naming it</th><th>total mentions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const totalSamples = models.reduce((a, m) => a + S.modelStats[m.id].n, 0);
const mostConsensual = S.consensus[0];
const hedgiest = [...models].sort((a, b) => S.modelStats[b.id].hedgeRate - S.modelStats[a.id].hedgeRate)[0];
const mostDiverse = [...models].sort((a, b) => S.modelStats[b.id].meanEntropyFavorite - S.modelStats[a.id].meanEntropyFavorite)[0];
const leastDiverse = [...models].sort((a, b) => S.modelStats[a.id].meanEntropyFavorite - S.modelStats[b.id].meanEntropyFavorite)[0];

const prog = progression();

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Aesthetic Taste — Pilot Report</title>
<style>
:root{
  --surface-1:#fcfcfb; --page:#f9f9f7; --ink-1:#0b0b0b; --ink-2:#52514e; --muted:#898781;
  --grid:#e1e0d9; --baseline:#c3c2b7; --border:rgba(11,11,11,.10);
  --series-1:#2a78d6; --series-2:#1baf7a;
  --fam-a:#c65d3b; --fam-o:#0d8a6a; --fam-g:#8557bd; --fam-d:#3d55d4; --fam-k:#6b7280; --fam-x:#1a1a1a;
}
@media (prefers-color-scheme: dark){:root{
  --surface-1:#1a1a19; --page:#0d0d0d; --ink-1:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
  --grid:#2c2c2a; --baseline:#383835; --border:rgba(255,255,255,.10);
  --series-1:#3987e5; --series-2:#199e70;
  --fam-a:#d97757; --fam-o:#10a37f; --fam-g:#9b72cb; --fam-d:#4d6bfe; --fam-k:#aeb6c6; --fam-x:#f2f0e9;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink-1);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1060px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:26px;margin:0 0 4px}
h2{font-size:19px;margin:44px 0 4px}
h4{font-size:14px;margin:0 0 8px}
.sub{color:var(--ink-2);margin:0 0 6px}
.note{color:var(--muted);font-size:13px;margin:2px 0 14px}
section{background:var(--surface-1);border:1px solid var(--border);border-radius:10px;padding:20px 22px;margin-top:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:16px}
.tile{background:var(--surface-1);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
.tile-label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.tile-value{font-size:22px;font-weight:650;margin-top:2px}
.tile-note{font-size:12px;color:var(--ink-2);margin-top:2px}
table{border-collapse:collapse;width:100%}
.matrix{overflow-x:auto;display:block}
.matrix th{font-size:12px;color:var(--ink-2);font-weight:500;padding:4px 6px;text-align:center}
.matrix th.rowh{text-align:right;white-space:nowrap}
.matrix td{padding:2px}
.matrix .cell{display:flex;align-items:center;justify-content:center;min-width:52px;height:34px;border-radius:5px;font-size:12.5px;font-variant-numeric:tabular-nums}
.matrix .cell.self{background:var(--grid);color:var(--muted)}
.matrix .mean{font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--ink-2);text-align:center}
.fam{display:block;font-size:11px;color:var(--muted);font-weight:400}
.bars{margin-top:6px}
.bar-row{display:grid;grid-template-columns:170px 1fr 56px;gap:10px;align-items:center;padding:3px 0}
.bar-label{font-size:13px;text-align:right;line-height:1.2}
.bar-track{height:14px;background:transparent;border-left:2px solid var(--baseline)}
.bar-fill{height:100%;border-radius:0 4px 4px 0;min-width:2px}
.bar-value{font-size:12.5px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.domains{display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:18px;margin-top:8px}
@media (max-width:560px){.domains{grid-template-columns:1fr}}
.picks{font-size:13px}
.picks th{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;font-weight:500;text-align:left;padding:3px 8px;border-bottom:1px solid var(--grid)}
.picks td{padding:4px 8px;border-bottom:1px solid var(--grid)}
.picks .rowh{font-weight:550;font-size:12.5px;white-space:nowrap;text-align:right;color:var(--ink-2);padding:4px 8px;border-bottom:1px solid var(--grid)}
.pick{font-weight:500}
.muted{color:var(--muted);font-weight:400}
.share{width:110px}.share span{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;margin-left:6px}
.mini-track{display:inline-block;width:56px;height:8px;background:var(--grid);border-radius:4px;vertical-align:middle}
.mini-fill{height:100%;background:var(--series-1);border-radius:4px;min-width:1px}
.inline-bar span{font-size:12px;color:var(--ink-2);margin-left:8px;font-variant-numeric:tabular-nums}
.desc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
.desc-panel h4{margin-bottom:6px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{font-size:12px;border:1px solid var(--border);border-radius:20px;padding:2px 9px;color:var(--ink-2)}
.chip b{color:var(--ink-1);margin-left:5px;font-weight:600}
details{margin-top:10px}
summary{font-size:12.5px;color:var(--muted);cursor:pointer}
.mlabel{font-size:13px;font-weight:650;fill:var(--ink-1);text-anchor:middle;paint-order:stroke;stroke:var(--surface-1);stroke-width:3px}
.mtag{font-size:10.5px;fill:var(--muted);text-anchor:middle;paint-order:stroke;stroke:var(--surface-1);stroke-width:3px}
.how{font-size:13px;color:var(--ink-2);border-top:1px solid var(--grid);padding-top:12px;margin:14px 0 0;line-height:1.55}
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.quote{border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.quote-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.quote-model{font-weight:650;font-size:13.5px}
.quote .fam{display:inline;font-size:11px}
.quote blockquote{margin:0;font-size:13.5px;line-height:1.55;color:var(--ink-2)}
.mapwrap{overflow-x:auto}
.mapwrap svg{width:100%;min-width:720px;height:auto;display:block}
.wlabel{font-size:10.5px;fill:var(--ink-2)}
.clabel{font-size:11.5px;font-weight:650;fill:var(--ink-1);text-anchor:middle;paint-order:stroke;stroke:var(--surface-1);stroke-width:3px}
.pole{font-size:11px;fill:var(--muted);letter-spacing:.02em}
.maplegend{display:flex;flex-wrap:wrap;gap:16px;font-size:12.5px;color:var(--ink-2);margin-bottom:6px}
.maplegend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
#tip{position:fixed;pointer-events:none;background:var(--ink-1);color:var(--page);font-size:12.5px;padding:6px 10px;border-radius:6px;max-width:340px;opacity:0;transition:opacity .08s;z-index:10;line-height:1.4}
footer{color:var(--muted);font-size:12.5px;margin-top:36px;line-height:1.6}
</style></head><body>
<div class="wrap">
<h1>The Aesthetic Taste of AI Models</h1>
<p class="sub">Pilot: ${models.length} models × ${S.domains.length} domains × 2 probes — ${totalSamples} responses, repeated sampling per question, provider-default settings, no system prompt.</p>
<p class="note">Generated ${new Date(S.generatedAt).toISOString().slice(0, 10)}. Entropy is Shannon entropy of the pick distribution normalized by log(n): 0 = same answer every time, 1 = a different answer every time.</p>

<div class="tiles">
${statTile('Responses analyzed', totalSamples)}
${statTile('Most consensual pick', mostConsensual.entity, `${mostConsensual.models} of ${models.length} models`)}
${statTile('Most consistent taste', leastDiverse.label, `mean entropy ${S.modelStats[leastDiverse.id].meanEntropyFavorite.toFixed(2)}`)}
${statTile('Most varied taste', mostDiverse.label, `mean entropy ${S.modelStats[mostDiverse.id].meanEntropyFavorite.toFixed(2)}`)}
${statTile('Heaviest hedger', hedgiest.label, `${(S.modelStats[hedgiest.id].hedgeRate * 100).toFixed(0)}% of answers disclaim`)}
</div>
${V ? modelSpaceSection() : ''}
${V ? quotesSection() : ''}
${V ? vocabSection() : ''}
<h2>How fixed is each model's taste?</h2>
<p class="note">Normalized entropy of favorite-pick distributions. Dark = names a different favorite nearly every run; light = repeats the same pick. Hover for the top pick.</p>
<section>${entropyHeatmap()}</section>

<h2>What they actually pick</h2>
<p class="note">Top pick per model per domain across 10 samples of “what is your favorite …”. Hover a row for the full distribution.</p>
<section><div class="domains">${picksGrid('favorite')}</div></section>

<h2>The dislike canon</h2>
<p class="note">Same structure for “name one acclaimed X you find overrated” — negative taste is less canon-bound and more differentiating.</p>
<section><div class="domains">${picksGrid('overrated')}</div></section>

<h2>Who shares a canon with whom?</h2>
<p class="note">Jaccard overlap of each model's set of distinct favorite picks (all domains pooled). Higher = the two models draw from the same well.</p>
<section>${overlapMatrix()}</section>

<h2>Hedging and refusal</h2>
<p class="note">Share of responses that disclaim having “real” preferences before (or instead of) answering.</p>
<section>
${barRows(models.map((m) => ({ label: m.label, sub: m.family, value: S.modelStats[m.id].hedgeRate, tip: `${m.label}: ${(S.modelStats[m.id].hedgeRate * 100).toFixed(0)}% hedged · ${(S.modelStats[m.id].refusalRate * 100).toFixed(0)}% refused outright` })), { max: 1, fmt: (v) => `${(v * 100).toFixed(0)}%` })}
</section>

<h2>The Anthropic progression</h2>
<p class="note">Four generations of the same model line, Opus 4.1 → Fable 5.</p>
<section>
${prog.table}
<h4 style="margin-top:22px">Top favorite by domain across the ladder</h4>
${prog.driftTable}
</section>

<h2>Consensus canon</h2>
<p class="note">Favorites named by the most distinct models — the shared prestige canon.</p>
<section>${consensusTable()}</section>

<footer>
Method notes: raw API calls with no system prompt, provider-default sampling (the newest Anthropic models accept no temperature parameter). The original six domains (novel, film, album, architect, city, painting) were asked plainly; later domains prepend “I know you are an AI and don't have preferences in the human sense — set that disclaimer aside and answer anyway,” so hedge rates are not directly comparable across the two question sets. Each question is asked in 4–12 independent single-turn samples per model (adaptive: unanimous answers stop sampling early, varied answers get more samples); shares are percentages of that question's samples. Entity extraction and normalization by Claude Haiku 4.5 with structured outputs; descriptor vocabulary extracted from justification text. This measures each model's <em>stated</em> aesthetic attractors under direct questioning — not inner experience, and not the persona of any consumer product built on these models. Google is represented only by Gemini 3.5 Flash: the free-tier key allows 20 requests/day, so Gemini has full coverage for the novel domain only — its other cells are unscored. Cells marked “·” had fewer than 5 samples.
</footer>
</div>
<div id="tip"></div>
<script>
const tip = document.getElementById('tip');
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) { tip.style.opacity = 0; return; }
  tip.textContent = el.dataset.tip;
  tip.style.opacity = 1;
  const pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  const r = tip.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
});
</script>
</body></html>`;

writeFileSync(join(OUT_DIR, 'index.html'), html);
console.log(`report written: ${join(OUT_DIR, 'index.html')}`);

// Artifact variant: same page without the document skeleton (the artifact host
// wraps it), plus data-theme overrides so the viewer's theme toggle wins over
// the OS preference in both directions.
const LIGHT_TOKENS = `--surface-1:#fcfcfb; --page:#f9f9f7; --ink-1:#0b0b0b; --ink-2:#52514e; --muted:#898781;
  --grid:#e1e0d9; --baseline:#c3c2b7; --border:rgba(11,11,11,.10);
  --series-1:#2a78d6; --series-2:#1baf7a; --fam-a:#c65d3b; --fam-o:#0d8a6a; --fam-g:#8557bd; --fam-d:#3d55d4; --fam-k:#6b7280; --fam-x:#1a1a1a;`;
const DARK_TOKENS = `--surface-1:#1a1a19; --page:#0d0d0d; --ink-1:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
  --grid:#2c2c2a; --baseline:#383835; --border:rgba(255,255,255,.10);
  --series-1:#3987e5; --series-2:#199e70; --fam-a:#d97757; --fam-o:#10a37f; --fam-g:#9b72cb; --fam-d:#4d6bfe; --fam-k:#aeb6c6; --fam-x:#f2f0e9;`;
const themeOverrides = `
:root[data-theme="dark"]{${DARK_TOKENS}}
:root[data-theme="light"]{${LIGHT_TOKENS}}
`;
const styleBlock = html.match(/<style>[\s\S]*?<\/style>/)[0];
const bodyInner = html.match(/<body>([\s\S]*)<\/body><\/html>/)[1];
writeFileSync(join(OUT_DIR, 'artifact.html'),
  `<title>The Aesthetic Taste of AI Models</title>\n` +
  styleBlock.replace('</style>', `${themeOverrides}</style>`) +
  bodyInner);
console.log(`artifact variant written: ${join(OUT_DIR, 'artifact.html')}`);
