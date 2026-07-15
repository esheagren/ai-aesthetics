# Q2 — Do models converge more on what they REJECT than on what they LOVE?

## Question

Across 13 models × 43 domains, is cross-model agreement systematically stronger for the
`overrated` probe (shared villains) than for the `favorite` probe (shared heroes)? And does
this reverse for people/thinker domains, where models might agree more on who to *admire*
than on who is *overrated* (a plausible RLHF-safety asymmetry around real named people)?

This claim has been derived three times already from different angles: content-H2 (top-pick
concentration, perm p=0.0058), conv-H5/H6 (max-model-agreement + entropy, with a people-group
flip), and `director_grounding.md` (consensus fraction 0.461 vs 0.550). This analysis
re-derives it from scratch with two independent metrics and proper paired tests, specifically
to check whether the finding survives being metric-agnostic and rigorously tested rather than
just descriptively replicated.

## Method

- Source: `data/extracted.jsonl`, canonicalized via `aa.load_extracted()` (applies
  `data/aliases.json`, drops `refused` rows). 43 official domains per `DATA_DICTIONARY.md`
  (legacy `bookcover`/`chair` excluded). `blogger` is the 43rd domain and — per the data
  dictionary's own grouping table — is not assigned to any of the five groups; it's kept in
  the overall 43-domain tests but excluded from the group-vs-group reversal test.
- **Metric (a) — modal-pick agreement fraction**: for each (domain, probe), take each of the
  13 models' own most-frequent pick (its "mode" across that model's ~4–36 samples for that
  cell); the metric is the fraction of models whose mode equals the plurality mode across the
  13. 6.9% of model×domain×probe cells (77/1117) have a tied mode; ties are broken
  alphabetically (deterministic, but arbitrary — noted as a caveat, not hidden).
- **Metric (b) — mean cell entropy**: for each (domain, probe), the mean over the 13 models
  of that model's own normalized Shannon entropy (`aa.norm_entropy`, which divides by
  `log(k)`, the number of distinct picks that model made) — lower means each model is more
  internally decisive/repeats itself more, which prior work in this batch treats as a proxy
  for consensus. **Important divergence from precomputed data**: `data/summary.json`'s own
  `entropy` field normalizes by `log(n_samples)` instead (confirmed in `src/report.js:506`:
  "Shannon entropy... normalized by log(n)"), which confounds sample count with dispersion —
  two cells with identical pick proportions but different sample sizes get different
  "entropy." That's why this analysis's entropy numbers (~0.46–0.48 means) are numerically
  much higher than earlier reports' summary.json-derived entropy (~0.21–0.23): different
  normalization base, not a different result. `aa.norm_entropy`'s `log(k)` base is used here
  as the more standard, sample-size-invariant definition.
- **Paired significance test**: 43 domain-level paired differences (favorite vs overrated).
  Ran a custom **paired sign-flip permutation test** (`q2_asymmetry.paired_sign_flip_test`):
  under the null, each domain's (overrated − favorite) difference is an independent fair coin
  flip in sign (the "swap within pair" null) — 20,000 resamples, two-sided. This is distinct
  from `aa.perm_test`, which pools and reshuffles group membership (wrong tool for a paired
  design) — not used here for this step. Also ran an **exact two-sided binomial sign test**
  on the nonzero paired differences.
- **The reversal**: grouped domains per `aa.DOMAIN_GROUP` (cultural/people/places/
  design_sensory/meta), computed each group's mean gap on both metrics, then ran a
  label-shuffle permutation test (20,000 resamples) comparing the people group's mean gap to
  the pooled cultural+places group's mean gap (the two most confidently-sized "expected
  overrated>favorite" groups).
- Environment: python3 + numpy 2.4.4 (numpy unused in the final script; stdlib
  `random`/`math`/`collections` sufficed), no network, no scipy/pandas.

## Results

### 1. Per-domain consensus, both probes, both metrics

