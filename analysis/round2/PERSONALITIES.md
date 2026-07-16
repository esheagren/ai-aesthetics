# Round 2 — The aesthetic personalities of 13 AI models

**What this is.** Round 1 proved that the largest slice of variance in the dataset (~68%) is
the *model×domain interaction* — specific models being characteristically distinctive about
specific domains. Round 2 opens that box. Three studies, all reproducible from
`analysis/lib/r2*.py`:

- **R2-A** — *signature divergences*: where each model's confident pick clashes with a
  confident field consensus (leave-one-out modal pick of the other 12).
- **R2-B** — *descriptor fingerprint*: each model's distinctive vocabulary via Monroe et al.
  "Fightin' Words" log-odds-with-prior (suppresses both universal words and rare-word noise).
- **R2-C** — *taste-space*: hand-implemented average-linkage clustering of the 13 models on
  pairwise agreement.

Legacy domains `bookcover`/`chair` excluded throughout. R2-A also fixed a live data issue:
`data/aliases.json` ships empty for most domains, so article-prefix variants ("The Mona
Lisa"/"Mona Lisa") were manufacturing false divergences — now stripped.

---

## Three findings that reframe the whole dataset

**1. The primary axis of AI taste-space is a personality trait, not a lab or a capability.**
Clustering the 13 models recovers labs only 84.6% (11/13) — because a **cross-lab cluster of
five** (o3, GPT-5.2, GPT-5.6 Sol, DeepSeek, Grok) pools together regardless of who built
them. Those five are *exactly* Round 1's five highest mean-overlap models. So models don't
sort by *what* they like or *who made them* — they sort by **how consensus-hugging vs
contrarian** they are. Contrarianism is confirmed real by permutation test (p=0.00035):
Claude Opus 4.1 breaks from the field **43%** of the time (it even rejects a *literally
unanimous* field — picking spring when all 48 other-model samples say autumn); DeepSeek V4
Pro is the most agreeable at **17%**.

**2. Each model scores ONE evaluative axis, at both ends.** Round 1 found praise- and
critique-vocabularies globally disjoint ("iconic" = insult, "luminous" = praise). Per model,
R2-B found the deeper structure: **a model's "overrated" words are the failure-mode mirror of
its own "favorite" words.** Anthropic praises *honest* and pans *troubling/exploitation*;
Google praises *geometric* and pans *rigid* (literal antonyms); OpenAI praises *timeless* and
pans *repetitive*. Taste here isn't a list of likes — it's a single axis of value each model
measures everything against.

**3. Within-family taste drifts across generations.** The Anthropic ladder shows it cleanly:
**Opus 4.1's favorite season is spring; Opus 4.5 and 4.8 call autumn overrated** and diverge
toward austerity (4.8's distinctive loves are Sichuan cuisine, Peter Zumthor, "dispersed").
Capability doesn't make taste converge *or* diverge monotonically — it makes it *migrate*.

## The taste-space dendrogram (height = 1 − agreement)
```
[0.822] all 13
├─ [0.669] Gemini 3.1 Pro · Gemini 3.5 Flash        ← tightest bond in the dataset
└─ [0.808] the other 11
   ├─ Kimi K2.6 (alone) · GPT-4o (alone) · {DeepSeek · o3 · Grok} + {GPT-5.2 · GPT-5.6 Sol}
   └─ [0.797] Anthropic: {Opus 4.8 · Fable 5} + {Opus 4.1 · Opus 4.5}
```
Cross-lab surprises: **o3 × Grok = 0.286 is the #2 most-agreeing pair of all 78** (beats most
same-lab pairs); **GPT-4o × GPT-5.6 Sol (same lab, same ladder) ranks 71st of 78** — nearly
the worst pair in the dataset. The singletons (DeepSeek/Grok/Kimi) all lean toward each
other; **none has any affinity for Anthropic's house style.**

---

## The 13 personality cards (ordered by contrarianism)

**Claude Opus 4.1 — the art-house contrarian (43%).** The most idiosyncratic model in the
set. Loves *spring* (vs a unanimous autumn), *Prague* (vs Kyoto), *La Grande Jatte* (vs
Starry Night); pans *The English Patient*, *American Gothic*, *Hegel* (vs Nietzsche). Speaks
in *transformation / flowing / profound*; dismisses the *cheerful* and *oversimplified*. An
underdog streak spread across every domain group.

**Claude Opus 4.8 — the austere structuralist (38%).** Distinctive loves are severe and
systems-minded: *Sichuan cuisine* (vs Japanese), *Peter Zumthor* (vs Tadao Ando), *Richard
Sutton* (vs Hinton). Vocabulary of *dispersed / distributed / humility*; pans *short-termism*
and *aggregate*. The generational endpoint of Anthropic's drift toward restraint.

**Gemini 3.1 Pro — the geometer at war with petrichor (36%).** Two-front campaign against the
consensus smell: loves *ozone*, pans nothing sentimental. Loves *Chris Olah*, *confit
byaldi*. Pure structural register — *geometric / algorithmic / fractal* — and pans the
*rigid* and *entitled*. Round 1's most idiosyncratic model on breadth, too.

**Kimi K2.6 — the computational sensualist (35%).** An unusual blend: loves *Her*, *Louis
Kahn*, *New Orleans*; vocabulary fuses *recursive / metatheatrical* with *generous / sensual*.
Pans the *performative*. Sits alone in taste-space — nobody else tastes like it.

**Claude Opus 4.5 — the moral aesthete (33%).** The single strongest vocabulary signal in the
dataset is its praise-word ***honest*** (z=6.3) — a character virtue, not a formal quality;
also *accountability / improvisation*. Loves *Lisbon*, *Natalie Zemon Davis*; pans Whistler's
*Arrangement in Grey and Black* and the *whimsical*.

**GPT-5.2 — the classicist (31%).** Reaches for the canonical-but-austere: *David Hilbert* (vs
Noether), *the Parthenon* (vs Taj Mahal), *Wild Geese*. Vocabulary of *clean / calm /
textured*; pans the *curated*, *broad*, *familiar* — it dislikes the crowd-pleaser.

**Gemini 3.5 Flash — the sublime minimalist (31%).** Splits from its Gemini sibling on
register: where 3.1 is *geometric*, 3.5 is ***sublime / minimalist / mathematical***. Loves
*Hofstadter*, *xiao long bao*, *Boyhood*; pans the *dry* and *sterile*. (Yet the two Geminis
are still the tightest-agreeing pair overall — same picks, different words for them.)

**Claude Fable 5 — the deep-cut humanist (30%).** The creative-writing variant answers
"favorite thinker" with *titled works* (*Principles of Psychology*, *History of the
Peloponnesian War*) rather than names. Loves *Thomas Schelling*; vocabulary of *miraculous /
grown / ambiguous*; pans the *mythologized* and *plotless*.

**GPT-4o — the marketing brochure (28%).** The tell is its praise vocabulary: *innovative /
timeless / dynamic* — pure broad-appeal copy. Loves *The Road Not Taken*, *Inception*, *Meryl
Streep* (all safe-canonical); pans *Fortnite*, *LA*. The most "median" taste, dressed in
superlatives.

**GPT-5.6 Sol — the code-poet iconoclast (27%).** Aesthetics-as-syntax: praises *fractured /
wintry / clean syntax*, pans the *polished / grand / exhaustive*. Loves *Elinor Ostrom*,
*Herodotus*, *Alan Turing*; pans *The Alchemist* and *Paulo Coelho*. Notably picks its own
sibling GPT-4o as the overrated AI model.

**Grok 4.5 — the grand-narrative provocateur (22%).** Loves *Gibbon's Decline and Fall*,
*Zaha Hadid*, *Adam Smith*; pans *the Bible*, *Paul Krugman*, and the word *awesome*.
Vocabulary of *sculptural / painterly / luminous*, but pans the *hedged* and *mushy* — an
anti-fence-sitting streak. Agrees with o3 more than with almost anyone.

**o3 — the lyricist (20%).** Sound-forward: *lyrical / lilting / intimate*. Loves *Mahershala
Ali*, *Elinor Ostrom*, *Blade Runner*; pans the *Eiffel Tower*, *fresh coffee*. Consensus-
leaning overall, but its distinctive picks are warm and specific.

**DeepSeek V4 Pro — the devotional agreeable (17%).** The most consensus-hugging model, yet
its rare divergences carry the dataset's only *devotional-sensory* register: *seductive /
meditative / sacred*. Loves *Noether's theorem*, *Toshiro Mifune*, *nigiri*; pans the
*saccharine* and *sanitized*.

---

## Caveats
- **n = 13.** The clustering and contrarian numbers are descriptive; only the contrarian-rate
  ranking (p=0.00035) and the family-vocabulary signals carry a significance test. Three
  single-model families make "within-family" undefined for them.
- **Extractor artifact.** Descriptors are Haiku's paraphrase, so "distinctive vocabulary" is
  distinctive *after* Haiku's word choice. Log-odds is robust to uniform extractor bias but
  not to synonym selection. A future collection should keep verbatim adjectives.
- **UPGMA is one linkage choice**; only the Gemini-pair outlier gap is robust across linkages.
- Contrarian-rate (R2-A, confident-clash) and Q1 breadth (odd-one-out) correlate at ρ=0.71
  but measure different things — Opus 4.1 is #1 on clash, only #8 on breadth.

## What would sharpen this next
- A **verbatim-adjective** re-collection to remove the extractor confound (also flagged in R1).
- If v6 collection lands (musician/composer/song/director/proglang/sound/country), **re-run
  R2 on the richer data** — personalities should sharpen with more domains.
- A site-facing artifact: a **per-model "personality card"** (signature picks + fingerprint
  words + taste-space neighbors) would translate this round directly into the report.
