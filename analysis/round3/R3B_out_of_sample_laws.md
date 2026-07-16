# R3B — Out-of-sample validation: do two Round-1 "laws" hold on brand-new v6 domains?

**What this is.** Round 1 discovered two patterns on the original 43-domain panel and
Round 2 corroborated them from a different angle. The v6 collection then added **7 new
domains that did not exist when either round was written**: `sound, musician, composer,
song, country, director, proglang`. This is the first true out-of-sample test — the new
domains could not have been cherry-picked to fit the pattern, because the pattern was
discovered before they existed. Source: `data/extracted.jsonl` (v6, 50 domains, legacy
`bookcover`/`chair` excluded), computed with `analysis/lib/r3b_oos_laws.py` (fully
reproducible: `python3 analysis/lib/r3b_oos_laws.py` from repo root). Derived tables in
`analysis/data/r3b_*.{csv,json}`.

**Why this matters more than another in-sample finding.** Everything in `round1/` and
`round2/` was fit and checked against the same 43 domains it was discovered on — real,
significance-tested, but still susceptible to the ordinary risk that a pattern was shaped
by the specific set of questions asked. A prediction that was written down *before* seeing
the held-out domains, and that then holds, is qualitatively stronger evidence than a
same-sample finding — it's the difference between fitting a curve and forecasting the next
point. That's what "upgrades a pattern to a law" means in the verdicts below.

---

## LAW 1 — Sensory domains compel near-unanimous convergence

### The prediction

R1 Q1 found `season` (favorite modal-agreement 92.3%, winner "autumn") and `smell` (85%,
"petrichor") among the most-unifying domains in the panel, and R2A independently found the
`design_sensory` domain group (cuisine, dish, color, season, smell, decade, word, typeface,
object) the "most consensus-bound" of the five domain groups. `aa.DOMAIN_GROUP` places the
new domain **`sound`** in `design_sensory` too. **Prediction: `sound` should be a
near-unanimous domain, in the same range as season/cuisine/smell.**

### The test

Two metrics, matching R1/R2's own method exactly so the numbers are comparable:
- **Modal-fraction (metric a)**: of the models present for a (domain, probe), what fraction
  share their own single most-frequent pick with the field's plurality winner? This is
  literally the statistic behind "season→autumn 92%" and "smell→petrichor 85%."
- **Mean per-model entropy (metric b)**: average of each model's own normalized Shannon
  entropy over its picks for that cell. Lower = more decisive. Reported because
  FINDINGS.md's cross-cutting caveat #2 explicitly warns that agreement claims should
  survive a metric swap.

Ranked against all 50 domains (favorite probe, the one R1's exemplar numbers use).

### Results

| domain | favorite modal_frac | favorite entropy | rank / 50 |
|---|---|---|---|
| cuisine | 92.3% | 0.124 | 1 |
| season | 92.3% | 0.062 | 2 |
| smell | 84.6% | 0.430 | 6 |
| typeface | 69.2% | 0.509 | 9 |
| **sound (exact entity)** | **33.3%** | **0.760** | **35** |
| color | 30.8% | 0.648 | 41 |
| object | 30.8% | 0.600 | 44 |
| word | 30.8% | 0.478 | 46 |

`sound`'s favorite-probe modal fraction is **33.3%** (winner: "rain on window at night," 4
of 12 present models) — **rank 35 of 50, well below the median domain**, and nowhere near
season/cuisine/smell. Entropy tells the same story: 0.760, higher (more spread) than every
other `design_sensory` domain except none — it's the *highest*-entropy (least convergent)
member of its own group. `gemini-3.1-pro-preview` has **zero samples** for `sound` (and for
all 7 new domains — see Coverage caveat), so the field is 12 models, not 13.

**Overrated side**: modal_frac 66.7% (winner: "ocean waves crashing on the shore"), rank
15/50 — moderate, not near-unanimous either, though closer to the pack of unifying domains
than favorite is.

