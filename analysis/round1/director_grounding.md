# Round 1 — Director's-hunch grounding pass (independent of subagents)

Quick numbers I computed directly to calibrate curation. Method notes inline; all from
`analysis/lib/aa.py` over `data/summary.json` + `data/extracted.jsonl` (9,262 non-refused,
canonicalized rows). These are **descriptive**, not yet significance-tested.

## Hunch 1 — "remarkable convergence"  → PARTLY TRUE, and it's structured
- Mean pairwise model overlap (off-diagonal of the 13×13 `overlap` matrix): **0.181**.
- **Within-family 0.224 vs between-family 0.173** — models from the same lab agree ~30%
  more than across labs, but cross-lab agreement is still well above zero. So: real global
  convergence, plus a detectable "house style" per lab. Both effects are present.

## Hunch 1b — convergence is DOMAIN-driven, not uniform
Cross-model consensus = fraction of the 13 models whose modal pick is the single most
common modal pick, per (domain, probe):
- **Near-unanimous**: childrensbook/overrated → *The Giving Tree* (1.00), season/favorite →
  *autumn* (0.92), cuisine/favorite → *Japanese cuisine* (0.92), smell/favorite →
  *petrichor* (0.85), typeface/overrated → *Helvetica* (0.85), architect/overrated →
  *Frank Gehry* (0.92).
- **Highly contested**: tvshow/favorite → *Twin Peaks* (0.15), object/overrated → *French
  press* (0.15), album/favorite → *Kind of Blue* (0.23), novelist/favorite → *Italo
  Calvino* (0.23), dish/overrated → *macaron* (0.23).
→ The interesting story isn't "AIs converge" flat — it's **which domains force convergence
  (sensory/seasonal/canonical) vs which fracture (personal-canon domains: albums, novels, TV).**

## Hunch: favorite vs overrated asymmetry → TRUE and clean
- Cross-model consensus **favorite = 0.461, overrated = 0.550**. Models agree **~19% more on
  what is OVERRATED than on what they love.** Intuition: many idiosyncratic ways to love,
  one shared target for "the overhyped canonical thing" (Gatsby, Gehry, Helvetica, Friends).
- Within-model self-consistency (mean cell entropy): favorite 0.230 vs overrated 0.215 —
  same direction, models are slightly more decisive about the overrated pick too.

## Hunch 2 — "AIs really like Asia" → NEEDS FRAMING; global number is modest
- Crude keyword bucket (japan/tokyo/ando/kurosawa/murakami/zen/china/korea/india/ramen/…):
  **5.6% of all favorites (267/4740).** That's low *because favorites span 45 domains, most
  non-geographic.* The real test must be **domain-conditional**: within culture/place-bearing
  domains (cuisine, city, architect, film, building), is Asia (esp. Japan) over-picked vs a
  sensible base rate? Japanese cuisine at 0.92 consensus is the anchor example. Flag honestly:
  the flat 5.6% tempers the hunch; the domain-conditional version is where to look.

## Data hygiene note
- Data contains **45 domains**, not 43: two legacy/pilot domains — **`bookcover`** and
  **`chair`** — appear in extracted.jsonl but not in the shipped `config.js` DOMAINS. Decide
  whether to include or exclude from headline analysis (recommend: exclude from cross-domain
  headline stats, report separately, since they weren't part of the final panel).
