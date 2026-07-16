# R2-B — Each model's descriptor fingerprint: distinctive vocabulary vs. peers

**Question.** Round 1 Q6 found models *share reasons more than picks* (descriptor Jaccard
2.9× entity Jaccard) — a near-universal praise/critique lexicon (*elegant, luminous,
honest* / *iconic, polished, shallow*). This round hunts the **residual**: once you
control for words every model reaches for, which adjectives does each of the 13 models
reach for *disproportionately more than its peers*? Raw frequency can't answer this —
"elegant" tops nearly everyone's raw list and says nothing distinctive. This needs a
statistic that rewards genuine skew and punishes both (a) high-frequency-but-shared words
and (b) low-frequency one-off noise.

**Data.** `data/extracted.jsonl`, non-refused rows, `bookcover`/`chair` excluded (per
convention) → **10,312 records** (5,226 favorite / 5,086 overrated) across 13 models × 43
domains. Descriptor tokens per model per probe range 1,218–2,041 (avg ~1,650); 400–850
unique words per model per probe. `descriptors` field only.

---

## 1. Method: log-odds-ratio with an informative Dirichlet prior ("Fightin' Words")

This is the standard technique from **Monroe, Colaresi & Quinn (2008), "Fightin' Words:
Lexical Feature Selection and Evaluation for Identifying the Content of Political
Conflict"** — built exactly for this problem (distinctive vocabulary between groups,
controlling for both word frequency and small-count noise).

For each model *i* and probe, compared against the pooled corpus of the other 12 models:

- `y_i^w` = count of descriptor *w* used by model *i* (pooled over all domains)
- `y_j^w` = count of *w* pooled across the **other 12 models**
- `n_i`, `n_j` = total descriptor-token counts for model *i* / the rest
- **Informative prior** `α_w` = count of *w* in the **full pooled corpus (all 13 models,
  that probe)** — i.e., the prior is the corpus's own frequency profile. This is the key
  move that controls "elegant is universal": a word everyone uses gets a large prior mass
  in the denominator on both sides, so it takes a *real* skew, not just high frequency, to
  post a large statistic. `α_0 = Σ_w α_w`.
- **Log-odds-ratio:**
  `δ_w = log((y_i^w + α_w)/(n_i + α_0 − y_i^w − α_w)) − log((y_j^w + α_w)/(n_j + α_0 − y_j^w − α_w))`
- **Variance:** `σ²(δ_w) = 1/(y_i^w + α_w) + 1/(y_j^w + α_w)`
- **Ranking statistic:** `z_w = δ_w / √σ²(δ_w)` — the "z-scored log-odds-ratio with
  informative Dirichlet prior." This is what controls rare-word noise: a word used once by
  one model has a small `y_i^w + α_w`, which inflates the variance term and shrinks `z`
  even if `δ` looks large. Words need both a meaningful frequency *and* a meaningful skew to
  rank highly.

Applied twice per model (favorite, overrated), keeping only words with `z > 0` (used *more*
than peers), top 10 by `z`. Applied identically at the **family** level (pool models within
a family as target, all other families as background) for the three multi-model families
(Anthropic, OpenAI, Google).

Code: `analysis/lib/r2b_fingerprint.py` (`log_odds_fightin_words`, `model_fingerprints`,
`family_fingerprints`). Derived table: `analysis/data/r2b_fingerprint.csv` (scope=model/family
× probe × rank × descriptor × z × log-odds delta × in-group/out-group counts).

---

## 2. Per-model vocabulary sketches (all 13)

Numbers in parens are `z` (ranking statistic) for the #1 word, favorite probe unless noted.

**Claude Opus 4.1** — *transformation* (z=3.0), flowing, profound, invisible, dreamlike,
transcendent. Reaches for **transcendence/becoming** words — process and metamorphosis
more than any peer; overrated register is comparatively flat (oversimplified, ordinary),
suggesting this model's distinctiveness is concentrated in praise, not critique.

**Claude Opus 4.5** — *honest* (z=6.3, n=99!), accountability, improvisation, unresolved,
morally serious, compassionate. The strongest single-word signal in the whole dataset.
Reaches for **moral-character vocabulary** — describes art the way you'd describe a
person's integrity. Its overrated register moralizes too: troubling, self-erasure,
codependency, exploitation — it doesn't just find things ugly, it finds them ethically
compromised.

**Claude Opus 4.8** — *dispersed/distributed* (z=4.3/3.9), humility, restraint, honest
(carries forward from 4.5), slowness. Reaches for a **structural-humility** register —
decentralization and restraint as aesthetic virtues. Overrated critique matches structurally:
short-termism, structureless, scaffolded, dysfunctional — it critiques *systems*, not surfaces.

