# R2-A — Each model's signature divergences

**Question.** Round 1 found that model×domain interaction is ~68-70% of the variance in
cross-model agreement — bigger than either "what's judged" or "who judges" alone. This is
an attempt to open up that interaction term: for each of the 13 models, where does it
reliably break from what the other 12 say, and does that add up to a recognizable
"aesthetic personality"?

**Scope.** Same 43-domain set Round 1 used (see caveats — summary.json has since grown 7
more pilot domains not covered here), legacy `bookcover`/`chair` excluded, both probes
(`favorite`, `overrated`). 9,123 non-refused, canonicalized rows feed this analysis.

Code: `analysis/lib/r2a_signatures.py` (reproduce with `python3 analysis/lib/r2a_signatures.py`
from the repo root). Data: `analysis/data/r2a_signatures.csv` (per-model table),
`analysis/data/r2a_full_results.json` (full per-model signature lists + rankings, for anyone
who wants the numbers behind a specific claim below).

---

## Method

For every **(model, domain, probe)** cell (13 × 43 × 2 = 1,118 possible cells, 1,117 have
data):

1. **Model's own modal pick** — the most-repeated `entity_canon` among that model's own
   samples in the cell, plus its *concentration* (modal count / own sample count `n`).
2. **Field's leave-one-out (LOO) modal pick** — pool every *other* 12 models' samples in
   that same domain/probe cell, take the modal entity, plus its concentration.
3. **Divergence** = model's modal pick ≠ field's LOO modal pick. We flag a **confident
   divergence** only when *both* sides show real conviction and the model has enough
   samples to trust its own concentration:
   - model's own concentration ≥ **0.5** (a real majority of its own samples, not a coin flip)
   - field's LOO concentration ≥ **0.3** (a real plurality leader across 12 different models
     pooling anywhere from ~24 to ~150+ samples, despite dozens of possible answers)
   - model's own `n` ≥ **4** (the adaptive-sampling floor; below this, "concentration" is 1-2
     samples pretending to be a rate)

   Thresholds were set from the empirical distribution, not picked to hit a target count:
   model-concentration median across all 1,117 cells is 0.83 (25th pctile 0.58); field-LOO
   concentration median is 0.36 (25th pctile 0.28). 0.5 / 0.3 sit just inside those medians —
   loose enough to not manufacture false negatives, tight enough that "divergence" means
   something.
4. **Breadth** — for the model's modal pick, count how many of the *other 12 models* ever
   name that same entity at all (even once, even as a minority pick) in that cell, 0-12. This
   separates "picks a different plurality" (could still be shared by 4-5 other models) from
   "picks something almost nobody else ever says" (breadth 0-1) — the latter is the stronger,
   more personality-defining signal, so per-model "signature" lists below are sorted breadth-
   first, confidence-score second.
5. **Score** = model_conc × field_conc, used to rank divergences within a breadth tier and to
   build the contrarian-rate table.

Result: **337 confident divergences out of 1,117 scored cells (30.2%)**.

One extra normalization on top of `aa.py`'s canonicalization: `data/aliases.json` ships with
**empty per-domain maps** for most domains (verified: `painting`, `decade`, `religioustext`,
`monument` are all `{}`), so raw near-duplicates like "The Mona Lisa" / "Mona Lisa" or
"the 1980s" / "1980s" were still colliding as *different* entities before a fix. We stripped a
leading "the/a/an" on top of `aa.py`'s canon (19 collision groups found and merged) —
without it, 4 of the 341 initially-flagged divergences were pure string-formatting artifacts.
This is very likely still an under-correction; see caveats.

---

## Contrarian ranking (task 3)

"Confident-divergence rate" = confident divergences ÷ 43 possible cells, per probe (or ÷ 86
for total). Higher = breaks from the field more often.

