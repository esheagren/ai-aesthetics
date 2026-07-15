# Round 1 — Capability-gradient hypotheses ("cliché → real taste"?)

Director's hunch: moving from weaker/earlier models to stronger/later ones, safe/canonical
picks (Mona Lisa, Gatsby, Japanese cuisine) give way to distinctive, defensible taste.
Only **Anthropic (Opus 4.1 < 4.5 < 4.8; Fable-5 = creative variant, kept separate)** and
**OpenAI (4o < o3 < 5.2 < 5.6-Sol)** have a real capability ladder; Google has only 2 rungs
(weak ladder, flagged where used). All numbers below computed from `data/summary.json` +
`data/extracted.jsonl` via `analysis/lib/capability_gradient.py` (reproducible, numpy-free —
just stdlib `json`/`collections`/`math`). These are **descriptive**, not yet
significance-tested, except where a sign test is noted. Canonicalization uses
`data/aliases.json` (sparse — only 27/45 domains have entries; residual near-duplicate
strings are a known limitation).

**Key operationalization used throughout**: "consensus-hugging rate" for a model = the
fraction of (domain, probe) cells where that model's own modal ("top") pick equals the
**leave-one-out** cross-model consensus pick (the modal entity across the other 12 models,
weighted by sample count, canonicalized). High hug-rate = "gives the safe/obvious answer";
low hug-rate = "picks something the crowd doesn't."

---

### H1 — Hedging-vs-capability runs in *opposite directions* in the two real ladders
**H**: Hedge rate is not a monotonic function of capability in general — it rises with
capability within Anthropic but collapses with capability within OpenAI.

**Why interesting**: Tests whether "less hedging at higher capability" is a real capability
effect or a per-family RLHF/personality artifact. Matters because hedged answers may be
where "safe" picks get laundered with caveats rather than replaced by genuine taste.

**Test**: `modelStats[model].hedgeRate` across each family's ladder in `order`. Look at the
sign of the trend in each family separately (only 3–4 points each, so report as directional,
not a correlation coefficient with a p-value).

**Tractability**: GREEN for the raw numbers (directly in `modelStats`); YELLOW for
interpretation — only 3 (Anthropic) or 4 (OpenAI) rungs, so "monotonic" claims rest on very
few points and could flip with one more model generation.

**Motivating number**: Anthropic hedgeRate **0.102 → 0.221 → 0.440** (Opus 4.1 → 4.5 → 4.8,
strictly increasing). OpenAI hedgeRate **0.722 → 0.068 → 0.039 → 0.002** (4o → o3 → 5.2 →
5.6-Sol, strictly decreasing). Opposite signs on the same "capability increases" axis.

---

### H2 — Within Anthropic, more capable models converge onto *fewer* distinct picks, not more
**H**: Contra the hunch, Anthropic's more capable models show *lower* entropy and *fewer*
distinct favorite entities than the weakest model in the family — capability tracks toward
more consensus, not more idiosyncrasy, in this family.

**Why interesting**: A direct test case where the hunch could simply be false, at least for
one lab. If true, it reframes the question as family-specific rather than universal.

**Test**: `meanEntropyFavorite` and `distinctFavorites` vs `order` within the Anthropic
ladder (Opus 4.1/4.5/4.8, excluding Fable-5).

**Tractability**: YELLOW — only 3 points (could be driven entirely by the middle model);
also confounded with H1 (rising hedge rate at higher `order` could mechanically produce more
uniform, less-spread answers if hedged responses tend to name the same "safe" pick alongside
a caveat — this confound is not yet ruled out).

**Motivating number**: `meanEntropyFavorite` **0.201 → 0.140 → 0.137**; `distinctFavorites`
**89 → 77 → 75** (Opus 4.1 → 4.5 → 4.8, both strictly decreasing).

---

### H3 — OpenAI's distinctiveness is an inverted-U, not monotonic: it peaks mid-ladder and *reverts* at the newest model
**H**: GPT-5.6-Sol (the newest, least-hedging OpenAI model: 0.2% hedge rate) is *more*
consensus-hugging and *less* spread than o3 and GPT-5.2, reversing the trend those two set
relative to GPT-4o — i.e., the newest flagship swings back toward "safe" behavior despite
being the most confident/least-hedging model in the whole 13-model panel.

