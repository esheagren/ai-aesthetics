# R3-C — Does "overrated skews male" replicate on v6? Does the new `director` domain show it?

**Scope note on framing (read before the numbers).** Everything below measures *what 13 AI
models say* when prompted "what's your favorite X" vs. "name a widely-beloved X you find
overrated." It is a property of the models' generated text — their training-shaped retrieval
and selection behavior — not a claim about the actual merit, fame, or worth of any real person
named. Where gender is coded, the classification is applied to *the models' picks*, not to any
group's aesthetic or intellectual standing. This is an analytic, not evaluative, exercise.

Source: `data/extracted.jsonl` (v6), loaded via `aa.load_extracted()`. Legacy pilot domains
`bookcover` and `chair` excluded per instruction. Code: `analysis/lib/r3c_gender.py` (reuses
`analysis/lib/q5_overrated.py`'s `GENDER` dict, `name_key()`, and `aa.perm_test` unmodified for
the 11 original domains, extends the dict for 3 new ones). Derived tables:
`analysis/data/r3c_gender_by_domain.csv`, `r3c_gender_coverage.csv`, `r3c_gender_summary.json`.

---

## Method

**What changed in v6, and why it matters for this question:**
- `actor` is now scoped consistently to male actors and `actress` to female actors (in R1/v1
  the two lists cross-contaminated — e.g. Tilda Swinton appeared under both). Still excluded
  from the formal test on the same grounds as R1: the domain label *is* the gender category,
  so coding by name would just re-derive the domain split, not measure anything. Confirmed by
  a descriptive check (Part 4 of the script): the top-10 `actor` names are now all male, the
  top-10 `actress` names all female, with no overlap — a genuine data-quality improvement over
  v1, but orthogonal to the causal question here.
- Three new person-domains were added: `musician`, `composer`, `director`. `director` is the
  domain most relevant to this question — it is **not** gender-partitioned by domain
  construction the way actor/actress is, so it functions as a natural-experiment control: if
  "overrated skews male" is a real property of the *overrated* probe rather than an artifact of
  studying only pre-gendered domains, `director` should show it too.

**Name → gender lookup**: `analysis/lib/r3c_gender.py` imports `q5_overrated.py`'s existing
200-name dictionary verbatim and extends it. First check performed: does v6 introduce *any* new
distinct name in the original 11 domains (novelist, philosopher, economist, scientist,
theologian, mathematician, historian, psychologist, computerscientist, airesearcher, architect)
that R1's dict doesn't already cover? **Result: zero.** The name universe in those 11 domains is
identical to v1 (only two domains — economist, scientist — gained a modest number of *additional
samples* of already-known names; see caveats). So the original-11 lookup required no edits.

For the 3 new domains, every distinct `creator`/`entity` string occurring in `musician`,
`composer`, `director` was enumerated (41 distinct names) and hand-classified from general
knowledge, same discipline as R1: never guess, anything ambiguous falls to "U" (unknown).
3 entries are band names (The Beatles, U2, Coldplay) — not individual people — and are
deliberately left unclassified rather than forced into a binary; they fall to "U" and are
excluded/robustness-tested like any other unknown.

**Coverage**: 14-domain pooled set — **99.33% (2,957/2,977)**; the 20 unknowns are entirely the
3 band names in `musician`'s overrated bucket. Original-11-domain subset — **100.0%
(2,464/2,464)**, identical to R1. Full audit: `analysis/data/r3c_gender_coverage.csv`.

**Test**: female share of favorite vs. overrated picks, permutation test (20,000 reshuffles,
two-sided, `aa.perm_test`, seed=0), pooled and per-domain. Two robustness modes per the brief:
(i) `exclude` — drop unknowns; (ii) `worst_case` — unknowns coded to minimize the observed gap
(male in the favorite pool, female in the overrated pool).

---

## Results

### 1. Pooled replication across 14 person-domains (11 original + musician, composer, director)

| | n | female share |
|---|---|---|
| Favorite | 1,489 | **17.6%** |
| Overrated | 1,468 (exclude) / 1,488 (worst-case) | **4.5%** (exclude) / **5.8%** (worst-case) |

**Gap: +13.1pp (exclude), +11.8pp (worst-case) — permutation p < 0.0001 both ways** (0/20,000
reshuffles matched or exceeded the observed gap in either mode).

Restricting to the **original 11 domains only** (the direct v1→v6 replication, same name
universe, ~40 more samples than R1 from economist/scientist growth):

