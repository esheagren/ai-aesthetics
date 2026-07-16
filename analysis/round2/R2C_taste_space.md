# R2-C — The map of taste-space: lab, capability, or something that cuts across both?

**Verdict: cuts across both.** Family recovery is real but imperfect (11/13 =
84.6% purity at the natural k=6 cut) — the two Geminis and both Anthropic
sub-pairs cluster tightly by lab, exactly as Round-1 Q1 found. But five
models — **o3, GPT-5.2, GPT-5.6 Sol, DeepSeek V4 Pro, and Grok 4.5** — form a
single cross-lab cluster that is *more internally cohesive* than three of the
six same-family pairs in the dataset. That cluster isn't random: it's OpenAI's
three most-agreement-seeking rungs plus the two other most-agreement-seeking
singleton models, by the exact ranking Round 1 already produced
(`q1_model_convergence_rank.json`). The axis that cuts across lab boundaries
here looks like "how consensus-seeking is this model's aesthetic," not release-
date capability.

## Method

- **Input**: `analysis/data/q1_pairwise_agreement_combined.csv` (13×13
  Jaccard agreement over `{probe}:{domain}:{entity_canon}` picks, pooling
  favorite + overrated per Round-1's `q1_convergence.py`). Also ran on the
  `_favorite` and `_overrated` variants for the probe-split check (§5).
- **Distance**: `d = 1 − agreement`. Diagonal (shipped as 0.0000 — the metric
  is never computed against itself) is irrelevant and zeroed, matrix
  symmetrized against float rounding.
- **Linkage**: **average-linkage (UPGMA) agglomerative clustering,
  implemented by hand** in `analysis/lib/r2c_clustering.py::upgma()` — numpy
  + stdlib only, no scipy. At each step the two active clusters with the
  smallest mean pairwise distance are merged; the merged cluster's distance
  to every remaining cluster is updated via the exact size-weighted
  recurrence `d(A∪B,C) = (|A|·d(A,C) + |B|·d(B,C)) / (|A|+|B|)` (provably
  equal to the true mean over all cross-pairs, by induction on prior merges
  already being true means).
- **Monotonicity check**: heights are non-decreasing across all 12 merges for
  all three matrices (combined/favorite/overrated) — no inversions, so the
  dendrogram geometry below is not an artifact of an ill-behaved linkage.
- **Cut**: k=6, to match the 6 labeled families (Anthropic, OpenAI, Google,
  DeepSeek, Moonshot, xAI) for the family-recovery test.
- All numbers below are **descriptive** (dendrogram geometry, purity counts,
  rank positions) — no permutation test is run in this note; see caveats.

## Dendrogram (combined matrix, ASCII tree form; height = 1 − agreement)

```
[h=0.8222] (n=13)
|-- [h=0.6687] (n=2)
|   |-- gemini-3.1-pro-preview
|   `-- gemini-3.5-flash
`-- [h=0.8080] (n=11)
    |-- [h=0.7948] (n=7)
    |   |-- kimi-k2.6
    |   `-- [h=0.7787] (n=6)
    |       |-- gpt-4o
    |       `-- [h=0.7518] (n=5)
    |           |-- [h=0.7230] (n=3)
    |           |   |-- deepseek-v4-pro
    |           |   `-- [h=0.7143] (n=2)
    |           |       |-- o3
    |           |       `-- grok-4.5
    |           `-- [h=0.7349] (n=2)
    |               |-- gpt-5.2
    |               `-- gpt-5.6-sol
    `-- [h=0.7970] (n=4)
        |-- [h=0.7470] (n=2)
        |   |-- claude-opus-4-8
        |   `-- claude-fable-5
        `-- [h=0.7563] (n=2)
            |-- claude-opus-4-1
            `-- claude-opus-4-5
```

Read bottom-up: lower height = merged earlier = more similar. The two
Geminis merge first and at by far the lowest height (0.6687, i.e. 0.3313
agreement) — the single tightest bond in the whole dataset. Everything else
merges in a narrow band (0.71–0.83), meaning **outside the Gemini pair, no
other bond is much stronger than any other** — taste-space is mostly a diffuse
cloud with one strong outlier pair, not a set of crisp lab-shaped balls.

## Family recovery at k=6

**Purity = 11/13 = 0.8462** (sum of each cluster's majority-family count,
divided by 13).

| cluster | members | family mix |
|---|---|---|
| 1 | Claude Opus 4.1, Claude Opus 4.5 | Anthropic (2/2) |
| 2 | Claude Opus 4.8, Claude Fable 5 | Anthropic (2/2) |
| 3 | GPT-4o | OpenAI (1/1) — singleton |
| 4 | o3, GPT-5.2, GPT-5.6 Sol, DeepSeek V4 Pro, Grok 4.5 | **OpenAI (3/5), DeepSeek, xAI** |
| 5 | Gemini 3.1 Pro, Gemini 3.5 Flash | Google (2/2) |
| 6 | Kimi K2.6 | Moonshot (1/1) — singleton |

Four of six clusters are family-pure or family-singleton (clusters 1, 2, 3,
5, 6 — five, actually, counting the two singletons trivially). The failure
mode is entirely concentrated in **cluster 4**: OpenAI's ladder doesn't stay
together as one block — GPT-4o splits off on its own, and the remaining three
OpenAI rungs (o3, GPT-5.2, GPT-5.6 Sol) get joined by both single-model
"orphan" families that have no same-family partner to cluster with
(DeepSeek, xAI). Kimi is the one singleton that resists this pull and sits
alone instead.

Anthropic (both sub-pairs) and Google recover perfectly; OpenAI recovers
partially (3 of 4 rungs, minus GPT-4o); the two truly homeless singletons
(DeepSeek, xAI) don't get their own clusters — they get absorbed into
whichever cross-lab cluster is nearest, which happens to be the OpenAI rump.

## Cross-lab surprises

**Highest cross-lab pairs** (combined matrix, all pairs ranked 1–78 by
agreement; family label in parens):

| rank | pair | agreement |
|---|---|---|
| 2 | o3 (OpenAI) × Grok 4.5 (xAI) | 0.2857 |
| 5 | DeepSeek V4 Pro × Grok 4.5 (xAI) | 0.2797 |
| 6 | o3 (OpenAI) × DeepSeek V4 Pro | 0.2743 |
| 9 | GPT-5.6 Sol (OpenAI) × DeepSeek V4 Pro | 0.2566 |
| 12 | GPT-5.2 (OpenAI) × DeepSeek V4 Pro | 0.2414 |
| 13 | GPT-4o (OpenAI) × Grok 4.5 (xAI) | 0.2388 |

Rank #2 overall (out of 78 pairs) is a cross-lab pair — **o3 and Grok 4.5
agree more (0.2857) than any single Anthropic pair except Opus 4.8×Fable-5
(0.2530), and more than any OpenAI pair except o3's own two same-family
bonds.**

**Lowest same-lab pairs** (all 13 within-family pairs, ranked):

| pair | family | agreement | rank (of 78) |
|---|---|---|---|
| GPT-4o × GPT-5.6 Sol | OpenAI | **0.1575** | **71 / 78** |
| Claude Opus 4.1 × Claude Fable 5 | Anthropic | 0.1881 | 49 |
| Claude Opus 4.5 × Claude Opus 4.8 | Anthropic | 0.2056 | 37 |
| Claude Opus 4.5 × Claude Fable 5 | Anthropic | 0.2082 | 33 |
| Claude Opus 4.1 × Claude Opus 4.8 | Anthropic | 0.2101 | 29 |
| GPT-4o × GPT-5.2 | OpenAI | 0.2300 | 16 |

**GPT-4o and GPT-5.6 Sol — same lab, same ladder — sit at rank 71 of 78,
almost the single worst-agreeing pair in the entire dataset**, worse than 58
of the 65 cross-lab pairs. Same-lab is no guarantee of agreement: it is
plausible for two models from the same company, three "generations" apart,
to agree with each other *less* than two models from different labs made by
different companies.

**Where the singleton families sit** (mean agreement to each other family,
combined matrix):

| singleton | nearest family | 2nd | 3rd | 4th | farthest |
|---|---|---|---|---|---|
| DeepSeek V4 Pro | **xAI 0.2797** | OpenAI 0.2448 | Google 0.2172 | Moonshot 0.2112 | Anthropic 0.2025 |
| Grok 4.5 | **DeepSeek 0.2797** | OpenAI 0.2382 | Moonshot 0.2239 | Anthropic 0.1886 | Google 0.1573 |
| Kimi K2.6 | **xAI 0.2239** | DeepSeek 0.2112 | OpenAI 0.1990 | Anthropic 0.1746 | Google 0.1651 |

All three orphans point to each other and to OpenAI as nearest neighbors, and
all three are farthest from Anthropic or Google. DeepSeek and Grok are each
other's #1 pick (mutually, at 0.2797 — tied for the highest cross-lab
agreement in the dataset). None of the three singletons has any meaningful
affinity for Anthropic's house style; Google is the single worst match for
two of the three.