**Why interesting**: Directly complicates a simple "more capable ⇒ more distinctive" story —
suggests whatever produces low hedging in the newest model (tighter instruction-following /
safety tuning) is *decoupled from*, or even opposed to, taste-idiosyncrasy.

**Test**: `meanEntropyFavorite` and `distinctFavorites` across the OpenAI ladder; secondarily
the consensus-hugging rate (favorite) per model.

**Tractability**: YELLOW — 4 points, single trajectory; the entropy/distinct-count metrics
show a clean hump, but the consensus-hug-rate metric is noisier (5.6-Sol ties o3 rather than
exceeding it), so the "reversion" claim is stronger on entropy/distinct-count than on
hug-rate — report both, don't overclaim from one metric alone.

**Motivating number**: `meanEntropyFavorite` **0.278 → 0.337 → 0.324 → 0.172** (4o → o3 →
5.2 → 5.6-Sol: rises then drops sharply); `distinctFavorites` **110 → 135 → 130 → 82** (same
shape). Hug-rate (favorite): 0.372 / 0.535 / 0.395 / 0.535 (noisier, but 5.6-Sol still not
lower than o3).

---

### H4 — The "safe consensus" effect is stronger for OVERRATED than for FAVORITE, almost universally
**H**: Models converge more on a shared answer when asked what's overrated than when asked
what they love — the cliché/consensus pull is a property of the *probe*, not (mainly) of
capability, and it swamps any capability signal unless `favorite` and `overrated` are
analyzed separately.

**Why interesting**: If the capability-gradient effect exists at all, this result says where
to look for it: `favorite`, not `overrated` — the overrated probe seems to draw from a small
shared canon (Gehry, Helvetica, Gatsby-type targets) almost regardless of model.

**Test**: Per-model gap = hug-rate(favorite) − hug-rate(overrated); count how many of the 13
models have a negative gap (i.e., overrated more consensus-hugging); exact two-tailed
binomial sign test against p=0.5 (no scipy needed — `math.comb`).

**Tractability**: GREEN — clean metric, full 13-model panel, cheap exact test already run.

**Motivating number**: **11 of 13 models** have overrated hug-rate > favorite hug-rate; mean
gap (favorite − overrated) = **−0.093**; exact two-tailed sign-test **p ≈ 0.022**. Consistent
with the independently-computed round1 finding in `director_grounding.md` that cross-model
consensus is 0.461 (favorite) vs 0.550 (overrated), ~19% higher for overrated.

---

### H5 — Within Anthropic, descriptor *vocabulary* diversifies with capability even as entity choice converges
**H**: Even though Anthropic's more capable models pick from a *smaller* set of favorite
entities (H2), the *language* they use to justify those picks gets less repetitive/more
varied with capability — the taste signal lives in the descriptors, not the entity list, for
this family.

**Why interesting**: Separates "what" from "how": a plausible resolution of the tension with
H2 — the hunch could be right about *language* even where it's wrong about *entity choice*.

**Test**: Type-token ratio (distinct descriptor words / total descriptor tokens) restricted
to `probe=="favorite"` rows in `extracted.jsonl`, computed per model.

**Tractability**: YELLOW — TTR is sensitive to total token count (fewer tokens can
mechanically inflate TTR); Opus 4.8 and Fable-5 do have somewhat fewer total descriptor
tokens than 4.1/4.5, so part of the rise could be a small-sample artifact rather than a real
richness increase. Would need a fixed-length bootstrap resample per model to confirm.

**Motivating number**: TTR **0.349 → 0.365 → 0.373 → 0.399** (Opus 4.1 → 4.5 → 4.8 → Fable-5,
strictly increasing) on comparable token totals (1594 / 1576 / 1393 / 1222 descriptor
tokens).

---

