# Round 1 Hypotheses — Convergence & Divergence Between Models

Lens: interrogating the director's hunch of "clear and remarkable convergence in what
aesthetics AIs care for." All numbers below were computed directly from
`data/summary.json` (and, where noted, a fresh re-aggregation of `data/extracted.jsonl`
using `data/aliases.json` for canonicalization, restricted to the official 43 domains).
Scripts used are throwaway (`/private/tmp/.../explore{,2,3,4}.py`); nothing reusable was
promoted to `analysis/lib/` yet since these are still exploratory.

**Important scope note on `overlap`**: per `src/analyze.js`, `summary.json`'s `overlap`
matrix is the **Jaccard overlap of *favorite* picks only** (pooled across all domains,
canonicalized), not overrated. Any hypothesis that leans on `overlap` is therefore a claim
about convergence-in-taste, not convergence-in-scorn. Overrated convergence has to be
measured separately from `cells[...].overrated.entropy` or from re-aggregating
`extracted.jsonl` — which is exactly what several hypotheses below do.

---

### H1 — Convergence clusters by model family; it is not a uniform field-wide phenomenon
**Claim**: Pairwise favorite-overlap is higher within a model family (same lab) than
across families — the "remarkable convergence" is partly an artifact of family reuse of
training data/RLHF preferences, not a universal AI aesthetic.

**Why interesting**: If true, the director's hunch should be reframed from "AI taste
converges" to "AI taste convergence is inherited within a lab," which is a very different
(and less mystical) story.

**Test**: Compare mean `overlap[i][j]` for same-family pairs vs different-family pairs;
run a label-permutation test (shuffle family labels 20k times, recompute the within/between
gap) for a p-value. Already done.

**Tractability**: GREEN — fully testable with `overlap` + `models[].family`. Caveat:
DeepSeek, Moonshot, and xAI each have only one model, so "family effect" is only directly
testable for Anthropic (4 models), OpenAI (4 models), and Google (2 models); the other
three families can only appear in the *between*-family pool.

**Motivating number**: within-family mean overlap = **0.224** (n=26 ordered pairs) vs
between-family mean = **0.173** (n=130); permutation test on family-label shuffles gives
**p = 0.0006** for within > between. Per-family breakdown: Google +0.194 (0.340 within vs
0.146 out), OpenAI +0.052 (0.235 vs 0.183), Anthropic +0.029 (0.193 vs 0.164) — the bubble
effect is real but very unevenly sized by family.

---

### H2 — There are two consistent "odd models out," not a smooth convergence gradient
**Claim**: Gemini 3.1 Pro and Claude Opus 4.8 are reliably the least-convergent models
with the rest of the 13-model field, while simultaneously Gemini 3.1 and Gemini 3.5 Flash
form the single most-convergent *pair* in the whole matrix — i.e., insularity, not
uniform divergence.

**Why interesting**: A single well-chosen "outlier model" claim is falsifiable and much
sharper than a diffuse "convergence is high/low" claim; it also suggests family-internal
agreement can coexist with field-wide idiosyncrasy (a "walled garden" pattern) rather than
picking one model that ignores the consensus entirely.

**Test**: Rank each model's mean overlap with the other 12; identify bottom-2. Separately
identify the single highest-overlap pair in the full 78-pair set and check whether it's
also each other's top ranked most idiosyncratic model.

**Tractability**: GREEN — pure descriptive statistic on `overlap`.

**Motivating number**: mean overlap-with-others: gemini-3.1-pro-preview = **0.146**
(lowest of 13), claude-opus-4-8 = **0.156** (2nd lowest). Yet gemini-3.1 × gemini-3.5-flash
= **0.340**, the single highest pairwise value in the matrix (next highest is o3×gpt-5.2 at
0.280). 6 of the bottom 8 pairs in the entire matrix involve gemini-3.1-pro-preview; the
other 2 involve claude-opus-4-8.

---

### H3 — Within the Anthropic capability ladder, newer/more capable models are *less* convergent with the field, not more
**Claim**: Mean overlap-with-others decreases monotonically across
claude-opus-4-1 → 4-5 → 4-8 (0.178 → 0.172 → 0.156), i.e. capability growth correlates
with *more* idiosyncratic taste within this family, contradicting a naive "smarter models
converge on the objectively-best answer" story.