Full table: `analysis/data/q2_consensus_by_domain.csv` (43 rows: domain, group, n models
present per probe, modal-fraction favorite/overrated + winning entity, modal gap, entropy
favorite/overrated, entropy gap).

Aggregate means across 43 domains:
- Modal-fraction: **favorite 0.449, overrated 0.531** (mean gap +0.082, overrated higher).
- Mean cell entropy: **favorite 0.482, overrated 0.458** (mean gap +0.023 in the
  favorite-minus-overrated direction, i.e. overrated slightly lower/more-decisive).

Caveat: one cell (`city`/`overrated`) has only 12 of 13 models present — `claude-opus-4-8`
produced zero non-refused, non-null entity picks for that cell. All other cells have 13 (or
effectively 13 with a handful of null individual samples, e.g. `kimi-k2.6`/`architect`/
`overrated` had 4 of 12 samples null but 8 valid ones survive).

### 2. Paired significance test

| Metric | Mean gap | Paired sign-flip perm p | Exact sign test |
|---|---|---|---|
| Modal fraction (ovr − fav) | **+0.082** | **p = 0.0281** | 27 domains ovr>fav, 12 fav>ovr, 4 ties → **p = 0.0237** |
| Mean cell entropy (fav − ovr) | +0.023 | **p = 0.4321** | 22 domains ovr more consensual, 21 reverse, 0 ties → **p = 1.00** |

This is the paper's central rigor check, and it's a genuinely metric-dependent result: the
**modal-fraction metric supports H5 at conventional significance** (p≈0.02–0.03, both tests
agree), but the **entropy metric — properly normalized — does not** (p≈0.43–1.0, essentially
a coin flip at the aggregate/whole-panel level, 22 vs 21 domains). The direction of the point
estimate is consistent both times (overrated more consensual), but only one of the two
required metrics clears significance. Prior reports' "same direction, corroborating" entropy
claims used the `log(n)`-normalized summary.json field, which is not a clean apples-to-apples
comparison once sample-size confounding is removed.

### 3. The reversal (people/thinkers vs cultural/places)

Mean gap per group (n domains; modal gap = ovr−fav; entropy gap = fav−ovr):

| Group | n | Modal gap | Entropy gap |
|---|---|---|---|
| cultural | 11 | **+0.252** | **+0.123** |
| places | 5 | −0.018 | +0.070 |
| people | 13 | +0.089 | **−0.049** |
| design_sensory | 9 | −0.068 | +0.005 |
| meta | 4 | −0.000 | −0.001 |
| (blogger, ungrouped) | 1 | +0.308 | −0.095 |

- **Entropy metric**: people-group gap (−0.049) is negative — i.e. on average, favorite
  picks are *more* decisive/consensual than overrated picks for people/thinker domains,
  genuinely reversed from cultural (+0.123) and places (+0.070). Label-shuffle test,
  people vs pooled cultural+places: **observed diff = −0.155, p = 0.0356** — significant.
- **Modal-fraction metric**: people-group gap (+0.089) is still *positive* — overrated is
  still somewhat more consensual on average for people domains too, just roughly a third the
  size of cultural's (+0.252). It does not flip sign under this metric. People vs pooled
  cultural+places: **observed diff = −0.079, p = 0.3798** — not significant.

So the reversal is real and statistically confirmed under the entropy metric, but under the
modal-fraction metric it's an attenuation (people domains show a much weaker overrated>
favorite gap than cultural/places), not a confirmed sign-flip, and that attenuation itself
isn't statistically distinguishable from cultural+places noise. **The honest verdict:
"reversal" is a real, mixed pattern rather than a clean, metric-independent flip.**

