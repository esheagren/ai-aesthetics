# R3-D — v5→v6 robustness confirmation

**What this is.** Round 1 (`analysis/round1/FINDINGS.md`) and Round 2
(`analysis/round2/PERSONALITIES.md`) shipped their headline numbers on a v5 snapshot:
9,262 non-refused rows, 43 domains, 13 models. The dataset then grew ~14%: **10,531
non-refused rows, 50 domains** (7 new: `musician`, `composer`, `song`, `director`,
`proglang`, `sound`, `country`), same 13 models. The derived tables committed under
`analysis/data/` (`q1_*`, `q2_*`, `r2a_*`, `r2c_*`, timestamped before the domain-add
commit) are the v5 snapshot; `data/summary.json`/`extracted.jsonl` are current (v6).

This note re-runs the *same methods* from `analysis/lib/{q1_convergence,q2_asymmetry,
r2a_signatures,r2c_clustering,r2b_fingerprint}.py` over the current v6 data via the new
`analysis/lib/r3d_robustness.py`, and reports every v5-vs-v6 number found. All v6 tables
are written with a `v6_` prefix so the original v5 tables are untouched. Two small edits
were needed to make the existing scripts run at all on the larger domain set (both
preserve the original algorithm, just widen a hardcoded 43-domain assumption):
- `q2_asymmetry.py`: its `assert len(OFFICIAL_DOMAINS) == 43` now accepts 43 or 50.
- `r2a_signatures.py`'s module-global `DOMAINS_43` is monkey-patched at call time by
  `r3d_robustness.py` (no source edit) to run over the full v6 domain set, and again
  restricted to just the 7 new domains for the new-domains-only check.
`r2b_fingerprint.py` needed no change — it was already domain-agnostic.

---

## HELD / SHIFTED / BROKEN