**Why interesting**: This is the most direct test available of whether increasing
capability moves models toward a shared "true" aesthetic canon or away from it toward
more distinctive/opinionated taste — a central question for the "convergence" thesis if
convergence is expected to strengthen with capability.

**Test**: Regress/compare mean overlap-with-others against `order` within Anthropic only
(4 points; fable-5 is a stated outlier/creative variant per the data dictionary and should
be reported separately, not fit into the ladder). Repeat for OpenAI's 4-point ladder
(4o→o3→5.2→5.6-sol) as an out-of-family replication check.

**Tractability**: YELLOW — only 3–4 ordered points per family, so this is a descriptive
trend, not a statistically powered regression; a permutation/rank test on 3-4 points has
very low power. Also the OpenAI ladder does **not** replicate the monotonic pattern (see
motivating number), so if this hypothesis is pursued it should be scoped explicitly to
Anthropic and stated as "does not generalize to OpenAI" rather than a universal capability
law.

**Motivating number**: Anthropic mean overlap-with-others by order: 4.1=0.178, 4.5=0.172,
4.8=0.156 (fable-5=0.178, off-ladder). OpenAI by order: 4o=0.166, o3=0.215, 5.2=0.193,
5.6-sol=0.211 — non-monotonic, and o3 (order 2) is the single highest-overlap model in the
*entire* 13-model set.

---

### H4 — Agreement is driven far more by *which domain* than by *which model*
**Claim**: How much models agree is mostly a property of the question being asked
(season/cuisine/boardgame produce near-unanimity; street/aimodel/dish produce chaos)
rather than a property of which model answers — i.e. "clear convergence" is domain-
specific, not model-general.

**Why interesting**: This reframes the director's hunch entirely: it isn't that AIs
converge on taste in general, it's that some questions have a culturally dominant answer
baked into everyone's training data (autumn is the consensus season; Kyoto/Japanese
cuisine keep winning) while others (a favorite street, a favorite dish) have no such
attractor for anyone.

**Test**: Two-way variance decomposition of the model × domain entropy matrix (for
`favorite` and separately `overrated`): grand mean + domain main effect + model main
effect + residual; compare the variance attributable to domain-effect vs model-effect.

**Tractability**: GREEN for the decomposition itself; YELLOW for causal interpretation —
the residual (domain×model interaction) is larger than either main effect, so "domain
matters more than model" is true of the *explainable* variance but most of the total
variance in agreement is still idiosyncratic to specific (model, domain) combinations, not
cleanly attributable to either main effect alone.

**Motivating number**: Variance decomposition of the 43-domain × 13-model entropy matrix:
favorite — domain-effect variance **0.0110** vs model-effect variance **0.0043** (domain
≈2.6× model); overrated — domain-effect **0.0119** vs model-effect **0.0035** (domain
≈3.4× model). Residual (interaction) variance is largest in both cases (~0.033–0.035),
i.e. most variance is neither pure domain nor pure model effect. Concretely: `season`
favorite-entropy mean = 0.021 (near-unanimous) vs `street` = 0.525 (near-chaotic) — a 25x
spread driven by domain alone, wider than the full range across models (model means for
favorite entropy range roughly 0.137–0.337, a ~2.5x spread).

---

### H5 — Models converge more on what they reject than on what they love
**Claim**: Cross-model consensus is systematically stronger for `overrated` picks (shared
villains) than for `favorite` picks (shared heroes) — the director's "convergence in what
they care for" undersells a *stronger* convergence in what they collectively snub.

**Why interesting**: This inverts the framing of the hunch: if true, the sharpest and
most robust convergence signal in the dataset is negative consensus (agreeing Gatsby/
Catcher-in-the-Rye-type picks are overrated), not positive shared taste. That's a much
more surprising and citable finding than "AIs like the same things."

**Test**: For each of the 43 official domains, compute the max number of models (of 13)
that independently named the *same* canonicalized entity as their favorite vs as
overrated; compare the per-domain distribution and the sign of the paired difference
across domains. Cross-check with the (independent) cell-level entropy means from
`summary.json` — same direction should show up there too.

