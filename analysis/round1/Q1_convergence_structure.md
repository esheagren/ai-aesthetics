# Q1 — The structure of aesthetic convergence: domain vs model vs family

## Question

The director's hunch is "clear and remarkable convergence in what aesthetics AIs care
for." This question interrogates the *structure* of that convergence: when 13 models
agree (or disagree) on a pick, how much of that is explained by **which domain** is being
judged (season vs street), how much by **which specific model** is answering, and how
much by the model's **family/lab** (a shared "house style")? All analysis is restricted to
the 43 official domains (`bookcover` and `chair` are legacy/pilot domains present in
`extracted.jsonl` but absent from the shipped panel — excluded throughout, per
`director_grounding.md`'s data-hygiene note).

## Method

Code: `analysis/lib/q1_convergence.py` (reusable, re-run with `python3
analysis/lib/q1_convergence.py` from repo root; ~4s, deterministic given fixed seeds).
Derived tables: `analysis/data/q1_*.{json,csv}`.

1. **Variance decomposition.** Built the 43×13 domain×model *entropy* matrix directly
   from `summary.json`'s `cells[model][domain][probe].entropy` (no zero-`n` cells; the
   grid is complete). Fit the standard no-replication two-way additive model `entropy[d,m]
   = μ + a[d] + b[m] + resid[d,m]` (domain effect `a`, model effect `b`, both sum to zero).
   Population variance of `a`, `b`, and `resid` partitions the total variance of the matrix
   exactly (verified: `var_domain + var_model + var_resid = var_total` to full precision).
   Significance: a permutation test *within the other factor* — to test the domain effect,
   shuffle entropy values within each model's column (destroys domain identity, preserves
   each model's marginal entropy values) 20,000 times and recompute `var_domain`; symmetric
   test for the model effect. This is a randomized two-way-layout test, not an F-test, but
   needs no distributional assumptions.
2. **Family clustering.** `summary.json`'s `overlap` matrix is favorites-only (confirmed
   in `src/analyze.js`), so I re-derived a pairwise Jaccard agreement matrix from
   `extracted.jsonl` for **both probes**, using `aa.load_extracted()`'s canonicalization
   (aliases.json + lowercase/strip; non-refused rows only), pooling picks as
   `{domain}:{entity_canon}` sets per model, mirroring `analyze.js`'s method. Sanity check:
   my re-derived favorite matrix vs the shipped `overlap` — mean|diff| = 0.0064, Pearson r =
   0.9912 (same method modulo `analyze.js`'s extra stripping of leading articles/quotes,
   which `aa.py` doesn't do — a known, minor canonicalization difference). Family gap =
   mean(within-family pairs) − mean(between-family pairs); significance via a label-shuffle
   permutation test (permute which of the 13 models gets which family label, family-size
   distribution held fixed, 20,000 draws, two-sided).
3. **Odd-models-out.** Mean overlap-with-others (row mean, off-diagonal) computed from the
   favorite matrix, the overrated matrix, and a **combined** matrix (probes pooled into one
   Jaccard set per model: `{probe}:{domain}:{entity_canon}`).
4. **Domain ranking.** Mean entropy across all 13 models per domain, per probe, from
   `summary.json` cells directly — purely descriptive (no test needed for a ranking).

## Results

### 1. Variance decomposition

| Probe | var(domain) | var(model) | var(residual/interaction) | var(total) | domain/model ratio |
|---|---|---|---|---|---|
| favorite | 0.01098 | 0.00427 | 0.03473 | 0.04998 | **2.57×** |
| overrated | 0.01190 | 0.00352 | 0.03232 | 0.04774 | **3.38×** |

As a share of total variance: favorite = domain 22.0% / model 8.5% / residual 69.5%.
Overrated = domain 24.9% / model 7.4% / residual 67.7%.

Both the domain effect and the model effect are individually significant (permutation
p = 0.00005 for both, both probes — the minimum resolvable p at 20,000 draws, i.e. no
permutation among 20,000 beat the observed value). But **the residual/interaction term is
the single largest component in both probes** — roughly 68–70% of total variance is
neither a pure domain effect nor a pure model effect; it's specific (model, domain)
combinations behaving idiosyncratically (e.g., one model going off-script on one domain).
Grounding's "domain ≈3× model" holds up quantitatively and is slightly *stronger* for
overrated (3.38×) than favorite (2.57×).

### 2. Family clustering (both probes, re-derived)

| Probe | within-family mean | between-family mean | gap | perm p (two-sided) |
|---|---|---|---|---|
| favorite | 0.2191 | 0.1674 | **+0.0517** | **0.00020** |
| overrated | 0.2665 | 0.2295 | **+0.0370** | **0.00595** |

Per-family breakdown (descriptive; DeepSeek/Moonshot/xAI have one model each and cannot
form within-family pairs, so they only ever contribute to the between-family pool):

| Family | favorite within (n) | favorite between | gap | overrated within (n) | overrated between | gap |
|---|---|---|---|---|---|---|
| Anthropic (4 models) | 0.189 (12) | 0.158 (36) | +0.031 | 0.253 (12) | 0.222 (36) | +0.032 |
| OpenAI (4 models) | 0.229 (12) | 0.179 (36) | +0.049 | 0.271 (12) | 0.232 (36) | +0.039 |
| Google (2 models) | 0.342 (2) | 0.142 (22) | **+0.199** | 0.321 (2) | 0.219 (22) | **+0.103** |

The family effect is real and significant in **both** probes (previously only shown for
favorites). It is not evenly distributed: Google's gap is 4–6× any other family's, but
Google's within-family estimate rests on a single pair (Gemini 3.1 × Gemini 3.5 Flash), so
it is a strong but thin-n data point, not a stable "family" estimate. Anthropic (4 models,
12 within-pairs) and OpenAI (4 models, 12 within-pairs) give the more reliable within-lab
estimates and both show a smaller, but still positive and directionally consistent, effect
in both probes.

### 3. Odd-models-out

- **Favorite** (matches conv-H2 exactly): lowest mean overlap = `gemini-3.1-pro-preview`
  (0.141), 2nd-lowest = `claude-opus-4-8` (0.154).
- **Overrated** (new): lowest = `claude-opus-4-5` (0.205), 2nd = `kimi-k2.6` (0.210).
  `gemini-3.1-pro-preview` drops to 4th-lowest (0.223) and `claude-opus-4-8` to 5th (0.227).
  **The "two odd ones out" are probe-specific, not a stable pair** — Opus 4.8's
  idiosyncrasy is a favorites phenomenon; on overrated picks it's Opus 4.5 that stands out.
- **Combined** (both probes pooled): lowest = `gemini-3.1-pro-preview` (0.180), then
  `claude-opus-4-5` (0.186) and `claude-opus-4-8` (0.186, effectively tied).
  `gemini-3.1-pro-preview` is the one model that is bottom-2 in every view (favorite,
  combined) and bottom-4 in overrated — the most robust single "odd one out" in the data.
- **Most-convergent pair**: `gemini-3.1-pro-preview` × `gemini-3.5-flash` = 0.331 in the
  combined matrix — clearly the single highest pairwise value (runner-up is `o3` ×
  `grok-4.5` at 0.286, then three more `o3`-involving pairs at 0.27–0.28). This confirms the
  "Gemini pair is the most convergent duo in the matrix" half of conv-H2 cleanly, and
  independently confirms H8's finding that `o3` is a convergence hub (it appears in 4 of
  the top 6 combined pairs, despite having the most distinct favorite picks of any model).
  Bottom 6 combined pairs are dominated by `gemini-3.1-pro-preview` (4 of 6 appearances)
  and `claude-opus-4-8` (2 of 6, both involving `gemini-3.1-pro-preview` or `gpt-4o`).

