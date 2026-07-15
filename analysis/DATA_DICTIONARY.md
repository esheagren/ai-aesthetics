# AI Aesthetics — Data Dictionary (for analysis)

This is the shared reference for all analysis of the "Machines of Loving Taste" dataset.
Everything here is derived from a factorial probe: **13 models × 43 domains × 2 probes**,
with adaptive sampling (4 → 8 → 12 samples per cell depending on how varied the answers were).

The two probes:
- `favorite`  — "what is your favorite X?" (positive taste)
- `overrated` — "name one widely beloved X you find overrated" (negative taste)

## Models (13), grouped by family, ordered by release/capability within family

| id | label | family | order |
|---|---|---|---|
| claude-opus-4-1 | Claude Opus 4.1 | Anthropic | 1 |
| claude-opus-4-5 | Claude Opus 4.5 | Anthropic | 2 |
| claude-opus-4-8 | Claude Opus 4.8 | Anthropic | 3 |
| claude-fable-5 | Claude Fable 5 | Anthropic | 4 |
| gpt-4o | GPT-4o | OpenAI | 1 |
| o3 | o3 | OpenAI | 2 |
| gpt-5.2 | GPT-5.2 | OpenAI | 3 |
| gpt-5.6-sol | GPT-5.6 Sol | OpenAI | 4 |
| gemini-3.1-pro-preview | Gemini 3.1 Pro | Google | 1 |
| gemini-3.5-flash | Gemini 3.5 Flash | Google | 2 |
| deepseek-v4-pro | DeepSeek V4 Pro | DeepSeek | 1 |
| kimi-k2.6 | Kimi K2.6 | Moonshot | 1 |
| grok-4.5 | Grok 4.5 | xAI | 1 |

**Capability gradient** (usable for "cliché → real taste" tests): the `order` field is
monotone in release date/capability *within* Anthropic and OpenAI (the two families with a
real ladder). Anthropic: 4.1 < 4.5 < 4.8 (Fable-5 is a creative-writing variant, treat
separately). OpenAI: 4o < o3 < 5.2 < 5.6.

## Domains (43)

book, film, album, architect, city, painting, poem, word, typeface, object, videogame,
building, street, uscity, cuisine, dish, color, season, smell, decade, novelist,
philosopher, religioustext, artmovement, monument, tvshow, actor, actress, play, musical,
economist, scientist, theologian, mathematician, blogger, computerscientist, airesearcher,
aimodel, historian, psychologist, boardgame, sport, childrensbook.

Rough groupings (for "what kind of domain drives agreement?" tests):
- **Cultural artifacts**: book, film, album, painting, poem, videogame, tvshow, play, musical, boardgame, childrensbook
- **People / thinkers**: architect, novelist, philosopher, economist, scientist, theologian, mathematician, historian, psychologist, computerscientist, airesearcher, actor, actress
- **Places**: city, uscity, street, building, monument
- **Design / sensory**: word, typeface, object, color, season, smell, decade, cuisine, dish
- **Meta**: aimodel, artmovement, religioustext, sport

## Files (all under repo root unless noted)

### `data/extracted.jsonl` — 9,395 rows, the per-sample analytical substrate
One JSON object per line, one per (model, domain, probe, sample):
```json
{"key":"gpt-4o|book|overrated|0","model":"gpt-4o","domain":"book","probe":"overrated",
 "entity":"The Catcher in the Rye","creator":"J.D. Salinger",
 "refused":false,"hedged":false,"descriptors":["dated","frustrating","cynical"]}
```
- `entity` — the specific pick (raw string; NOT fully canonicalized — mind near-duplicates like "The Catcher in the Rye" vs "Catcher in the Rye")
- `creator` — author/architect/director/etc where applicable
- `descriptors` — adjectives the extractor pulled from the model's stated reasoning (the model's aesthetic vocabulary)
- `hedged` / `refused` — booleans (did the model dodge)

### `data/raw.jsonl` — 10,874 rows, full text responses
`{key, provider, model, domain, probe, i, text, stop, usage, ts}`. Use `text` only if you
need the original prose; `usage` has token counts; `ts` is an ISO timestamp.
(More raw than extracted rows: some raws weren't extracted — refusals/dupes/backfill.)

### `data/summary.json` — precomputed aggregates (USE THESE FIRST)
- `models` — list as above
- `domains` — list of {id, noun}
- `cells[model][domain][probe]` = `{n, dist:[[entity,count],...], entropy, hedged, refused}`
  - `dist` is the pick distribution, sorted desc by count. `entropy` is normalized Shannon
    entropy in [0,1] (0 = unanimous, 1 = maximally spread). This is your agreement metric.
- `modelStats[model]` = `{n, hedgeRate, refusalRate, meanEntropyFavorite,
  meanEntropyOverrated, distinctFavorites, favoriteSamples, topDescriptors:[[word,count]]}`
- `overlap` — 13×13 matrix of pairwise cross-model pick similarity (rows/cols indexed by `overlapModels`)
- `overlapModels` — the model-id order for `overlap` rows/cols
- `consensus` — top-20 most cross-model-agreed entities: `{entity, domain, models, total}`
  (`models` = how many of 13 models picked it; `total` = total sample count)

### `data/aliases.json` — canonicalization map, per domain: `{domain: {rawstring: canonical}}`
Apply when counting agreement if you want to be strict about near-duplicate strings.

## Environment
- `python3` with **numpy 2.4.4**. **No scipy, no pandas.** Prefer permutation / bootstrap /
  exact tests you can implement with numpy + stdlib (`collections`, `statistics`, `math`,
  `itertools`, `random`). For significance, permutation tests are the house style — no scipy needed.
- Do NOT hit any network / model API. This is offline analysis of existing data only.

## Conventions for analysis outputs
- Write findings to `analysis/round<N>/`. One markdown file per question: `Q<n>_<slug>.md`.
- Every quantitative claim must show the number and the method that produced it. State
  sample sizes and caveats (canonicalization, small-n cells). Distinguish "descriptive"
  from "significance-tested".
- Reusable computation → drop a script in `analysis/lib/` so results are reproducible.
- Derived tables → `analysis/data/` as CSV or JSON.