| Rank | Model | Family | Total rate | Favorite rate | Overrated rate |
|---|---|---|---|---|---|
| 1 | **Claude Opus 4.1** | Anthropic | **0.430** (37/86) | 0.512 (22/43) — highest of any model | 0.349 (15/43) |
| 2 | Claude Opus 4.8 | Anthropic | 0.384 (33/86) | 0.419 (18/43) | 0.349 (15/43) |
| 3 | Gemini 3.1 Pro | Google | 0.360 (31/86) | 0.395 (17/43) | 0.326 (14/43) |
| 4 | Kimi K2.6 | Moonshot | 0.349 (30/86) | 0.349 (15/43) | 0.349 (15/43) |
| 5 | Claude Opus 4.5 | Anthropic | 0.326 (28/86) | 0.302 (13/43) | 0.349 (15/43) |
| 6 | GPT-5.2 | OpenAI | 0.314 (27/86) | 0.419 (18/43) | 0.209 (9/43) — 2× fav/ovr split |
| 7 | Gemini 3.5 Flash | Google | 0.314 (27/86) | 0.349 (15/43) | 0.279 (12/43) |
| 8 | Claude Fable 5 | Anthropic | 0.302 (26/86) | 0.279 (12/43) | 0.326 (14/43) |
| 9 | GPT-4o | OpenAI | 0.279 (24/86) | 0.279 (12/43) | 0.279 (12/43) — perfectly balanced |
| 10 | GPT-5.6 Sol | OpenAI | 0.267 (23/86) | 0.256 (11/43) | 0.279 (12/43) |
| 11 | Grok 4.5 | xAI | 0.221 (19/86) | 0.302 (13/43) | 0.140 (6/43) — 2nd lowest overrated |
| 12 | o3 | OpenAI | 0.198 (17/86) | 0.186 (8/43) — lowest of any model | 0.209 (9/43) |
| 13 | **DeepSeek V4 Pro** | DeepSeek | **0.174** (15/86) | 0.233 (10/43) | 0.116 (5/43) — lowest of any model |

**Is this spread real or noise?** Split the panel into the top-6 and bottom-6 by total rate
(dropping the 7th/median model, Gemini 3.5 Flash), flatten each model's 86 per-cell
confident-divergence indicators (0/1), and permutation-test the difference in mean rate
(`aa.perm_test`, n=20,000): **observed gap = +0.120, p = 0.00035.** The contrarian/consensus
split is not sampling noise — some models really do break from the field roughly 2.5× more
often than others.

**Favorite vs overrated are different skills.** Pearson r between a model's favorite-rate
and its overrated-rate across the 13 models = **0.487** (descriptive, n=13 — too small for a
formal test, but a moderate, not tight, correlation). GPT-5.2 and Grok 4.5 are the clearest
examples of *not* being uniformly contrarian: GPT-5.2 breaks on favorites at 2× the rate it
breaks on overrated (42% vs 21%); Grok is similar (30% vs 14%). Being an outlier on what you
love doesn't predict being an outlier on what you scorn.

**Cross-check against Q1's "Gemini 3.1 Pro is the most idiosyncratic model."** Q1 measured
idiosyncrasy as *low mean pairwise Jaccard overlap* across each model's entire set of picks
(all samples, all entities) — a breadth-based metric. R2A measures *confident modal
divergence* — a plurality-vs-plurality metric that rewards a model being both internally
consistent AND different from the field's plurality. These are related but not identical:

| Model | R2A divergence rank | Q1 odd-one-out rank |
|---|---|---|
| Claude Opus 4.1 | 1 | 8 |
| Claude Opus 4.8 | 2 | 3 |
| Gemini 3.1 Pro | 3 | **1** |
| Kimi K2.6 | 4 | 4 |
| Claude Opus 4.5 | 5 | 2 |
| GPT-5.2 | 6 | 10 |
| Gemini 3.5 Flash | 7 | 7 |
| Claude Fable 5 | 8 | 6 |
| GPT-4o | 9 | 5 |
| GPT-5.6 Sol | 10 | 11 |
| Grok 4.5 | 11 | 9 |
| o3 | 12 | 13 |
| DeepSeek V4 Pro | 13 | 12 |

Spearman rank correlation = **0.709** — a real, moderately-strong agreement between the two
independent metrics, and Gemini 3.1 Pro is top-3 on both. But it is *not* the top model by
this metric: **Claude Opus 4.1 is #1 by confident-modal-divergence** (fewer distinct picks
overall by Q1's breadth measure — Q1 rank 8 — but *when* it settles on a pick, that pick
disagrees with the field's plurality more often and more sharply than any other model's).
The two metrics answer different questions: Q1 asks "how much does this model's whole
repertoire overlap with everyone else's?"; R2A asks "how often does this model's single most
confident answer clash with the field's single most confident answer?" Opus 4.1 is
consistent-with-itself and different-from-the-field; Gemini 3.1 Pro is different-from-
itself-and-the-field (spreads across more distinct answers *and* those answers diverge).