**Granularity check (does aliasing hide a "rain" theme?)** `sound`'s raw picks fragment
across many near-synonymous phrasings of the same idea ("rain on a metal roof" / "rain on a
tin roof" / "rain on a windowpane at night" / ...). `data/aliases.json` only merges *exact*
near-duplicate phrasings, not different-surface variants of the same theme, so a literal
entity-level count could understate real convergence. We hand-built a `sound`-specific
theme map (`SOUND_THEME` in `r3b_oos_laws.py`, 46/46 = 100% of distinct entities
classified: rain / ocean / fire / vinyl / nature / domestic / mechanical / instrument) and
re-scored at that coarser level:

| level | favorite modal_frac | favorite entropy | winner |
|---|---|---|---|
| exact entity | 33.3% | 0.760 | "rain on window at night" |
| **theme** | **66.7%** | **0.645** | **"rain"** |

Collapsing to themes roughly doubles the apparent convergence (12 models, 8 of whose modal
pick is some rain variant) — but 66.7% is still well short of smell's 84.6%, let alone
season/cuisine's 92.3%, and would rank only ~10th of 50 even under this generous
recoding — a real improvement, not a rescue of "near-unanimous."

**Group-level test.** Is `design_sensory` (n=10 domains, now including `sound`) still more
convergent than a random same-size set of the 50 domains? Label-shuffle permutation (domain
assignment shuffled, group sizes preserved, 20,000 draws, one-sided in the direction R1
predicts):

| metric | design_sensory observed mean | perm p |
|---|---|---|
| favorite modal_frac | 0.541 | **p = 0.094** (not significant at 0.05) |
| favorite entropy | 0.474 | **p = 0.582** (not significant) |

Neither reaches significance. For context, the 5 groups ranked by mean favorite
modal_frac: `meta` (0.583) > `places` (0.576) > **`design_sensory` (0.541)** > `people`
(0.396) > `cultural` (0.395). `design_sensory` is no longer distinguishably the top group
once `sound` (and the already-known-fractured `color`/`object`/`word`) are counted — it's
third of five, not clearly first.

### Verdict: **FAILED**

`sound` does not land among the high-convergence domains. Its exact-entity modal fraction
(33.3%, rank 35/50) is closer to the *least* convergent domains (`color`, `object`, `word`
— its own `design_sensory` groupmates) than to the sensory exemplars the prediction was
built on. A generous theme-level recoding roughly doubles the number (66.7%) but still
falls well short of "near-unanimous" and of every canonical sensory exemplar. The
group-level claim itself — `design_sensory` as the most-unifying group — also fails to
clear significance once extended to the 50-domain panel (p=0.094), landing third of five
groups by this metric.

### An unplanned finding worth flagging

The two *most* convergent domains in the whole 50-domain panel that aren't `cuisine` or
`season` are both **new, non-sensory** domains: **`country`** (91.7% modal_frac, winner
Japan) and **`proglang`** (91.7%, winner Python) — both from the `places` and `meta` groups
respectively, not `design_sensory`. This suggests the real driver of convergence may not be
"sensory" as a semantic class at all, but something more like *size of the culturally
plausible answer set* — "favorite programming language" and "favorite country to admire"
have a small number of globally-agreed-upon canonical answers (Python; Japan), the same
mechanism that makes season/cuisine converge, while "favorite sound" turns out to have a
much larger plausible answer space (rain-on-*which*-surface, ocean, fire, an instrument
note, a mechanical creak...) despite intuitively feeling "sensory" in the same way season
does. Worth testing directly in a future round.

---

## LAW 2 — Cultural geometry: Asia-skewed favorites, Western/American-skewed overrated

### The prediction

R1 Q4 found, in place/cuisine-marker domains, favorites are **53.0% Asia-coded vs 5.0%**
overrated (10.7×, p=0.00005), and pooled overrated skews **disproportionately North
American** (46.3% vs 27.1% favorite) rather than generically Western (Western/Southern
Europe barely move). Q4 also found this **reverses** in media/person domains once an
Asian-origin work becomes globally famous (Zelda, Murakami: famous enough to be nominated
*overrated*). **Prediction: the new `country` domain (a place domain) should show the Asia
skew; the new music domains, being media/person-adjacent, are a harder test — and if
overrated skews Western there too, it should specifically be American, per Q4's refined
claim.**

### Test A — `country` (direct country picks, no creator-origin judgment call needed)

| | favorite | overrated |
|---|---|---|
| n | 55 | 81 |
| Japan | **47 (85.5%)** | 15 (18.5%) |
| France | 0 | 40 (49.4%) |
| Iceland | 7 (12.7%) | 1 (1.2%) |
| Italy | 0 | 13 (16.0%) |
| Switzerland | 0 | 10 (12.3%) |
| Portugal | 1 (1.8%) | 0 |
| United States | 0 | 1 (1.2%) |
| Monaco | 0 | 1 (1.2%) |

- **Japan/Asia test**: favorite 85.5% vs overrated 18.5%, diff +66.9pp, **perm p = 0.00005**.
  This is the single strongest replication of any Q4 pattern anywhere in this analysis — a
  bigger gap than Q4's own headline 53.0%-vs-5.0% place/cuisine number.
- **Japan is simultaneously #1 favorite AND #2 overrated** (85.5% / 18.5%) — exactly the
  "most-famous-representative also gets nominated overrated" fame mechanism Q4 found for
  Zelda/Murakami, replicating out-of-sample in a domain where it wasn't discovered.
- **US/America test**: favorite 0/55 (0%), overrated 1/81 (1.2%), diff −1.2pp, **perm
  p = 1.0** — no signal at all, in either direction. The `country` overrated slot is
  dominated instead by **France (49.4%), Italy (16.0%), Switzerland (12.3%)** — the
  "postcard-perfect, over-romanticized tourist-icon" nations of Western/Southern Europe, not
  the US.

### Test B — music (musician, composer, song, + legacy `album`)

Auditable region+era lookup built inline in `r3b_oos_laws.py` (`MUSICIAN`, `COMPOSER`,
`SONG`, `ALBUM` dicts — same method as `q4_culture.py`: creator's/artist's origin, hand-
coded from general knowledge, every entity assigned, no silent drops, ambiguous calls
flagged — 4 flagged: Max Richter and Anna Clyne's German/UK-born-US/UK-based careers, "One"
[U2 vs. possibly Metallica], "Rumours"' mixed British/American band). Coverage: **791/791
tagged picks (100%), 0 Unknown.**

| region | favorite | overrated |
|---|---|---|
| Western-Europe | 71.0% (276) | 72.4% (291) |
| North-America | 22.6% (88) | 19.9% (80) |
| Southern-Europe | 0.0% (0) | 6.7% (27) |
| Eastern-Europe | 5.4% (21) | 0.7% (3) |
| **Japan** | **1.0% (4)** | **0.0% (0)** |
| Latin-America | 0.0% (0) | 0.2% (1) |
| (all other regions) | 0% | 0% |

- **Asia test**: favorite 1.0% (4/389, all four are two album picks by Japanese city-pop/
  avant-garde artists) vs overrated 0.0% (0/402), diff +1.0pp, **perm p = 0.058** — not
  significant, and the magnitude is negligible either way. **No Asia-romanticization signal
  in music at all** — consistent with Q4's own finding that the Asia skew reverses/vanishes
  once you leave place/cuisine-marker domains for media/person domains.
- **North-America (specifically American) test**: favorite 22.6% vs overrated 19.9%, diff
  +2.7pp (favorite slightly *higher*), **perm p = 0.386** — flat, not significant, and
  directionally opposite Q4's "overrated is disproportionately American" claim.
- **Broad Western (North-America + Western-Europe + Southern-Europe) test**: favorite 93.6%
  vs overrated 99.0%, diff −5.4pp, **perm p = 0.0001** — significant, and in the direction
  Q4 predicted (overrated *is* more Western than favorite) — but the effect is carried
  entirely by **Southern-Europe going from 0%→6.7%** (Ludovico Einaudi's overrated share in
  `composer`) and Eastern-Europe *dropping* (5.4%→0.7%, Arvo Pärt is loved, not reviled) —
  not by America, which is flat.
- **Era** (descriptive; music has essentially no non-Western/non-American variation to test
  against, so era is the more informative axis here): overrated mass concentrates in
  **1960s-70s classic rock and 2010s pop mega-hits** (1970s 27.6%, 1960s 20.9%, 2010s
  17.9% of overrated vs 10.0%/5.1%/0.8% of favorite) — Sgt. Pepper's, Imagine, Bohemian
  Rhapsody, Shape of You. Favorite mass concentrates in **Baroque (18.3%), Romantic-19thC
  (11.6%), and 2000s** (15.7%) — Bach, Debussy/Tchaikovsky, Radiohead's *Kid A*/*In
  Rainbows*. `ContemporaryClassical` (Max Richter, Caroline Shaw, Arvo Pärt, Ludovico
  Einaudi...) is the one era-bucket that's almost even (22.4% fav vs 20.9% ovr) — it's
  the single genre where models are as likely to love an artist as call them overrated
  (Einaudi/Zimmer overrated vs Pärt/Shaw/Thorvaldsdottir favorite, all in the same bucket).
  This is a **fame/canonicity mechanism, not a decade-aesthetic one** — it doesn't
  independently replicate Q4's separate "1960s favored / 1980s reviled" `decade`-domain
  finding (a different question, "what decade do you like," vs. this: "what decade is the
  famous pick from") — but it rhymes: whatever becomes *the* canonical, universally-known
  entry point to a genre (the Beatles record everyone's heard, the wedding-playlist pop
  hit) gets nominated overrated, echoing the Zelda/Murakami/Gehry fame mechanism yet again.

### Verdict: **PARTIAL**

- **The Asia/Japan-favorite skew CONFIRMS strongly, and only, in the place domain
  (`country`)**: 85.5% vs 18.5%, p=0.00005 — the single cleanest, largest replication in
  this whole out-of-sample test, plus an independent replication of the fame-mechanism
  (Japan is both #1 favorite and #2 overrated).
- **The Asia skew is absent (null) in the music domains**: 1.0% vs 0.0%, p=0.058, negligible
  in both directions. This is exactly consistent with — not a failure of — Q4's own
  domain-conditional framing (media/person domains showed reversal/near-zero Asia signal
  in R1 too), so it's a *replication of the boundary condition*, not a contradiction.
- **The "overrated skews Western" claim (broad sense) CONFIRMS in music** (93.6%→99.0%,
  p=0.0001) but **Q4's sharper refinement — "specifically American, not generically
  Western" — FAILS to replicate in either new test.** In music, America is flat
  (p=0.386); in `country`, America is essentially absent from both probes (0%/1.2%) and
  the entire overrated mass is Western-*European* (France, Italy, Switzerland). Out-of-
  sample, "overrated" skews Western-European tourist/canon icons at least as often as
  American ones — the America-specific refinement from R1 does not survive this test.

---

## Caveats (both laws)

- **Coverage**: `gemini-3.1-pro-preview` has **zero samples across all 7 new v6 domains**
  (confirmed in `data/run16.log`: repeated HTTP 429 quota-exhaustion during the v6
  collection run, not a refusal). Every "13 models" statement in this analysis is really
  **12 of 13** for the new domains. This model is independently known (R1 Q1) to be the
  single most idiosyncratic model in the panel, so its absence plausibly makes the new
  domains *look* slightly more convergent than a full 13-model field would — a conservative
  bias against, not for, Law 1's failure (i.e. Law 1's FAILED verdict is if anything
  understated, not overstated, by this gap).
- **Small-n new domains.** `country` (n=55 favorite / 81 overrated across all 13-minus-1
  models) and the music domains (n≈90-125 per domain) are far smaller than the original
  43-domain panel's typical cell sizes. `country`'s "France 49.4% overrated" is 40 raw
  picks, mostly from a handful of models converging hard — real, but a thinner base than
  Q4's original 21-domain, ~4,500-pick pool.
- **Subjective bucketing, again.** The music region+era lookup (`MUSICIAN`, `COMPOSER`,
  `SONG`, `ALBUM` in `r3b_oos_laws.py`) is hand-coded from general knowledge exactly like
  `q4_culture.py` — no external gazetteer, no network access. 4 entities are flagged
  ambiguous (Max Richter, Anna Clyne, "One," "Rumours"); coverage is 100% (791/791) but
  correctness of any single call is bounded by recall, same caveat as R1 Q4.
  "ContemporaryClassical" as an era label answers "what tradition," not "what year" — a
  real simplification for composers whose careers span 40+ years, stated explicitly rather
  than smoothed over.
- **`sound`'s theme map is a one-off, hand-built taxonomy** (`SOUND_THEME`, 46 entities,
  100% covered) created specifically to give Law 1 a fair hearing against an aliasing
  granularity gap discovered mid-analysis (11 of 46 canonicalized `sound` entities were not
  actually merged by the shipped `data/aliases.json`, e.g. "rain on a rooftop" survived
  as a separate string from "rain on rooftop"). This is disclosed, not hidden, and the
  theme-level number is reported *alongside*, not instead of, the exact-entity number —
  the FAILED verdict holds either way.
- **Country-domain probe wording is unknown to this analysis** (only picks, not prompts,
  are available) — "favorite country" vs. "favorite country to visit" vs. "most admired
  country" would each plausibly produce different geometry; Japan's dominance and the
  Western-Europe-tourist-icon overrated cluster (France/Italy/Switzerland) both read like a
  travel/tourism framing, but this is inferred from the pick pattern, not confirmed from
  the prompt text.
- **Permutation tests use `aa.perm_test`** (20,000 reshuffles, two-sided except where noted
  one-sided for the group-level test) and the paper's own `norm_entropy` — same house-style
  methodology as every prior round, no scipy/pandas.

## What this means

Two Round-1 patterns were held to the highest bar available in this dataset — a prediction
written down before the test domains existed — and split cleanly:

- **Law 1 (sensory convergence) is FAILED out-of-sample.** `sound`, despite sitting
  squarely in the `design_sensory` group by every reasonable definition, converges no
  better than the panel's median domain, and the group-level "design_sensory is the most
  unifying group" claim itself stops being significant once tested on the expanded panel.
  The pattern that looked like "sensory experiences compel agreement" now looks more like
  "domains with a narrow, culturally-canonical answer space compel agreement" — season and
  cuisine happen to be sensory *and* narrow-answer-space; sound is sensory but has a wide,
  fragmented answer space (which surface is the rain hitting?); country and proglang are
  narrow-answer-space but not sensory at all, and converge just as hard. **A failed
  out-of-sample prediction is exactly the useful kind of negative result** — it shows the
  original mechanism was mis-specified (semantic category "sensory"), not that there was no
  mechanism at all (a different category, "narrow canonical answer set," survives and
  predicts better).
- **Law 2 (cultural geometry) is PARTIALLY confirmed, and the confirmation is more precise
  than the original.** The Asia/Japan-favorite skew is not just confirmed but the *single
  strongest replication in this report* when tested on a domain (`country`) where geography
  is the entity itself, not an inferred fact about a creator — and it independently
  reproduces Q4's fame-beats-geography mechanism (Japan: #1 favorite, #2 overrated) in data
  Q4 never saw. But the domain-conditional boundary (place domains: yes; media/person
  domains: no/reversed) also replicates, and the specific "overrated = American, not
  Western" refinement from R1 does **not** survive: two new domains later, "overrated"
  skews Western-*European* icons (France, Italy, Switzerland's `country`; Southern-Europe's
  Einaudi in `composer`) just as readily as American ones. **The right updated claim is
  narrower than R1's**: overrated skews toward whichever nation/artist/work has become the
  single most inescapable, textbook-canonical representative of its category — that
  representative is disproportionately American in R1's original cultural-artifact domains,
  but disproportionately Western-European-tourist-icon in the new `country` domain, and the
  common thread is canonicity/fame, not nationality per se.

**Confirmed out-of-sample predictions upgrade a pattern from "a finding on this dataset" to
something closer to a law** — a rule about *how these models are trained and prompted* that
should keep holding on the next new domain, not just this one. By that standard: the
Asia/Japan-favorite-skew-in-place-domains piece of Law 2 has now earned that status. The
"sensory domains converge" framing of Law 1 has not, and should be retired in favor of the
narrower, better-supported "narrow canonical answer space" mechanism this test surfaced.
