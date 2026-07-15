# Q5 — Who gets called overrated? Fame and gender asymmetries in the models' picks

**Scope note on framing**: everything below is a measurement of *what 13 AI models say*
when asked "what's your favorite X" vs "name a widely-beloved X you find overrated." It is
a property of the models' generated text — their training-shaped selection behavior — not
a claim about the actual merit, fame, or worth of the real people, books, or buildings
named. Where the analysis touches gender, that is doubly true: it measures which named
public figures the models reach for under each prompt, coded by a hand-built lookup, not
a claim about any group's aesthetic or intellectual standing.

Source: `data/extracted.jsonl` (9,262 non-refused rows after loading via `aa.load_extracted()`),
domains `bookcover` and `chair` excluded per instruction (also excluded from the Data
Dictionary's 43-domain list). Code: `analysis/lib/q5_overrated.py`. Derived tables:
`analysis/data/q5_zero_overlap_by_domain.csv`, `q5_fame_proxy_by_domain.csv`,
`q5_gender_by_domain.csv`, `q5_gender_coverage.csv`.

---

## Part A — Fame: "most famous, never loved"

### A.1 — Method: zero-overlap quantification

For each of the 43 domains, using canonicalized entity strings (`entity_canon`, via
`aliases.json`), split named entities into three buckets per probe: named under
`favorite` only, named under `overrated` only, or named under both. "Overrated-only"
entities are the "most famous, never loved" candidates from content-H7 (Gehry, Catcher
in the Rye, Mona Lisa). This is pure counting — no subjective judgment calls beyond the
canonicalization already shipped in `aliases.json`.

### A.1 — Results

**Pooled across all 43 domains**: of 4,438 total `overrated` samples, **2,773 (62.5%)**
name an entity that has *zero* favorite mentions anywhere in that domain. Symmetrically,
of 4,630 `favorite` samples, **3,090 (66.7%)** name an entity with zero overrated mentions.
Both probes are dominated by their own private cast of entities — but the interesting
asymmetry content-H7 pointed at is in *which* entities anchor the overrated-only bucket:
they are overwhelmingly the single most culturally dominant representative of the category,
not a random pick.

Highlights (canonicalized counts; domain, entity, overrated-only count / favorite count in
same domain — 0 unless noted):

| Domain | Overrated-only anchor | Count | Domain overrated-only share |
|---|---|---|---|
| architect | Frank Gehry | 91 / 0 | 90.1% |
| book | The Catcher in the Rye | 81 / 0 | 82.4% |
| painting | Mona Lisa | 81 / 0 | 95.8% |
| boardgame | Monopoly | 79 / 0 | 73.1% |
| childrensbook | The Giving Tree | 85 / 0 | 98.9% |
| tvshow | Friends | 61 / 0 | 98.6% |
| city | Paris | 69 / 0 | 100% |
| album | Sgt. Pepper's Lonely Hearts Club Band | 47 / 0 | 50.4% |
| theologian | C.S. Lewis (combined spellings) | 40 / 0 | 43.8% |
| religioustext | Book of Revelation | 40 / 0 | 69.6% |

(Raw, non-canonicalized substring counts for the four H7 anchor cases came out close but
not identical — Gehry 91, Catcher in the Rye 81, Mona Lisa 88, Monopoly 79 — small
differences from H7's originally-cited 95/84/82 are counting-method artifacts, canonicalized
exact-match here vs. raw substring match there; both agree on the qualitative point: 0
favorite mentions.)

Two domains stand out as *not* fitting the pattern: **aimodel** (4.3% overrated-only — the
"overrated" AI-model picks mostly also show up as somebody's favorite) and **computerscientist**
(15.4%) and **economist** (14.0%) — in these, the same handful of famous names (Turing,
Knuth, Keynes, Hayek) get cited on *both* sides by different models, which is the H6
"contested entity" pattern rather than the H7 "famous but never loved" pattern. Full
per-domain table: `analysis/data/q5_zero_overlap_by_domain.csv`.

### A.2 — Method: internal fame proxy (explicitly non-circular by construction)

Per the brief, an internal proxy avoiding "most-overrated = most-famous" circularity:
**breadth** — for each individual sample (one model naming one entity under one probe),
count how many of the **other 12 models** (leave-one-model-out) ever named that same
`entity_canon` in that domain, under **either** probe. This is a pure name-recognition /
salience measure: it does not know or care whether the sample itself was a favorite or
overrated pick, only whether other models have heard of the entity at all. A secondary,
more literal reading of the brief's "mention count across the OTHER probe" cue: for each
sample, the count of the *same* entity named under the *opposite* probe by the other 12
models.

Both proxies are internal to this dataset — a real fame measure (Wikipedia pageviews,
citation counts, box office) is a **future-data ask**, not attempted here; treat the causal
claim ("overrated targets are picked *because* they're famous") as **RED**, consistent with
content-H7's own rating. The descriptive correlational result below is at best YELLOW.

### A.2 — Results

Pooled over all 43 domains, 9,068 samples:

| Proxy | Mean, favorite samples | Mean, overrated samples | Diff | Permutation p (20k, two-sided) |
|---|---|---|---|---|
| Breadth (other 12 models, either probe) | 4.97 | 6.25 | +1.28 | **< 0.0001** (0/20,000 exceeded) |
| Same-entity mentions in the *other* probe (other 12 models) | 4.60 | 4.80 | +0.20 | 0.352 (n.s.) |

The breadth proxy shows a real, statistically clear effect: entities named as overrated are
on average recognized by ~1.3 more of the other 12 models (out of a max of 12) than entities
named as favorite — consistent with "overrated targets tend to be broadly known" rather than
obscure. The narrower same-entity-opposite-probe proxy is *not* significant, which makes
sense given A.1: the overrated-only anchors (Gehry, Catcher, Mona Lisa, Monopoly, Friends,
Paris...) score **zero** on this proxy by definition (nobody names them as favorite), so this
specific operationalization undercuts itself for exactly the entities the fame story is about.
Breadth is the more informative of the two.

The breadth effect is **directionally consistent but not universal**: 28 of 43 domains
(65%) show overrated-picks with higher mean breadth than favorite-picks; 15 domains (35%)
go the other way (favorite picks more broadly recognized) — notably cuisine, religioustext,
play, actor, smell, monument, object, dish, season, uscity. Domains with the largest
overrated > favorite breadth gap: childrensbook (+7.5), tvshow (+7.2), book (+6.8), poem
(+6.2), architect (+4.6) — these are exactly the domains that also show the strongest
zero-overlap "famous, never loved" pattern in A.1. Full table:
`analysis/data/q5_fame_proxy_by_domain.csv`.

### Part A verdict

**Supported, descriptively, as an internal-dataset pattern; not established as a causal
fame mechanism.** ~63-67% of both probes' volume sits on entities the *other* probe never
touches, and the overrated-only anchors are disproportionately drawn from a small set of
maximally-famous representatives per category (Gehry, Mona Lisa, Friends, Paris, Monopoly,
Catcher in the Rye). A within-dataset breadth proxy — how many of the other 12 models
recognize the entity at all, independent of valence — is significantly higher for overrated
picks (p < 0.0001), and the effect concentrates in exactly the domains where the zero-overlap
pattern is strongest. But "breadth in this dataset" is not "real-world fame"; confirming the
causal story (models reach for the most objectively famous X and then critique it) needs an
external fame measure this project does not have.

---

## Part B — Gender

### Method

**Domain scope**: the 11 person-domains named in the brief where gender is inferable and not
a category label itself — novelist, philosopher, economist, scientist, theologian,
mathematician, historian, psychologist, computerscientist, airesearcher, architect.
`actor`/`actress` are excluded from the formal test because the domain label *is* the gender
category — coding by name would just re-derive the domain split, not measure anything. (A
quick descriptive check confirms why exclusion is right: top "actor" pick across the dataset
includes Tilda Swinton at 42 mentions and top "actress" pick includes Tilda Swinton at 27 —
models don't even respect the domain's own gender framing consistently, which is a separate,
interesting data-quality wrinkle but orthogonal to this test.)

**Name → gender lookup**: built directly in `analysis/lib/q5_overrated.py` as two explicit,
inspectable Python sets, `FEMALE_KEYS` (22 name-keys / ~21 people) and `MALE_KEYS` (178
name-keys), 200 name-keys total, covering every distinct `creator` (fallback `entity`)
string that occurs in the
11 domains — enumerated by first dumping the full distinct-name list per domain (all of them
well-known real public figures: Hemingway, Keynes, Feynman, Gehry, etc.) and hand-classifying
each. Names are normalized (`name_key()`: lowercase, strip punctuation, fold accents,
including manual handling for letters NFKD doesn't decompose like ø/æ) before lookup, so
spelling variants ("C.S. Lewis" / "C. S. Lewis", "Ramanujan" / "Srinivasa Ramanujan",
"Søren Kierkegaard") resolve to the same entry. Anything not in either set falls through to
**"U" (unknown)** — the code never guesses. The full audit trail (every name-key, its sample
count, and its assigned label) is written to `analysis/data/q5_gender_coverage.csv` for
inspection/correction.

This is a **hand-built lookup from the analyst's general knowledge, not a verified external
biography/Wikidata source** — YELLOW tractability, same as content-H3. It is defensible here
specifically because the universe is closed and small (200 distinct names, all majorly
public figures with unambiguous, well-documented gender presentation) — this would NOT
generalize to a corpus of lesser-known names without a real lookup.

**Coverage**: **100.0% (2,424/2,424 samples)** — every name occurring in these 11 domains
resolved to F or M; zero fell into the unknown bucket. (Two names were initially missed in a
first pass — Baruch Spinoza and Viktor Frankl — and one had a transliteration bug (Søren
Kierkegaard); both fixed and re-verified in the code before producing the numbers below.)

**Test**: female share of favorite picks vs. overrated picks, permutation test (20,000
reshuffles, two-sided) on the difference in means, via `aa.perm_test`. Per-domain and pooled.

### Results — per domain

| Domain | n favorite | n overrated | % female (favorite) | % female (overrated) | diff (pp) | perm p |
|---|---|---|---|---|---|---|
| novelist | 120 | 111 | 27.5% | 4.5% | +23.0 | <0.0001 |
| philosopher | 100 | 116 | 1.0% | 15.5% | **−14.5** | <0.0001 |
| economist | 140 | 114 | 7.9% | 0.0% | +7.9 | 0.0028 |
| scientist | 126 | 114 | 50.8% | 1.8% | +49.0 | <0.0001 |
| theologian | 104 | 96 | 1.0% | 0.0% | +1.0 | 1.0 (n.s.) |
| mathematician | 96 | 135 | 39.6% | 0.0% | +39.6 | <0.0001 |
| historian | 108 | 121 | 24.1% | 9.9% | +14.2 | 0.0041 |
| psychologist | 84 | 88 | 0.0% | 0.0% | 0.0 | 1.0 (n.s., no women present either side) |
| computerscientist | 104 | 117 | 22.1% | 9.4% | +12.7 | 0.0141 |
| airesearcher | 116 | 91 | 0.9% | 0.0% | +0.9 | 1.0 (n.s.) |
| architect | 108 | 115 | 6.5% | 0.0% | +6.5 | 0.0061 |

**The scientist flip, in the models' own words** (raw top picks by count):
- Favorite top-8: Richard Feynman (26), **Emmy Noether (26)**, **Marie Curie (24)**, **Ada
  Lovelace (14)**, Alan Turing (9), James Clerk Maxwell (8), Santiago Ramón y Cajal (7),
  Michael Faraday (6) — 3 of the top 4 are women, 64/126 (50.8%) of all favorite-scientist
  picks name a woman.
- Overrated top-8: Neil deGrasse Tyson (29), Nikola Tesla (24), Albert Einstein (16), Thomas
  Edison (13), Richard Feynman (9), Stephen Hawking (9), Carl Sagan (7), Michio Kaku (4) —
  zero women in the top 8; across all 114 overrated-scientist samples only **2** name a woman
  (both Marie Curie).

**The one domain that flips the *other* way** — philosopher, −14.5pp (more female in
overrated than favorite) — is a single-entity artifact: Ayn Rand accounts for 18 of the 116
overrated-philosopher samples (15.5%) and is the *only* woman named at all on either side of
this domain in any volume (favorite side: a single mention, from Iris Murdoch, out of 100 —
1.0%). This is not "women philosophers are seen as overrated" so much as "the one woman these
13 models associate with the philosopher category by name recognition is Ayn Rand, and she's
named almost exclusively to be dismissed."

### Pooled result (11 domains, 2,424 samples)

**Female share: 17.0% of favorite picks (205/1,206) vs. 3.9% of overrated picks (48/1,218)
— a 13.1 percentage-point gap, permutation p < 0.0001** (0/20,000 reshuffles matched or
exceeded the observed gap).

### Robustness

Both requested robustness variants — (i) exclude unknowns, (ii) worst-case-for-the-effect
(any unknown coded male in the favorite pool, female in the overrated pool, i.e. the coding
that would *minimize* the gap) — are **identical to the primary result**, because coverage
is 100%: there are no unknowns to redistribute. This is a genuine robustness result (there is
no hidden unknown-driven inflation), but it should not be over-read as validating the lookup
itself beyond its stated scope — it only means the closed, 200-name universe in these 11
domains happened to be fully classifiable by the analyst without guessing, not that the
lookup would achieve 100% coverage on a broader or less-famous name set.

### Part B verdict

**Supported, robustly, within the stated scope.** Across 11 person-domains and 2,424
classified samples (100% coverage under a hand-built but fully auditable lookup), these 13
models' favorite picks are ~4.3x more likely to be a woman than their overrated picks
(17.0% vs 3.9%, p < 0.0001). The effect holds in 8 of 11 domains individually (5 reaching
p < 0.01), is null (not zero-vs-zero-different, genuinely absent) in 3 domains where women
are barely named on either side (theologian, psychologist, airesearcher), and reverses in
exactly 1 domain (philosopher) for a documented, single-entity reason (Ayn Rand). The
"scientist flip" the brief called out — Curie/Noether/Lovelace as favorites vs.
Tyson/Tesla/Einstein/Edison as overrated — replicates cleanly and is the single largest
per-domain effect (49.0pp).

---

## Caveats

- **Hand-built lookups throughout.** The gender dictionary (200 name-keys) and the domain/
  entity canonicalization (`aliases.json`, pre-existing) both reflect one analyst's
  classification judgment, not a verified external source (Wikidata, VIAF, etc.). The
  universe here is small and closed enough (well-known public figures) that this is
  low-risk, but it is not a substitute for a verified lookup, and the code is written so
  every classification is visible and correctable (`GENDER` dict in
  `analysis/lib/q5_overrated.py`; full audit CSV in `analysis/data/q5_gender_coverage.csv`).
- **Unknown handling was conservative by design** — nothing was guessed to fill a cell — but
  in this run it turned out coverage was 100%, so the "exclude" and "worst-case" robustness
  variants are trivially identical. That is a property of this specific closed dataset, not
  a general guarantee the method would hit 100% coverage elsewhere.
- **The internal fame proxy (breadth) is explicitly not a real fame measure.** It only
  captures how often an entity recurs within this 13-model, 43-domain dataset. A domain full
  of niche entities where one happens to be named by 6 of 13 models is not "famous" in any
  external sense — it's just this dataset's internal consensus, which is exactly what H2
  already measures for overrated picks generally. Treat the fame-causal claim as RED per the
  brief; the breadth correlation is a real, non-circular *pattern in this data*, not proof of
  mechanism.
- **`actor`/`actress` were excluded from Part B on principle** (the domain label is the
  gender category), but the fact that models cross-contaminate them (Tilda Swinton named
  under both "actor" and "actress" in volume) suggests these two domains carry their own
  data-quality issue unrelated to this question — noted, not chased further here.
- **Canonicalization affects exact counts.** A.1's canonicalized entity counts (e.g., Gehry
  91) differ slightly from content-H7's originally-cited raw-string counts (Gehry 95) and
  from a naive raw substring count (Gehry 91, Mona Lisa 88 vs. 81 canonicalized) — expected,
  since canonicalization merges near-duplicate strings (or excludes tangential
  substring-matched phrases) differently than raw counting. The qualitative finding (these
  entities have zero or near-zero favorite mentions) is stable across all three
  counting methods; treat specific integers as approximate to a few units.
- **Small-n cells exist.** Several per-domain gender splits rest on <15 known-female samples
  in one arm (e.g., architect overrated n=0 female out of 115) — the permutation test handles
  this correctly (it doesn't assume normality), but a handful of samples flipping category
  could move a per-domain percentage substantially. The pooled result (2,424 samples) is far
  more stable than any single domain row.

## What this means

Within this dataset, both patterns the director flagged are real, in the narrow sense of
"these are properties of what 13 models actually generated," and both come with the same
structural caveat: the models are not drawing from a stable, hidden preference ranking and
revealing it twice — the `favorite` and `overrated` probes surface almost entirely disjoint
casts of entities (62-67% zero-overlap), and the overrated cast disproportionately consists
of the single most recognizable representative of a category (Gehry for architect, Mona Lisa
for painting, Friends for tvshow) and, in person-domains, disproportionately male relative to
the favorite cast (17.0% vs 3.9% women, driven hardest by the scientist domain's Curie/
Noether/Lovelace-vs-Einstein/Tesla/Tyson split). Neither pattern should be read as "these
models believe women's or famous people's work is worse" — the far better-supported reading
is a *retrieval* story: asked to name something "widely beloved" to critique, the models
reach for whatever is most culturally over-determined/canonical to name at all (which, given
the training data's own historical composition, skews toward a small set of very famous, and
disproportionately male, historical figures and works) — then generate a critique of it. That
mechanism claim is plausible and consistent with the internal fame-breadth correlation found
here, but confirming it causally needs the external fame data this project doesn't have.
