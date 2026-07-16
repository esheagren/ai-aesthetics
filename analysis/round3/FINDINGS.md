# Round 3 — Findings: confirmation, one refutation, and the master variable

Round 3 tested Round 1/2's claims against the **v6 data** (50 domains, 10.5k rows), including
**7 domains that did not exist when the earlier claims were formed** — a genuine out-of-sample
design. Four agents; all reproducible from `analysis/lib/r3*.py`. Legacy `bookcover`/`chair`
excluded.

**Load-bearing caveat for everything on new domains:** `gemini-3.1-pro-preview` has **zero
samples in all 7 new v6 domains** (API quota exhaustion mid-collection, confirmed in
`data/run16.log`). Every new-domain statistic is really **12 models, not 13**. A model
looking "absent" on a new domain is a data gap, not a finding.

---

## The through-line: it was fame/canonicity all along

The single most valuable thing Round 3 produced is a *unification*. Several findings we'd been
treating as separate "laws" turn out to be facets of one mechanism: **models orient to a small
canonical/famous answer-space per domain, and "overrated" = the most famous item in that
space.** Evidence converging on this from four independent directions:

- **`sound` did NOT converge** (33% modal, 35th of 50 domains) — yet `country` (91%, Japan) and
  `proglang` (91%, Python) did. The predictor of convergence is *not* sensoriness — it's
  whether the domain has a narrow canonical answer (see R3-B, Law 1).
- **The "most famous = most overrated" pattern replicated on every new domain tested**: GPT-4
  (AI model), Turing (computer scientist), Python (proglang), Japan (country) are each
  simultaneously #1 favorite and top-overrated.
- **Music "overrated" clusters on mega-hits** (60s-70s classic rock, 2010s pop), not on a region
  or decade-aesthetic — fame, not geography or era.
- **Gender "overrated"** is the canonical famous men (Einstein/Tesla/Tyson), and the models
  can't even *retrieve* a woman director — canonicity of the answer-space, again.

So R1's "sensory domains compel convergence," "Asia skew," "overrated skews male/American," and
R3's "fame→overrated" are not four laws — they're one law (**canonical-answer-space + fame**)
wearing four domain-specific costumes.

---

## Study verdicts

### R3-A — AI's taste about AI  → the products/researchers split
- **In-group bias is real for products, absent for people.** For AI *models*: Google picks its
  own 91% (vs 15% from others), OpenAI 80% (vs 42%), xAI 67% (vs 0%), all p<0.0001; Anthropic
  only marginal (20%, p=0.092). For AI *researchers*: **every lab self-cites at exactly 0%** —
  no model ever names its own lab's researcher as favorite. Hinton is the field's most-beloved
  researcher (9/13), voted entirely by competitors, never by Google's own models.
- **Fame→overrated inside AI**: GPT-4 is #1 favorite AND #1 overrated `aimodel`; Python 12/13
  favorite yet top overrated. Breadth-correlation positive in all 4 AI domains (r 0.27–0.73).
- **Method trap corrected**: "Grok favored Claude" was an artifact of Grok's picks fragmenting
  across 5 version spellings; lab-aggregated, xAI out-picks Anthropic 8-to-4. (Count entities,
  not strings — the recurring canonicalization lesson.)
- AI domains are *not* higher-consensus than average — `aimodel` overrated entropy is
  significantly *higher* (0.608 vs 0.451, p=0.0049).

### R3-B — Out-of-sample law tests  → one FAILED, one PARTIAL (both instructive)
- **Law 1 (sensory→convergence): FAILED.** `sound` modal fraction 33% (35th/50); design_sensory
  group not significantly most-convergent (p=0.094). **The real driver is a narrow canonical
  answer-space, not sensoriness** — `country`/`proglang` (non-sensory) are the most convergent
  new domains. This *corrects* R1's interpretation: sensory domains converged because petrichor/
  autumn are canonical, not because they're sensory.
- **Law 2 (cultural geometry): PARTIAL.** Geography half **confirms strongly** — `country`
  favorites are 85.5% Japan vs 18.5% overrated (p=0.00005), the cleanest replication in the
  report. But the **"overrated = American" half FAILS**: the US is ~0% either way; overrated
  countries are France/Italy/Switzerland. Music shows no Asia signal (p=0.058); its "overrated"
  is fame-driven mega-hits, not a region or decade.

### R3-C — Gender, on gender-disambiguated data  → REPLICATED and sharpened
- Core asymmetry holds almost exactly: original 11 domains **17.3% women favorites vs 3.9%
  overrated** (+13.4pp, p<0.0001), essentially identical to R1's 17.0/3.9. Scientist flip
  *strengthened* (53.7% vs 1.8%, largest effect on record); new composer flip (+47pp).
- **`director` is the starkest form**: across 151 samples the models name **zero women
  directors** under either probe — the gender gap in its most extreme version (a retrieval-set
  with no women at all). Framed throughout as model selection/retrieval behavior, not merit.
- Robust to worst-case unknown coding (+11.8pp, p<0.0001).

### R3-D — Did R1/R2 survive v6?  → HELD
- **HELD:** Q1 domain≈3×model + ~68% interaction; family-clustering gaps; Q2's metric-dependence
  (entropy still null, p→0.86); R2-A endpoints (Opus 4.1 #1 42%, DeepSeek last; split p
  0.00035→0.00005, *stronger*); R2-C family purity (bit-identical 84.6%) + identical cross-lab
  cluster of 5; all 4 R2-B fingerprints reproduced verbatim.
- **SHIFTED (softer, not reversed):** Q2 modal-fraction weakened (p→0.036–0.044, reinforcing the
  original caution); mid-pack contrarian ranks reshuffled (Gemini 3.1 #3→#8 — partly the data
  gap); o3×Grok #2→#6 (value barely moved). Nothing crossed a boundary that changes the story.

---

## What's site-worthy (solid enough to publish)
1. **The fame/canonicity through-line** — "AI taste is a canonical answer-space, and the
   overrated is its most famous member" — is the strongest, most defensible narrative we have,
   confirmed across R1/R2/R3 and out-of-sample. This could anchor an essay/section.
2. **Japan as the aesthetic home of AI taste** — `country` 85.5% vs 18.5% (p=0.00005) is clean,
   vivid, and quotable.
3. **The AI products/researchers self-reference split** — flatter your products, never name your
   people — is novel and shareable (with the "model behavior, not merit" framing).
4. **Per-model personality cards** (R2, held on v6) — the most engaging site artifact.

## What is NOT site-ready
- The fragile favorite/overrated *entropy* asymmetry (Q2) — metric-dependent, weakening.
- Anything on the 7 new domains framed as 13 models (Gemini 3.1 gap) — needs its backfill first.
- The gender findings are real but sensitive — publish only with explicit model-behavior framing,
  if at all; not a claim about people.

## Recommended next data
- **Backfill Gemini 3.1 Pro on the 7 new domains** (quota reset) to restore the full 13-model
  panel — cheap and removes the load-bearing caveat.
- To make fame→overrated *causal* rather than internal-proxy, an external fame measure
  (pageviews) remains the one high-value external join (flagged since R1).