**Claude Fable 5** (creative-writing variant) — miraculous, grown, ambiguous, sheltered,
porous, patient, hesitation, feverish. A **hushed, interior, literary** register —
tentative and embodied words no other model reaches for at this rate. Overrated: mythologized,
plotless, tourist-trap, contextless — debunks *hype and myth* rather than form.

**GPT-4o** — innovative (z=5.6), timeless, dynamic, vibrant, profound, harmonious,
accessible, engaging, immersive. Reads like **marketing copy for broad appeal** — the most
"universally positive adjective" register of any model, favoring approachability over
specificity. Overrated critique is oddly **policy-flavored** ("government intervention"
appears as an extracted descriptor) alongside generic complaints (simplistic, cumbersome).

**o3** — lyrical (z=2.3), lilting, intimate, urgent, musical, poetic, silky, erudite. A
**sound/music-forward** register — audible qualities (lilting, musical, silky) more than
any peer. Overrated: catchy, formulaic, disposable, mythic — critiques via the same
musical/mythic vocabulary turned negative.

**GPT-5.2** — clean (z=4.6), calm, textured, restrained, architectural, crisp, "spare
elegance," spacious. A **restrained-material** register — closer to design-critic language
(texture, space, architecture) than emotional language. Overrated: curated, familiar,
uneven, crowded — critiques excess/over-curation, the mirror of its own "restrained" ideal.

**GPT-5.6 Sol** — fractured (z=2.6), "clean syntax," wintry, austere, unsettling, "irregular
rhythm," "spare language." Notably reaches for **code/linguistic-structure metaphors**
("clean syntax") applied to aesthetic judgments — a distinctly technical-literary hybrid.
Overrated: "shallow reasoning," overconfident, polished, immaculate — self-aware critique
of surface polish masking thin substance.

**Gemini 3.1 Pro** — geometric (z=4.0), algorithmic, fractal, mathematical, brutalist,
elegant, pristine. The most **structural/mathematical** register in the dataset — form and
pattern language over emotional language. Overrated: rigid, sterile, dogmatic, stagnant,
disconnected — critiques via the *failure mode* of its own favorite register (order curdling
into rigidity).

**Gemini 3.5 Flash** — sublime (z=6.0), minimalist, mathematical, infinite, poetic,
melancholic. Shares Gemini 3.1 Pro's mathematical/geometric vein but adds a **sublime/
infinite** register (scale and awe) 3.1 Pro doesn't reach for as strongly — the Google
family's clearest internal split (see §3). Overrated: dry, sterile, hyped, mundane, "over-
tourism" — echoes 3.1 Pro's sterility critique plus a travel/place-domain-specific tell.

**DeepSeek V4 Pro** — seductive (z=2.5), meditative, sacred, ecstatic, pointillist,
jeweled, hypnotic. A **sensory-mystical/devotional** register unmatched by any other
model — the only model that reaches for "sacred" and "ecstatic" at rate. Overrated:
saccharine, sanitized, homogenous, unmoved — critiques via *loss of the sacred feeling*
(sanitized, saccharine) rather than form.

**Kimi K2.6** — recursive (z=2.7), generous, metatheatrical, compression, computational,
collaborative, sensual. An unusual **computational-plus-affective** blend — structural/CS
vocabulary (recursive, compression, computational) alongside warmth words (generous,
collaborative, sensual) that don't normally co-occur. Overrated: performative, self-
congratulatory, "sensory-assault," shouty, wallpaper — critiques via *excess and
performance*.

**Grok 4.5** — sculptural (z=4.5), painterly, luminous, kinetic, deadpan, irreverent,
architectural, crystalline. A **visual-arts/material** register (sculpture, paint, light)
with a distinct **irreverent/deadpan personality edge** no other model shows. Overrated:
mushy, hedged, cardboard, "carb-heavy," obligatory — keeps the informal, slightly comic
tone into critique (this is the only model whose overrated list reads like banter).

---

## 3. Family vocabulary signatures