## Capability axis (descriptive, underpowered — only 2 real ladders)

**Matched-rung, cross-family agreement** (Anthropic rung *i* vs OpenAI rung
*i*, combined matrix):

| rung | pair | agreement |
|---|---|---|
| 1 (weakest) | Claude Opus 4.1 × GPT-4o | 0.2096 |
| 2 | Claude Opus 4.5 × o3 | 0.1770 |
| 3 (strongest, Anthropic tops out) | Claude Opus 4.8 × GPT-5.2 | 0.2128 |

No monotone rise with capability — rung 2 is the *lowest* of the three, not
the middle. No support here for "stronger models converge across labs
regardless of house style," consistent with Round 1 Q3's refutation of the
capability→convergence hunch, though this is only 3 data points.

**Within-ladder, adjacent-rung agreement** (does agreement with your own
predecessor rise as you get stronger?):

- Anthropic: 4.1↔4.5 = 0.2437, then 4.5↔4.8 = **0.2056** — falls.
- OpenAI: 4o↔o3 = 0.2730, o3↔5.2 = 0.2815, 5.2↔5.6-Sol = 0.2651 — rises then
  falls; peaks in the middle of the ladder, not at the top.

Neither ladder shows capability cleanly pulling models closer together —
matches Round 1's Q3 verdict (capability does not turn cliché into
convergence; if anything the newest rung is often *not* the closest to its
own lineage). The one clean cross-cutting signal in this dataset is not
"most capable models converge" but **"the five models with the highest
Round-1 `mean_overlap` score (o3, GPT-5.6 Sol, DeepSeek, GPT-5.2, Grok, in
that order) are exactly the five that land in the one cluster that spans
three labs"** — general agreeableness, not benchmark strength, is the
cross-cutting axis visible here.

