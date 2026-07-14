// Fetch illustrative imagery from Wikimedia Commons for the atlas site.
// Searches per entity, takes the best thumb, records artist + license, and
// writes everything as data URIs into data/images.json.
// Photographic subjects only — typefaces, colors, words, poems are rendered
// natively in the page instead.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(here, '..', 'images');
mkdirSync(RAW_DIR, { recursive: true });

// key -> Commons search query (searched in File namespace)
const MANIFEST = {
  'kyoto': 'Kinkaku-ji golden pavilion Kyoto autumn',
  'paris': 'Eiffel Tower seen from Champ de Mars',
  'tadao ando': 'Church of the Light Ibaraki Tadao Ando',
  'frank gehry': 'Museo Guggenheim Bilbao',
  'girl with a pearl earring': 'Girl with a Pearl Earring Vermeer',
  'mona lisa': 'Mona Lisa Leonardo da Vinci Louvre painting',
  'starry night': 'The Starry Night Van Gogh 1889',
  'nighthawks': 'Nighthawks Edward Hopper painting',
  'sunday afternoon la grande jatte': 'A Sunday Afternoon on the Island of La Grande Jatte Seurat',
  'autumn': 'Japanese maple autumn leaves momiji',
  'japanese cuisine': 'Sushi assortment nigiri',
  'petrichor': 'Raindrops on leaves macro',
  'eames lounge chair': 'Eames Lounge Chair and ottoman',
  'paperclip': 'Paperclips colorful',
  'san francisco': 'Golden Gate Bridge fog San Francisco',
  'champs-elysees': 'Champs-Élysées Arc de Triomphe avenue',
  'philosophers walk': 'Philosopher\'s Walk Kyoto Tetsugaku no michi cherry',
  'sagrada familia': 'Sagrada Família interior columns Gaudí',
  'therme vals': 'Therme Vals interior stone',
  'great gatsby': 'The Great Gatsby 1925 first edition cover',
  'moby-dick': 'Sperm whale Moby Dick illustration',
};

const API = 'https://commons.wikimedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q) {
  const url = `${API}?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=560&format=json`;
  let data;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'ai-aesthetics-pilot/0.1 (contact: personal research)' } });
    const text = await res.text();
    try { data = JSON.parse(text); break; }
    catch { await sleep(4000 * (attempt + 1)); } // rate-limited: back off and retry
  }
  if (!data) return null;
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    if (!/image\/(jpeg|png)/.test(ii.mime)) continue;
    const meta = ii.extmetadata ?? {};
    return {
      thumb: ii.thumburl,
      artist: (meta.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 60),
      license: meta.LicenseShortName?.value ?? '',
      page: ii.descriptionshorturl ?? '',
      title: p.title,
    };
  }
  return null;
}

const OUT_PATH = join(here, '..', 'data', 'images.json');
const out = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : {};
for (const [key, q] of Object.entries(MANIFEST)) {
  if (out[key]) continue; // resume
  try {
    await sleep(2000);
    const hit = await search(q);
    if (!hit) { console.error(`NO HIT: ${key}`); continue; }
    const rawPath = join(RAW_DIR, key.replace(/[^a-z0-9]/g, '_') + '.jpg');
    const img = await fetch(hit.thumb, { headers: { 'user-agent': 'ai-aesthetics-pilot/0.1' } });
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 2000 || buf.slice(0, 15).toString().includes('<')) throw new Error('got HTML, not an image');
    writeFileSync(rawPath, buf);
    // recompress to keep the single-file page lean
    execSync(`sips -s format jpeg -s formatOptions 55 -Z 560 "${rawPath}" --out "${rawPath}" >/dev/null 2>&1`);
    const b64 = readFileSync(rawPath).toString('base64');
    out[key] = {
      uri: `data:image/jpeg;base64,${b64}`,
      credit: [hit.artist, hit.license].filter(Boolean).join(' · '),
      source: hit.title,
    };
    console.log(`${key}: ${hit.title} (${Math.round(b64.length * 0.75 / 1024)}KB) [${hit.license}]`);
  } catch (err) {
    console.error(`FAIL ${key}: ${String(err).slice(0, 120)}`);
  }
}
writeFileSync(join(here, '..', 'data', 'images.json'), JSON.stringify(out));
console.log(`\n${Object.keys(out).length}/${Object.keys(MANIFEST).length} images; total ${Math.round(JSON.stringify(out).length / 1024)}KB`);