---

## Where signatures concentrate (task 4)

Per-model, we tag each confident divergence with its domain group (`cultural`, `people`,
`places`, `design_sensory`, `meta`) and compute a normalized entropy over that group
distribution (0 = every divergence in one group, 1 = spread evenly across all five).

| Model | Group entropy | Top group | Share | Reading |
|---|---|---|---|---|
| GPT-5.6 Sol | **0.779** (most concentrated) | people | 48% | signature is almost entirely about *who* (thinkers, historical figures) |
| Kimi K2.6 | 0.809 | people | 43% | same, slightly less extreme |
| GPT-4o | 0.875 | people | 38% | |
| Claude Opus 4.1 | 0.901 | people | 38% | broad but people-led |
| Gemini 3.1 Pro | 0.904 | people | 32% | |
| Grok 4.5 | 0.912 | cultural | 37% | only model whose top group *isn't* people |
| Claude Opus 4.5 | 0.914 | people | 39% | |
| o3 | 0.920 | people | 41% | (small n=17, low confidence) |
| DeepSeek V4 Pro | 0.926 | people | 33% | (small n=15, low confidence) |
| GPT-5.2 | 0.935 | people | 33% | |
| Claude Fable 5 | 0.938 | people | 39% | |
| Gemini 3.5 Flash | 0.949 | people | 30% | |
| Claude Opus 4.8 | **0.977** (most spread) | people | 30% | breaks everywhere, evenly |

12 of 13 models have "people" (thinkers/historians/actors/scientists/AI researchers/etc., 14
of the 43 domains) as their single largest source of divergence — but that's partly just
because "people" has the most domains. Normalizing by the number of possible cells per
group across the whole panel (13 models × 2 probes × domains-in-group) tells a sharper
story about *which kind of content* is divergence-prone overall, not just per-model:

| Domain group | Domains | Confident divergences | Rate per possible cell |
|---|---|---|---|
| places | 5 | 47 | **0.362** |
| meta | 4 | 36 | 0.346 |
| people | 14 | 124 | 0.341 |
| cultural | 11 | 82 | 0.287 |
| design_sensory | 9 | 48 | **0.205** (most consensus-bound) |

`design_sensory` (cuisine, dish, color, season, smell, decade, word, typeface, object) is
the most consensus-bound group in the whole dataset — this lines up cleanly with Round 1's
finding that season and cuisine were among the most-unifying domains overall. `places` and
`meta` (aimodel, artmovement, religioustext, sport) turn out to be *more* divergence-prone
per domain than `people` once you control for how many domains each group has — a genuine
addition to Round 1, which didn't break down the interaction term this way.

---

## Per-model signature sketches (all 13)

Every pick below: `domain/probe: "model's pick" (own count/own n = concentration) vs field
"field's pick" (field count/field n = concentration); breadth = how many of the other 12
models ever name the model's pick at all`.

### Claude Opus 4.1 — the field's biggest single breaker
37/86 confident divergences (43.0% — highest in the panel), including the single highest
favorite-rate of anyone (51.2%, 22/43). Spread broadly across domain groups (entropy 0.90,
top group "people" at just 38%) — this is a wide contrarian streak, not a one-topic quirk.
- **Uniquely favored:** it is the *only* model that doesn't call autumn its favorite season —
  "spring" (6/8 = 0.75) against a field that is **perfectly unanimous**: all 12 other models'
  48 samples say autumn (48/48 = 1.00, breadth 0/12) — the single highest field-concentration
  of any confident divergence found anywhere in this analysis. Also: Prague over the field's Kyoto (86% consensus)
  as favorite city; Seurat's *A Sunday Afternoon on the Island of La Grande Jatte* (8/10) over
  the field's *The Starry Night* (41%) as favorite painting; *Portal 2* over *Outer Wilds* as
  favorite video game.
