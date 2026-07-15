# Round 1 — Curated shortlist (which hypotheses to actually test, and why)

24 hypotheses came back across three lenses (`hypotheses_convergence.md`,
`hypotheses_capability.md`, `hypotheses_content.md`) plus my own `director_grounding.md`.
This is the curation step: I picked **6 questions** to test rigorously, chosen for
(a) interest, (b) tractability with current data, (c) non-redundancy, (d) collectively
answering the director's three hunches AND the strongest emergent findings.

Selection principle: every one of the director's three hunches gets a rigorous, honest
verdict (even where the answer is "false" or "more complicated"), and I add the emergent
findings that multiple lenses independently surfaced.

## SELECTED

**Q1 — What is the *structure* of aesthetic convergence? (domain vs model vs family)**
Sources: conv-H1 (family clustering, within 0.224 > between 0.173, perm p=0.0006),
conv-H4 (variance decomposition, domain var ≈3× model var), grounding.
Why: reframes the headline hunch. "AIs converge" → "convergence is mostly compelled by the
domain, with a secondary lab-inherited house style." The keystone result.
Verdict target: variance decomposition (domain/model/family/residual) + family-clustering
permutation test, on BOTH probes.

**Q2 — Do models agree more on what they *reject* than what they *love* — and where does it flip?**
Sources: content-H2 (perm p=0.0058), cap-H4 (sign test p=0.022), conv-H5/H6 (flips for
people/thinkers), grounding (0.46 vs 0.55). Triple-confirmed core + a genuinely surprising
reversal for people-domains.
Why: the cleanest, most-replicated finding in the whole batch, and the reversal makes it
non-trivial. Verdict target: paired per-domain consensus test both probes + the artifact/
place vs people/thinker interaction.

**Q3 — Does more capability mean *less cliché* taste? (the director's central hunch)**
Sources: cap-H2/H3/H6, conv-H3. The hunch was "4o gives clichés, advanced models give real
taste." Early read: FALSE or backwards for Anthropic (converges harder with capability),
inverted-U for OpenAI, and hedging is entangled with the metric.
Why: it's Erik's core question and deserves the most rigorous, hedge-controlled test even
though the likely verdict is "not supported / more complicated." Verdict target:
consensus-hugging + entropy + descriptor-richness across the two real ladders, controlling
for hedge rate; state honestly.

**Q4 — The cultural & geographic geometry of taste (the "AIs like Asia" hunch)**
Sources: content-H1 (Asia 20.3% fav vs 3.0% ovr in cultural domains, ~7×), grounding
(global 5.6% but domain-conditional is where it lives).
Why: directly tests the hunch, with the honest reframing (it's domain-conditional). Broaden
beyond Asia to the full cultural distribution of taste. Verdict target: auditable region
bucketing, per-domain, favorite vs overrated, with base-rate caveats stated.

**Q5 — Who gets called overrated? Fame & the gender asymmetry**
Sources: content-H3 (favorites 19.3% women vs overrated 4.2%, perm p<0.00005; scientist
flips 50.8%→1.7%), content-H7 (overrated = most-famous-in-category: Gehry 95/0, Catcher
84/0, Mona Lisa).
Why: the most striking emergent finding, and the most sensitive — so it gets the most
rigor. Requires a transparent, auditable gender lookup with conservative "unknown"
handling; framed strictly as a property of *the models' picks*, not a claim about people.
Verdict target: fame-asymmetry (zero-overlap "famous but never loved") + gender asymmetry
with audited lookup + robustness to unknowns.

**Q6 — Is there a universal AI aesthetic vocabulary?**
Sources: content-H5 ("elegant" #1 for 13/13; praise vs critique vocab nearly disjoint),
conv-H7 (vocabulary converges more than entity choice; within/between-family descriptor
Jaccard 0.252 vs 0.184).
Why: colorful, illustrative, and speaks to "do they share reasons, not just picks." Verdict
target: descriptor-vocabulary convergence across models + praise/critique lexicon split,
with the honest caveat that generic positive adjectives may be an LLM writing tic.

## DEFERRED (good, but not this round)
- conv-H2 (odd-models-out: Gemini-3.1 & Opus-4.8 least convergent; Gemini pair most) — folds
  into Q1 as a sub-result rather than its own study.
- content-H4 (temporal skew 1960s favored / 1980s reviled) — real and GREEN, but narrower;
  fold a one-paragraph version into Q4 (taste's time geography) rather than a full study.
- cap-H1 (hedging directions opposite across ladders) — becomes a *control* inside Q3, not
  its own question.
- content-H6 (same entity loved & hated) — descriptive color; can surface in Q2.
- Anything RED (causal fame needs external pageview data) — noted as a future-data ask, not
  tested this round.

## FUTURE-DATA ASKS surfaced by the hypotheses (for Erik)
- External fame proxy (e.g. Wikipedia pageviews) to make the "overrated = most famous"
  claim causal rather than circular.
- A verified creator metadata table (birth country, gender, era) to replace hand-built
  keyword/gender lookups and upgrade Q4/Q5 from YELLOW to GREEN.
- A non-aesthetic control task (same models, same "what's your favorite ___" frame on
  neutral prompts) to test whether "elegant"-style vocabulary is aesthetics-specific or a
  general LLM tic.