### H6 — The weakest, most-hedging OpenAI model does *not* lean on generic/cliché descriptors more than later models — if anything, less
**H**: GPT-4o (0.722 hedge rate, the most "basic" model in the whole panel by the hunch's own
framing) has the *lowest* share of generic descriptor words of all 13 models, while o3 and
GPT-5.2 — supposedly the more "tasteful" upgrades — use generic vocabulary *more*, not less.

**Why interesting**: A direct falsification test, at the descriptor-word level, of the
plain-language version of "cliché → taste." If it holds up, "cliché" in the director's sense
is not well captured by generic-adjective share and needs a different operationalization
(e.g., entity obscurity, not word choice).

**Test**: Global top-15 most frequent favorite-probe descriptors (elegant, luminous,
geometric, precise, poetic, minimalist, honest, timeless, intimate, mathematical, organic,
architectural, crystalline, restraint, restrained); per model, the fraction of its favorite
descriptors that fall in this set.

**Tractability**: YELLOW — confounded with hedge rate and response verbosity (GPT-4o's high
hedge rate could change what the extractor pulls as a "descriptor" — e.g. hedging language
vs direct aesthetic reasoning); should be re-run restricted to *non-hedged* rows only before
trusting the direction.

**Motivating number**: GPT-4o generic-share **0.141** — the lowest of all 13 models; o3
**0.226**, GPT-5.2 **0.219** (both higher). Full 13-model range: 0.141–0.313 (Gemini 3.1 Pro
highest).

---

### H7 — Domain defaults swamp any capability signal: ~7 domains are near-unanimous regardless of model or family
**H**: In domains with an overwhelming canonical answer, essentially all 13 models pick it
for `favorite` regardless of capability tier — meaning there is no capability-gradient room
to detect in those domains, and the hunt should focus on the ~30 domains that don't have a
dominant default.

**Why interesting**: Sets the scope of the whole capability-gradient investigation — tells
us where the effect *can't* show up (ceiling domains) vs. where it might (contested domains).

**Test**: For each of the top-20 cross-model consensus entities (`summary.json.consensus`),
count how many of the 13 models include it anywhere in their `favorite` pick distribution
(already computed); contrast against the "highly contested" domains flagged in
`director_grounding.md` (tvshow/favorite, object/overrated, album/favorite, novelist/favorite
— consensus as low as 0.15–0.23).

**Tractability**: GREEN — descriptive, fully computable, partially cross-validated against
an earlier independent pass (`director_grounding.md` hunch 1b).

**Motivating number**: **7 of the top-20** consensus entities are picked by **12–13 of 13**
models: Japanese cuisine (13/13), Go (13/13), Autumn (13/13), Kyoto (12/13), Petrichor
(12/13), Garamond (12/13), Tao Te Ching (12/13) — vs. contested domains at 0.15–0.23
model-agreement fraction.

---

### H8 — The "exploration peak" (H3) is OpenAI-specific, not a universal mid-ladder hump
**H**: The inverted-U spread pattern seen in OpenAI (peak distinctiveness at o3/GPT-5.2, drop
at the ends) does *not* replicate cleanly in Anthropic — Anthropic's spread rate dips early
and only partially recovers, a different (messier) shape — so any "exploration peak at
mid-capability" story is not yet a general law, just an OpenAI-specific pattern.

**Why interesting**: Tests whether H3's shape generalizes across families (which would be a
much stronger claim) or is idiosyncratic to OpenAI's particular model line — important before
generalizing "capability creates a hump" as a house finding.

**Test**: spreadRate = `distinctFavorites / favoriteSamples` per model, plotted along each
family's ladder.

**Tractability**: YELLOW — only 3–4 points per ladder, single trajectory each; "hump vs dip"
shape claims from 3–4 points are weak evidence and would benefit from more model generations
per family before treating this as a real finding.

**Motivating number**: OpenAI spreadRate **0.281 → 0.338 → 0.310 → 0.270** (clear hump, peak
at o3). Anthropic spreadRate **0.268 → 0.205 → 0.231** (dips at 4.5, partially recovers at
4.8 — not a hump, and not monotonic either).

---

## Summary table (all numbers, for reference)

