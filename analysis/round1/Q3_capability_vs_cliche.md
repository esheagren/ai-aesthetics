# Q3 — Does more model capability produce less cliché / more distinctive aesthetic taste?

**The director's central hunch**: weak models (GPT-4o) give the safe, canonical pick
(Mona Lisa, Gatsby, Japanese cuisine); strong models give idiosyncratic, defensible taste.
Tested rigorously and honestly below. **Bottom line: NOT SUPPORTED, and on the core
entity-choice measures the pattern runs backwards** — this survives a hedge-controlled
re-run, so it is not simply a hedging artifact. There is one narrow, real, but
under-powered exception (Anthropic's descriptor *vocabulary* gets richer with capability),
and it does **not** replicate in OpenAI once hedging is controlled for.

## Method

Tested on the two real capability ladders only (per `DATA_DICTIONARY.md` /
`analysis/lib/aa.py::LADDER`):
- **Anthropic**: Opus 4.1 < Opus 4.5 < Opus 4.8 (n=3; Fable-5 excluded as a stated
  creative-writing variant, not a capability rung).
- **OpenAI**: GPT-4o < o3 < GPT-5.2 < GPT-5.6-Sol (n=4).

Google (2 rungs), DeepSeek/Moonshot/xAI (1 rung each, no ladder) are out of scope per the
task — not analyzed here. `bookcover` and `chair` domains excluded throughout (leaves the
43 official domains). All computation in `analysis/lib/q3_capability.py`
(`python3 analysis/lib/q3_capability.py`); full per-model, per-subset table in
`analysis/data/q3_capability_table.csv`.

Four metrics, each run on **two subsets** of `data/extracted.jsonl`:
- **"all"** = every non-refused sample (matches the convention already used in
  `data/summary.json` / `hypotheses_capability.md`).
- **"clean"** = non-refused **and** non-hedged only — the critical control, since hedge
  rate moves wildly and non-monotonically across both ladders (Anthropic 0.102 → 0.221 →
  0.440 rising; OpenAI 0.722 → 0.068 → 0.039 → 0.002 collapsing) and could mechanically
  drive entropy/distinct-pick counts rather than reflect real taste.

1. **Consensus-hugging rate** (favorite & overrated): fraction of (domain, probe) cells
   where a model's own modal pick equals the **leave-one-out** cross-model modal pick
   (weighted by sample count, canonicalized via `data/aliases.json`, consensus computed
   over the other 12 models). Lower = more distinctive. Same operationalization as the
   round-1 H-series, recomputed here from raw extracted rows so it can be subset by hedge
   status.
2. **Within-model spread**: mean per-cell normalized entropy (favorite) + count of distinct
   favorite entities + distinct/n "spread rate."
   - **Entropy convention note (a real bug caught mid-analysis)**: `aa.norm_entropy`
     normalizes by log(*k*, number of distinct picks). The *house* convention already baked
     into `data/summary.json` (`src/report.js`: "Shannon entropy of the pick distribution
     normalized by log(n)") normalizes by log(*n*, sample count) instead — a materially
     different number (verified on `claude-opus-4-1`/`book`/favorite, dist 4/2/2/1/1,
     n=10: log(k) gives 0.914, log(n) gives 0.639, and 0.639 is what's actually in
     `summary.json`). `q3_capability.py` implements `norm_entropy_by_n` to match the house
     convention, so these numbers are directly comparable to the ones already published in
     `hypotheses_capability.md` (confirmed: recomputed Anthropic entFav 0.204/0.148/0.146
     vs. the doc's 0.201/0.140/0.137 — matches within rounding/dedup noise).
3. **Descriptor richness**: type-token ratio (distinct/total descriptor tokens) and
   generic-adjective share, both restricted to `probe=="favorite"`. The "generic" word set
   is the top-15 most frequent descriptor tokens **recomputed fresh within each subset**
   (not hardcoded), so the hedge-controlled version isn't silently reusing an all-rows list.
4. **Exact monotonicity test**: with only 3–4 points per ladder, a correlation p-value would
   be theater. Instead: Kendall's tau between the metric and ladder position, with an
   *exact* two-sided permutation p-value from full enumeration of all 3! = 6 (Anthropic) or
   4! = 24 (OpenAI) orderings of the metric values. This is deliberately conservative and
   explicit about power: the best possible p-value is **0.333 for n=3** and **0.083 for
   n=4** — i.e., even a perfectly monotonic 4-point ladder cannot reach conventional
   significance. Treat every result here as a directional descriptive trend, not a
   confirmed law.

## CRITICAL CONTROL: hedging is not a clean covariate — it changes *which domains* enter
   the comparison

Before the metric results: hedge-removal does not just shrink sample sizes evenly. For the
single highest-hedging model in **each** ladder, removing hedged rows removes entire
domains from the comparison:

| model | hedge rate | favorite n (all) | favorite n (clean) | domains with data (of 43) | domains with **zero** clean samples |
|---|---|---|---|---|---|
| claude-opus-4-1 | 0.102 | 332 | 287 | 41 | 2 |
| claude-opus-4-5 | 0.221 | 376 | 299 | 42 | 1 |
| claude-opus-4-8 | 0.440 | 324 | 206 | **32** | **11** |
| gpt-4o | 0.722 | 392 | 121 | **28** | **15** |
| o3 | 0.068 | 399 | 379 | 43 | 0 |
| gpt-5.2 | 0.039 | 420 | 414 | 43 | 0 |
| gpt-5.6-sol | 0.002 | 304 | 304 | 43 | 0 |

GPT-4o hedges on *every single sample* in 15 of 43 domains — its clean-subset stats are
built on a different, smaller, non-random set of domains (whichever ones it happened to
answer confidently in at least once) than the other three OpenAI rungs, which keep full
43-domain coverage. The same asymmetry shows up in Anthropic, but on the *opposite end* of
the ladder: Opus 4.8 (the newest/most-hedging Anthropic model) loses 11 domains, while
Opus 4.1 loses almost none. This means the "clean" comparison is least reliable for exactly
the two models — GPT-4o and Opus 4.8 — that anchor opposite ends of the hunch's story, and
their clean-subset numbers should be read with that in mind, not as directly comparable
apples-to-apples n's.

## Results — Anthropic ladder (Opus 4.1 → 4.5 → 4.8)

| metric | subset | 4.1 | 4.5 | 4.8 | shape | exact p |
|---|---|---|---|---|---|---|
| hugFav (consensus-hugging, favorite) | all | 0.302 | 0.488 | 0.302 | flat / no net trend | 1.000 |
| | clean | 0.268 | 0.452 | 0.375 | non-monotonic, net **positive** | 1.000 |
| entFav (spread, house entropy) | all | 0.204 | 0.148 | 0.146 | strictly **decreasing** | 0.333 |
| | clean | 0.246 | 0.175 | 0.143 | strictly **decreasing** | 0.333 |
| distinctFav (# distinct picks) | all | 90 | 79 | 76 | strictly **decreasing** | 0.333 |
| | clean | 85 | 74 | 55 | strictly **decreasing** | 0.333 |
| TTR (favorite descriptors) | all | 0.355 | 0.368 | 0.376 | strictly **increasing** | 0.333 |
| | clean | 0.376 | 0.390 | 0.420 | strictly **increasing** | 0.333 |
| genericShare (favorite) | all | 0.206 | 0.174 | 0.186 | non-monotonic, net negative | 1.000 |
| | clean | 0.207 | 0.185 | 0.179 | strictly **decreasing** | 0.333 |

Reading this against the hunch (capability → *lower* hug-rate, *higher* entropy/distinct
picks, richer/less-generic vocabulary):
- **Consensus-hugging does not fall.** It rises from Opus 4.1 to 4.5/4.8 in both subsets —
  the *opposite* of what "less cliché" predicts. Opus 4.1 is, if anything, the *least*
  consensus-hugging of the three.
- **Entropy and distinct-pick count fall monotonically with capability**, in both subsets.
  Anthropic's more capable models pick from a *smaller*, more repeated set of favorites,
  not a larger, more idiosyncratic one. This directly contradicts the hunch's core claim
  and replicates cap-H2 from `hypotheses_capability.md`, now confirmed robust to hedge
  control (same monotonic shape, same magnitude, before and after removing hedged rows).
- **The one place the hunch's language survives**: descriptor vocabulary (TTR) rises
  monotonically with capability in *both* subsets — Anthropic's stronger models use a more
  varied critical vocabulary even as their entity picks converge. This is real (survives
  hedge control) but it's a claim about *how* models talk, not *what* they pick — a
  narrower, weaker echo of the hunch, on n=3.
- genericShare (share of favorite descriptors that are generic/high-frequency words) falls
  with capability in the clean subset (monotonic) — a second thread in the hunch's favor,
  but noisy in the all-subset (non-monotonic) and, like everything here, n=3.

## Results — OpenAI ladder (GPT-4o → o3 → GPT-5.2 → GPT-5.6-Sol)

| metric | subset | 4o | o3 | 5.2 | 5.6-Sol | shape | exact p |
|---|---|---|---|---|---|---|---|
| hugFav | all | 0.326 | 0.488 | 0.349 | 0.488 | non-monotonic, net positive | 0.500 |
| | clean | 0.286 | 0.488 | 0.302 | 0.442 | non-monotonic, net positive | 0.750 |
| entFav | all | 0.283 | 0.348 | 0.337 | 0.172 | inverted-U, net **decrease** | 0.750 |
| | clean | 0.269 | 0.346 | 0.339 | 0.172 | inverted-U, net **decrease** | 0.750 |
| distinctFav | all | 111 | 136 | 133 | 82 | inverted-U, net decrease | 0.750 |
| | clean | 48 | 133 | 133 | 82 | non-monotonic (see caveat below) | 1.000 |
| TTR | all | 0.247 | 0.340 | 0.273 | 0.300 | non-monotonic, net **increase** | 0.750 |
| | clean | 0.363 | 0.342 | 0.274 | 0.300 | non-monotonic, net **decrease** | 0.333 |
| genericShare | all | 0.140 | 0.226 | 0.220 | 0.192 | flat/hump, net **increase** | 1.000 |
| | clean | 0.112 | 0.236 | 0.222 | 0.181 | flat/hump, net **increase** (stronger) | 1.000 |

- **The inverted-U replicates cap-H3** and, importantly, **survives hedge control**: entropy
  and distinct-pick count both rise from GPT-4o to a mid-ladder peak (o3/GPT-5.2) and then
  crash at GPT-5.6-Sol — in both subsets. But the shape the hunch actually needs is
  monotonic *increase*, and what we see instead is a net *decrease* end-to-end
  (0.283→0.172 all; 0.269→0.172 clean): **the newest, most confident, least-hedging OpenAI
  model is the single least-diverse model in its own ladder**, on both entropy and
  hug-rate. That is close to the opposite of the hunch.
- **genericShare runs backwards from the hunch, and gets *more* backwards under hedge
  control, not less.** GPT-4o — the "basic," heavily-hedging model the hunch expects to be
  most cliché — has the *lowest* generic-descriptor share of the whole ladder in both
  subsets (0.140 all, 0.112 clean), while GPT-5.2/GPT-5.6-Sol sit meaningfully higher
  (0.220/0.192 all; 0.222/0.181 clean). This replicates cap-H6 and rules out the concern
  raised there (that H6 might just be a hedging artifact of what the extractor treats as a
  "descriptor" in hedged text) — cleaning the data makes GPT-4o's descriptor vocabulary
  look *even less* generic, not more.
- **A genuine hedging-artifact reversal, caught by the control (this is exactly what the
  task asked to check for)**: TTR's *direction* flips sign between subsets. In the raw
  ("all") data, TTR rises end-to-end (0.247 → 0.300), which reads as mild support for the
  hunch. Once hedged rows are removed, GPT-4o's TTR jumps from 0.247 to **0.363** — now the
  *highest* TTR in the entire OpenAI ladder — while GPT-5.6-Sol stays essentially flat
  (0.300 either way, since it barely hedges to begin with). Net direction reverses to a
  *decrease* (0.363 → 0.300). The likely mechanism: GPT-4o's hedged responses repeat a
  small stock of hedge-language tokens across a very large volume of samples (722 of every
  1000 favorite answers are hedged), which mechanically deflates its raw TTR; strip those
  out and its *actual* aesthetic vocabulary is the richest in the ladder, not the poorest.
  **This is precisely the kind of hedging confound the task flagged as a risk, and here it
  is directly visible and specific to one metric (TTR) in one ladder (OpenAI).**
- **distinctFav's clean-subset numbers for GPT-4o are not trustworthy on their own**: its
  clean sample size (121, across only 28/43 domains — see the coverage table above) is
  roughly a third of the other three rungs' (~300–420, full 43 domains). A raw count of 48
  distinct picks out of 121 samples across fewer domains cannot be compared directly to 133
  distinct picks out of ~400 samples across all 43 domains — the entropy metric (which
  normalizes per-cell by log(n) before averaging) is the more trustworthy read on
  distinctiveness here, and it says the *opposite* of what the raw distinct-count
  comparison would suggest (GPT-4o's clean entropy, 0.269, is close to its all-subset value
  and not obviously lower than o3/GPT-5.2's).

## Cross-ladder summary: endpoint comparisons (weakest vs. strongest real rung)

The cleanest single test of the hunch is the weakest-vs-strongest rung comparison on the
two most trustworthy, sample-size-aware metrics (entropy, hug-rate), across both subsets:

| ladder | subset | hugFav: weakest → strongest | direction vs. hunch | entFav: weakest → strongest | direction vs. hunch |
|---|---|---|---|---|---|
| Anthropic | all | 0.302 → 0.302 | flat (hunch needs ↓) | 0.204 → 0.146 | **against** (hunch needs ↑) |
| Anthropic | clean | 0.268 → 0.375 | **against** | 0.246 → 0.143 | **against** |
| OpenAI | all | 0.326 → 0.488 | **against** | 0.283 → 0.172 | **against** |
| OpenAI | clean | 0.286 → 0.442 | **against** | 0.269 → 0.172 | **against** |

**7 of 8 endpoint comparisons point against the hunch; the 8th is flat.** Zero point in the
hunch's predicted direction. This is the single strongest piece of evidence in this
analysis, and it is unchanged by hedge control.

## Verdict

- **Anthropic: NOT SUPPORTED — and backwards on the core measures.** Consensus-hugging does
  not fall with capability (it rises then partially retreats); entropy and distinct-pick
  count fall monotonically with capability (n=3, p=0.333, the best available given the
  sample). The one place the hunch's spirit survives is descriptor vocabulary (TTR rises,
  genericShare falls) — real, survives hedge control, but narrow (style, not substance) and
  statistically the weakest kind of evidence this dataset can produce (3 points).

- **OpenAI: NOT SUPPORTED — non-monotonic, and net backwards end-to-end.** The inverted-U
  (cap-H3) replicates and survives hedge control, but resolves in the *wrong* direction for
  the hunch: the newest/most-confident model (GPT-5.6-Sol) ends up the *least* diverse and
  no less consensus-hugging than the mid-ladder peak. genericShare is fully backwards
  (GPT-4o least generic, not most). TTR's mild "for the hunch" reading in raw data is shown
  to be a **hedging artifact** that reverses once hedged rows are removed.

- **Overall, on the director's central hunch**: **NOT SUPPORTED.** Where the data moves at
  all on the core entity-choice measures (consensus-hugging, entropy, distinct-pick count),
  it moves opposite to the hunch in 7 of 8 endpoint comparisons across both real ladders,
  and this pattern is **not** an artifact of hedge rate — it survives, essentially
  unchanged, when hedged and refused samples are stripped out. The one thread that runs in
  the hunch's favor (Anthropic's richer descriptor vocabulary with capability) is real but
  narrow, applies to *language* not *entity choice*, does not replicate in OpenAI once
  hedging is controlled, and rests on only 3 data points.

## Caveats

- **n=3 (Anthropic) / n=4 (OpenAI) points per ladder.** The exact permutation test's best
  possible two-sided p-value is 0.333 and 0.083 respectively — a perfectly monotonic
  4-point sequence still cannot reach p<0.05. Every "trend" above is a directional
  descriptive pattern, not a confirmed statistical law, and could plausibly flip with one
  more model generation per family.
- **Hedge-rate confound is real but does not explain away the finding.** Hedge rate moves
  wildly and non-monotonically across both ladders and changes which domains even enter
  the "clean" comparison (see coverage table) — GPT-4o loses 15/43 domains entirely, Opus
  4.8 loses 11/43. Despite this, the qualitative shapes of entropy, hug-rate, and
  genericShare are essentially unchanged before vs. after hedge control in both ladders.
  The one metric that *does* flip (OpenAI TTR) flips in the direction of showing the raw
  data slightly overstated support for the hunch, not the reverse — if anything this makes
  the overall "not supported" verdict more conservative, not less.
- **Canonicalization** (`data/aliases.json`) covers only 27/45 domains; residual
  near-duplicate entity strings could inflate distinct-pick counts / deflate hug-rate
  unevenly across models. Recomputed "all-subset" numbers here were spot-checked against
  the independently-computed `hypotheses_capability.md` figures and match within small
  rounding/dedup noise (e.g., Anthropic entFav 0.204/0.148/0.146 here vs. 0.201/0.140/0.137
  there), which is some reassurance the two independent computations aren't diverging for
  a hidden reason.
- **Scope**: Google (2 rungs — Gemini 3.1 Pro, Gemini 3.5 Flash) and the single-model
  families (DeepSeek, Moonshot, xAI) have no real capability ladder and are excluded per
  the task; this analysis cannot speak to whether the pattern generalizes beyond
  Anthropic/OpenAI.
- **Favorite probe only for the headline metrics**; `hugOver` (overrated) is reported in
  the tables for completeness but shows essentially no ladder trend in either family
  (flat/noisy in both subsets) and isn't load-bearing for the verdict.

## What this means

The director's hunch, taken at face value — "GPT-4o gives the safe pick, the smart models
give real taste" — does not survive contact with the two ladders where it's actually
testable, and this isn't a data-quality mirage: stripping out every hedged and refused
sample and re-running the whole analysis leaves the picture essentially intact. If
anything, on the measures closest to "does the model pick something the crowd already
picked," capability moves *toward* more consensus, not away from it, at least at the top of
each of the two real ladders. Anthropic's most capable model converges onto fewer distinct
favorites than its weakest; OpenAI's newest, most confident model is the single
least-diverse point in its own four-model line.

There is a real, separate, much narrower finding buried inside this: Anthropic's models
talk about their picks in richer, less repetitive language as capability rises, even while
picking from a smaller set of entities. That's a genuine "what vs. how" split worth keeping
in mind — but it's not what the hunch claimed (the hunch was about taste, i.e. *which*
things a model loves, not the adjectives it reaches for), it doesn't show up in OpenAI once
hedging is controlled, and it rests on three data points. It should be held as a
curiosity, not promoted to a finding.

Practically, if this hunch is worth another look, the fix is more rungs per ladder (both
real ladders are underpowered at the modest, honest ceiling of p≈0.08–0.33 no matter what
the data says) — three or four more model generations per family would let the exact
permutation test actually discriminate signal from noise, which it currently cannot.