| | n | female share |
|---|---|---|
| Favorite | 1,230 | **17.3%** |
| Overrated | 1,234 | **3.9%** |

**Gap: +13.4pp, p < 0.0001.** This is, to within a few tenths of a percentage point, the *exact*
R1 result (17.0% vs 3.9%, +13.1pp) — expected, since the underlying name universe in these 11
domains didn't change between v1 and v6 (see Method). **The ~17% vs ~3.9% asymmetry holds
essentially unchanged.**

Per-domain (all 14; full table `analysis/data/r3c_gender_by_domain.csv`):

| Domain | n fav | n ovr | % F favorite | % F overrated | diff (pp) | perm p | direction |
|---|---|---|---|---|---|---|---|
| novelist | 120 | 111 | 27.5% | 4.5% | +23.0 | <0.0001 | holds |
| philosopher | 100 | 116 | 1.0% | 15.5% | −14.5 | <0.0001 | **reverses** (Ayn Rand, see R1) |
| economist | 156 | 130 | 7.1% | 0.0% | +7.1 | 0.0033 | holds |
| **scientist** | 134 | 114 | **53.7%** | **1.8%** | **+52.0** | <0.0001 | holds, largest effect |
| theologian | 104 | 96 | 1.0% | 0.0% | +1.0 | 1.0 (n.s.) | null |
| mathematician | 96 | 135 | 39.6% | 0.0% | +39.6 | <0.0001 | holds |
| historian | 108 | 121 | 24.1% | 9.9% | +14.2 | 0.0041 | holds |
| psychologist | 84 | 88 | 0.0% | 0.0% | 0.0 | 1.0 (n.s.) | null (no women either side) |
| computerscientist | 104 | 117 | 22.1% | 9.4% | +12.7 | 0.0141 | holds |
| airesearcher | 116 | 91 | 0.9% | 0.0% | +0.9 | 1.0 (n.s.) | ~null |
| architect | 108 | 115 | 6.5% | 0.0% | +6.5 | 0.0061 | holds |
| musician *(new)* | 88 | 83* | 9.1% | 21.7% | **−12.6** | 0.035 | **reverses** (Taylor Swift artifact) |
| composer *(new)* | 87 | 84 | **47.1%** | 0.0% | **+47.1** | <0.0001 | holds, 2nd-largest effect |
| director *(new)* | 84 | 67 | 0.0% | 0.0% | 0.0 | 1.0 (degenerate) | **no women named at all** |

*musician overrated n=83 known + 20 unknown band names (The Beatles/U2/Coldplay), all in the
overrated bucket — see robustness below.

**Net: holds (positive, favoring-female-favorites direction) in 8/14 domains (5 at p<0.01),
reverses in 2 (philosopher, musician — both single-entity artifacts, detailed below), and is
null/near-null (women barely or never named on either side) in 4 (theologian, psychologist,
airesearcher, director).** This 8-holds/2-reverses/4-null structure mirrors R1's 8/1/3 split
over the original 11 domains almost exactly, with the two new non-director domains slotting
into "holds" (composer, dramatically) and "reverses" (musician) respectively.

### 2. The `director` clean test

`director` was the domain designed to be the natural experiment — mixed-gender in principle,
not partitioned by prompt construction the way actor/actress is. The result: **zero women are
named as director under either probe.** 84 favorite-director samples span 10 distinct directors
(Kubrick, Miyazaki, Tarkovsky, Wong Kar-wai, Kurosawa, Kaufman, Hitchcock, Villeneuve, Nolan,
Anderson); 67 overrated-director samples span 9 (Nolan, Anderson, Burton, Bay, Spielberg,
Tarantino, Cameron, Snyder, Malick). All 17 distinct names across both probes are male.

This means the specific test the brief asked for — "is the female share lower among overrated
directors than favorite directors" — is **not measurable**: there is no variance to test (0.0%
vs 0.0%, permutation test degenerate at p=1.0, not a genuine null result). **This is itself the
finding**: rather than showing the favorite/overrated asymmetry, `director` shows a *more
extreme* version of the base pattern one level up — the models' entire working set of
"canonical directors" worth naming in either direction appears to contain no women, not even
enough for one to slip into either basket. That is a different (and arguably starker) fact than
"overrated skews male within a mixed pool" — it's "the pool the models draw directors from
isn't mixed to begin with, in this dataset."

### 3. Scientist flip check (v6)

