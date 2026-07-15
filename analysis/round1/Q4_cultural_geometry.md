# Q4 — The cultural & geographic geometry of AI taste: the "AIs really like Asia" hunch, done honestly

Source: `data/extracted.jsonl` (9,395 rows, `bookcover`/`chair` excluded), computed with
`analysis/lib/q4_culture.py` (region lookup + all stats below) + `analysis/lib/aa.py`
(permutation tests). Derived table: `analysis/data/q4_region_by_domain.csv`. All numbers
in this doc are reproducible by running `python3 analysis/lib/q4_culture.py` from the repo
root.

## Question

Content-H1 found favorites are ~20% Asia-coded vs ~3% for overrated in "cultural" domains
(a ~7x ratio), using ad-hoc keyword matching. The director's grounding pass separately
found a flat 5.6% Asia share across ALL favorites (diluted by 44 mostly-non-geographic
domains) and flagged that the real test has to be **domain-conditional**. Q4's job: build
an auditable, non-keyword region lookup (nationality/origin-of-creator or location-of-place,
not string matching on the entity name), re-run the favorite-vs-overrated Asia comparison
properly, test it for significance, and — per the brief — broaden past Asia to the full
cultural distribution and fold in the temporal (H4) angle.

## Method

**Domain set (21 "culture-bearing" domains + 1 control).** A domain qualifies if its picks
carry a knowable region: either the pick *is* a place (`city`, `uscity`, `street`,
`building`, `monument`), or it's a cultural artifact/person whose creator's nationality or a
dish's culinary origin is a fact, not an opinion (`cuisine`, `dish`, `architect`, `film`,
`book`, `novelist`, `album`, `painting`, `artmovement`, `religioustext`, `boardgame`, `poem`,
`tvshow`, `videogame`, `childrensbook`, `philosopher`, `historian`). This matches
content-H1's 20-domain set plus `album` (explicitly requested in this Q4's brief).
**Excluded**: economist/scientist/mathematician/theologian/computerscientist/airesearcher/
actor/actress/psychologist (already covered by Q3/Q5, and — checked directly — 100%
Western/American picks in this dataset, so they'd only pad the Western denominator) and
play/musical (same reason: near-100% Anglo-American theatre). `uscity` is carried as a
**control**, not part of the pooled Asia test, since it's North-America by construction
(models were asked for a US city) — it shows what a domain that's Asia-proof-by-definition
looks like, for comparison.

**Region lookup.** `analysis/lib/q4_culture.py` hand-codes every distinct entity
(post-canonicalization, ~460 distinct entity strings across the 21 domains) to one of 13
regions: Japan, East-Asia, Southeast-Asia, South-Asia, Middle-East, Western-Europe,
Southern-Europe, Eastern-Europe, North-America, Latin-America, Africa, Oceania, Unknown.
Rule: **created works are coded by their creator's/studio's origin, not the work's
setting or title language** (e.g. a French-directed film about Japan would be
Western-Europe; a Nintendo game with an English title is Japan). **Places are coded by
where they are.** "Asia" for headline stats = Japan + East-Asia + Southeast-Asia +
South-Asia; **Middle-East is tracked separately and NOT folded into "Asia"** (matches the
director's own "Japan/East Asia" framing) — a real, stated choice, not a fact. Ancient
Greece/Rome are folded into Southern-Europe (merges antiquity with modern-Mediterranean
geography, not chronology — flagged again below).

Every one of the ~460 entity codings is a manual judgment call from general knowledge (no
external gazetteer, no network access). **44 entity-domain pairs are explicitly flagged
`AMBIGUOUS`** in the code with a one-line reason (e.g. "chess" coded South-Asia per its
chaturanga origin though it carries no felt cultural marker today; Kazuo Ishiguro coded
Western-Europe for his British literary identity though he was born in Japan; "Go" coded
East-Asia/China though it's played under its Japanese name). These affect 361 of 4,512
picks (8.0%). A **robustness run excluding every flagged entity entirely** is reported
below — the headline result is unchanged.

**Coverage**: of 4,512 tagged picks across the 21 pooled domains, only **6 (0.13%)**
resolved to `Unknown` — 3× "Rue Targui", 1× "Rue Outiwi" (unidentifiable streets), 1×
"truffle-infused dishes" (too generic a name to assign a base cuisine), 1× "Tsuro" (a
board game with Japanese-evocative branding but a US designer, left unresolved rather than
guessed). Unknown is a real bucket in the code (`region_for` never drops or guesses past
what's coded) — it's just rare, because most AI picks in these domains are famous,
identifiable things.

**Significance**: permutation tests via `aa.perm_test` (20,000 reshuffles, two-sided),
treating each pick as a 1/0 "is this region" indicator, favorite group vs overrated group.

## Results

### 1. Headline: pooled Asia share, favorite vs overrated

Across all 21 domains (n=2,315 favorite picks, n=2,197 overrated picks):

| | favorite | overrated | ratio | diff | perm p |
|---|---|---|---|---|---|
| **Asia (Japan+E.Asia+SE Asia+S.Asia)** | **25.1%** (582) | **6.4%** (141) | **3.9×** | +18.7pp | **p=0.00005** |

This is highly significant but is **not** the ~7× the crude keyword method found. Digging
into why matters more than the headline number (see "Why the ratio moved" below).

Region breakdown of that Asia share:

| region | favorite | overrated |
|---|---|---|
| Japan | 14.6% (337) | 4.8% (105) |
| East-Asia | 6.8% (157) | 0.7% (16) |
| South-Asia | 3.0% (70) | 0.9% (20) |
| Southeast-Asia | 0.8% (18) | 0.0% (0) |
| Middle-East (tracked, not counted as "Asia") | 1.8% (42) | 5.7% (125) |

**Robustness**: excluding all 44 ambiguous-flagged entities entirely (n_fav=2,062,
n_ovr=2,089): Asia share 24.9% vs 6.7%, diff +18.2pp, p=0.00005 — essentially unchanged.
The finding does not depend on any single contested call (Go, chess, Ishiguro, etc.).

### 2. Why the ratio is 3.9×, not 7×: it splits cleanly into two regimes

Splitting the 21 domains into **place/cuisine-marker domains** (cuisine, dish, city,
street, building, monument, architect, religioustext, boardgame — 9 domains where the pick
*itself* signals a place or civilizational tradition) vs **media/person domains** (film,
book, novelist, album, painting, artmovement, poem, tvshow, videogame, childrensbook,
philosopher, historian — 12 domains where Asian origin is a fact about the creator, not a
visible feature of the pick):

| subgroup | favorite Asia% | overrated Asia% | ratio | diff | perm p |
|---|---|---|---|---|---|
| **Place/cuisine (9 domains, n≈970 each)** | **53.0%** | **5.0%** | **10.7×** | +48.0pp | p=0.00005 |
| **Media/person (12 domains, n≈1,300 each)** | **4.9%** | **7.6%** | **0.7×** (reversed) | −2.6pp | p=0.0066 |

The place/cuisine version of the hunch is *stronger* than the original 7× estimate. The
media/person version **reverses**: Asian-origin picks are (mildly, significantly) more
common in overrated than favorite there. Almost the entire media/person "overrated Asia"
mass is two entities: **The Legend of Zelda: Breath of the Wild + Ocarina of Time**
(Nintendo, Japan; 52+12=64 overrated mentions in `videogame`) and **Haruki Murakami** (29
overrated mentions in `novelist`, ~all of the domain's Asia signal). Both are also the
single most cross-model-agreed "most famous representative of the category" in their
domain (content-H7's mechanism) — i.e. once an Asian-origin cultural product becomes the
globally-canonical, inescapable one, models critique it exactly the way they critique
Gehry, *The Catcher in the Rye*, or *Friends*. Fame-driven critique, not culture, is doing
the work there.

Per-domain favorite/overrated Asia rates (all 21 domains, full detail in the CSV):

| domain | favorite Asia% | overrated Asia% |
|---|---|---|
| cuisine | 96.9% (62/64) | 2.4% (2/82) |
| religioustext | 80.8% (59/73) | 29.6% (34/115)* |
| city | 83.7% (87/104) | 0.0% (0/89) |
| boardgame | 71.9% (69/96)† | 0.0% (0/108) |
| architect | 56.5% (61/108) | 0.0% (0/111) |
| dish | 79.2% (103/130) | 9.2% (12/131) |
| monument | 35.5% (44/124) | 0.0% (0/115) |
| film | 27.5% (33/120) | 0.0% (0/109) |
| videogame | 26.9% (28/104) | 53.3% (64/120) — reversed |
| street | 21.0% (30/143) | 0.0% (0/104) |
| novelist | 0.0% (0/119) | 26.1% (29/111) — reversed |
| album | 3.3% (4/122) | 0.0% (0/123) |
| building/painting/artmovement/book/poem/tvshow/childrensbook/philosopher/historian | ~0% | ~0% (no Asia signal either direction) |

\* `religioustext` is genuinely contested on both sides — Tao Te Ching and Bhagavad Gita
each get nominated as both favorite and overrated (echoes content-H6). † boardgame's 71.9%
depends partly on coding "chess" as South-Asia (chaturanga origin, flagged ambiguous); with
chess excluded it's still 55.2% (matches content-H1's original 55% almost exactly), so the
domain-level story is unaffected by that one call.

### 3. Broadening beyond Asia: the full cultural distribution

Pooled full region distribution across the 21 domains:

| region | favorite | overrated |
|---|---|---|
| North-America | 27.1% (627) | **46.3% (1,017)** |
| Western-Europe | 27.2% (629) | 27.4% (601) |
| Southern-Europe | 13.6% (315) | 10.2% (224) |
| Japan | 14.6% (337) | 4.8% (105) |
| East-Asia | 6.8% (157) | 0.7% (16) |
| Middle-East | 1.8% (42) | 5.7% (125) |
| South-Asia | 3.0% (70) | 0.9% (20) |
| Latin-America | 2.7% (62) | 1.0% (21) |
| Eastern-Europe | 2.0% (47) | 1.1% (25) |
| Oceania | 0.2% (5) | 1.9% (42) |
| Southeast-Asia | 0.8% (18) | 0.0% (0) |
| Africa | 0.04% (1) | 0.0% (0) |
| Unknown | 0.2% (5) | 0.05% (1) |

Three things worth pulling out:

- **Favorites are genuinely global**: no single region breaks 30% (West total
  Western-Europe+Southern-Europe+North-America = 67.9%, Asia total = 25.2%, everything else
  small but present). Favorites spread across essentially every region tracked except
  Africa (only one pick anywhere in these 21 domains resolves there — Ibn Khaldun,
  `historian`, itself an ambiguous Middle-East/North-Africa border call) and Oceania
  (5 picks, essentially nothing).
- **Overrated is disproportionately North American *specifically*, not generically
  "Western."** Western-Europe (27.2%→27.4%) and Southern-Europe (13.6%→10.2%) barely move
  or drop slightly between favorite and overrated. **North-America nearly doubles its share
  (27.1%→46.3%, +19.2pp)** — the single largest shift of any region in either direction.
  Nearly half of all overrated nominations in these 21 domains are American in origin
  (Gehry, Catcher in the Rye, Friends, Monopoly, Avatar, Forrest Gump, most of `uscity`'s
  own overrated list, etc.).
- **Oceania and Middle-East both spike in overrated relative to favorite** (Oceania
  0.2%→1.9%, driven almost entirely by the Sydney Opera House being `building`'s #2
  overrated pick; Middle-East 1.8%→5.7%, driven by Book of Revelation/Leviticus/Proverbs in
  `religioustext`, Burj Khalifa, and Dubai). Neither region has a meaningful favorite-side
  presence to counterbalance it — they're "overrated-only" regions in this dataset, the
  mirror image of what Japan/East-Asia are in the place/cuisine domains.

### 4. Temporal geometry (H4 fold-in): 1960s loved, 1980s reviled

From the `decade` domain (independently recomputed, not just cited from H4), n=76 favorite
+ n=71 overrated non-null decade picks:

| decade | favorite | overrated |
|---|---|---|
| 1920s | 25.0% (19) | 0.0% (0) |
| 1950s | 7.9% (6) | 36.6% (26) |
| 1960s | 56.6% (43) | 1.4% (1) |
| 1970s | 10.5% (8) | 0.0% (0) |
| 1980s | 0.0% (0) | **62.0% (44)** |

Confirms content-H4 almost exactly (minor 1-count differences from an independent
recompute are immaterial). Favorite mass sits almost entirely in 1920s+1960s (interwar
modernism + a countercultural/design-and-science decade); overrated mass is 1980s+1950s.
This is orthogonal to the Asia finding (it's a separate axis: *when*, not *where*) but
consistent in shape — both show a sharp, non-uniform, era/region-specific split rather than
a smooth gradient.

## Verdict

**The director's hunch is TRUE, significant, and larger than first estimated — but only in
its precise, domain-conditional form, and it does NOT generalize to "AIs like Asian
things" broadly.**

1. Pooled across all 21 culture-bearing domains: favorites are **25.1% Asia-coded vs 6.4%**
   for overrated (**3.9×**, p=0.00005). Real, large, highly significant — but smaller than
   content-H1's original ~7× estimate.
2. The 7× estimate was an artifact of H1's **string-keyword** method, which could only catch
   Asian-origin picks whose name literally contains a Japan/China/etc. keyword. It missed
   Nintendo's Zelda games (no "Japan" in the title) entirely. Once a proper **origin-based
   lookup** (this script) is used instead of keyword matching, those entities get correctly
   coded — and they turn out to run in the *opposite* direction (Zelda/Murakami are
   overrated favorites, not favorited ones), which pulls the pooled ratio down from ~7× to
   ~3.9×.
3. Splitting by domain *type* resolves the apparent contradiction cleanly: restricted to
   **place/cuisine/civilizational-marker domains** (cuisine, city, architecture, streets,
   monuments, religious texts, board games), the skew is **10.7×** (53.0% vs 5.0%,
   p=0.00005) — stronger than the original hunch. Restricted to **media/person domains**
   where Asian origin is a fact about a creator rather than a visible feature of the pick,
   the skew **reverses** (4.9% vs 7.6%, p=0.0066) — driven by exactly the two Asian-origin
   entities famous enough to be "the most famous representative of the category"
   (Zelda, Murakami), which content-H7 already showed is the actual overrated-nomination
   mechanism regardless of geography.

**Precise form of the claim**: *AI models romanticize an imagined Japan/East Asia as a
place, cuisine, spiritual-philosophical tradition, and architectural style — but they do
not extend any special affection to Asian-origin cultural products once those products
become globally famous enough to be nominated as "the overrated one," where fame beats
geography every time.* Separately, "overrated" as a category is disproportionately
**American** in origin (46.3% vs 27.1% favorite) — not generically Western, since Western
and Southern Europe's shares are nearly flat between the two probes.

## Caveats

- **This is subjective bucketing**, hand-coded from general knowledge, not run against an
  external gazetteer or biographical database (no network access in this environment).
  Coverage is very high (99.87% of picks resolved, 6/4,512 left honestly `Unknown`) but
  correctness of any individual call is only as good as the analyst's recall.
- **44 entity-domain pairs are flagged ambiguous** in the code (8.0% of picks) — contested
  cultural attributions (chess's South Asian vs. Persian vs. now-fully-globalized status;
  Kazuo Ishiguro British-vs-Japanese identity; "Go" coded China not Japan despite being
  played under a Japanese name; Ludwig Mies van der Rohe German-vs-American career; several
  Portugal/Brazil street-name ambiguities). The headline pooled result is robust to
  dropping all of them (24.9% vs 6.7%, p=0.00005, vs. 25.1%/6.4% with them included) but a
  reader who disagrees with individual calls should expect single-domain numbers (like
  boardgame's 71.9%) to move more than the pooled headline.
- **Created-work region = creator's origin, not the work's setting or genre register.**
  This is a defensible but real choice; it's why Zelda counts as "Japan" even though its
  aesthetic register (medieval European fantasy) carries no visible Japanese marker, and
  it's the single biggest driver of the media/person reversal in part 2.
- **Ancient Greece/Rome folded into "Southern-Europe"** merges classical antiquity with
  modern Mediterranean geography — a simplification stated explicitly in the code, not
  hidden.
- **Middle-East is tracked but excluded from the "Asia" aggregate** by convention (matches
  the director's original Japan/East-Asia framing) — geographically debatable, since parts
  of the Middle East are technically Asia. Flagged, not smoothed over.
- Small-n domains (e.g. Southeast-Asia's 18 favorite / 0 overrated picks is almost entirely
  Vietnamese/Thai dishes and streets) should be read as descriptive color, not
  independently significance-tested.

## What this means

The "AIs like Asia" intuition survives contact with a rigorous test — more strongly than
first estimated, in fact — but only for a specific slice of "Asia": an aestheticized,
restrained, contemplative Japan/East Asia experienced through cuisine, place, architecture,
and spiritual-philosophical texts (Kyoto, Tadao Ando's concrete minimalism, ramen, Go, the
Tao Te Ching). That register lines up neatly with content-H5's finding that "elegant,"
"minimalist," and "restrained" are the dominant favorite-vocabulary words — this may be
less "AIs like Asia" and more "AIs have converged on a restrained-minimalist aesthetic
ideal that they consistently locate in Japan/East Asia when asked for a place, food, or
building, but not a special fondness for Asian-origin culture in general." The moment an
Asian-origin pick becomes a globally ubiquitous pop-culture object (a Nintendo
blockbuster, a bestselling novelist), it gets swept into the same "most famous, hence
overrated" bucket as Gehry or *Friends* (content-H7) — geography stops mattering and fame
takes over. Meanwhile "overrated" itself skews American specifically, not Western broadly,
a sharper and more falsifiable claim than "AIs reject the canon" — they reject the
*American* canon in particular, while treating European canon more gently.