**Verdict on conv-H2**: partially confirmed. The Gemini-pair-as-most-convergent-duo and
Gemini-3.1-as-single-most-idiosyncratic-model claims replicate cleanly and robustly across
probes. The specific "Opus-4.8 is the second odd one out" claim is favorites-specific and
does not hold for overrated (Opus-4.5 takes that role instead) — so the correct
generalization is "Gemini-3.1 is reliably idiosyncratic; *some* Anthropic model is usually
the second-most-idiosyncratic, but which one shifts by probe," not a fixed two-model wall.

### 4. Domain ranking

**Favorite** — most unifying (lowest mean entropy): `season` (0.021), `cuisine` (0.047),
`uscity` (0.064), `city` (0.065), `religioustext` (0.096). Most fracturing (highest):
`street` (0.525), `aimodel` (0.456), `dish` (0.364), `building` (0.361), `object` (0.354).

**Overrated** — most unifying: `childrensbook` (0.019), `poem` (0.029), `season` (0.063),
`tvshow` (0.066), `decade` (0.068). Most fracturing: `mathematician` (0.455), `object`
(0.430), `airesearcher` (0.400), `album` (0.399), `dish` (0.379).

Cross-probe consistency of the domain ranking: Pearson r = 0.41, Spearman r = 0.47 between
per-domain mean entropy (favorite) and (overrated) across all 43 domains — a moderate,
positive, but far-from-perfect correlation. Some domains are consistently unifying/
fracturing regardless of probe (`season` unifying in both, `dish`/`object` fracturing in
both), which is the strongest evidence that "domain" is a real, stable property, not an
artifact of one probe's wording. But several domains flip hard: `street`/`building` are
among the most fractured *favorite* domains (rank 40-43/43) but land mid-pack for
overrated (rank 21-25/43); `poem`/`tvshow`/`childrensbook` are near-unanimous for
*overrated* (rank 1-4/43) but mid-to-fractured for favorite (rank 8, 27, 38/43); and
`mathematician` is the single most fractured overrated domain (rank 43/43) but unremarkable
for favorite (rank 17/43). So "domain drives agreement" is true in aggregate (moderate
positive correlation, and it dwarfs the model effect in the variance decomposition) but the
*specific* ranking of which domains unify vs fracture is meaningfully probe-dependent for
about half the domains — consistent with the large residual/interaction term in part 1.