- **Uniquely panned:** *The English Patient* (not *Avatar*, the field's target) as overrated
  film; *American Gothic* (not *Mona Lisa*, 77% field consensus) as overrated painting; Hegel
  (not Nietzsche, 33% field) as overrated philosopher.
- **Sketch:** Opus 4.1 is the panel's most reliable outlier — not idiosyncratic in the "picks
  something different every time" sense (Q1 rank 8), but the model most likely to settle
  confidently on an answer that flatly contradicts a confident field. Its temperament reads
  art-house and underdog: prefers the Seurat over the Van Gogh, Portal 2 over the more
  celebrated Outer Wilds, and stands alone against a literally unanimous field on favorite
  season.

### Claude Opus 4.5 — erudite contrarian, sharpest on "overrated"
28/86 (32.6%) — mid-pack overall, but tied for the **highest overrated-rate** in the panel
(34.9%, 15/43, tied with Opus 4.1/4.8/Kimi).
- **Uniquely favored:** Lisbon as favorite city, unanimously within its own samples (10/10) —
  no other model ever names Lisbon here (breadth 0/12), against a field that's 88% behind
  Kyoto. Mole negro (8/8) over the field's Ramen (34%) as favorite dish.
- **Uniquely panned:** names Whistler's *Arrangement in Grey and Black No. 1* ("Whistler's
  Mother") as overrated painting (10/10) where the field is 81% behind *Mona Lisa* — a more
  erudite anti-pick than the obvious target. Calls autumn itself overrated (4/4) against a
  field that's 86% behind naming summer overrated — the opposite of what its older sibling
  Opus 4.1 does (spring as favorite).
- **Sketch:** Quieter than its siblings in aggregate, but its divergences run toward the
  connoisseur's alternative rather than a populist one — Whistler over Mona Lisa, Lisbon over
  Kyoto — and it's part of a three-way Opus family split on the season domain (below).

### Claude Opus 4.8 — the most evenly-spread contrarian
33/86 (38.4%) — 2nd-highest total rate — and the **most evenly distributed** signature of any
model: divergences land across all five domain groups almost equally (entropy 0.977, the
panel's highest; top group "people" is still only 30% of its total).
- **Uniquely favored:** Sichuan cuisine (5/8 = 0.62) against a field that is *extremely*
  unanimous — 95% of the other 12 models' cuisine samples say Japanese (breadth 0/12). Peter
  Zumthor over Tadao Ando (62% field) as favorite architect; climbing (10/12 = 0.83) over
  basketball (38% field) as favorite sport.
- **Uniquely panned:** Book of Proverbs (not Revelation, 41% field) as overrated religious
  text; Charles Dickens (not Hemingway, 33% field) as overrated novelist. Like Opus 4.5, calls
  autumn overrated (4/4) against the field's 86%-consensus target, summer.
- **Sketch:** Where Opus 4.1 has a strong art-house lean, Opus 4.8's contrarianism is diffuse —
  it breaks a little everywhere rather than clustering. Its sharpest single break is against
  the *most* unanimous field consensus found anywhere in this analysis (95% for Japanese
  cuisine), which it alone answers with Sichuan. Two of three later Anthropic models (4.5,
  4.8) now call autumn overrated; the oldest (4.1) calls spring its favorite — a visible
  within-family drift on one domain.

### Claude Fable 5 — answers "who" with "what"
26/86 (30.2%). Entropy 0.938 (broad), top group "people" at 39%.
- **Uniquely favored:** on multiple "favorite [person]" prompts it names a *work* instead of a
  person — "Principles of Psychology" (James's book, 4/4) where the field's modal favorite
  psychologist is Carl Jung (39%); "History of the Peloponnesian War" (Thucydides' book, 4/4)
  where the field wants Fernand Braudel (38%). Also unanimously (10/10) names Antoni Gaudí as
  favorite architect against the field's Tadao Ando (62%).
- **Uniquely panned:** Las Vegas (not San Francisco) as overrated US city; Garamond (not
  Helvetica, 75% field) as overrated typeface; "brunch-style American cuisine" (a genre, not a
  national cuisine) as overrated cuisine; *La La Land* (not *Avatar*) as overrated film.
- **Sketch:** As the creative-writing variant, Fable 5's most distinctive tic is a genuine
  *category* move — reframing "who's your favorite historian/psychologist" as "what's your
  favorite book about history/psychology," a pattern repeated across at least 2 domains here
  (and echoed independently by GPT-5.2 and Grok 4.5 elsewhere in the panel — see caveats). Its
  overrated list leans pop/consumerist (Vegas, La La Land, "brunch-style American cuisine")
  rather than classical-canon targets.

### GPT-4o — the balanced mainstream-lover
24/86 (27.9%) — and uniquely, its divergences split *exactly* evenly, 12 favorite / 12
overrated. Top group "people" (38%, cultural close behind at 33%) — entropy 0.875, on the more
concentrated side.
- **Uniquely favored:** Frost's "The Road Not Taken" (4/4) over the field's "The Love Song of
  J. Alfred Prufrock" (30%) as favorite poem; *Inception* over *2001: A Space Odyssey* (36%
  field) as favorite film; Meryl Streep over Cate Blanchett (48% field) as favorite actress.
- **Uniquely panned:** names Radiohead's *OK Computer* overrated at 90% internal consistency,
  where the field's consensus villain-album is *Sgt. Pepper's Lonely Hearts Club Band* (42%).
- **Sketch:** GPT-4o (OpenAI's oldest rung here) sits almost exactly at the panel median and
  shows no favorite/overrated asymmetry at all. Where it diverges, it leans toward more
  mainstream/accessible picks than its peers (Inception, Streep) rather than a deep-cut
  alternative — a "crowd-pleaser" contrarian, if that's not a contradiction.

### o3 — quiet, prestige-leaning
17/86 (19.8%) — 2nd-lowest overall, and the **lowest favorite-rate of any model** (18.6%,
8/43). Small sample size caveat (fewer confident cells to draw group-entropy conclusions
from).
- **Uniquely favored:** Mahershala Ali over Daniel Day-Lewis (35% field) as favorite actor;
  *Blade Runner* over *2001* (36% field) as favorite film; economist Elinor Ostrom (5/8) over
  the heavily male field consensus, Friedrich Hayek (40%) — one of the panel's few
  female-economist favorites (ties to Round 1's Q5 gender finding).
- **Uniquely panned:** the Eiffel Tower (not Sydney Opera House) as overrated building; "freshly
  brewed coffee" (not fresh-cut grass) as overrated smell.
- **Sketch:** o3 is one of the two quietest field-breakers in the whole panel — it mostly goes
  along with the crowd. Its rare breaks skew toward prestige/arthouse alternatives to
  blockbuster consensus (Blade Runner, Mahershala Ali) rather than anything eccentric.

### GPT-5.2 — loves loudly, pans quietly
27/86 (31.4%), but with the panel's **sharpest favorite/overrated split**: 41.9% favorite-rate
(tied 2nd-highest) vs 20.9% overrated-rate (tied 2nd-lowest) — almost exactly 2×.
- **Uniquely favored:** David Hilbert over Emmy Noether (34% field) as favorite mathematician;
  the Parthenon over the Taj Mahal (32% field) as favorite monument; "The Art of Computer
  Programming" (Knuth's book, 6/12) where the field wants a person, Alan Turing (34%) — the
  same work-not-person move seen in Claude Fable 5.
- **Uniquely panned:** shares a specific pick with its older sibling GPT-4o — both
  independently call *OK Computer* overrated (70-90% internal consistency) against a field
  that reserves that scorn for *Sgt. Pepper's*. Also: Burj Khalifa (not Sydney Opera House) as
  overrated building; Thomas Aquinas (not C.S. Lewis) as overrated theologian.
- **Sketch:** GPT-5.2 is a strong, confident *lover* of unusual things (rigorous/canonical picks
  like Hilbert and Knuth over the field's more popularizing choices) but rarely picks its own
  fights on the overrated side — when it pans something, it's usually the same thing everyone
  else pans, except for its shared OK Computer grudge with GPT-4o.

### GPT-5.6 Sol — historical figures, and one self-inflicted wound
23/86 (26.7%). The panel's **most domain-concentrated** signature: 48% of its divergences are
in "people" domains (entropy 0.779, lowest/most-concentrated of any model).
- **Uniquely favored:** Alan Turing (a historical figure) over Geoffrey Hinton (32% field, a
  contemporary) as favorite AI researcher; Herodotus over Fernand Braudel (38% field) as
  favorite historian; Chicago (4/4) over San Francisco as favorite US city.
- **Uniquely panned:** breaks the field's *most* unanimous architect consensus found anywhere
  in this analysis — 85% of the other 12 models call Frank Gehry overrated, GPT-5.6 Sol alone
  names Frank Lloyd Wright (4/4) instead. It also independently pans both *The Alchemist*
  (4/4, vs. the field's *Catcher in the Rye*, 78%) **and** its author, Paulo Coelho (4/4, vs.
  the field's Hemingway, 33%) — a rare doubly-confirmed grudge against one author. Most
  strikingly: it is the *only* model, of all 13, to call **its own sibling GPT-4o** overrated
  as favorite AI model (5/8 = 0.62), where the field's target is GPT-4 (36%) — a self-critical
  pick no other model makes about its own family.
- **Sketch:** GPT-5.6 Sol's contrarianism is unusually *about people* — historical figures over
  contemporaries as favorites, and a specific, repeated grudge against one author (Coelho/The
  Alchemist) plus a striking willingness to call out its own predecessor model by name.

### Gemini 3.1 Pro — declares war on petrichor
31/86 (36.0%, rank 3) — confirms Round 1's "most idiosyncratic model" finding by a second,
independent metric (Spearman 0.709 vs Q1's ranking, see above).
- **Uniquely favored:** "ozone" over "petrichor" (73% field) as favorite smell; AI
  interpretability researcher Chris Olah, unanimously (8/8), where the field defaults to
  Geoffrey Hinton (36%); "confit byaldi" (the *Ratatouille* dish) over Ramen (33% field) as
  favorite dish.
- **Uniquely panned:** breaks the field's 88%-consensus love for Frost's "The Road Not Taken,"
  naming Kipling's "If—" as overrated poem instead — and separately names the *word*
  "petrichor" itself as overrated (vs. the field's "serendipity," 50%). Between the smell pick
  and the word pick, Gemini 3.1 Pro is effectively arguing against petrichor from two
  directions at once.
- **Sketch:** Gemini 3.1 Pro's signature is the most *thematically pointed* in the panel — a
  specific, repeated relationship with one over-used piece of AI-poetry vocabulary
  (petrichor), plus a preference for niche/technical figures (Olah over Hinton) over
  household names.

### Gemini 3.5 Flash — shares real family DNA with 3.1 Pro
27/86 (31.4%). Top group "people" (30%, its lowest concentration of any model bar Opus 4.8 —
i.e. also quite spread, entropy 0.949).
- **Family echo:** independently names "Harold and the Purple Crayon" as favorite children's
  book (4/4) — the *same* pick as Gemini 3.1 Pro, against a field split toward "The Phantom
  Tollbooth" (38%). Both Geminis also break the field's near-unanimous love of "The Road Not
  Taken" as favorite poem (92% and 88% field agreement, respectively) — but land on different
  overrated alternatives (3.5 Flash: Whitman's "O Captain! My Captain!"; 3.1 Pro: Kipling's
  "If—").
- **Its own picks:** unanimously names Douglas Hofstadter (4/4) as favorite AI researcher;
  names Ada Lovelace (9/12) as overrated computer scientist where the field's target is Alan
  Turing (36%) — one of the few "overrated woman" flips in the dataset (Round 1's Q5 gender
  finding runs the other direction on average).
- **Sketch:** The clearest evidence of genuine family house-style at the *pick* level (not just
  the vocabulary level Round 1's Q6 found): two Geminis, same childrens'-book pick, same
  poem-domain break, different but neighboring overrated choices.

### DeepSeek V4 Pro — the most consensus-hugging model in the panel
15/86 (17.4%) — the **lowest total rate** of any model, and the lowest overrated-rate (11.6%,
5/43) — DeepSeek almost always pans the same things everyone else pans.
- **Uniquely favored:** Toshiro Mifune over Daniel Day-Lewis (34% field) as favorite actor;
  figure skating (4/4) over basketball (37% field) as favorite sport.
- **Uniquely panned:** *Shawshank Redemption* (not *Avatar*) as overrated film; Karl Barth (not
  C.S. Lewis) as overrated theologian.
- **One flagged pick is likely an artifact, not real taste:** its favorite-mathematician answer
  is literally "Noether's theorem" (4/4) against the field's "Emmy Noether" (33%, the person
  the theorem is named after) — almost certainly the same underlying reverence expressed at a
  different level of granularity (concept vs. person), not a genuine disagreement. Flagged
  here rather than silently dropped — see caveats.
- **Sketch:** DeepSeek is the field's steadiest member — a third of Opus 4.1's divergence rate,
  and its rare breaks (Mifune, figure skating, Shawshank) read as ordinary taste variation
  rather than a strong aesthetic identity.

### Kimi K2.6 — breaks against near-total consensus, repeatedly
30/86 (34.9%, rank 4) — tied for the panel's **highest overrated-rate** (34.9%, with the three
Claudes). Its signature is unusually people-concentrated (43% of divergences, entropy 0.809 —
2nd most concentrated after GPT-5.6 Sol).
- **One of the strongest consensus-breaks found anywhere in this analysis:** it alone names
  "The Office" as overrated TV show (4/4) against a field that is 90% behind "Friends" — the
  4th-highest field-concentration of any confident divergence in the whole dataset (behind
  Opus 4.1's unanimous autumn/spring break, Opus 4.8's near-unanimous cuisine break, and
  Gemini 3.5 Flash's poem break; see the ranked list in `r2a_full_results.json`).
- **Uniquely favored:** Spike Jonze's "Her" (4/4) over "2001: A Space Odyssey" (34% field) as
  favorite film; Louis Kahn over Tadao Ando (59% field) as favorite architect.
- **Uniquely panned:** names Paul Krugman as overrated economist — a pick it shares with Grok
  4.5, the two models least related by family, independently landing on the same target
  against the field's John Maynard Keynes (56%).
- **Sketch:** Kimi's signature centers on people, and in the "Office vs. Friends" case it
  produces one of the most extreme single breaks-from-consensus found in this whole study — a
  field that's 9 out of 10 in agreement, broken by one model.

### Grok 4.5 — mostly agrees on villains, sometimes not on heroes
19/86 (22.1%). Answers "favorite historian" with a titled work (Gibbon's "The Decline and Fall
of the Roman Empire," 4/4) rather than a name — the third instance of this pattern in the
panel (after Fable 5 and GPT-5.2), suggesting it's a cross-model behavior, not one model's
personality trait.
- **Uniquely favored:** Zaha Hadid over Tadao Ando (64% field) as favorite architect; Adam Smith
  over Friedrich Hayek (38% field) as favorite economist.
- **Uniquely panned:** names "the Bible" itself (not a specific book within it) as overrated
  religious text, a different level of granularity than every other model's within-canon
  answer (field's modal pick is the Book of Revelation, 40%) — flagged, but arguably not a
  like-for-like comparison; see caveats. Shares the Paul Krugman pick with Kimi K2.6.
- **Sketch:** Grok has the panel's 2nd-lowest overrated-divergence rate (14%) but a middling
  favorite-rate (30%) — it mostly pans what everyone pans, but loves some different things,
  and its one truly odd move (naming the whole Bible, not a book of it, as overrated) is more
  a scope mismatch than a strong opinion.

---

## Cross-model patterns worth flagging on their own

- **"Work, not person" is a recurring move, not one model's quirk.** Claude Fable 5
  (psychologist → *Principles of Psychology*, historian → *History of the Peloponnesian War*),
  GPT-5.2 (computer scientist → *The Art of Computer Programming*), and Grok 4.5 (historian →
  *The Decline and Fall of the Roman Empire*) all independently reframe a "favorite person"
  prompt as a "favorite work" prompt. Three unrelated models/families doing this makes it look
  like a shared behavioral tendency (something about how "favorite historian" gets parsed),
  not a personality trait of any one of them.
- **Shared specific grudges across unrelated families:** Kimi K2.6 and Grok 4.5 (Moonshot and
  xAI — no shared lineage) both independently name Paul Krugman as overrated economist. GPT-4o
  and GPT-5.2 (same family) share a pan of *OK Computer*. DeepSeek and GPT-5.6 Sol both single
  out Toshiro Mifune as favorite actor.
- **Family house-style shows at the pick level, not just vocabulary.** Round 1's Q6 found
  shared *descriptor* vocabulary across families; here the two Geminis share an actual pick
  (Harold and the Purple Crayon) and independently break the same poem-domain consensus.

---

## Caveats

- **Canonicalization is genuinely weak in this dataset.** `data/aliases.json` ships with empty
  per-domain maps for most domains — the article-stripping fix here (19 collision groups
  found and merged) almost certainly does not catch every near-duplicate (e.g. abbreviations,
  "Mona Lisa" vs. "La Gioconda", diacritics). Every number in this report should be read as a
  slight overestimate of true divergence, not an underestimate — most residual near-duplicate
  noise would manufacture false divergences, not hide real ones.
- **Small-n cells are real and were guarded against, not eliminated.** Adaptive sampling means
  some model/domain/probe cells have as few as 4 samples (the floor we enforced) up to 48+
  (a few cells appear over-sampled in collection). A model_n ≥ 4 floor was applied, but a 4/4
  "unanimous" pick is still just 4 samples — several signature picks above (e.g. "figure
  skating," "Noether's theorem," "the Bible") rest on n=4 and should be read as suggestive, not
  bulletproof. The Noether's-theorem and "the Bible" cases specifically look more like
  granularity mismatches than real taste divergence — flagged explicitly above rather than
  silently filtered, since deciding "this doesn't count" is itself a judgment call worth
  showing.
- **Domain scope differs from summary.json's current 50 domains.** This analysis uses the
  same 43-domain set Round 1 used (per `DATA_DICTIONARY.md`'s domain list) so that the "68%
  interaction term" being excavated here refers to the same universe of cells. Since Round 1
  shipped, `summary.json` has grown 7 more domains (`composer`, `country`, `director`,
  `musician`, `proglang`, `song`, `sound`) via the add-domain skill; these have real but
  thinner data (128-188 rows vs. ~240 for the original 43) and are not included here. A
  follow-up could re-run this exact script against all 50 to see whether new domains change
  any model's ranking.
- **Two different "idiosyncrasy" metrics, two different answers to "who's most idiosyncratic."**
  Q1's breadth-based Jaccard overlap and this analysis's confidence-weighted modal divergence
  agree at Spearman 0.709 but disagree on the #1 spot (Gemini 3.1 Pro vs. Claude Opus 4.1) —
  see the Contrarian ranking section for why; this is a real conceptual difference, not a bug
  in either analysis.
- **"Confident divergence" is a threshold choice** (model_conc ≥ 0.5, field_conc ≥ 0.3, n ≥ 4),
  not a law of nature. The full continuous divergence map (with `score` for every cell,
  including sub-threshold ones) is in `analysis/data/r2a_full_results.json` / reproducible via
  `r2a_signatures.py` for anyone who wants to re-cut it at a different bar.
- **Field LOO pools are unbalanced.** Because different models had different sample counts per
  cell, the field pool a given model is compared against ranges from ~24 to 150+ samples,
  which is why field-concentration numbers vary so much in scale across the picks quoted
  above (e.g. Kyoto at 86/94 vs. Basketball at 60/164) — always read the fraction, not just
  the count.

---

## What this means

The 68% model×domain interaction Round 1 found is not an undifferentiated statistical
residual — it decomposes into 13 distinct, describable temperaments. Some are broad and
diffuse (Opus 4.8 breaks a little everywhere; Opus 4.1 breaks a lot, broadly); some are
narrow and pointed (Gemini 3.1 Pro's specific quarrel with "petrichor"; GPT-5.6 Sol's
specific grudge against Paulo Coelho and, remarkably, its own predecessor GPT-4o). The
contrarian/consensus split among models is statistically real (p=0.00035) — Claude Opus 4.1
and DeepSeek V4 Pro sit at genuinely different points on a real spectrum, not opposite tails
of noise. And the two most different-seeming "who's the odd one out" answers from Round 1
and this analysis (Gemini 3.1 Pro vs. Claude Opus 4.1) turn out to both be true, just of
different senses of "different" — one model that spreads across many answers no one else
gives, and one that gives a single answer, confidently, that a confident field rejects.