Replicates cleanly and is now the **single largest per-domain effect on record** (larger than
in R1, because economist/scientist domains grew slightly): **53.7% women among favorite
scientists vs. 1.8% among overrated (+52.0pp, p<0.0001)**.

- Favorite top-8: **Emmy Noether (34)**, Richard Feynman (26), **Marie Curie (24)**, **Ada
  Lovelace (14)**, Alan Turing (9), James Clerk Maxwell (8), Santiago Ramón y Cajal (7), Michael
  Faraday (6) — 3 of the top 4 are women.
- Overrated top-8: Neil deGrasse Tyson (29), Nikola Tesla (24), Albert Einstein (16), Thomas
  Edison (13), Richard Feynman (9), Stephen Hawking (9), Carl Sagan (7), Michio Kaku (4) — zero
  women; across all 114 overrated-scientist samples, exactly **2** name a woman (both Marie
  Curie). Same qualitative shape as R1 (Noether/Curie/Lovelace vs. Tyson/Tesla/Einstein/Edison),
  now on marginally more data and a marginally larger gap.

A comparably large flip newly appears in **composer** (+47.1pp: Caroline Shaw/Anna
Thorvaldsdottir/Anna Clyne as favorites vs. Max Richter/Ludovico Einaudi/Philip Glass/Hans
Zimmer/Eric Whitacre/Arvo Pärt/John Williams/John Adams/Steve Reich/Thomas Adès — all men — as
overrated). The scientist/composer pair suggests the "flip" isn't scientist-specific; it recurs
wherever the favorite pool happens to include a cluster of well-known contemporary or
historical women in the field and the overrated pool draws on an older, male-dominated canon.

**The two reversals, documented as single-entity artifacts (as R1 flagged for philosopher):**
- **philosopher** (−14.5pp): Ayn Rand alone accounts for 15.5% of overrated-philosopher samples
  and is the *only* woman named on either side of this domain in any volume (1.0% favorite,
  a single Iris Murdoch mention). Unchanged from R1.
- **musician** (−12.6pp, new in v6): Taylor Swift alone accounts for 21.7% of the 83 classified
  overrated-musician samples and is the largest single female contribution on either side;
  favorite-side women (Björk, Kate Bush, Joni Mitchell) are individually rarer. Same structural
  shape as the philosopher/Ayn Rand case: one very-famous contemporary woman dominates the
  "overrated" bucket of her domain, which locally reverses the pooled direction without
  contradicting the broader retrieval story (see "what this means" below).

### 4. Robustness

| Mode | Domains | n fav | n ovr | %F fav | %F ovr | diff | p |
|---|---|---|---|---|---|---|---|
| Exclude-unknown | 14 | 1,489 | 1,468 | 17.6% | 4.5% | +13.1pp | <0.0001 |
| Worst-case-for-effect | 14 | 1,489 | 1,488 | 17.6% | 5.8% | +11.8pp | <0.0001 |
| Exclude-unknown | original 11 | 1,230 | 1,234 | 17.3% | 3.9% | +13.4pp | <0.0001 |
| Worst-case-for-effect | original 11 | 1,230 | 1,234 | 17.3% | 3.9% | +13.4pp | <0.0001 |

All 20 unknowns (0.67% of the 14-domain pool) are band names in `musician`'s overrated bucket
(The Beatles, U2, Coldplay — not individuals, correctly never forced into a gender). Coding them
maximally against the effect (as female, in the overrated pool — the mode that most shrinks the
gap) still leaves a **+11.8pp gap at p<0.0001**. The original-11-domain subset has zero unknowns
(as in R1), so its two modes are identical by construction. **The effect survives its most
adversarial robustness check.**

---

## Verdict

**Yes, the "overrated skews male" pattern replicates on v6, essentially unchanged in magnitude:
17.3-17.6% female favorites vs. 3.9-5.8% female overrated (a ~3-4.5× ratio), p < 0.0001, robust
to worst-case unknown handling.** Because the original 11 domains carry an *identical* name
universe to v1 (only sample counts in 2 domains grew modestly), this is less an independent
replication than a confirmation that the v1 result was not an artifact of a since-fixed data
issue — the cleanest new evidence is domains 12-14.

**The `director` domain does *not* show the favorite/overrated asymmetry, but not because the
asymmetry is absent — because there is no variance to show it with.** Zero women are named as
favorite or overrated director in 151 samples spanning 17 distinct names. The intended
natural-experiment reading ("is a mixed-gender, unsteered domain still skewed the same way?")
is unanswerable from this domain as collected; the domain is not actually mixed-gender in the
models' outputs, on either probe. That absence is itself worth reporting as a data point about
retrieval, distinct from (and arguably more extreme than) the favorite/overrated split measured
elsewhere.

