---
name: add-domain
description: Add a new domain (e.g. 'director', 'actor') to the AI-aesthetics study and run it through the full pipeline
---

You are adding a new aesthetic domain (the argument, e.g. "director" or "actor/actress") to the study in `/Users/erik/Documents/projects/active/ai-aesthetics`. Every step below assumes that directory — `cd` there first in every Bash call (cwd resets between calls). API keys load automatically from `.env` (providers.js has its own loader; no dotenv needed).

## 1. Choose the key and the noun phrase

- **Key**: short lowercase identifier used in data files and the site (`director`, `actor`). No spaces.
- **Noun**: the string substituted into both probe templates in `src/config.js` (`PROBES`). Read them before choosing. It must read naturally in *"what is your favorite {noun}?"* and *"Name exactly one specific {noun}"* — so disambiguate and keep it singular: `'film director'` not `'director'`, `'actor or actress'`, `'word in the English language'`. Existing DOMAINS entries are good style references.

## 2. Edit the three files that enumerate domains

1. `src/config.js` — add `key: 'noun phrase',` at the end of `DOMAINS` (the v2 section; all new collection uses the anti-hedge preamble automatically).
2. `src/site.js` — two edits:
   - `DOMAIN_LABELS`: add a display label (`director: 'Film director',`).
   - `DOMAIN_GROUPS`: add the key to one group's `ids` array — **mandatory; a domain not in any group never appears in the site index or dossiers.** Current groups: Literature & Language, Music, Film & TV, Fine Art, Design & Form, Places, Life & Senses. Add a new group only if none fits.
3. `src/report.js` — add the same label to its own separate `DOMAIN_LABELS` map (otherwise the legacy report renders `undefined`).

**Hazard when editing `src/site.js`**: most of the file is one giant template literal emitting the page's client-side JS. Regexes inside that client code need double-escaped backslashes (`\\s`, `\\u0300` — see `normEnt`/`rawNorm` near line 581); a single `\s` is eaten by the template literal and silently changes the regex.

## 3. Collect

New-domain cost: 12 models × 2 probes × 4 samples = 96 calls at round 1; adaptive escalation can take varied cells to 8 then 12 (worst case ~288). Everything is key-resumable — re-running `collect.js` skips already-collected keys in `data/raw.jsonl` and retries failures, so partial runs are normal, not errors.

Quota/cost caveats (from config.js comments and past runs):
- **Gemini free key ≈ 20 requests/day.** Round 1 for one domain needs 16 Gemini calls (2 models × 2 probes × 4) — fits one day, but escalations won't. Expect partial Gemini cells; collect everything else with `SKIP_PROVIDERS=gemini node src/collect.js`, then backfill on later days by re-running plain `node src/collect.js` (done keys skip; error records don't count as done, so failures retry).
- **Fable 5** (maxTokens 3000, effort low) and **Grok 4.5** (maxTokens 2500) have always-on thinking billed as output — the priciest calls per sample.
- **Kimi** runs at concurrency 1 (account limit) — slow; let it finish.

Run the adaptive loop manually (adapt.js exits 1 while escalations remain, 0 when settled):

```sh
cd /Users/erik/Documents/projects/active/ai-aesthetics
node src/collect.js && node src/extract.js && node src/adapt.js
# repeat the line until adapt prints "0 need more samples" / exits 0 (max 3 passes)
```

(`node src/run.js` automates this loop and then runs analyze/vocab/report, but it does **not** run canonicalize or site — if you use it, still do steps 4 and 6-7 afterwards and re-run analyze.)

## 4. Canonicalize — then review the merges by eye

```sh
node src/canonicalize.js
```

Resumable per-domain: it skips any domain already keyed in `data/aliases.json`, so only your new domain is processed and existing alias maps are untouched. **Known hazard: over-merging distinct entities.** The prompt carries anti-examples (French Press ≠ Chemex; Otoro ≠ Uni Nigiri), but Haiku still errs toward merging. Before proceeding, open `data/aliases.json`, read every `variant → canonical` pair under the new domain, and delete any pair where the two strings are genuinely different things (delete the line, keep valid JSON). If you later need to redo the domain (e.g. backfill brought new picks), delete the domain's key from `aliases.json` first, then re-run.

## 5. Analyze

```sh
node src/analyze.js    # rewrites data/summary.json; consults aliases.json
```

## 6. Vocab — must rerun

```sh
node src/vocab.js      # needs OPENAI_API_KEY (text-embedding-3-small)
```

Rerun is required: the new domain contributes new descriptor words, and the PCA is recomputed so all coordinates shift. Check the printed pole words — if an axis has changed character, update the hand-written one-word axis labels in `src/site.js` (`DATA.axes`: currently Crafted/Frustrating, Mythic/Controlled, Ornate/Ambiguous).

## 7. Site (and optional extras)

```sh
node src/site.js       # emits report/site.html and report/artifact.html
node src/report.js     # optional: keeps the legacy report/index.html current
```

- **If `src/entitycards.js` exists** (being built by a colleague; absent as of 2026-07-14), read its header comment and run it here too.
- **If the domain is visual** (like paintings/buildings): after collection, look at the new domain's top picks in `data/summary.json`, add entries for the leading ones to `MANIFEST` in `src/fetch-images.mjs` (key → Wikimedia Commons search query) and matching entries to `IMG_MAP` in `src/site.js` (normalized entity name → manifest key), run `node src/fetch-images.mjs` (resumable; skips keys already in `data/images.json`), then re-run `node src/site.js`. Non-photographic kinds (typefaces, colors, words, verse, decades) use the `NATIVE` map in site.js instead.

## 8. Verify and republish

1. Serve `report/` and open `site.html`: confirm the new domain appears in the index under its group, its choice-matrix panel renders, and it shows in model dossiers ("Its favourites, all domains").
2. **Charset gotcha**: `python3 -m http.server` sends no charset, and `artifact.html` has no `<meta charset>` — accented picks mojibake. Serve with UTF-8 forced:

```sh
cd /Users/erik/Documents/projects/active/ai-aesthetics/report && python3 -c "
import http.server as h
h.SimpleHTTPRequestHandler.extensions_map['.html']='text/html; charset=utf-8'
h.test(h.SimpleHTTPRequestHandler, port=8765)"
```

3. Republish the live artifact with the Artifact tool — file `report/artifact.html`, and pass `url: https://claude.ai/code/artifact/d2b4864a-b0cd-49ee-83b5-3de49fabcf04` so it updates in place. Keep the existing title and favicon.

## Notes

- `analyze.js`, `vocab.js`, and `site.js` all filter to `Object.keys(DOMAINS)` — removing a key from DOMAINS retires a domain from every output without touching collected data.
- Everything downstream of collection is cheap to re-run; when in doubt, re-run extract → analyze → vocab → site in that order.