## Favorite vs. overrated: does the map change?

Family purity: **combined 0.8462, favorite 0.8462, overrated 0.7692** (10/13)
— the probes agree on the broad picture but overrated is noticeably messier.

- **Favorite-only**: OpenAI's top three rungs (o3, GPT-5.2, GPT-5.6 Sol) stay
  together as a pure 3-member OpenAI cluster; it's GPT-4o that defects,
  joining DeepSeek + Grok instead. Anthropic and Google both recover
  perfectly.
- **Overrated-only**: this is where the map degrades. **Claude Opus 4.1**
  defects from its own family entirely, joining a 6-member cross-lab cluster
  with o3/GPT-5.2/GPT-5.6-Sol/DeepSeek/Grok — and **Claude Opus 4.5** ends up
  alone as a singleton, split off even from its own Anthropic siblings
  (Opus 4.8 + Fable-5 stay paired). So on "what's overrated," Anthropic's
  house style fractures in a way it doesn't on "what's your favorite."
- Interpretation: consensus on shared villains ("what's overrated") pulls in
  models from any lab that converge on famous, easy targets (Round 1 Q5's
  "overrated = famous" mechanism) more strongly than positive taste does —
  and that pull is strong enough to peel individual models off their own
  family in a way favorite-only agreement doesn't.

## Caveats

- **n=13 is very small for clustering** — every number above is a specific
  finite-sample geometry, not a population estimate. No permutation/
  significance test is attached to the k=6 purity number or any individual
  merge height; treat this whole note as descriptive, matching Round 1's
  own convention for undertested claims.
- **Three families are singletons** (DeepSeek, Moonshot, xAI) — "within-
  family agreement" is undefined for them by construction, so the family-
  recovery purity metric can never fully reward or penalize their placement;
  they can only ever land as a 1-member "correct" cluster or get absorbed
  into someone else's.
- **Google's ladder is explicitly flagged weak** in `aa.py` (`gemini-3.1-pro-
  preview` vs `-3.5-flash` isn't a clean capability progression) — excluded
  from the capability-axis test above for that reason.
- **UPGMA is one linkage choice.** Average-linkage was specified by the task;
  single-linkage (chaining) or complete-linkage (compact-cluster-forcing)
  would very plausibly redraw cluster boundaries at k=6, especially around
  the diffuse 0.71–0.83 height band where most of this dataset's structure
  lives. The one genuinely robust fact independent of linkage choice is the
  Gemini pair's outlier gap (0.66 vs everything else ≥0.71) — that would
  survive any reasonable linkage.
- **Combined matrix pools favorite+overrated picks into one Jaccard set per
  model** (per Round 1's method) — real, but it can average over probe-level
  disagreements the §5 breakdown makes visible; treat the combined map as the
  headline and the split as a robustness/nuance check, not a contradiction.
- No causal claim: "consensus-seeking" as an axis is inferred from Round 1's
  pre-existing `mean_overlap` ranking correlating with this cluster's
  membership, not tested here as an independent hypothesis.

## What this means

Taste-space is not a clean set of six lab-shaped clusters, but it is not
random either. **Real family gravity exists** — Anthropic's two sub-pairs and
the two Geminis lock in early and stay locked — but it is **strongest for
labs with genuine multi-model families and weakest exactly at the boundary
where the ladder gets long and single-model labs need somewhere to go.**
GPT-4o, the three friendless singletons, and (on the overrated probe) even
Claude Opus 4.1 and 4.5 individually — all get pulled toward a single loose,
cross-lab "consensus cluster" built from whichever models happen to be the
most agreement-seeking in the dataset, not whichever are newest or most
capable. If there's a second axis here beyond lab, it looks like **"how much
does this specific model converge with the field in general"** — which
Round 1 already measured as `mean_overlap` — rather than a release-date
capability gradient, which showed no clean monotone pull in either direction.

## Files

- `analysis/lib/r2c_clustering.py` — UPGMA implementation, dendrogram
  renderer, cut/purity/cross-lab/capability helpers, `__main__` driver
  (reproduces every number above; `python3 analysis/lib/r2c_clustering.py`
  from the repo root).
- `analysis/data/r2c_clusters.csv` — full 12-step merge order (height, size)
  for the combined matrix, plus k=6 cluster assignments for all three
  matrices (combined/favorite/overrated), one row per model per matrix.
