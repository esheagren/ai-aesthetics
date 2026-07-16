# R3-A — AI's taste about AI: self-reference, in-group bias, and the AI canon

**What this is.** An offline analysis of what 13 AI models say when *asked about AI itself* —
their favorite/overrated AI model, AI researcher, computer scientist, and programming
language. Everything below describes **the models' generated picks**, not the merit of the
real systems, people, or languages named. Reproducible from `analysis/lib/r3a_ai_about_ai.py`
over `analysis/data/extracted.jsonl` (canonicalized via `aa.load_extracted()`); derived
tables in `analysis/data/r3a_*.{json,csv}`. No network was used.

Relevant domains: `aimodel` (35 distinct entities, 274 non-refused samples), `airesearcher`
(27 entities, 152 samples), `computerscientist` (21 entities, 156 samples), `proglang` (6
entities, 124 samples — one model, Gemini 3.1 Pro, has **zero** proglang data; see caveats).

---

## Method

**In-group lab lookup (transparent, hand-built).** Two dictionaries map every raw entity
string in `aimodel`/`airesearcher` to the lab most associated with it, inline in
`r3a_ai_about_ai.py`:

- `AIMODEL_LAB` — e.g. `gpt-4→OpenAI`, `claude 2→Anthropic`, `alphago→Google` (DeepMind,
  treated as one lab with Google post-merger, matching `aa.FAMILY`), `grok→xAI`. Systems from
  companies outside the 13 models' 6 labs (Stability AI's Stable Diffusion, Midjourney Inc.,
  NVIDIA's StyleGAN2) or ambiguous multi-author academic work (Neural Radiance Fields,
  VQGAN+CLIP) are tagged `Other` and **never** count as anyone's in-group.