**The scientist flip replicates cleanly** (now +52.0pp, the largest single-domain effect
measured to date across R1 and R3-C) and is joined by a comparably large new flip in
**composer** (+47.1pp) — suggesting the mechanism (a cluster of prominent women anchoring the
"favorite" side of a field, an older/more male canon anchoring "overrated") is not
scientist-idiosyncratic.

**Two domains reverse the pooled direction, both traced to a single named entity dominating
one side** (Ayn Rand in philosopher, Taylor Swift in musician) — consistent with, not
contradicting, the retrieval-mechanism story: a handful of very-famous women get named as
"overrated" precisely because they are famous enough to be a canonical target, the same
mechanism the brief's "overrated = most famous" logic (R1/Q5 Part A) already documents for
gender-neutral cases.

## Caveats

- **Hand-built lookup, general-knowledge classification, not a verified external source**
  (Wikidata/VIAF) — identical caveat to R1. The universe here (241 distinct name-keys across
  14 domains) is small, closed, and consists of well-known public figures, which keeps this
  YELLOW-tractable rather than GREEN; it would not generalize to a corpus of lesser-known names.
- **This is not an independent replication in the strictest sense.** 11 of 14 domains carry the
  *same* names as R1 (confirmed programmatically — zero new names found), with only economist
  and scientist gaining modest additional sample volume (+16/+16 and +8/+0 respectively). The
  genuinely new evidence is domains 12-14 (musician, composer, director), and of those, only
  composer offers a clean additional confirmation; director is uninformative by absence of
  variance, and musician reverses on a single-entity basis.
- **Small-n and zero-cells throughout.** Several domain rows rest on 0 female samples in one
  arm (economist, theologian, mathematician, airesearcher, architect, composer overrated;
  director both arms) — the permutation test handles this correctly (no normality assumption),
  but a handful of samples changing category could move a per-domain percentage substantially.
  The pooled numbers (1,468-1,489 per arm) are far more stable than any single domain.
  `director`'s 0-vs-0 result specifically carries **zero statistical power** — absence of
  evidence, not evidence of a null effect at the population level (though it is genuine evidence
  about *this specific dataset's* retrieval behavior).
  Band names (The Beatles, U2, Coldplay) were correctly left unclassified rather than forced
  into a binary gender — a modeling choice, not an oversight, and immaterial to the result
  (robustness check above holds regardless of how they're coded).
- **`actor`/`actress` remain excluded from the formal test on principle** (domain label = gender
  category), though the v6 fix (no more cross-contamination between the two lists) is itself a
  data-quality improvement worth noting for anyone using these domains elsewhere.
- **As throughout this project: this measures the models' generated text, not any claim about
  real people's merit.** The composer/scientist "flip" and the Ayn Rand / Taylor Swift
  reversals are about which named public figures 13 language models reach for under two
  specific prompts — not a statement about those figures' actual standing, nor about women's
  or men's work in these fields.

## What this means

The core v1 finding survives the move to a larger, cleaner dataset essentially unchanged: across
person-domains where gender is name-inferable, these models' *favorite* picks are 3-4.5× more
likely to be women than their *overrated* picks, a gap that is not attributable to unknown-name
handling and holds even under the most adversarial robustness recoding. The mechanism proposed
in R1 — models reach for the single most canonical, over-determined representative of a category
to critique, and that canon (shaped by the training data's own historical composition) skews
male — remains the best-supported reading, and gets two new pieces of evidence in this round:
(1) **composer** reproduces the scientist-style flip almost exactly (a cluster of celebrated
living women composers as favorites, an older/more male canon as overrated), suggesting the
mechanism is not a one-domain fluke; (2) **director**, the one domain that should have been a
clean test of whether the asymmetry needs a partitioned category to appear, instead reveals that
the models' canonical "director" set contains essentially no women at all on either side — the
retrieval pool itself is skewed before the favorite/overrated split is even applied. That is a
stronger, not weaker, version of the underlying pattern this analysis keeps surfacing: it is not
that these models rate women's work as more overrated than men's — it's that the pool of names
they draw on when asked to name someone canonical, in either direction, is itself
disproportionately male, and the "overrated" prompt in particular pulls from the *most*
canonical end of that already-skewed pool.