Family-level log-odds (pooling each family's model(s) vs. the rest) confirms the
per-model sketches aggregate into real family registers, not just individual quirks:

| Family | Favorite register (top terms, z) | Overrated register (top terms, z) |
|---|---|---|
| **Anthropic** (4 models) | honest (z=9.1, n=187), restraint, ambiguous, patient, philosophical, humility | troubling, mythologized, slow-paced, melancholy, attrition, self-erasure, exclusive |
| **Google** (2 models) | geometric (z=6.1), mathematical (z=6.0), sublime, minimalist, symmetrical, algorithmic | sterile (z=4.7), rigid, dry, chaotic, sluggish, dogmatic, clinical, entitled |
| **OpenAI** (4 models) | calm (z=4.9), innovative, vivid, balanced, timeless, intimate, lyrical | uneven, repetitive (z=3.5, n=189!), crowded, familiar, overwhelming, polished, iconic |
| **DeepSeek** (1 model) | seductive, meditative, sacred, ecstatic, pointillist, hypnotic | saccharine, lonely, sanitized, cramped, homogenous |
| **Moonshot** (1 model) | recursive, generous, metatheatrical, compression, collaborative | performative, implicit, self-congratulatory, suffocating, shouty |
| **xAI** (1 model) | sculptural, painterly, luminous, kinetic, deadpan, irreverent | mushy, hedged, polished, hype, cardboard |

**Reading the table:**
- **Anthropic's signature is moral/ethical, not aesthetic-formal** — the only family whose
  #1 word (honest, z=9.1) is a character trait, not a visual/sensory quality — and it
  carries straight through to critique (troubling, exploitation, self-erasure). This is the
  single strongest family effect in the dataset by a wide margin (z=9.1 vs. next-highest
  family top word at z=6.1).
- **Google's signature is structural/mathematical**, and its critique register is the
  *literal antonym set* of its praise register (geometric→rigid, symmetrical→sterile,
  minimalist→dry) — a family that judges failure as its own virtue curdled, not as a
  different vocabulary entirely.
- **OpenAI's signature is broad-appeal/approachable** in praise (calm, balanced, timeless —
  words that could describe almost anything positively) and **volume/sameness-fatigue** in
  critique (repetitive at n=189 is the single highest raw in-group count in the whole
  table; "iconic" reappears here as OpenAI's critique tell, consistent with Round 1 Q6's
  finding that "iconic" skews critique 91:12 dataset-wide).
- Single-model "families" (DeepSeek, Moonshot, xAI) are, by construction, identical to
  their model-level fingerprints in §2 — included in the table for completeness, not as
  independent corroboration.

---

## 4. Caveat — this is vocabulary *after* Haiku's paraphrase

**`descriptors` are Haiku's extraction of the model's stated reasoning, not the model's
verbatim words** (per `DATA_DICTIONARY.md` and Round 1's own flagged confound). Two
implications for this analysis specifically:

- **What survives:** because every model's text passes through the *same* extractor, a
  differential/distinctive-vocabulary method like log-odds is comparatively robust to a
  uniform extractor bias — Haiku's own stylistic tics would show up as *shared* frequency
  across all 13 models and get pushed toward the shared-prior baseline, not toward any one
  model's fingerprint. That's part of why "elegant" and "honest" don't dominate every
  model's list here despite being globally frequent.
- **What doesn't survive:** synonym selection is still Haiku's judgment call. If two models
  make the same underlying claim (e.g., "this building doesn't pretend to be more than it
  is") but Haiku renders one as *honest* and the other as *unpretentious* or *sincere*, this
  method will count that as a real vocabulary difference when it may be extractor noise.
  The fingerprints above should be read as **"distinctive after Haiku's paraphrase,"**
  not as claims about the models' literal word choices. Round 1's future-data ask
  (verbatim descriptor capture) is the fix; until then, treat single-word idiosyncrasies
  (e.g., GPT-5.6 Sol's "clean syntax") as more trustworthy than they'd be from raw text,
  but not as ground truth for exact phrasing.

---

## 5. What this means

Round 1 Q6 showed AI aesthetic *language* converges harder than AI aesthetic *taste*
(shared praise/critique lexicon, disjoint from each other). This analysis shows that
underneath that shared lexicon, **each model still has a real, statistically distinguishable
accent** — and it's not noise: the same handful of words recur as a model's top pick across
independent runs of the method, and family-level aggregation reproduces the pattern with
even larger effect sizes (family log-odds z's exceed most individual model z's, because
pooling 2–4 models' worth of tokens shrinks the variance term).

The most interesting finding is that **each model's critique vocabulary is usually a
mirror of its own praise vocabulary's failure mode**, not a separate lexicon: Anthropic's
honest→exploitation, Google's geometric→rigid, GPT-5.2's restrained→curated/crowded,
DeepSeek's sacred→sanitized. Models don't have one aesthetic vocabulary and one separate
complaint vocabulary — they have one *evaluative axis* (order, honesty, sensuality,
polish) and score both ends of it. That's a stronger and more falsifiable claim than "each
model has some favorite adjectives," and it's the headline this round adds to Q6.
