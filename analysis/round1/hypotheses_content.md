# Round 1 — Content Hypotheses: what and why do 13 AI models like

Source: `data/extracted.jsonl` (9,395 rows), `data/summary.json`. Computed with `python3`
+ numpy only (no scipy/pandas). All bucketing rules are stated explicitly since none of it
is precomputed metadata — treat classification-dependent numbers as descriptive, not as
verified ground truth, until an external lookup double-checks them.

Scope note: `extracted.jsonl` actually contains 44 domain values, not the 43 in the data
dictionary (`chair` n=81, `bookcover` n=108 are extra/deprecated domains) — excluded from
all counts below.

---

## H1 — Models' favorites skew heavily toward East/South Asia; their "overrated" targets almost never do

**Why interesting**: this is the director's top hunch ("AIs really like Asia") — worth
pinning down with an actual number instead of a vibe.

**Test**: Across 21 "cultural-pick" domains (cuisine, dish, city, building, monument,
architect, film, novelist, book, religioustext, boardgame, artmovement, poem, painting,
tvshow, street, childrensbook, videogame, album, philosopher, historian), classify each
`favorite`/`overrated` sample's `entity`+`creator` text by keyword match:
- **Japan**: japan/japanese/kyoto/tokyo/tadao ando/ghibli/miyazaki/murakami/kurosawa/ozu/
  ramen/tonkotsu/ukiyo/basho/kawabata/wabi, plus the literal answer "Go" (Japanese name for
  the board game, tracked separately since it's Chinese-origin)
- **East Asia (non-Japan)**: china/chinese/sichuan/xiao long bao/mapo tofu/korea/korean/
  bibimbap/hong kong/wong kar-wai/vietnam*/tao te ching/laozi/confucius/taois*
- **South Asia**: india*/taj mahal/bhagavad gita/ramanujan/amartya sen
- everything else uncoded

**Motivating number**: **20.3% of favorite samples (472/2,329)** in these domains are
Asia-coded vs **3.0% of overrated samples (68/2,255)** — a ~7x ratio. Broken down: Japan
alone is 11.0% of favorites vs 1.3% of overrated (the overrated Japan hits are almost
entirely Haruki Murakami, 29/30). Per-domain favorite rates: cuisine 95% (Japanese cuisine
43×, Sichuan 5×), city 84% (Kyoto 83, Tokyo 4), religioustext 74% (Tao Te Ching 50,
Bhagavad Gita 9), architect 56% (Tadao Ando 61/108), boardgame 55% (Go 53/96). By contrast,
building is 1% (Sagrada Família and Salk Institute, not Asian, dominate) — the skew is not
uniform across domains, it's concentrated in cuisine/city/religion/architecture/games.

**Tractability**: YELLOW — keyword bucketing is mine, not a verified gazetteer; "Go"
(Chinese-invented, Japanese-named) and "Tao Te Ching" (Chinese, not Japanese) are judgment
calls I flagged rather than hid. A cleaner version would need a country/culture-of-origin
lookup table for ~150 distinct entities.

---

## H2 — "Overrated" nominations are more mutually agreed-upon than "favorite" ones — models converge harder on what to reject than on what to love

**Why interesting**: reframes the favorite/overrated asymmetry as a *structural* fact about
the two probes, not just a content one: rejecting the canon is a more homogeneous act than
having taste.

**Test**: For each of 43 domains, compute the top-pick's share of all samples (concentration)
for `favorite` vs `overrated`, pooling across all 13 models. Paired permutation test
(sign-flip the 43 domain-level differences 20,000 times) on the mean difference.

**Motivating number**: mean top-pick share is **35.1% (favorite) vs 44.9% (overrated)**
across 43 domains — **permutation p = 0.0058** (43 paired domain observations, two-sided).
Sharpest cases: childrensbook 35%→97% (The Giving Tree owns overrated), poem 29%→82% (The
Road Not Taken), tvshow 15%→85% (Friends), book 21%→75% (Catcher in the Rye), architect
57%→79% (Frank Gehry). Corroborating: a from-scratch cross-model consensus count (like
`summary.json`'s `consensus` field, but for overrated) shows the top-20 overrated entities
average **11.35/13 models** in agreement vs **10.1/13** for the precomputed favorite top-20
— e.g. Paris, Helvetica, Frank Gehry, The Catcher in the Rye, and Friends each pull 12-13/13
models as "overrated."

**Tractability**: GREEN — pure counting + permutation test, no subjective bucketing, uses
raw `entity` strings (near-duplicates like "Tonkotsu Ramen"/"Tonkotsu ramen" would slightly
*understate* concentration since they're not merged — a stricter test with `aliases.json`
applied would likely widen the gap further).

---

## H3 — Models elevate women as favorites far more than they nominate women as overrated, across thinker/creator domains

**Why interesting**: this is a sharper, more falsifiable version of "is taste gendered" —
it's not just "are favorites male-skewed" (they are, per field composition) but that the
skew *reverses direction* between the two probes.

**Test**: Across 12 person-domains where gender is knowable and not a category label itself
(novelist, philosopher, economist, scientist, historian, psychologist, mathematician,
computerscientist, airesearcher, theologian, architect, blogger — **excludes actor/actress**,
which are gendered by construction), take `creator` (fallback `entity`) per sample, tag
against a manually-built list of 26 known women (Ursula K. Le Guin, Virginia Woolf, George
Eliot, Toni Morrison, Jane Austen, Iris Murdoch, Ayn Rand, Elinor Ostrom, Joan Robinson,
Marie Curie, Emmy Noether, Ada Lovelace, Barbara Tuchman, Natalie Zemon Davis, Doris Kearns
Goodwin, Mary Beard, Fei-Fei Li, Barbara Liskov, Grace Hopper, Zaha Hadid, Simone Weil,
Maria Popova, Ree Drummond, Chiara Ferragni, Gwyneth Paltrow), everyone else coded male.
Permutation test (20,000 reshuffles) on % female, favorite vs overrated.

**Motivating number**: **19.3% female among favorites (253/1,312) vs 4.2% among overrated
(57/1,353)** — **permutation p < 0.00005** (0/20,000 reshuffles matched the observed 15.1pp
gap). The most extreme per-domain flips: scientist 50.8%→1.7% (favorite: Feynman/Noether/
Curie/Lovelace; overrated: Tyson/Tesla/Einstein/Edison — 0 women except 2 Curie mentions),
mathematician 39.6%→0% (Noether/Lovelace vs. an all-male overrated list), blogger 45.3%→6.6%
(Maria Popova/The Marginalian vs. Tim Ferriss/Seth Godin/Mark Manson, with the few female
overrated picks being lifestyle bloggers — Ree Drummond, Chiara Ferragni, Gwyneth Paltrow —
not intellectual ones). One domain runs the *other* way: philosopher goes 1.0%→15.5%,
entirely because Ayn Rand (18 overrated mentions) is the one woman philosopher models
reach for, and only to criticize.

**Tractability**: YELLOW — the female-name list is hand-built from general knowledge, not
an external biography database; it's a closed, checkable list of 26 real public figures
(low ambiguity), but a rigorous version should cross-check names against a birth-sex/gender
lookup (e.g. Wikidata) rather than my own recall.

---

## H4 — Favorites cluster in 1920s–1970s modernism; "overrated" clusters in the 1980s (and, contested, the 1950s)

**Why interesting**: tests the "mid-century modern nostalgia" hunch directly against the
one domain built for it (`decade`), rather than inferring it from architecture picks alone.

**Test**: Normalize `entity` strings in the `decade` domain to canonical `19XXs` decade
labels, tabulate distribution for favorite vs overrated.

**Motivating number**: favorite decade total n=76: **1960s 56.6% (43), 1920s 25.0% (19),
1970s 10.5% (8), 1950s 7.9% (6)** — i.e. essentially all favorite mass sits in 1920s–1970s.
Overrated decade total n=72: **1980s 61.1% (44), 1950s 36.1% (26), 1960s 1.4% (1)**. The
1960s is almost purely a favorite decade (43 favorite vs 1 overrated mention) and the 1980s
is almost purely a reviled one (0 favorite mentions at all), but the **1950s is contested**
— 6 favorite mentions vs 26 overrated, present on both sides but net negative. This
partially confirms and partially complicates "mid-century modern nostalgia": it's really
1920s+1960s (interwar modernism + a countercultural design-and-science decade) that's loved,
with the immediate postwar (1950s) and the 1980s read as the tacky/overexposed eras.

**Tractability**: GREEN — decade is a clean structured field, only needed regex
normalization ("The 1960s" → "1960s"), no subjective judgment calls.

---

## H5 — There is a shared, near-universal AI aesthetic vocabulary for favorites ("elegant" above all), and it is almost disjoint from the overrated vocabulary

**Why interesting**: if 13 differently-trained models from 5 labs all reach for the same
adjective to describe what they love, that's a strong claim about a convergent "AI taste"
rather than 13 independent tastes.

**Test**: From `modelStats[model].topDescriptors` (favorite-probe descriptors per model,
already computed) — check whether "elegant" ranks #1 for every model. Separately, pool all
`descriptors` from `extracted.jsonl` by probe (lowercased) and compare top-20 word lists for
overlap.

**Motivating number**: **"elegant" is the single most-used favorite-descriptor for 13/13
models** (counts range from 49 for kimi-k2.6 to 138 for gemini-3.1-pro-preview, out of
616-800 samples per model) — no other word achieves this. Pooling across all models: 20,294
favorite-descriptor tokens vs 17,521 overrated-descriptor tokens; **only 2 of the top-50
words for each probe overlap** ("elegant": 1,095 favorite mentions vs 89 overrated;
"sculptural": 136 vs 114). Favorite's next-most-common words are luminous/geometric/precise/
poetic/minimalist/honest/timeless/intimate/mathematical/organic — a "restrained, precise,
contemplative" register. Overrated's are repetitive/shallow/hollow/rigid/tedious/exhausting/
spectacle/superficial/reductive/romanticized — a "hollow spectacle" register. Notably
"iconic" (114 overrated vs 15 favorite) and "polished" (112 vs 5) are near-exclusively
overrated words — i.e. being called iconic/polished is a tell for critique, not praise, in
this dataset.

**Tractability**: GREEN — direct counting from precomputed `topDescriptors` and raw
`descriptors` arrays, no bucketing judgment calls (descriptors are already lowercase-able
strings the extractor produced).

---

## H6 — Individual entities split models rather than being uniformly loved or hated: San Francisco, Helvetica, Impressionism, Turing, and Waiting for Godot are simultaneously "favorite" and "overrated" picks

**Why interesting**: complicates H1/H2/H4 — the favorite/overrated split isn't a clean
partition of entities into two camps; specific entities are genuinely contested *across*
models, which is a different (and arguably more interesting) kind of disagreement than
within-model entropy.

**Test**: Within each domain, intersect the set of entities named under `favorite` with the
set named under `overrated` (raw `entity` strings, `None`s excluded); for shared entities,
report the favorite-count vs overrated-count split.

**Motivating number**: **39 of 43 domains have at least one entity claimed as both favorite
and overrated.** Standouts: uscity — San Francisco **30 favorite / 28 overrated**, almost a
perfect coin flip; typeface — Helvetica **8 / 65** (mostly overrated but not exclusively);
artmovement — Impressionism **29 / 53**; computerscientist — Alan Turing **32 / 39** and
Donald Knuth **22 / 24** (both are simultaneously top favorite AND top overrated pick in
their domain); religioustext — Tao Te Ching **45 / 14** and Bhagavad Gita **9 / 16**; play
— Waiting for Godot **23 / 17**; videogame — Zelda: Breath of the Wild **13 / 52**; word —
Serendipity **28 / 42**. This means, e.g., "Alan Turing" is not a consensus favorite with a
few dissenters calling him overrated — he is close to *equally* the top answer to both
prompts across the 13-model panel.

**Tractability**: YELLOW — uses raw (non-canonicalized) entity strings, so counts are a
floor; applying `aliases.json` would merge some near-duplicates (e.g. "Frank Lloyd Wright"
spellings) and could reveal more or fewer overlaps depending on the domain. Worth re-running
with canonicalization applied before treating exact percentages as final.

---

## H7 — "Overrated" targets tend to be the single most world-famous representative of a category, independent of whether models otherwise like that category

**Why interesting**: offers a candidate *mechanism* for H2/H6 — models aren't nominating
their least-favorite item in a domain, they're nominating whatever they'd guess is the most
famous/canonical one and then critiquing it, which is a different cognitive move (recall
fame → apply critique) than genuine anti-preference.

**Test**: For domains where the overrated top-pick is a plausible "most famous X" (Mona
Lisa/painting, Eiffel Tower or Paris/monument-city, Frank Gehry/architect, Alan Turing or
Sigmund Freud/scientist-adjacent, Helvetica/typeface, Friends/tvshow), cross-check against
an external fame proxy (Wikipedia pageviews, or a hand-built "most famous in category" list)
to see if overrated-nomination-rate correlates with real-world fame rank rather than with
low favorite-rate. Contrast cases where the overrated top-pick has *zero* favorite mentions
at all in the same domain (Frank Gehry: 95 overrated / 0 favorite in the architect list; The
Catcher in the Rye: 84 overrated / 0 favorite in the book list; Mona Lisa/painting: 82
overrated, doesn't even appear in the favorite top-8) — these look like "most famous, never
loved" rather than "formerly loved, now spurned."

**Motivating number** (descriptive, not yet fame-adjusted): of the 15 domains with a >70%
concentrated overrated top-pick (childrensbook 97%, poem 82%, tvshow 85%, book 75%, painting
68%, architect 79%, artmovement 63%, boardgame 73%, typeface 71%, economist 49%, sport 56%,
psychologist 60%, uscity split n/a...), **at least 6 of those top-picks (Gehry, Catcher in
the Rye, Mona Lisa, Sydney Opera House [42/120 building overrated], The Giving Tree, Monopoly
[79/108 boardgame overrated]) have 0 or near-0 favorite mentions anywhere in the same
domain** — consistent with "most famous, not formerly favorite."

**Tractability**: RED for the causal fame claim — needs an external, independent fame metric
(Wikipedia pageviews/citation counts/box-office, not derived from this dataset) to avoid
circularity, since "most nominated as overrated" and "most famous" are currently the same
measurement. The descriptive zero-overlap observation above is GREEN/YELLOW on its own but
doesn't establish the *mechanism* without that outside data.

---

## Summary table

| # | Hypothesis | Tractability | Key number |
|---|---|---|---|
| H1 | Asia/Japan skew in favorites vs overrated | YELLOW | 20.3% vs 3.0% of cultural-domain picks |
| H2 | Overrated is more consensus-driven than favorite | GREEN | top-share 44.9% vs 35.1%, p=0.0058 |
| H3 | Favorites skew female, overrated skews male | YELLOW | 19.3% vs 4.2% female, p<0.00005 |
| H4 | 1920s–1970s favored, 1980s (+1950s) reviled | GREEN | 92% of favorite decade mass in 1920s-1970s |
| H5 | Universal vocabulary ("elegant"), near-disjoint fav/overrated lexicons | GREEN | elegant #1 for 13/13 models; 2/50 word overlap |
| H6 | Entities split models, not cleanly loved/hated | YELLOW | 39/43 domains have a dual-cited entity; SF 30/28 |
| H7 | Overrated = most-famous-in-category, not anti-favorite | RED (mechanism) / YELLOW (descriptive) | Gehry 95 overrated / 0 favorite |