Within the people group, the entropy-based flip is concentrated in the more "academic/
factual" thinker domains — `scientist` (entropy gap −0.10), `mathematician` (−0.38, the
largest people-group flip: Emmy Noether/Lovelace-type favorite consensus vs a much more
scattered overrated field), `philosopher` (−0.17), `computerscientist` (−0.16),
`airesearcher` (−0.13), `historian` (−0.04), `actress` (−0.05) — while a few people domains
go the *other* way, still overrated-dominant on both metrics: `psychologist` (modal +0.38:
Freud 77% overrated vs Jung 38% favorite), `architect` (modal +0.23, entropy +0.03: Gehry 92%
overrated), `theologian` (modal +0.15, entropy +0.18), `novelist` (modal +0.23, entropy
≈−0.01, essentially flat). So even "people/thinkers" isn't monolithic — the flip is strongest
for scientific/technical thinkers, weak-to-absent for architects, novelists, psychologists,
and theologians, where a single famous name still draws heavy shared scorn.

### 4. Color

**Biggest per-domain swings toward overrated-consensus (modal-fraction gap, ovr−fav):**

| Domain | Favorite (winner, share) | Overrated (winner, share) | Gap |
|---|---|---|---|
| tvshow | Twin Peaks, 15% | Friends, 92% | **+0.77** |
| childrensbook | Where the Wild Things Are, 46% | The Giving Tree, 100% | +0.54 |
| book | Invisible Cities, 31% | The Catcher in the Rye, 77% | +0.46 |
| poem | Prufrock, 38% | The Road Not Taken, 85% | +0.46 |
| psychologist | Carl Jung, 38% | Sigmund Freud, 77% | +0.38 |

**Biggest swings the *other* way (favorite more consensual than overrated):**

| Domain | Favorite | Overrated | Gap |
|---|---|---|---|
| smell | petrichor, 85% | fresh-cut grass, 46% | **−0.38** |
| religioustext | Tao Te Ching, 77% | Book of Revelation, 46% | −0.31 |
| cuisine / dish | (both −0.23) | | −0.23 |
| actor | Tilda Swinton, 54% | Tom Hanks, 31% | −0.23 |

**Entities simultaneously loved and hated (content-H6, re-derived with canonicalization,
sorted by how balanced the split is)** — confirms and cross-checks the earlier raw-string
version:

| Domain | Entity | Favorite (n) | Overrated (n) |
|---|---|---|---|
| uscity | San Francisco | 30 | 28 |
| computerscientist | Alan Turing | 32 | 39 |
| computerscientist | Donald Knuth | 28 | 24 |
| color | Teal | 34 | 23 |
| theologian | Thomas Aquinas | 29 | 22 |
| airesearcher | Geoffrey Hinton | 39 | 21 |
| psychologist | Carl Jung | 31 | 20 |
| sport | Soccer | 20 | 25 |
| play | Waiting for Godot | 23 | 17 |
| economist | John Maynard Keynes | 34 | 57 |
| artmovement | Impressionism | 29 | 53 |
| word | Serendipity | 30 | 42 |
| aimodel | GPT-4 | 31 | 42 |
| mathematician | Srinivasa Ramanujan | 19 | 40 |
| musical | Hamilton | 19 | 27 |

San Francisco is the closest thing to a true 50/50 split in the whole dataset (30 vs 28 across
13 models × up-to-12 samples). Alan Turing and Donald Knuth are each *simultaneously the
single top favorite pick and a heavily-cited overrated pick* in their own domain — models
aren't split into camps of "Turing fans" vs "Turing skeptics" so much as individual models
routinely praise and separately critique the same canonical figure across different sample
draws.

## Verdict

**Supported, but only partially and with real metric-dependence — treat as "real but
modest," not "clean and dramatic."**

- The core H5 claim (overrated > favorite consensus) is **statistically significant under
  the modal-fraction metric** (mean gap +0.082, p≈0.02–0.03 by two independent tests) but
  **not significant under a properly-normalized entropy metric** (mean gap +0.023, p≈0.43–1.0).
  Both point estimates go the same direction; only one clears a conventional significance
  bar. The magnitude is moderate, not overwhelming: 27 of 43 domains lean overrated-consensual,
  12 lean the other way, 4 are ties — roughly 2:1, not "always."