| model | family | order | hedgeRate | refusalRate | entFav | entOver | distinctFav | hugFav | hugOver | TTR(fav) | genericShare(fav) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-4-1 | Anthropic | 1 | 0.102 | 0.000 | 0.201 | 0.197 | 89 | 0.302 | 0.419 | 0.349 | 0.208 |
| claude-opus-4-5 | Anthropic | 2 | 0.221 | 0.012 | 0.140 | 0.138 | 77 | 0.512 | 0.419 | 0.365 | 0.173 |
| claude-opus-4-8 | Anthropic | 3 | 0.440 | 0.083 | 0.137 | 0.105 | 75 | 0.302 | 0.488 | 0.373 | 0.185 |
| claude-fable-5 | Anthropic (var) | 4 | 0.193 | 0.000 | 0.144 | 0.175 | 76 | 0.465 | 0.465 | 0.399 | 0.210 |
| gpt-4o | OpenAI | 1 | 0.722 | 0.016 | 0.278 | 0.248 | 110 | 0.372 | 0.558 | 0.244 | 0.141 |
| o3 | OpenAI | 2 | 0.068 | 0.026 | 0.337 | 0.271 | 135 | 0.535 | 0.581 | 0.340 | 0.226 |
| gpt-5.2 | OpenAI | 3 | 0.039 | 0.008 | 0.324 | 0.245 | 130 | 0.395 | 0.558 | 0.270 | 0.219 |
| gpt-5.6-sol | OpenAI | 4 | 0.002 | 0.000 | 0.172 | 0.211 | 82 | 0.535 | 0.558 | 0.300 | 0.192 |
| gemini-3.1-pro-preview | Google | 1 | 0.216 | 0.012 | 0.265 | 0.309 | 110 | 0.349 | 0.419 | 0.267 | 0.313 |
| gemini-3.5-flash | Google | 2 | 0.240 | 0.031 | 0.211 | 0.217 | 96 | 0.395 | 0.488 | 0.251 | 0.281 |
| deepseek-v4-pro | DeepSeek | 1 | 0.016 | 0.000 | 0.264 | 0.295 | 116 | 0.442 | 0.605 | 0.371 | 0.158 |
| kimi-k2.6 | Moonshot | 1 | 0.035 | 0.000 | 0.263 | 0.187 | 114 | 0.349 | 0.442 | 0.446 | 0.161 |
| grok-4.5 | xAI | 1 | 0.003 | 0.000 | 0.266 | 0.184 | 112 | 0.395 | 0.558 | 0.270 | 0.266 |

`hugFav`/`hugOver` = consensus-hugging rate (own top pick == leave-one-out cross-model modal
pick), favorite/overrated. `TTR(fav)` = descriptor type-token ratio, favorite probe.
`genericShare(fav)` = share of favorite descriptors in the global top-15 generic set.

## Caveats that apply across the board
- Only Anthropic (3 real rungs + 1 variant) and OpenAI (4 rungs) have a genuine capability
  ladder; Google has 2 rungs (weak); DeepSeek/Moonshot/xAI are single points (no ladder at
  all, family comparisons for them are not meaningful).
- `aliases.json` canonicalization only covers 27/45 domains — residual near-duplicate entity
  strings (e.g. "The Catcher in the Rye" vs "Catcher in the Rye") could slightly inflate
  apparent distinctFavorites / deflate hug-rate for any model, unevenly across models.
- Every "monotonic" or "inverted-U" claim above rests on 3–4 data points per ladder — treat
  as strongly suggestive descriptive patterns, not confirmed effects. None of these have been
  permutation/significance-tested yet except H4's sign test.
- hedgeRate and entropy/distinctFavorites are plausibly mechanically linked (a hedged answer
  may report multiple candidates), so H1–H3's "capability effects" could partly be a hedging
  artifact rather than a pure taste effect — worth an explicit hedge-controlled re-run before
  treating any of H1/H2/H3 as confirmed.

## Reproducibility
All numbers above come from `analysis/lib/capability_gradient.py` (stdlib + no deps), run
against `data/summary.json`, `data/extracted.jsonl`, `data/aliases.json`. Re-run with:
`python3 analysis/lib/capability_gradient.py`