| # | Claim | v5 | v6 | Verdict |
|---|---|---|---|---|
| Q1 | domain/model variance ratio, favorite | 2.57× | 3.15× | **HELD** |
| Q1 | domain/model variance ratio, overrated | 3.38× | 2.85× | **HELD** |
| Q1 | share of variance: domain / model / interaction (favorite) | 22.0% / 8.5% / 69.5% | 24.5% / 7.8% / 67.7% | **HELD** |
| Q1 | share of variance: domain / model / interaction (overrated) | 24.9% / 7.4% / 67.7% | 22.6% / 7.9% / 69.5% | **HELD** |
| Q1 | domain & model main-effect significance | p = 0.00005 (both) | p = 0.00005 (both) | **HELD** |
| Q1 | within-family > between-family, favorite | gap +0.052, p = 0.0002 | gap +0.047, p = 0.0003 | **HELD** |
| Q1 | within-family > between-family, overrated | gap +0.037, p = 0.0059 | gap +0.041, p = 0.0071 | **HELD** |
| Q2 | overrated>favorite, modal-fraction metric | gap +0.082, p = 0.028 (perm) / 0.024 (sign) | gap +0.070, p = 0.044 (perm) / 0.036 (sign) | **SHIFTED** (weaker, still &lt;0.05) |
| Q2 | overrated>favorite, log-k entropy metric | gap +0.023, p = 0.43 (null) | gap +0.005, p = 0.86 (null) | **HELD** (still null, even flatter) |
| Q2 | → metric-dependence itself persists | — | — | **HELD** |
| R2-A | Opus 4.1 most contrarian | 43.0%, rank 1/13 | 42.0%, rank 1/13 | **HELD** |
| R2-A | DeepSeek most agreeable | 17.4%, rank 13/13 | 19.0%, rank 13/13 | **HELD** |
| R2-A | endpoint-split significance (top-6 vs bottom-6 perm test) | p = 0.00035 | p = 0.00005 (perm floor) | **HELD** (strengthened) |
| R2-A | middle-of-pack contrarian order | Gemini 3.1 Pro #3 (36%), Kimi #4 (35%) | Kimi #3 (37%), Gemini 3.1 Pro #8 (31%) | **SHIFTED** |
| R2-C | family recovery / purity at k=6 | 84.6% (11/13) | 84.6% (11/13) | **HELD** |
| R2-C | cross-lab cluster of 5 | {o3, GPT-5.2, GPT-5.6 Sol, DeepSeek, Grok} | identical 5 models | **HELD** |
| R2-C | o3 × Grok top cross-lab pair | 0.2857, rank 2/78 | 0.2757, rank 6/78 | **SHIFTED** (still top-decile) |
| R2-C | GPT-4o × GPT-5.6 Sol near-worst pair | 0.1575, rank 71/78 | 0.1659, rank 65/78 | **HELD** (still bottom-14 of 78) |
| R2-B | Opus 4.5 top word = "honest" | z-scored #1 | #1, identical top-5 | **HELD** |
| R2-B | Grok, GPT-4o, DeepSeek fingerprints | sculptural/painterly/luminous; innovative/timeless/dynamic; seductive/meditative/sacred | identical top-5 words, same order | **HELD** |
| New domains | any model distinctive on music/proglang? | n/a (didn't exist in v5) | GPT-5.6 Sol's "clean syntax" carries straight into `proglang`/`sound` (reinforces its existing persona, not a new one); Gemini 3.1 Pro shows 0/14 confident divergences | **DESCRIPTIVE — see caveat below** |

---

## Notes on what moved

**Q1 (convergence structure) — solid.** The domain-beats-model ratio stayed in the same
2.5–3.4× band on both metrics, the variance shares stayed within ~2.5 points of their v5
values on every component, and both main effects are still maxed-out significant
(p = 0.00005 is the permutation-test floor at n=20,000 — 0 of 20,000 shuffles beat the
observed effect, both before and after). Family clustering held almost exactly: gap sizes
moved by ~0.004–0.005 in both directions, p-values stayed comfortably under the same
threshold. **Nothing here is fragile.**

**Q2 (asymmetry) — the one real softening.** The modal-fraction gap shrank about 15%
(+0.082 → +0.070) and its p roughly doubled (0.024–0.028 → 0.036–0.044) — still under
0.05 by both tests, but now close enough to the line that a slightly less generous test
or a few more borderline domains could flip it. The entropy metric, already null in v5
(p=0.43), got *more* null in v6 (gap nearly vanished, p=0.86). So the actual headline —
"real but metric-dependent, don't stake anything on the single modal-fraction
significance" — is **reinforced, not undermined**, by the growth. This was already the
correctly-hedged conclusion in Round 1; v6 just makes the hedge look more justified.

**R2-A (contrarian ranking) — endpoints rock-solid, middle noisy.** Opus 4.1 and DeepSeek
V4 Pro are still exactly #1 and #13 with near-identical rates, and the permutation test
that certifies the top-6/bottom-6 split as real got *stronger* (from p=0.00035 to the
test's floor, p=0.00005). But the #3–#8 band reshuffled: Kimi K2.6 jumped from #4 to #3,
and — notably — **Gemini 3.1 Pro fell from #3 (36%) to #8 (31%)**. Some of that drop is
real signal dilution as more domains average things out; some of it is likely the data
gap below (Gemini 3.1 Pro has zero rows in all 7 new domains, so its rate is computed
over fewer, not-comparable cells than everyone else's). Either way, this is exactly the
kind of "ranks 3 through 8 are close together" instability you'd expect from a 13-point
ranking under resampling — treat the *order* in that band as descriptive, the two
endpoints as load-bearing.

**R2-C (taste-space) — the cluster is exactly stable, one pair-rank drifted.** Family
purity is bit-for-bit the same fraction (11/13 = 84.6%), and the cross-lab cluster of 5
is the *identical set of 5 models*, not just the same count. The GPT-4o×GPT-5.6-Sol
"worst same-lab pair" claim held (65th vs 71st of 78 — still solidly in the bottom
quintile). The one number that moved more than trivially is o3×Grok's exact rank (2nd →
6th of 78) — the agreement value itself barely changed (0.2857 → 0.2757) but a handful of
other pairs edged past it. "A top cross-lab pair" holds; "the #2 pair specifically" does
not.

**R2-B (fingerprints) — untouched.** `r2b_fingerprint.py` never restricted itself to the
43-domain scope (it pools over whatever `q6.load_recs()` returns, which only drops
`bookcover`/`chair`), so its outputs were already effectively computed on close-to-v6
data even at v5-snapshot time. All 4 spot-checked models reproduced identical top-5 word
lists. No surprise, but useful confirmation the extractor-vocabulary story isn't an
artifact of the smaller corpus.

## Caveat: the new domains aren't evenly collected yet

**Gemini 3.1 Pro has literally zero extracted rows in all 7 new domains** (musician,
composer, song, director, proglang, sound, country) — confirmed directly against
`data/extracted.jsonl` row counts, and consistent with the collection commit's own note
("gemini-3.1-pro cells for new domains pending its quota reset"). Its "0/14 confident
divergences" and "no fingerprint word" on the new-domains-only cut in the table above is
a **collection gap, not a personality signal** — don't read it as "Gemini 3.1 Pro has no
opinion on music." The other 12 models are present in every new domain but at uneven,
generally thin sample counts (8–24 rows/domain vs. 124–296 for the original 43), so
per-model rates on the new-domains-only slice are noisier than the full-corpus numbers
and are reported here as descriptive, not significance-tested.

Where the new domains *do* show something coherent: GPT-5.6 Sol's already-known
"code-poet" vocabulary (`clean syntax`, `fractured`) carries straight through into
`proglang`/`sound`, and Opus 4.8's "austerity" register shows up there too — both
consistent with, not a revision of, their existing Round 2 personality cards. No model
picked up a genuinely new axis from the added domains in this pass.

## What this means for trusting Round 1 / Round 2

The pipeline's **structural** claims — the ones anyone would actually build on — are
robust to a 14% data increase and 7 new domains: the variance decomposition, the
family-clustering gap, the contrarian endpoints, the taste-space cluster membership, and
the descriptor fingerprints all reproduced within noise, with no sign flips and no
crossed significance thresholds. The one number that genuinely weakened (Q2's
modal-fraction p-value) was already the analysis's self-flagged soft spot — Round 1's
own text called it "real but modest, and it doesn't survive a metric swap," and v6 makes
that hedge more true, not less. The only claims that shifted materially are
rank-order claims among closely-spaced middle entries (R2-A's #3–#8 contrarian band,
R2-C's o3×Grok exact pair-rank) — which is the expected failure mode for close rankings
under more data, not evidence of a broken method. **Net: trust the earlier rounds' shape
of the story; hold the exact middle-of-the-pack rank numbers loosely; and re-run this
check again once Gemini 3.1 Pro's new-domain gap is filled in.**

---

## Reproducing this

```
cd /Users/erik/Documents/projects/active/ai-aesthetics
python3 analysis/lib/r3d_robustness.py
```

Writes (all v6, none clobber the v5 tables already in `analysis/data/`):
`v6_q1_variance_decomposition.json`, `v6_q1_family_gap.json`,
`v6_q1_pairwise_agreement_{favorite,overrated,combined}.csv`,
`v6_q1_model_convergence_rank.json`, `v6_q2_consensus_by_domain.csv`,
`v6_q2_summary.json`, `v6_r2a_signatures.csv`, `v6_r2a_full_results.json`,
`v6_r2a_new_domains_only.csv`, `v6_r2c_clusters.csv`, `v6_r2b_fingerprint.csv`.