- The people/thinkers **reversal is real and significant under the entropy metric** (people
  gap −0.049 vs cultural+places pooled ≈+0.11, p=0.036) but **attenuation-only (not a
  confirmed sign flip) under the modal-fraction metric** (people gap still +0.089, positive,
  p=0.38 vs cultural+places). So: "the effect gets much weaker, and flips sign on one of two
  metrics, for people/thinker domains" is the defensible statement — "the effect cleanly
  reverses" is an overclaim on the modal metric alone.
- Where it flips hardest: technical/scientific thinker domains (mathematician, scientist,
  philosopher, computerscientist, airesearcher). Where it doesn't flip at all: architect,
  psychologist, theologian, novelist — these still show strong overrated consensus (Gehry,
  Freud, C.S. Lewis, Hemingway), so "people domains are safe from convergent scorn" is false
  as a blanket claim.

## Caveats

- **Metric choice matters more than expected.** This is the headline caveat, not a footnote:
  a study that only ran the modal-fraction metric (as content-H2/conv-H5 effectively did, via
  top-pick-share and max-agreement counts) would report a clean, significant finding; adding
  the entropy metric — properly normalized — shows the aggregate result is fragile. Report
  both, always, for this claim.
- **Entropy normalization is a real methodological trap in this dataset.** `summary.json`'s
  precomputed `entropy` field divides by `log(n_samples)`, not `log(k_distinct_picks)`. That
  conflates "how many times we asked" with "how spread the answers are" and is not
  sample-size-invariant. Any future analysis reusing `cells[...].entropy` directly should be
  aware its magnitude is not directly comparable to a standard normalized-entropy metric like
  `aa.norm_entropy` (log(k)).
- **Small-n cells.** Per-model sample counts for a given (domain, probe) range roughly 4–36
  (adaptive sampling); domains/models near the low end make both the mode and the entropy
  noisier. `city`/`overrated` has only 12 of 13 models present (one model's samples were all
  null-entity, non-refused).
- **Canonicalization is imperfect.** Uses `data/aliases.json`; near-duplicate spellings not
  in that map would fragment a pick and understate consensus in either direction. The
  dual-entity list re-derived here matches content-H6's raw-string numbers closely (e.g.
  Turing 32/39, San Francisco 30/28 — identical), suggesting canonicalization isn't
  materially distorting the biggest cases, but smaller counts are less certain.
- **Modal tie-breaking**: 77 of 1117 model×domain×probe cells (6.9%) have a tied top pick;
  ties are broken alphabetically, a deterministic but arbitrary rule that could nudge a small
  number of individual domain gaps by a little.
- **Group sizes are uneven** (cultural n=11, people n=13, places n=5, design_sensory n=9,
  meta n=4) — the meta and places group means in particular rest on few domains and one
  unusual domain (e.g. `religioustext` in meta, gap −0.31/−0.37) can swing the group mean.
- The reversal test compares people against a *pooled* cultural+places group by necessity
  (places alone is only 5 domains); this is a reasonable but not the only defensible pooling
  choice.

## What this means

The "shared villains > shared heroes" story is a real, replicated pattern in this dataset,
but it is neither as clean nor as universal as the three prior descriptive derivations made
it look — it survives one of two independently-reasonable agreement metrics at conventional
significance, and its much-touted "flip for people/thinkers" is confirmed on the metric where
it's weakest to detect overall (entropy) and merely attenuated (not flipped) on the metric
where the base effect is strongest (modal fraction). The most defensible summary for the
director: **models really do reach for the same villains more readily than the same heroes,
especially for shared cultural artifacts (a specific TV show, a specific children's book, a
specific poem) — but that tendency softens substantially, and for hard-science thinkers
partly inverts, once the target is a real named person rather than a book or a show.** The
practical reading is closer to "convergent scorn is a genre-specific reflex, strongest for
mass culture, softest for academic figures" than to a single universal law about rejection vs
love.
