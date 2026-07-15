# Q6 — Is there a universal AI aesthetic vocabulary?

**Question**: Do the 13 models share the *reasons* (descriptors) they give for their
favorites more than they share the *picks* (entities) themselves? And is the language of
praise disjoint from the language of critique?

Source: `data/extracted.jsonl` (descriptors field), canonicalized entities via
`data/aliases.json`. Excludes `bookcover` (n=108) and `chair` (n=81) — deprecated/extra
domains not in the official 43. 9,073 non-refused records remain (4,631 favorite, 4,442
overrated). Computed with `python3` + stdlib only
(no scipy/pandas), permutation tests via a custom label-shuffle (20,000 draws, seed=0).
Code: `analysis/lib/q6_vocabulary.py`. Derived tables: `analysis/data/q6_*.{csv,json}`.

---

## Method

1. **Vocabulary vs. entity convergence**: for the `favorite` probe, build per-model
   Counters of (a) descriptor words and (b) canonicalized entities, pooled across all 43
   domains. Take top-K sets (K = 10/20/30/50/100/full) for each model and compute (i) mean
   pairwise Jaccard across all 13×12 ordered model pairs (matching the convention used by
   `data/summary.json`'s `overlap` matrix and conv-H1), and (ii) how many words/entities
   appear in *all 13* models' top-K, or in ≥10/13.
2. **Praise vs. critique lexicon**: pool descriptors across all models, separately for
   `favorite` and `overrated`. Compare top-50 word lists; report overlap size, and the
   most probe-exclusive high-count words (favorite-share = fav_count/(fav_count+ovr_count)).
3. **Family house style**: within- vs. between-family mean Jaccard of top-K favorite
   descriptor sets (and, as a control, entity sets), permutation-tested by shuffling the
   13 models' family labels 20,000 times (mirrors conv-H1/H7's method). Repeated across
   K to check robustness, since this turned out to matter (see Results).
4. Honest re-derivation throughout: every number below was recomputed from
   `extracted.jsonl` directly rather than trusted from prior round-1 docs, and two
   discrepancies with the round-1 hypothesis docs surfaced (reported below, not hidden).

---

## Results

### 1. Cross-model vocabulary convergence vs. entity-pick convergence