## Verdict

**Convergence is structurally domain-driven first, with a real but secondary
family-inherited layer, and the largest single component is neither — it's
model×domain-specific idiosyncrasy.**

Quantified: of the variance in cross-model agreement (entropy) that can be attributed to
a single main effect, domain explains 2.6–3.4× more than model does (both highly
significant, p < 0.0001 by permutation). But that's a comparison of *main effects only* —
in absolute terms, domain accounts for ~22-25% of total variance, model for ~7-9%, and
model×domain interaction/residual for ~68-70%. Layered on top, models from the same lab
agree systematically more with each other than with the field (both probes, p ≤ 0.006),
though this family effect is smaller in magnitude than the domain effect and unevenly
sized across labs (Google's is large but rests on one pair; Anthropic's and OpenAI's are
smaller but rest on 12 pairs each and replicate in both probes). One model — Gemini 3.1 Pro
— is a robust, probe-independent outlier, and its pairing with Gemini 3.5 Flash is the
single most convergent duo in the dataset by a wide margin, i.e. the family effect is not
uniform even within a lab — it's concentrated in specific pairs/models, not a smooth
lab-wide gradient.

So the honest one-line reframe of the director's hunch: **"AI aesthetic convergence" is
mostly "some questions have a culturally dominant answer everyone's training data agrees
on" (domain), with a smaller "labs produce a house style" effect (family) layered on top —
and most of the remaining variation is neither of these, it's specific models being
unpredictably weird about specific domains.**

## Caveats

- **Single-model families.** DeepSeek, Moonshot, and xAI each have exactly one model in
  this panel, so "family effect" for them is untestable by construction — they can only
  ever appear in the between-family pool. The family-clustering result is really a
  statement about Anthropic (4 models), OpenAI (4 models), and — weakly — Google (2
  models), not all 13 models symmetrically.
- **Google's within-family estimate is n=1 pair.** The striking +0.199/+0.103 Google gap is
  driven entirely by the Gemini 3.1 × Gemini 3.5 Flash pair; treat as a single strong
  data point, not a stable family-level parameter the way Anthropic's and OpenAI's
  12-pair estimates are.
- **Interaction term is unresolved.** The variance decomposition's residual (68-70% of
  total variance) is the model×domain interaction *and* any remaining noise conflated
  together — with one entropy observation per (domain, model) cell (no replication across
  independent runs of the same cell), these cannot be statistically separated here. "Domain
  beats model" is a comparison of the two identifiable main effects, not a claim that main
  effects explain most of the variance overall — they explain roughly 30%.
- **Canonicalization coverage.** The re-derived pairwise matrices depend on
  `aliases.json` + a simple lowercase/strip normalization (`aa.py`'s `_norm`), which is
  looser than `analyze.js`'s production canonicalization (which additionally strips
  leading articles and quote characters). The validation check (mean|diff| = 0.0064,
  r = 0.9912 vs the shipped favorite `overlap`) shows this is a minor, not a
  results-changing, discrepancy, but exact Jaccard values in `q1_pairwise_agreement_*.csv`
  should be read as "close to but not bit-identical with" a fully-canonicalized pipeline.
- **Odd-models-out is a ranking, not a hypothesis test.** No formal significance test was
  run on "is Gemini-3.1's mean overlap significantly lower than models near the middle of
  the pack" — the claim is presented descriptively, as the shortlist scoped it.
- **43 domains is a moderate n for the domain-ranking cross-probe correlation** (r = 0.41
  favorite-vs-overrated); a handful of large individual domain swings (e.g.
  `mathematician`, `street`) can move this correlation meaningfully.

## What this means

- Erik's "AIs converge on taste" intuition is real but should be reframed: it's mostly a
  statement about *which questions have culturally dominant answers baked into shared
  training data* (season → autumn, cuisine → Japanese), not a statement about AI
  systems independently arriving at the same aesthetic judgments.
- There is a genuine, measurable "house style" effect (same-lab models agree more), but
  it's smaller than the domain effect, concentrated unevenly (Google's Gemini pair is an
  outsized driver; Anthropic's and OpenAI's are real but modest), and doesn't make any
  lab's models a uniform bloc — Gemini 3.1 Pro is simultaneously in the most-convergent
  pair (with its own family) and among the least field-convergent models overall.
- Most of the variance in how much models agree is neither a domain property nor a model
  property in isolation — it's specific (model, domain) combinations going their own way,
  which means predicting agreement on a *new* domain from a model's general "convergence
  score" alone would miss roughly two-thirds of the story.
