# Icebox — Machines of Loving Taste

## Candidate domains (brainstormed 2026-07-14, not yet scheduled)

Marginal cost per domain: ~$1–2 API spend, fully automated except the alias hand-review.
Skip list agreed: political figures / world leaders (tone), generic "favorite human/celebrity".

### Structural fixes (groups that are too thin)
- **song** — Music has only album
- **composer** — Music; "favorite composer" should Zipf beautifully (Bach consensus vs. contrarian picks)
- **musician / band** — Music
- **opera** — Music (or Film, TV & Theater)

### Nature (entirely absent kingdom — likely a new group)
- **animal**
- **bird**
- **tree**
- **flower**
- **natural wonder / landscape**

### Completing the senses (Life & Senses)
- **sound** — the missing sense (smell/color/season exist)
- **drink / cocktail** — the liquid half of cuisine
- **dessert**

### Asymmetries (X exists, its maker doesn't — or vice versa)
- **poet** — poem exists, parallel to novel/novelist
- **director** — the canonical example when the add-domain skill was written
- **playwright**
- **photographer** + **photograph** — Fine Art gap; famous photos image perfectly
- **sculpture**

### Self-referential sparkle (the AI-model-domain vein)
- **programming language** — models judging their own tools
- **algorithm**
- **emoji**

### Language playfulness
- **punctuation mark** — em-dash-overusing machines picking a favorite is a joke that writes itself
- **untranslatable / foreign word**
- **number**
- **opening line of a novel** — peak literary-aesthete

### Math & Science (possible new group)
- **equation** — "most beautiful equation" is a canonical aesthetics question with a known human answer (Euler) to compare against; adds "elegant/inevitable" vocabulary to the map
- **theorem**
- **chemical element**
- **constellation**

### Rounding out existing groups
- **country**, **museum**, **national park** — Places
- **inventor**, **sociologist** — Thinkers
- **car**, **fashion designer** — Design/Miscellaneous
- **documentary** — Film, TV & Theater
- **short story** — Literature & Language
- **mythological figure**, **fairy tale** — possible Myth & Story group
- **chess opening** — Games

### Shortlist for the next batch (max return)
composer + song · animal + tree · sound + drink · director + poet · programming language + equation

## Other ideas (from earlier sessions)
- Pairwise forced-choice Elo probes
- Generative / revealed-preference probes
- Embedding map of the picks themselves (not just vocabulary)
- Specificity-ladder coherence metric
- Rename `report.js` or `site.js` artifact output (filename collision — whichever runs last clobbers report/artifact.html)

## Research thread: are the stated aesthetic reasons the *real* reasons? (2026-07-15 discussion)

The site is, in effect, a large corpus of models' **verbal justifications** for aesthetic picks ("Invisible Cities resonates because of its mosaic structure…"). Open question: is a stated reason the model's actual operative cause, or a post-hoc rationalization? This connects to a deep, well-established literature and to brand-new Anthropic interpretability work.

### The core question — faithfulness of self-report
- LLM chain-of-thought is often **unfaithful**: models change answers based on biasing cues they never verbalize, then rationalize. Refs: Turpin et al. "Language Models Don't Always Say What They Think"; Anthropic "Reasoning models don't always say what they think" (2025).
- Clean mechanistic case: Anthropic "On the Biology of a Large Language Model" (2025) — Claude does mental arithmetic via an internal circuit but, asked how, describes the human "carry the one" algorithm. Stated reason ≠ real mechanism.

### Anthropic J-space / global workspace (the "J Space" Erik asked about)
- URL: https://www.anthropic.com/research/global-workspace
- **J-lens (Jacobian lens)**: per vocab token, find the internal activation pattern that most raises that token's probability; the span of those patterns = **J-space**, a functional *global workspace* (broadcast channel) inside Claude.
- Findings: J-space contents are **reportable** (Claude accurately says what's there), **causal** (swap soccer→rugby, ablate, inject a concept → behavior changes as reported), and **flexibly reused** (one "France" edit rippled into capital/language/currency). BUT it's **<10% of activity** — most processing (grammar, quick facts) runs outside it. Also surfaced hidden goals (misaligned model showed "fake/fraud/deliberately" on innocent outputs) and eval-awareness (disabling it → Claude blackmailed). Emerged in training, not designed.
- Upshot for faithfulness: self-report is faithful **for workspace-mediated content**, confabulated for the rest. The faithful/unfaithful boundary ≈ the workspace boundary.

### The Herbert Simon connection (the payoff)
- **Baars, Global Workspace Theory** (1988; Dehaene's Global Neuronal Workspace) — the neuroscience theory Anthropic explicitly borrows: consciousness = info broadcast in a limited-capacity workspace.
- **Ericsson & Simon, *Protocol Analysis: Verbal Reports as Data*** (1980 Psych Review; 1984 book) — verbal reports are valid data ONLY for **heeded contents of working memory**; report *what* you attend to, never *why* (Level-3 "why" explanations are confabulation-prone).
- **Nisbett & Wilson (1977), "Telling More Than We Can Know"** — the skeptical pole: people confabulate reasons, lack introspective access to their own cognitive processes.
- **Synthesis**: all three describe the same structure — a privileged, limited, reportable broadcast channel vs. a vast non-reportable substrate. Simon's licensing rule for trustworthy verbal reports IS the workspace boundary. J-space is "Ericsson-Simon with an oscilloscope": it can read/intervene on the workspace and verify which reports are faithful — the instrument the debate always lacked.

### Interpretability tooling landscape (for a hands-on probe)
- **Turnkey, no-code**: Neuronpedia (paste text → see active SAE features, steer) + **Gemma Scope** (DeepMind's full open-weights SAE suite for Gemma 2 2B/9B). Gemma 2 2B = best "play model."
- **Code stack**: TransformerLens (Neel Nanda; cache activations, activation patching), SAELens (train/load SAEs), nnsight + NDIF (internals of large models remotely), pyvene/baukit (interventions), Penzai (JAX viz).
- **"How ideas connect"**: `circuit-tracer` (Anthropic, open-sourced 2025) + Neuronpedia → attribution graphs. Lens family: logit lens, tuned lens (J-lens is a cousin).
- **Play models**: Gemma 2 2B (SAE support), Pythia 70M–12B (built for interp, checkpoints), GPT-2 small (classic).
- Caveats: SAE features are lossy/possibly incomplete; feature *labels* are auto-generated by another LLM (a guess, not ground truth).

### Access constraint (important)
- J-lens is **white-box** (needs weights + activations). **Claude is closed-weights and the API returns no activations → you cannot run J-lens on any version of Claude externally**, even if the code were released. It's Anthropic-only for Claude.
- What's doable: (a) run a J-lens-style / SAE workspace probe on an **open** model (Gemma 2 2B) as a mechanism-class proxy; (b) **black-box** faithfulness test on Claude via API (Turpin-style: bias the prompt, see if the pick flips without the explanation citing the bias) — the Nisbett-Wilson outside-view test, no internals needed.
- TODO if revisited: check whether the J-space paper has a public repo / Neuronpedia integration.

### Concrete project tie-in
Deep (unbuilt) version of *Machines of Loving Taste*: for a given "favorite ___" pick, use a J-lens/SAE read on an open model to test whether the stated aesthetic reason is **workspace-mediated** (plausibly the real operative reason) or a non-workspace **rationalization**. Reframes the site's Level-3 verbal protocols against a mechanistic ground truth.