**"Elegant" re-check (content-H5's headline claim)**: re-deriving from raw
`extracted.jsonl` (favorite probe, descriptors only, domains excluded as above), "elegant"
is the single most-used descriptor for **12 of 13 models**, not 13/13 as content-H5
reported — **Claude Opus 4.5 is the exception**: `honest` (81 mentions / 376 favorite
samples, 21.5%) edges out `elegant` (51 mentions, 13.6%) for that one model. This holds
whether `bookcover`/`chair` are included or not. "Elegant" is still rank ≤2 for all 13
models and appears in every model's top-10 descriptors. This is a real, if smaller,
correction to a previously-reported "13/13" number — worth flagging since it shows even a
GREEN-tractability, direct-counting hypothesis can contain an off-by-one if not re-derived.
`analysis/data/q6_convergence_numbers.json` → `elegant_check`.

**Top-K Jaccard, descriptors vs. entities (favorite probe, all 13×12 ordered pairs)**:

| K | descriptor mean Jaccard | entity mean Jaccard | ratio (desc/ent) | # words in 13/13 | # entities in 13/13 |
|---|---|---|---|---|---|
| 10 | 0.198 | 0.050 | **3.9×** | 1 | 0 |
| 20 | 0.219 | 0.076 | **2.9×** | 1 | 0 |
| 30 | 0.230 | 0.110 | 2.1× | 1 | 2 |
| 50 | 0.239 | 0.173 | 1.4× | 1 | 1 |
| 100 | 0.250 | 0.189 | 1.3× | 4 | 3 |
| full set | 0.217 | 0.183 | 1.2× | 22 | 3 |

At K=20 (a natural "what's salient" cutoff): descriptor "elegant" is shared by 13/13
models, "precise" by 12/13, "luminous" by 11/13, "geometric" by 10/13 — four words clear
the 10-of-13 bar. The single most cross-model-shared **entity** at K=20 tops out at
"petrichor" (smell, 9/13), "Tilda Swinton" (actress, 8/13), "Kyoto" (city, 7/13) — no
entity reaches even 10/13 until K=50 ("Japanese cuisine," the only entity to ever hit
13/13, at K=50). **The vocabulary-convergence effect is real and largest at the head of
the distribution (2.9–3.9× at K=10–20) and shrinks toward parity as K grows** (1.2× at the
full, untruncated vocabulary) — because the descriptor vocabulary is bounded (a few
hundred adjectives cover nearly all usage; 226 distinct words appear in any model's
top-50) while the entity space is comparatively open-ended (266 distinct entities in top-50
across 43 unrelated domains), so full-set Jaccard for entities catches up as more items are
included. **Sanity check**: full-set entity Jaccard here (0.183) matches
`data/summary.json`'s precomputed `overlap` mean (0.181) almost exactly, validating the
method against the existing precomputed pipeline.

**Verdict on part 1**: Yes — models share descriptor vocabulary substantially more than
they share entity picks, and the gap is sharpest and most striking exactly where "shared
vocabulary" intuitively lives (the handful of words each model reaches for most often), not
in the long tail. `analysis/data/q6_top_descriptors_by_model.csv` has full top-20
descriptor lists per model for audit.

### 2. Praise vs. critique lexicon

Pooled across all 13 models, all 43 domains (favorite probe): 19,797 descriptor tokens
across 2,635 distinct words. Overrated probe: 17,135 tokens across 3,308 distinct words
(overrated vocabulary is more fragmented — more distinct words, each used less often, than
the tighter favorite vocabulary — itself a mild secondary "praise is more standardized than
critique" signal).

**Top-50 overlap**: only **2 of the top-50 words are shared between the two probes**:
`elegant` (1,070 favorite mentions vs. 89 overrated — still overwhelmingly a praise word,
92.3% favorite-share) and `sculptural` (130 vs. 104 — genuinely bidirectional, 55.6%
favorite-share, the single most balanced top-50 word in the dataset). This confirms
content-H5's near-disjointness claim almost exactly (H5 reported the same two words).

**Signature praise words** (top favorite-exclusive, min. 5 combined mentions, ranked by
favorite-share then volume): `luminous` (383/0), `crystalline` (177/0), `harmonious`
(148/0), `layered` (144/0), `balanced` (103/0), `fluid` (87/0), `recursive` (73/0),
`timeless` (182/1), `contemplative` (147/1), `musical` (132/1), `honest` (205/3),
`architectural` (180/3), `organic` (170/3), `intimate` (186/4) — a "restrained, precise,
contemplative" register, confirming H5's characterization.

**Signature critique words** (top overrated-exclusive): `shallow` (162/0), `hollow`
(135/0), `tedious` (128/0), `rigid` (126/0), `exhausting` (123/0), `spectacle` (117/0),
`superficial` (112/0), `reductive` (111/0), `thin` (99/0), `predictable` (97/0),
`mythologized` (97/0), `formulaic` (90/0), `crowded` (90/0), `commercialized` (89/0),
`bland` (85/0) — a "hollow spectacle" register, also confirming H5.

**Notable tells**: `iconic` (91 overrated vs. 12 favorite, 88% overrated-coded) and
`polished` (112 vs. 5, 96% overrated-coded) are near-exclusively critique words in this
dataset — being called "iconic" or "polished" is a marker of a model damning something with
faint/backhanded praise, not celebrating it. Full ranked table (150 words, both directions,
with top-50 membership flags): `analysis/data/q6_praise_critique_lexicon.csv`.

**Verdict on part 2**: Yes, close to fully disjoint — 48/50 non-overlapping at the top,
and the 2 shared words split into "still basically a praise word" (elegant) and "the one
genuinely two-sided word" (sculptural).

### 3. Family house-style in vocabulary — and a fragility this analysis surfaced

Re-running conv-H7's within/between-family descriptor Jaccard test turned up a
**methodology issue in the source hypothesis worth flagging explicitly**: `conv-H7`'s
0.252-vs-0.184 numbers come from `data/summary.json`'s `modelStats[model].topDescriptors`
field — and that field **pools descriptors from BOTH the favorite AND overrated probes**,
not favorite alone (confirmed by reproducing summary.json's exact top-15 sets: pooling both
probes matches for 8/13 models exactly and the rest to within a few tied-count entries;
favorite-only does not match at all — every one of the 13 models' top-15 lists differs when
restricted to favorite only, typically swapping in critique words like `repetitive`,
`hollow`, `shallow`, `rigid`). This matters because Q6 is specifically asked about the
*favorite*-probe vocabulary, so a clean re-test restricted to favorite-only descriptors was
run:

| basis (favorite-only) | K | within-family mean | between-family mean | gap | p (20k perm) |
|---|---|---|---|---|---|
| descriptor | 10 | 0.266 | 0.184 | 0.081 | 0.014 |
| descriptor | 15 | 0.248 | 0.227 | 0.021 | **0.545** |
| descriptor | 20 | 0.245 | 0.213 | 0.032 | 0.300 |
| descriptor | 30 | 0.276 | 0.221 | 0.055 | 0.051 |
| descriptor | 50 | 0.279 | 0.231 | 0.048 | 0.058 |
| descriptor | 100 | 0.286 | 0.243 | 0.043 | 0.045 |
| descriptor | **full set** | **0.247** | **0.211** | **0.037** | **0.002** |
| entity | 10 | 0.058 | 0.048 | 0.010 | 0.516 |
| entity | 15 | 0.068 | 0.065 | 0.003 | 0.817 |
| entity | 20 | 0.087 | 0.074 | 0.012 | 0.348 |
| entity | 30 | 0.138 | 0.105 | 0.033 | 0.022 |
| entity | 50 | 0.235 | 0.160 | 0.075 | **0.001** |
| entity | 100 | 0.238 | 0.180 | 0.058 | 0.001 |
| entity | **full set** | **0.225** | **0.174** | **0.051** | **0.001** |

(For comparison, exactly reproducing conv-H7's original mixed-probe, top-15 test:
within=0.252, between=0.184, gap=0.068, p=0.010 — confirmed, but this is a
both-probes-pooled number, not a favorite-only "house style" number as previously framed.)

Two things fall out of this:
- **The family-clustering-in-vocabulary effect is real but fragile at small/medium K**:
  significant at K=10 and K≥30, but *not* significant at K=15 or K=20 (the exact range
  conv-H7 and H1 used elsewhere) — the effect is present but noisy at truncated cutoffs and
  only reliably clears significance on the full, untruncated descriptor set (p=0.002) or
  large K (≥100).
- **On a matched, favorite-only, full-set basis, family clustering by ENTITY (gap 0.051,
  p=0.0007 — matching conv-H1's original 0.224/0.173 almost exactly) is at least as strong
  as, if not stronger than, family clustering by DESCRIPTOR (gap 0.037, p=0.002)**. This is
  a real correction to conv-H7's framing ("vocabulary converges more than entity choice,
  including within families") — once the probe-pooling artifact is removed, family house
  style shows up comparably in *what* a lab's models pick as in *how* they describe it, not
  more strongly in the latter.

**Verdict on part 3**: Family house-style in favorite-descriptor vocabulary is real
(full-set p=0.002) but smaller and more K-sensitive than previously reported, and does not
clearly exceed family house-style in entity picks once measured on a matched basis.

### 4. Honest control / caveats

- **Generic-positive-adjective confound (LLM writing tic, not aesthetics-specific)**:
  "elegant," "precise," "harmonious," "honest," "timeless" are exactly the register a large
  instruction-tuned model reaches for when praising *anything* — a recipe, a piece of code,
  a business plan. Nothing in this dataset can distinguish "these 13 models share a
  convergent aesthetic sensibility" from "these 13 models share a convergent RLHF-trained
  praise register that would show up regardless of the prompt topic." **This is a RED item
  without new data**: testing it requires a non-aesthetic control task (e.g., "what's your
  favorite approach to X" for a neutral/non-aesthetic X) run through the same 13 models to
  see if the same top words reappear. That data does not exist in this dataset — flagged
  as a future-data ask, not fudged around.
- **Extractor-vocabulary confound**: every `descriptors` value in `extracted.jsonl` was
  produced by a single extractor model (Haiku) summarizing each response's stated reasoning
  — it is not the raw text of the 13 models' own words. Some of the observed convergence
  (especially the sharp head-of-distribution concentration in part 1, e.g. "elegant"
  hitting 13/13 at K≥10) could be **the extractor's own paraphrase vocabulary being applied
  consistently across all 13 models' source text**, rather than the 13 models actually
  converging on that specific word choice in their raw prose. This analysis cannot
  distinguish "13 models say 'refined/graceful/elegant' and Haiku normalizes all three to
  `elegant`" from "13 models all literally write the word elegant." A follow-up should spot
  -check `data/raw.jsonl` text against a sample of `elegant`-tagged records to see how much
  paraphrase-normalization is happening.
- Descriptor and entity top-K comparisons are not perfectly apples-to-apples: the
  descriptor vocabulary is inherently smaller/more bounded (adjectives) than the entity
  space (named things across 43 unrelated domains), which mechanically inflates
  descriptor-Jaccard relative to entity-Jaccard at low K. The ratio shrinking from 3.9× (K=10)
  to 1.2× (full set) as more of the entity long tail is admitted is itself the honest way to
  show this — the "vocabulary converges more" claim is strongest as a claim about the *head*
  of each distribution, not a claim that is scale-invariant.
- The mixed-probe-vs-favorite-only discrepancy found in part 3 (see above) is reported as a
  substantive correction, not just a caveat — it changes the confidence level of "family
  vocabulary house style" from a clean GREEN in conv-H7 to a K-sensitive, still-real-but-
  smaller effect.

---

## Verdict

**Do reasons converge more than picks?** Yes, clearly, at the head of the distribution:
top-20 favorite-descriptor Jaccard (0.219) is 2.9× top-20 favorite-entity Jaccard (0.076),
and a single word ("elegant") is shared by all 13 models' top-20 vocabularies while no
single entity is shared by more than 9/13 models' top-20 picks at that cutoff. The effect
narrows toward ~1.2× once the full (untruncated) vocabulary/entity sets are compared, so
the honest claim is "the salient, most-used vocabulary is far more universal than the
salient, most-picked entities," not "descriptor overlap is always much bigger than entity
overlap at every scale."

**Is praise/critique language disjoint?** Yes, nearly completely: only 2 of the top 50
words in each list overlap, and one of those two ("elegant") is still 92% praise-coded in
practice. Favorite has its own restrained/precise/contemplative register; overrated has its
own hollow/rigid/tedious/spectacle register, with almost zero lexical crossover at the top.

**Family house style?** Real but smaller than previously reported once corrected for a
probe-pooling artifact in the source data (`summary.json`'s `topDescriptors` mixes favorite
+ overrated); on a clean favorite-only basis it's a modest, K-sensitive effect (full-set
gap 0.037, p=0.002) that is comparable to, not clearly larger than, family clustering in
entity picks (full-set gap 0.051, p=0.0007).

## What this means

The strongest, most robust finding in this dataset is the near-total disjointness of praise
and critique vocabulary (part 2) — that's GREEN, large, and simple counting. The
"vocabulary is more universal than picks" claim (part 1) is real and worth keeping as a
headline, but should be stated as a head-of-distribution effect, not an absolute. The
"shared vocabulary is a lab house style" claim (part 3, from conv-H7) needed a real
correction: it was partly an artifact of pooling both probes together, and on a fair,
favorite-only comparison, labs cluster about as much in what their models pick as in how
they describe it. Most importantly, none of this should be oversold as "AI aesthetic
sensibility converges" without the two caveats in section 4: the praise register looks a lot
like generic LLM enthusiasm rather than something aesthetics-specific (untestable without a
non-aesthetic control task — a genuine future-data ask), and some of the observed
word-for-word convergence may be introduced by the single extraction model rather than
present in the 13 models' own raw language.