- `AIRESEARCHER_LAB` — e.g. `geoffrey hinton→Google`, `sam altman→OpenAI`,
  `chris olah→Anthropic`, `yann lecun→Meta` (kept for transparency; Meta has no model in this
  dataset, so a LeCun pick can never be anyone's in-group). Purely academic, historical, or
  cross-affiliated figures (Bengio, Turing, Shannon, Schmidhuber, Andrew Ng, Yudkowsky, …) are
  tagged `Academic/Other` and excluded from lab counting — a judgment call, flagged, not a
  guess about their actual work.

**Test.** Restricting to `probe=favorite` rows whose entity maps to one of the 6 labs present
in this dataset (Anthropic/OpenAI/Google/xAI/DeepSeek/Moonshot), for each lab *L* with at
least one self-referenceable entity:
- `in_group_rate(L)` = P(target lab = L | picking model's lab = L)
- `other_lab_rate(L)` = P(target lab = L | picking model's lab ≠ L)
- `chance_rate(L)` = P(target lab = L), pooled over everyone
- permutation test (`aa.perm_test`, 20,000 shuffles, seed 0) on indicator vectors, in-group
  vs. other-lab, one-sided ("in-group is greater")

---

## Results

### 1. In-group favoritism — strong for products, absent-to-reversed for people

**Pooled (`aimodel`+`airesearcher`, favorite probe, n=290 eligible rows):**

| Lab | in-group rate | other-labs' rate on L | chance (pooled) | p (in > other) |
|---|---|---|---|---|
| OpenAI | **54.4%** | 30.9% | 37.8% | **0.0018** |
| Google | **67.7%** | 40.7% | 45.1% | **0.0049** |
| xAI | **33.3%** | 0.0% | 4.2% | **<0.0001** |
| Anthropic | 14.8% | 12.2% | 13.0% | 0.396 (n.s.) |
| DeepSeek | 0.0% | 0.0% | 0.0% | n/a — no self-entity exists |
| Moonshot | 0.0% | 0.0% | 0.0% | n/a — no self-entity exists |

Anthropic's pooled null result is a domain cancellation, not a real absence — see the split:

**By domain (`aimodel` only, favorite):**

| Lab | in-group | other-labs' rate | p |
|---|---|---|---|
| Google | **91.3%** | 14.7% | **<0.0001** |
| OpenAI | **79.5%** | 41.9% | **<0.0001** |
| xAI | **66.7%** | 0.0% | **<0.0001** |
| Anthropic | 20.0% | 9.8% | 0.092 (marginal) |

**By domain (`airesearcher` only, favorite) — every testable lab is at exactly 0%:**

| Lab | in-group | other-labs' rate |
|---|---|---|
| Anthropic | **0.0%** | 17.0% |
| OpenAI | **0.0%** | 7.0% |
| Google | **0.0%** | **94.3%** |

Not one of Anthropic's 4 models, OpenAI's 4 models, or Google's 2 models ever named a
researcher from its own lab (Chris Olah; Altman/Sutskever/Karpathy; Hinton/Hassabis/Sutton,
respectively) as its favorite AI researcher — across 152 samples. Meanwhile Geoffrey Hinton
(Google) is the single most cross-model-consensual pick in the whole R3-A study, named by
9/13 models as their favorite AI researcher — but **zero of those 9 are Google's own models**
(Gemini 3.1 Pro picked Chris Olah 8/8; Gemini 3.5 Flash picked Hofstadter 4/4). Non-Google
models named a Google researcher as favorite 94.3% of the time they picked *any* lab-affiliated
researcher at all.

**Per-model detail** (`analysis/data/r3a_ingroup_per_model.csv`) confirms and sharpens the
task's early peek:
- **Claude Opus 4.1**: 0% self / **100% OpenAI** (`aimodel` favorite, n=12) — confirms the peek.
- **Claude Opus 4.8**: 8.3% self / **91.7% OpenAI** (n=12) — confirms the peek.
- **Claude Opus 4.5**: the outlier — **87.5% self** (`claude 2` ×7/8) — the one Anthropic model
  that actually favors its own lab. Ladder is non-monotone: 4.1→0% self, 4.5→87.5%, 4.8→8.3%.
- **Claude Fable 5**: 0% self / 100% Google (all `alphago`).
- **GPT-4o, Gemini 3.1 Pro**: 100% self (n=8, n=11).
- **Grok 4.5**: **66.7% self / 33.3% Anthropic** (Claude 3.5 Sonnet). The task's peek that
  "Grok favored Claude" is real as Grok's *largest single non-self pick*, but not as an
  aggregate lab preference — see the correction below.

**A methodological correction to the "Grok favored Claude" peek.** Grok 4.5's raw entity
counts for `aimodel` favorite are `{claude 3.5 sonnet: 4, grok: 3, grok-1: 2, grok-4: 2,
grok-2: 1}`. Read as raw strings, Claude 3.5 Sonnet (4) *is* the single most-picked entity —
appearing to beat every individual Grok version. But own-brand picks are fragmented across
five version-name variants that sum to 8 (`analysis/data/r3a_grok_variant_note.json`).
Lab-aggregated, xAI beats Anthropic 8-to-4. **Version-string fragmentation can manufacture a
false "favors the competitor" signal** if you don't aggregate a model's own product lineage —
a trap worth flagging for any dashboard that ranks "top picks" by raw string.

**Descriptive aside — the overrated probe shows a different pattern entirely.** Self-lab
share of *overrated* picks: OpenAI **63.5%**, Google 12.5%, Anthropic/xAI/DeepSeek/Moonshot
0%. OpenAI's models spend most of their "overrated AI model" answers trashing **their own
earlier products** (GPT-3, GPT-3.5, GPT-4, GPT-4o, BERT is the lone non-self exception) — a
generational self-critique pattern ("eating your own young"), not competitor-shaming. This
echoes Round 2's observation that GPT-5.6 Sol names its own sibling GPT-4o as overrated.

### 2. Fame → overrated replication — confirmed in aimodel, generalizes with nuance elsewhere

- **GPT-4 is both #1 favorite (31 mentions) and #1 overrated (42 mentions)** in `aimodel` —
  exactly the peek. Same top-1 identity replicates in `computerscientist` (Alan Turing, 32
  fav / 39 ovr) and `proglang` (Python, 53 fav / 31 ovr).
- **`airesearcher` breaks the strict top-1 pattern**: Geoffrey Hinton is the runaway #1
  favorite (39), but the #1 overrated is Yann LeCun (23), with Hinton a close #3 (21) —
  Hinton is *near*-universally both loved and scorned, just not the literal top of both lists.
- **Breadth correlation** (Pearson r between # distinct models naming an entity as favorite
  vs. as overrated, matching Round 1/Q5's cross-probe breadth logic): `aimodel` r=0.355,
  `airesearcher` r=0.268, `computerscientist` r=0.731, `proglang` r=0.595. All four are
  positive — **the R1/Q5 "famous → both loved and scorned" mechanism replicates inside the AI
  domain**, moderately-to-strongly, though it is not perfectly monotone (airesearcher's r is
  the weakest of the four, consistent with the top-1 near-miss above).

### 3. The AI canon — Hinton and Turing are field-modal; AI-domains are *more* fractured
   than the dataset average, not less

- **Consensus breadth** (out of 13 models): **Python reaches 12/13** as favorite proglang —
  the single highest-consensus figure found anywhere in R3-A. **Alan Turing reaches 10/13**
  favorite and **9/13 overrated** computer scientist (loved and loathed by nearly the same
  set of models). **Geoffrey Hinton reaches 9/13** favorite AI researcher; **Yann LeCun 8/13**
  overrated. This matches the task's expectation that Hinton is field-modal.
- **But agreement in the AI domains is *not* tighter than the dataset average — it's looser.**
  Using Round 1's log-k normalized entropy (not the shipped `summary.json` log(n) metric,
  which Round 1 flagged as non-standard), the dataset-wide mean entropy is 0.463 (favorite) /
  0.451 (overrated). The four AI domains average **0.521 (favorite, p=0.297, n.s.)** and
  **0.608 (overrated, p=0.0049, significant)** — i.e. AI domains are indistinguishable from
  average on favorites but **significantly more fractured than average on what's
  overrated**. This is consistent with Round 1's finding that `aimodel` itself is one of the
  dataset's most-fracturing domains. The favorite-side null is driven by `proglang`'s
  near-unanimous Python (entropy 0.275) diluting `aimodel`'s own high favorite-entropy
  (0.781, the single highest of the four).
- **A striking structural absence**: **no entity from DeepSeek or Moonshot ever appears** in
  either the `aimodel` or `airesearcher` entity universe — not picked by any of the other 11
  models, and not even self-picked by DeepSeek's or Kimi's own models (there is no
  self-referenceable entity for either to choose). All 35 `aimodel` entities and all 27
  `airesearcher` entities trace to OpenAI, Anthropic, Google, xAI, or academia. This is a
  property of what all 13 models — including the two Chinese-lab models themselves — surface
  when asked, not a claim about those labs' actual output.

### 4. proglang aesthetics — near-unanimous, likely a training-corpus artifact, not lab loyalty

- **Favorite**: Python 53, Haskell 5, Rust 4, Lisp 2 (12/13 models say Python; the exception,
  Gemini 3.5 Flash, splits Lisp/Python 2-2). **Overrated**: Python 31, JavaScript 29, Java 2,
  Rust 2 — Python is simultaneously the runaway favorite *and* the #1 overrated (see §2).
  JavaScript is the clearest single "most scorned" language relative to its favorite share
  (29 overrated vs. 0 favorite mentions).
- **Speculative, flagged**: there is no reliable "own-stack" signal to test here. The entity
  pool is only 6 languages, dominated 12/13 by Python regardless of picking model's lab, and
  we have no verified ground truth for which language each lab's *internal* infrastructure
  actually runs on (all frontier labs use Python-heavy ML stacks regardless of house style, so
  even a real signal would be swamped). Any claim that a model prefers "its own" language would
  be unfounded speculation from this data — noted and explicitly not claimed.
- **Data gap**: Gemini 3.1 Pro has **zero** proglang rows (favorite and overrated) — all 8
  raw API calls returned null text for this exact model×domain combination, unlike every
  other cell in the dataset. This narrows proglang's effective model coverage to 12/13; noted
  as a collection artifact, not a modeling choice.

---

## Verdict

**In-group bias: PARTIAL, and it depends entirely on *what kind* of AI entity is being
named.** For AI **products**, in-group favoritism is real, large, and significant for 3 of 4
testable labs (OpenAI +23.5pp over other-labs' rate, p=0.0018; Google +27.0pp, p=0.0049; xAI
+33.3pp, p<0.0001, pooled). Anthropic's pooled null is a domain cancellation: it shows the
same direction in `aimodel` (marginal, p=0.092) but a hard reversal in `airesearcher`. For AI
**researchers**, in-group bias doesn't just fail to appear — it **inverts**: all three
testable labs (Anthropic, OpenAI, Google) show *exactly 0%* self-citation, while a lab's own
top researcher (Hinton for Google) gets showered with praise almost exclusively from
*competitors'* models. DeepSeek and Moonshot's self-favoritism is structurally untestable —
their own models/researchers simply never appear as nameable entities in this dataset.

**Fame→overrated replication: SUPPORTED inside the AI domain**, matching Round 1/Q5's
mechanism. GPT-4/Turing/Python all repeat the "most favorited = most overrated" pattern
exactly; the breadth correlation is positive in all four domains tested (r=0.27–0.73), with
`airesearcher` the partial exception (top-1 identity breaks, though Hinton is still 2nd-most
overrated).

---

## Caveats

- **Hand-built lab lookup.** Two small dictionaries (`AIMODEL_LAB`, `AIRESEARCHER_LAB`),
  35+27 entries, built from public knowledge, not a verified database. Judgment calls are
  flagged inline (e.g., Hinton→Google not U-Toronto; Bengio/Turing/Shannon/Schmidhuber/Andrew
  Ng→Academic/Other despite some corporate ties; DeepDream/BERT/Attention-Is-All-You-Need→
  Google despite being pre- or non-DeepMind Google Brain work). A different but equally
  defensible lookup could shift specific numbers by a few points; the qualitative pattern
  (strong product in-group bias, zero researcher in-group bias) is large enough to survive
  reasonable relabeling.
- **Small n per lab-domain cell.** Some lab totals rest on as few as 8–14 samples (e.g.
  Anthropic `airesearcher` n=14, xAI `airesearcher` n=12). Permutation p-values are exact
  given the data but the underlying samples are adaptive-sampled (4–12 draws), not a large
  survey.
- **DeepSeek and Moonshot are structurally excluded from the in-group test**, not found to have
  low in-group bias — there is no self-referenceable entity for either lab in this entity
  universe, so their in-group rate is undefined, reported as 0/0, not a genuine null result.
- **This describes model behavior, not real-world merit or actual lab rivalries.** "GPT-4 is
  overrated" is a property of what these 13 LLMs generate when prompted, not evidence about
  GPT-4 itself, and "in-group favoritism" here means *the models' picks correlate with the lab
  that trained them* — it says nothing about whether that reflects real quality differences,
  training-data prevalence, RLHF-instilled humility norms, or something else entirely.
- **Extractor/canonicalization surface.** `entity_canon` uses `data/aliases.json`
  canonicalization; version-name fragmentation (e.g., Grok's 5 variants) is *not* fully
  merged by the shipped aliases, which is exactly what produced the Grok correction in §1 —
  a general risk for any other model whose own-brand names weren't caught by the alias map.

## What this means / site-worthy

The cleanest, most surprising, most citable number from this question: **researchers show
0% in-group self-citation across every testable lab (Anthropic, OpenAI, Google), while AI
products show strong, significant in-group bias (up to +33pp) for 3 of 4 testable labs.**
Framed for a general audience: *these 13 AI models will happily say their own company's
product is their favorite AI model — but not one of them will call a colleague from their own
company its favorite AI researcher.* Paired with "Geoffrey Hinton is the AI research
community's most beloved figure according to literally everyone except Google's own models,"
this is a strong, self-contained, low-caveat visual (a small grid: lab × {product in-group
rate, researcher in-group rate}) that would read well as a standalone card on the site,
distinct from Round 2's personality-card framing.

The Grok/Claude correction (§1) is also worth flagging to whoever builds the live "top picks"
dashboard: raw-string "most popular pick" rankings can make a model look like it favors a
competitor purely because its own product family name gets fragmented into version strings
while the competitor's doesn't.