**Tractability**: GREEN, computed directly from `extracted.jsonl` + `aliases.json`
(needed because `summary.json`'s precomputed `overlap`/`consensus` only cover favorites).
Caveat: canonicalization is imperfect (`aliases.json` doesn't catch every wording variant),
so small differences (e.g. 8 vs 9 models) are noisier than large ones (e.g. 5 vs 12).

**Motivating number**: Restricted to the 43 official domains: mean "max models agreeing on
one entity" = **8.37/13 (64%)** for favorite vs **9.37/13 (72%)** for overrated. 24 of 43
domains show *more* overrated-consensus than favorite-consensus, vs only 16 domains where
favorite-consensus is higher (3 ties). Domains with the largest swing toward shared
disdain: `tvshow` (5→12 models), `book` (7→12), `poem` (7→12), `childrensbook` (8→13),
`word` (6→11). Independently, mean cell entropy across all model×domain cells is lower
for overrated (0.215) than favorite (0.230), same direction, smaller effect.

---

### H6 — The "shared villains > shared heroes" effect flips sign for people/thinkers domains
**Claim**: H5's overrated>favorite consensus pattern is not universal — it holds strongly
for cultural artifacts and places, but *reverses* for domains about people/thinkers
(philosophers, economists, historians, etc.), where models agree more on who to admire
than on who is overrated.

**Why interesting**: This is the sharpest test of whether "convergence" is one
phenomenon or several. If the effect flips by domain category, the director's hunch needs
a domain-conditional answer ("yes for X, no for Y") rather than a single verdict — and the
flip itself is a strong, falsifiable, non-obvious claim (praising canonical thinkers is
safer/more convergent than bashing them, perhaps for RLHF-safety reasons around real named
people).

**Test**: Using the data dictionary's five domain-category groupings (cultural artifacts,
people/thinkers, places, design/sensory, meta), compute mean favorite-entropy and mean
overrated-entropy per group from `cells[...][domain][probe].entropy`, and check the sign
of (favorite − overrated) per group.

**Tractability**: GREEN for the descriptive comparison; YELLOW for confidence in the
"meta" and "places" groups specifically, since they have only 4 and 5 domains
respectively (small n, single unusual domain can swing the group mean).

**Motivating number**: Group mean entropy (favorite vs overrated): Cultural artifacts
0.240 vs **0.166** (overrated much more consensual, gap −0.074); Places 0.259 vs 0.184
(gap −0.075); People/thinkers 0.221 vs **0.259** (favorite *more* consensual, gap +0.038,
opposite sign); Design/sensory 0.205 vs 0.218 (mild opposite-sign, +0.013); Meta 0.260 vs
0.226 (gap −0.034, same direction as cultural/places). Two of five categories flip sign
relative to the other three.

---

### H7 — Models converge far more on aesthetic *vocabulary* than on aesthetic *choices*
**Claim**: The word "elegant" appears in the top-15 most-used descriptor words for
**all 13 of 13 models**, while no single entity pick reaches unanimous (13/13) agreement
across more than 3 of 43 domains — i.e. the real convergence in this dataset is in HOW
models justify taste, not WHAT they pick. This is arguably the "remarkable convergence"
the director is sensing, just mis-attributed to entities rather than register.

**Why interesting**: This reframes the entire inquiry. If the strongest, most universal
convergence signal is lexical/stylistic (a shared critical register: "elegant,"
"restrained," "precise," "repetitive" as a criticism) rather than substantive (which book,
which city), the "AIs share taste" story is largely a "AIs share a way of talking about
taste" story — a much more mundane (RLHF style homogenization) explanation.

**Test**: For each model take `modelStats[model].topDescriptors` (top 15 by count);
count, across the 13 models, how many models include each word in their own top-15; find
the max. Compare against: (a) mean pairwise Jaccard of these top-15 descriptor sets, and
(b) the mean pairwise Jaccard of favorite-entity sets (`overlap`). Separately check
within- vs between-family descriptor-set Jaccard for consistency with H1.

**Tractability**: YELLOW — `topDescriptors` is truncated to the top 15 words per model in
`summary.json` (not the full vocabulary), so this likely *understates* true tail overlap
and slightly overstates head-word dominance; also some of these words ("elegant,"
"precise") are generic positive-affect adjectives that might be a broader LLM writing tic
rather than anything aesthetics-specific — worth a control comparison against descriptor
usage in a non-aesthetic task if such data existed (it doesn't here, so this part is RED
without new data).

**Motivating number**: "elegant" in top-15 of **13/13** models; "repetitive" in 11/13;
"luminous" and "precise" in 9/13. By contrast the single most cross-model-agreed favorite
*entity* in the whole dataset ("Japanese cuisine," "Go," "Autumn" per `consensus`) tops out
at 13/13 models but only for 3 of 43 domains — most domains never get close. Mean pairwise
Jaccard of top-15 descriptor sets (0.195) is comparable to or slightly higher than mean
pairwise Jaccard of favorite-entity sets (0.181), but the *ceiling* case (a single word
hitting literally every model) has no entity-level analogue outside those 3 domains.
Within-family descriptor Jaccard (0.252) vs between-family (0.184) shows the same family-
bubble pattern as H1, just measured in words instead of entities.

---

### H8 — A model's own tendency toward idiosyncratic/diverse picks does not predict lower convergence with the field
**Claim**: Contrary to the mechanical worry that a model with a larger, more diverse set
of favorite picks (higher entropy, more distinct entities) should almost automatically
show lower Jaccard overlap with everyone else (bigger denominator), the opposite mild
trend holds — diversity and field-overlap are weakly *positively* correlated, with o3 as
the extreme case (most distinct favorites of any model, and also the single highest mean
overlap with the rest of the field).

**Why interesting**: This rules out (or at least weakens) the simplest confound in
reading the `overlap` numbers: that "convergent" models might just be the ones with
narrower, more repetitive answer sets. If diversity and convergence aren't
anti-correlated, the family/capability patterns in H1–H3 are less likely to be pure
artifacts of answer-set size.

**Test**: Correlate `modelStats[model].distinctFavorites` (and separately
`meanEntropyFavorite`) against each model's mean `overlap` with the other 12 models, across
all 13 models (n=13, so treat as descriptive/rank correlation, not an inferential test).

**Tractability**: GREEN for the correlation itself; YELLOW for interpretation — n=13 is
too small for a confident correlation estimate (this is a suggestive descriptive check,
not a powered test), and it's a necessary-but-not-sufficient control, not proof the family
effects in H1 are confound-free.

**Motivating number**: corr(distinctFavorites, mean overlap-with-others) = **+0.34**;
corr(meanEntropyFavorite, mean overlap-with-others) = **+0.31** (both n=13). o3 has the
most distinct favorites of any model (135, vs a 13-model mean of ~103) and simultaneously
the highest mean overlap with the field (0.215) — the most-diverse picker is also the
most-convergent one, the opposite of the naive mechanical prediction.

---

## Summary table

| # | Hypothesis (one line) | Tractability | Key number |
|---|---|---|---|
| H1 | Convergence clusters by family (lab), not field-wide | GREEN | within 0.224 vs between 0.173, p=0.0006 |
| H2 | Gemini-3.1 & Opus-4.8 are the two odd-ones-out; Gemini pair is the top-convergent pair | GREEN | 0.146 / 0.156 lowest; 0.340 highest pair |
| H3 | Within Anthropic, newer models are less field-convergent (doesn't replicate in OpenAI) | YELLOW (n=3-4) | 0.178→0.172→0.156 vs OpenAI non-monotonic |
| H4 | Agreement is domain-driven more than model-driven | GREEN (desc.) / YELLOW (causal) | domain-effect var ≈2.6-3.4x model-effect var |
| H5 | Models converge more on what's overrated than what's loved | GREEN | mean consensus 9.37/13 (ovr) vs 8.37/13 (fav) |
| H6 | H5 flips sign for people/thinkers domains | GREEN (desc.) / YELLOW (small groups) | Cultural: −0.074 gap; People/thinkers: +0.038 gap |
| H7 | Vocabulary converges more than entity choice | YELLOW (truncated top-15, generic-adjective confound) | "elegant" in 13/13 models' top descriptors |
| H8 | Diversity doesn't suppress convergence (weak positive corr) | GREEN (desc.) / YELLOW (n=13) | r=+0.34 (distinctFavorites vs mean overlap) |
