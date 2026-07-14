// Vocabulary map stage: embeds every descriptor word, projects to 2D via PCA,
// computes per-model centroids and log-odds distinctiveness, writes data/vocab.json.
//
// PCA rather than t-SNE/UMAP: deterministic, dependency-free, and the axes are
// interpretable — you can read what each pole "means" from the extreme words.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODELS, DOMAINS } from './config.js';
import { KEYS, postJSON, withRetries } from './providers.js';

const here = dirname(fileURLToPath(import.meta.url));
const retainedDomains = new Set(Object.keys(DOMAINS));
const rows = readFileSync(join(here, '..', 'data', 'extracted.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => retainedDomains.has(r.domain));
const modelIds = MODELS.map((m) => m.id);
const familyOf = Object.fromEntries(MODELS.map((m) => [m.id, m.family]));

// --- 1. Count descriptor usage per model ---
const clean = (w) => w.toLowerCase().trim().replace(/[."']/g, '');
const counts = {}; // word -> model -> count
const modelTotals = Object.fromEntries(modelIds.map((id) => [id, 0]));
for (const r of rows) {
  for (const raw of r.descriptors ?? []) {
    const w = clean(raw);
    if (!w || w.length < 3) continue;
    counts[w] ??= {};
    counts[w][r.model] = (counts[w][r.model] ?? 0) + 1;
    modelTotals[r.model]++;
  }
}
const MIN_COUNT = 3;
const words = Object.keys(counts)
  .map((w) => ({ w, total: Object.values(counts[w]).reduce((a, b) => a + b, 0) }))
  .filter((x) => x.total >= MIN_COUNT)
  .sort((a, b) => b.total - a.total)
  .map((x) => x.w);
console.log(`${Object.keys(counts).length} unique descriptors; ${words.length} with count >= ${MIN_COUNT}`);

// --- 2. Embed ---
const emb = await withRetries(() => postJSON('https://api.openai.com/v1/embeddings', {
  authorization: `Bearer ${KEYS.openai}`,
}, { model: 'text-embedding-3-small', input: words, dimensions: 512 }), { label: 'embeddings' });
const X = emb.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
const d = X[0].length;

// --- 3. PCA (top 2 components via power iteration + deflation) ---
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const mean = new Array(d).fill(0);
for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j] / X.length;
const C = X.map((row) => row.map((v, j) => v - mean[j]));

function topComponent(M) {
  let v = Array.from({ length: d }, (_, i) => Math.sin(i + 1)); // fixed seed
  for (let it = 0; it < 150; it++) {
    const Mv = M.map((row) => dot(row, v));
    const next = new Array(d).fill(0);
    for (let i = 0; i < M.length; i++) for (let j = 0; j < d; j++) next[j] += M[i][j] * Mv[i];
    const norm = Math.hypot(...next);
    v = next.map((x) => x / norm);
  }
  return v;
}
const pc1 = topComponent(C);
const C2 = C.map((row) => { const s = dot(row, pc1); return row.map((v, j) => v - s * pc1[j]); });
const pc2 = topComponent(C2);
// Third component: deflate C2 by pc2, then power-iterate again. The three PCs
// are mutually orthogonal, so original centered rows can be projected onto all
// three to get honest 3D coordinates.
const C3 = C2.map((row) => { const s = dot(row, pc2); return row.map((v, j) => v - s * pc2[j]); });
const pc3 = topComponent(C3);

const totalVar = C.reduce((s, row) => s + dot(row, row), 0);
const var1 = C.reduce((s, row) => s + dot(row, pc1) ** 2, 0) / totalVar;
const var2 = C.reduce((s, row) => s + dot(row, pc2) ** 2, 0) / totalVar;
const var3 = C.reduce((s, row) => s + dot(row, pc3) ** 2, 0) / totalVar;
console.log(`variance explained: PC1 ${(var1 * 100).toFixed(1)}% PC2 ${(var2 * 100).toFixed(1)}% PC3 ${(var3 * 100).toFixed(1)}%`);

const coords = C.map((row) => [dot(row, pc1), dot(row, pc2), dot(row, pc3)]);

// --- 4. Log-odds association (word -> family, and word -> model) ---
const famIds = [...new Set(MODELS.map((m) => m.family))];
const famTotals = Object.fromEntries(famIds.map((f) => [f, 0]));
for (const id of modelIds) famTotals[familyOf[id]] += modelTotals[id];

function logOdds(cIn, nIn, cOut, nOut, a = 0.5) {
  return Math.log((cIn + a) / (nIn - cIn + a)) - Math.log((cOut + a) / (nOut - cOut + a));
}

const wordRecs = words.map((w, i) => {
  const per = counts[w];
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  const famCounts = Object.fromEntries(famIds.map((f) => [f, 0]));
  for (const [m, c] of Object.entries(per)) famCounts[familyOf[m]] += c;
  const grandTotal = Object.values(famTotals).reduce((a, b) => a + b, 0);
  let bestFam = null, bestLO = -Infinity;
  for (const f of famIds) {
    const lo = logOdds(famCounts[f], famTotals[f], total - famCounts[f], grandTotal - famTotals[f]);
    if (lo > bestLO) { bestLO = lo; bestFam = f; }
  }
  return {
    w, x: +coords[i][0].toFixed(4), y: +coords[i][1].toFixed(4), z: +coords[i][2].toFixed(4), total,
    per, fam: bestLO > 0.7 ? bestFam : null, famLO: +bestLO.toFixed(2),
  };
});

// --- 5. Model centroids (usage-weighted mean embedding, projected) ---
const centroids = modelIds.map((id) => {
  const acc = new Array(d).fill(0);
  let n = 0;
  words.forEach((w, i) => {
    const c = counts[w][id] ?? 0;
    if (!c) return;
    for (let j = 0; j < d; j++) acc[j] += X[i][j] * c;
    n += c;
  });
  const cen = acc.map((v, j) => v / Math.max(n, 1) - mean[j]);
  return { model: id, x: +dot(cen, pc1).toFixed(4), y: +dot(cen, pc2).toFixed(4), z: +dot(cen, pc3).toFixed(4), n };
});

// Pairwise cosine similarity of raw (unprojected) centroids — the honest
// "how different are their vocabularies" number, not limited to 2 PCs.
const rawCentroids = modelIds.map((id) => {
  const acc = new Array(d).fill(0);
  let n = 0;
  words.forEach((w, i) => {
    const c = counts[w][id] ?? 0;
    for (let j = 0; j < d && c; j++) acc[j] += X[i][j] * c;
    n += c;
  });
  return acc.map((v) => v / Math.max(n, 1));
});
const cos = (a, b) => dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));
const centroidSim = modelIds.map((_, i) => modelIds.map((_, j) => +cos(rawCentroids[i], rawCentroids[j]).toFixed(4)));

// --- 6. Distinctive words per model (log-odds vs all other models) ---
const grandTotal = Object.values(modelTotals).reduce((a, b) => a + b, 0);
const distinctive = Object.fromEntries(modelIds.map((id) => {
  const scored = words.map((w) => {
    const cIn = counts[w][id] ?? 0;
    const total = Object.values(counts[w]).reduce((a, b) => a + b, 0);
    return { w, c: cIn, lo: logOdds(cIn, modelTotals[id], total - cIn, grandTotal - modelTotals[id]) };
  }).filter((x) => x.c >= 2).sort((a, b) => b.lo - a.lo).slice(0, 10);
  return [id, scored.map((x) => [x.w, x.c, +x.lo.toFixed(2)])];
}));

// --- 7. Axis poles (extreme words on each PC, for labeling the map) ---
const byX = [...wordRecs].sort((a, b) => a.x - b.x);
const byY = [...wordRecs].sort((a, b) => a.y - b.y);
const byZ = [...wordRecs].sort((a, b) => a.z - b.z);
const poles = {
  xNeg: byX.slice(0, 6).map((r) => r.w), xPos: byX.slice(-6).map((r) => r.w).reverse(),
  yNeg: byY.slice(0, 6).map((r) => r.w), yPos: byY.slice(-6).map((r) => r.w).reverse(),
  zNeg: byZ.slice(0, 6).map((r) => r.w), zPos: byZ.slice(-6).map((r) => r.w).reverse(),
};

writeFileSync(join(here, '..', 'data', 'vocab.json'), JSON.stringify({
  words: wordRecs, centroids, centroidSim, centroidModels: modelIds,
  distinctive, poles, variance: { pc1: +var1.toFixed(3), pc2: +var2.toFixed(3), pc3: +var3.toFixed(3) },
  modelTotals,
}, null, 2));
console.log('vocab.json written');
console.log('poles x:', poles.xNeg.join(','), ' <-> ', poles.xPos.join(','));
console.log('poles y:', poles.yNeg.join(','), ' <-> ', poles.yPos.join(','));
console.log('poles z:', poles.zNeg.join(','), ' <-> ', poles.zPos.join(','));
