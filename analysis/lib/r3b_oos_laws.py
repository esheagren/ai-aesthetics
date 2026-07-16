"""R3B — out-of-sample validation of two Round-1 "laws" on the v6 held-out domains.

The v6 collection added 7 brand-new domains to the panel *after* Round 1's laws were
written: sound, musician, composer, song, country, director, proglang. This script tests
whether two Round-1 patterns generalize to these never-seen-during-discovery domains:

  LAW 1 — "Sensory domains compel near-unanimous convergence"
          (R1 Q1: season->autumn 92%, smell->petrichor 85%, design_sensory = most-unifying
          group). Prediction: the new sensory domain `sound` should be near-unanimous too.

  LAW 2 — "Cultural geometry: favorites skew Asian in culture/place domains; overrated
          skews Western/American" (R1 Q4: 53.0% Asia favorite vs 5.0% overrated in
          place/cuisine domains, 10.7x; pooled overrated is 46.3% North-America vs 27.1%
          favorite). Tested here on: (a) music (musician, composer, song + legacy album),
          with an inline region+era lookup; (b) the new `country` domain directly.

Everything needed to reproduce every number in analysis/round3/R3B_out_of_sample_laws.md
lives in this one file. No network, no scipy/pandas -- python3 + numpy + stdlib only, per
house style (see analysis/DATA_DICTIONARY.md). Run:

    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/r3b_oos_laws.py
"""
import sys, os, csv, json
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

ROOT = aa.ROOT
DATA_OUT = os.path.join(ROOT, "analysis", "data")

LEGACY_DOMAINS = {"bookcover", "chair"}
NEW_V6_DOMAINS = {"sound", "musician", "composer", "song", "country", "director", "proglang"}

# =============================================================================
# Shared machinery (mirrors analysis/lib/q2_asymmetry.py's two convergence
# metrics, reimplemented here so this file is self-contained per the brief).
# =============================================================================

def build_dist(recs, domains=None):
    """dist[domain][probe][model] = Counter(entity_canon), non-empty picks only."""
    dist = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))
    for r in recs:
        d, p, m, e = r["domain"], r["probe"], r["model"], r["entity_canon"]
        if d in LEGACY_DOMAINS:
            continue
        if domains is not None and d not in domains:
            continue
        if not e:
            continue
        dist[d][p][m][e] += 1
    return dist


def modal_agreement(dist_dp):
    """Metric (a) -- cross-model consensus: fraction of PRESENT models whose own
    modal pick equals the field's plurality-winning pick. This is exactly the
    metric behind R1's headline numbers (season->autumn 92%, smell->petrichor 85%).
    Returns (frac, n_models_present, winning_entity)."""
    modes = {}
    for m, c in dist_dp.items():
        if not c:
            continue
        top = c.most_common()
        maxc = top[0][1]
        winners = sorted(e for e, cnt in top if cnt == maxc)  # deterministic tie-break
        modes[m] = winners[0]
    n_present = len(modes)
    if n_present == 0:
        return 0.0, 0, None
    tally = Counter(modes.values())
    win_entity, win_count = tally.most_common(1)[0]
    return win_count / n_present, n_present, win_entity


def mean_cell_entropy(dist_dp):
    """Metric (b) -- mean of per-model normalized Shannon entropy over that
    model's own pick distribution. Lower = more decisive/consensual. Reported
    alongside metric (a) because FINDINGS.md's cross-cutting caveat #2 warns
    that agreement claims should survive a metric swap."""
    vals = [aa.norm_entropy(c) for c in dist_dp.values() if c]
    return (sum(vals) / len(vals)) if vals else None


def domain_convergence_table(recs, domains):
    """Returns dict[domain] -> {favorite: {frac, n, winner, entropy}, overrated: {...}}"""
    dist = build_dist(recs, domains)
    out = {}
    for d in domains:
        out[d] = {}
        for probe in ("favorite", "overrated"):
            frac, n, winner = modal_agreement(dist[d][probe])
            ent = mean_cell_entropy(dist[d][probe])
            out[d][probe] = {"modal_frac": frac, "n_models": n, "winner": winner, "entropy": ent}
    return out


# =============================================================================
# LAW 1 -- sensory convergence: does `sound` land among the high-convergence
# domains, as the design_sensory group's R1 track record predicts?
# =============================================================================

# `sound`'s canonicalized entities cluster tightly around a handful of THEMES
# (rain-on-a-surface, ocean, fire, vinyl, nature/leaves, mechanical/domestic,
# single musical note) even though data/aliases.json only merges *exact*
# near-duplicate phrasings (e.g. "rain on a window" + "rain tapping against a
# window at night" -> "rain on window at night"), not different surfaces of
# the same theme ("rain on window at night" stays distinct from "rain on
# rooftop"). A literal exact-entity modal-fraction can therefore understate
# convergence on the THEME "rain sound" even where the field is thematically
# unanimous. We report both levels: exact-canonical-entity (comparable
# apples-to-apples with every other domain in the panel) and theme-level
# (sound-specific, to check whether the exact-entity number is an artifact of
# aliasing granularity or a real finding).
SOUND_THEME = {
    # rain family
    "rain on window at night": "rain", "rain on rooftop": "rain",
    "rain on a metal roof": "rain", "rain on a glass skylight": "rain",
    "rain on a tin roof": "rain", "rain on a tent roof": "rain",
    "rain on a roof at night": "rain", "rain on a still lake": "rain",
    "rain on a windowpane at night": "rain", "sound of rain falling on leaves": "rain",
    "rain on roof or window": "rain", "rainfall patter": "rain",
    "distant thunder before summer storm": "rain", "distant thunder": "rain",
    "hush after snowfall": "rain", "rainfall": "rain",
    # additional raw variants that data/aliases.json did NOT fold into a
    # canonical form (a pre-existing gap in the shipped alias table for this
    # brand-new domain, discovered by auditing every distinct entity_canon
    # against this dict) -- added here so the theme-level number isn't
    # artificially deflated by leftover near-duplicate phrasings:
    "rain on a rooftop": "rain", "rain on tin roof": "rain",
    "rain tapping on a window": "rain", "the sound of rain on a tin roof": "rain",
    "the soft patter of rain against a windowpane": "rain",
    "a lone cello playing a low c note": "instrument",
    "a single piano key struck in an empty concert hall": "instrument",
    "the sound of a single piano key being pressed in an otherwise silent room": "instrument",
    "the soft crackle of a vinyl record as the needle settles into the groove": "vinyl",
    "creak-and-settle of an old wooden building": "mechanical",
    "ship's foghorn at dawn": "mechanical",
    # ocean family
    "ocean waves crashing on the shore": "ocean", "ocean waves gently crashing on shore": "ocean",
    "ocean waves on beach": "ocean", "waves collapsing on shore at night": "ocean",
    "ocean waves": "ocean",
    # fire / hearth family
    "crackling fireplace": "fire", "crackling campfire": "fire",
    # vinyl / analog-media family
    "vinyl record crackle": "vinyl",
    # nature / leaves / wind family
    "rustling of leaves in a soft breeze": "nature", "rustling of leaves in a forest": "nature",
    "dry autumn leaves rustling across asphalt": "nature", "wind chimes": "nature",
    "loon call": "nature", "quaking aspen leaves rustling in breeze": "nature",
    # mechanical / domestic / ambient objects
    "screen door closing in summer": "domestic", "screen door spring": "domestic",
    "book closing": "domestic", "book closing in quiet room": "domestic",
    "page turning": "domestic", "page turning in a physical book": "domestic",
    "pencil on paper": "domestic", "key turning in a lock": "domestic",
    "distant freight train whistle": "mechanical", "wooden structure creaking": "mechanical",
    "wooden ship hull creaking": "mechanical", "baby laughing": "domestic",
    "asmr whisper": "domestic",
    # single musical note / instrument
    "cello note": "instrument", "middle c piano note": "instrument",
}


def sound_theme(entity_canon):
    return SOUND_THEME.get(entity_canon, "other")


def sound_theme_coverage(recs):
    """Self-check: how many distinct `sound` entity_canon strings fall through
    to the 'other' bucket (i.e. aren't in SOUND_THEME at all)."""
    ents = set()
    for r in recs:
        if r["domain"] == "sound" and r["entity_canon"]:
            ents.add(r["entity_canon"])
    covered = sum(1 for e in ents if e in SOUND_THEME)
    return covered, len(ents)


def sound_theme_convergence(recs):
    """Same modal-agreement / entropy metrics as domain_convergence_table, but
    with `sound`'s entities collapsed to theme buckets first."""
    dist = defaultdict(lambda: defaultdict(Counter))
    for r in recs:
        if r["domain"] != "sound" or not r["entity_canon"]:
            continue
        dist[r["probe"]][r["model"]][sound_theme(r["entity_canon"])] += 1
    out = {}
    for probe in ("favorite", "overrated"):
        frac, n, winner = modal_agreement(dist[probe])
        ent = mean_cell_entropy(dist[probe])
        out[probe] = {"modal_frac": frac, "n_models": n, "winner": winner, "entropy": ent}
    return out


def group_permutation_test(conv_table, group_of, target_group, probe="favorite",
                            metric="modal_frac", n=20000, seed=7):
    """Is `target_group`'s mean metric value (across its domains) higher (for
    modal_frac) / lower (for entropy) than a same-size random subset of all
    scored domains would give by chance? Shuffle domain->group labels (group
    sizes preserved), 20000 draws, one-sided p in the direction R1 predicts."""
    import random
    rng = random.Random(seed)
    domains = list(conv_table.keys())
    vals = {d: conv_table[d][probe][metric] for d in domains if conv_table[d][probe][metric] is not None}
    domains = [d for d in domains if d in vals]
    group_size = sum(1 for d in domains if group_of.get(d) == target_group)
    obs_group_vals = [vals[d] for d in domains if group_of.get(d) == target_group]
    obs = sum(obs_group_vals) / len(obs_group_vals)
    higher_is_better = (metric == "modal_frac")  # entropy: lower is more convergent
    cnt = 0
    pool = domains[:]
    for _ in range(n):
        rng.shuffle(pool)
        sample = pool[:group_size]
        v = sum(vals[d] for d in sample) / group_size
        if higher_is_better:
            if v >= obs - 1e-12:
                cnt += 1
        else:
            if v <= obs + 1e-12:
                cnt += 1
    p = (cnt + 1) / (n + 1)
    return obs, p, group_size


# =============================================================================
# LAW 2a -- music cultural geometry (musician, composer, song, + legacy album)
# Auditable region + era lookup, built the same way as
# analysis/lib/q4_culture.py's per-domain dicts: hand-coded from general
# knowledge, offline, every entity assigned (never silently dropped), flagged
# AMBIGUOUS where the call is genuinely contestable.
# =============================================================================
REGIONS = [
    "Japan", "East-Asia", "Southeast-Asia", "South-Asia", "Middle-East",
    "Western-Europe", "Southern-Europe", "Eastern-Europe",
    "North-America", "Latin-America", "Africa", "Oceania", "Unknown",
]
ASIA_REGIONS = {"Japan", "East-Asia", "Southeast-Asia", "South-Asia"}

# Era buckets (coarse, defensible from general knowledge; the point/decade of
# the artist's primary output or the work's release/composition):
#   Baroque            ~1600-1750
#   Romantic-19thC     ~1800-1900
#   1960s / 1970s / 1980s / 1990s / 2000s / 2010s  (pop/rock by decade of the pick)
#   ContemporaryClassical  living-tradition concert/film composers, ~1970s-present
#     (kept separate from pop-by-decade because these composers' *entire career*
#     spans decades and the "decade of a specific work" is less meaningful than
#     for a 3-minute pop single; era here answers "what tradition", not "what year")

MUSICIAN = {
    # entity_canon: (region, era)
    "johann sebastian bach": ("Western-Europe", "Baroque"),
    "brian eno": ("Western-Europe", "1970s"),
    "bob dylan": ("North-America", "1960s"),
    "david bowie": ("Western-Europe", "1970s"),
    "björk": ("Western-Europe", "1990s"),  # Iceland; folded into Western-Europe per q4_culture's ALBUM convention (homogenic)
    "kate bush": ("Western-Europe", "1980s"),
    "joni mitchell": ("North-America", "1970s"),  # Canadian
    "ed sheeran": ("Western-Europe", "2010s"),
    "taylor swift": ("North-America", "2010s"),
    "the beatles": ("Western-Europe", "1960s"),
    "bruce springsteen": ("North-America", "1970s"),
    "drake": ("North-America", "2010s"),  # Canadian
    "u2": ("Western-Europe", "1980s"),  # Ireland
    "coldplay": ("Western-Europe", "2000s"),
    "justin bieber": ("North-America", "2010s"),  # Canadian
    "bono": ("Western-Europe", "1980s"),  # U2 frontman, Ireland
}

COMPOSER = {
    "caroline shaw": ("North-America", "ContemporaryClassical"),
    "arvo pärt": ("Eastern-Europe", "ContemporaryClassical"),  # Estonia
    "max richter": ("Western-Europe", "ContemporaryClassical"),  # German-born, UK-based -- AMBIGUOUS
    "anna thorvaldsdottir": ("Western-Europe", "ContemporaryClassical"),  # Iceland
    "philip glass": ("North-America", "ContemporaryClassical"),
    "john adams": ("North-America", "ContemporaryClassical"),
    "anna clyne": ("Western-Europe", "ContemporaryClassical"),  # UK-born, US-based -- AMBIGUOUS
    "steve reich": ("North-America", "ContemporaryClassical"),
    "thomas adès": ("Western-Europe", "ContemporaryClassical"),
    "ludovico einaudi": ("Southern-Europe", "ContemporaryClassical"),  # Italy
    "hans zimmer": ("Western-Europe", "ContemporaryClassical"),  # Germany, film scores
    "eric whitacre": ("North-America", "ContemporaryClassical"),
    "john williams": ("North-America", "ContemporaryClassical"),
}

SONG = {
    "clair de lune": ("Western-Europe", "Romantic-19thC"),  # Debussy, c. 1890-1905
    "bohemian rhapsody": ("Western-Europe", "1970s"),  # Queen, 1975
    "space oddity": ("Western-Europe", "1960s"),  # Bowie, 1969
    "everything in its right place": ("Western-Europe", "2000s"),  # Radiohead, Kid A 2000
    "hallelujah": ("North-America", "1980s"),  # Leonard Cohen, Canada, 1984
    "pyramid song": ("Western-Europe", "2000s"),  # Radiohead, 2001
    "a day in the life": ("Western-Europe", "1960s"),  # Beatles
    "one more time": ("Western-Europe", "2000s"),  # Daft Punk, France, 2000
    "god only knows": ("North-America", "1960s"),  # Beach Boys
    "paranoid android": ("Western-Europe", "1990s"),  # Radiohead, 1997
    "everybody wants to rule the world": ("Western-Europe", "1980s"),  # Tears for Fears
    "enjoy the silence": ("Western-Europe", "1990s"),  # Depeche Mode, 1990
    "one": ("Western-Europe", "1990s"),  # U2, Ireland, 1991 -- AMBIGUOUS (could be Metallica, US, 1991; coded to U2 given the field's Radiohead/Bowie/Beatles-heavy taste profile)
    "cello suite no. 1 in g major, bwv 1007 — i. prélude": ("Western-Europe", "Baroque"),  # Bach
    "once in a lifetime": ("North-America", "1980s"),  # Talking Heads, 1980
    "life on mars?": ("Western-Europe", "1970s"),  # Bowie, 1973
    "jóga": ("Western-Europe", "1990s"),  # Björk, Iceland, 1997
    "imagine": ("Western-Europe", "1970s"),  # Lennon, 1971
    "wonderwall": ("Western-Europe", "1990s"),  # Oasis, 1995
    "shape of you": ("Western-Europe", "2010s"),  # Ed Sheeran, 2017
    "happy": ("North-America", "2010s"),  # Pharrell, 2013
    "hey jude": ("Western-Europe", "1960s"),  # Beatles, 1968
    "sweet caroline": ("North-America", "1960s"),  # Neil Diamond, 1969
    "my heart will go on": ("North-America", "1990s"),  # Celine Dion, Canada, 1997
    "despacito": ("Latin-America", "2010s"),  # Luis Fonsi, Puerto Rico, 2017
}

# ALBUM region reused/aligned with q4_culture.py's ALBUM dict (region only there);
# era added here.
ALBUM = {
    "(what's the story) morning glory?": ("Western-Europe", "1990s"),  # Oasis
    "abbey road": ("Western-Europe", "1960s"),  # Beatles
    "goldberg variations": ("Western-Europe", "Baroque"),  # Bach
    "homogenic": ("Western-Europe", "1990s"),  # Björk, Iceland
    "hotel california": ("North-America", "1970s"),  # Eagles
    "in rainbows": ("Western-Europe", "2000s"),  # Radiohead, 2007
    "in the aeroplane over the sea": ("North-America", "1990s"),  # Neutral Milk Hotel, 1998
    "kid a": ("Western-Europe", "2000s"),  # Radiohead, 2000
    "kind of blue": ("North-America", "1950s"),  # Miles Davis, 1959
    "loveless": ("Western-Europe", "1990s"),  # My Bloody Valentine, Ireland, 1991
    "ok computer": ("Western-Europe", "1990s"),  # Radiohead, 1997
    "random access memories": ("Western-Europe", "2010s"),  # Daft Punk, France, 2013
    "rumours": ("North-America", "1970s"),  # Fleetwood Mac -- AMBIGUOUS (British/American mixed band)
    "selected works of tatsuro yamashita": ("Japan", "1970s"),  # city pop
    "selected works of toshi ichiyanagi": ("Japan", "1960s"),  # avant-garde
    "sgt. pepper's lonely hearts club band": ("Western-Europe", "1960s"),  # Beatles
    "swan lake": ("Eastern-Europe", "Romantic-19thC"),  # Tchaikovsky, Russia
    "the dark side of the moon": ("Western-Europe", "1970s"),  # Pink Floyd
    "the wall": ("Western-Europe", "1970s"),  # Pink Floyd, 1979
    "thriller": ("North-America", "1980s"),  # Michael Jackson, 1982
}

MUSIC_DOMAIN_LOOKUP = {
    "musician": MUSICIAN, "composer": COMPOSER, "song": SONG, "album": ALBUM,
}
MUSIC_DOMAINS = list(MUSIC_DOMAIN_LOOKUP.keys())

MUSIC_AMBIGUOUS = {
    ("composer", "max richter"), ("composer", "anna clyne"),
    ("song", "one"), ("album", "rumours"),
}


def music_region_era(domain, entity_canon):
    table = MUSIC_DOMAIN_LOOKUP.get(domain, {})
    return table.get(entity_canon, ("Unknown", "Unknown"))


# =============================================================================
# LAW 2b -- `country` domain: direct country -> region lookup (countries ARE
# the entity, so this needs no creator-origin judgment call at all -- the
# cleanest possible test of the geometry).
# =============================================================================
COUNTRY_REGION = {
    "japan": "Japan",
    "iceland": "Western-Europe",   # Nordic; matches q4_culture's Björk/homogenic convention
    "portugal": "Southern-Europe",
    "france": "Western-Europe",
    "italy": "Southern-Europe",
    "switzerland": "Western-Europe",
    "monaco": "Western-Europe",
    "united states": "North-America",
}


def country_region(entity_canon):
    return COUNTRY_REGION.get(entity_canon, "Unknown")


# =============================================================================
# Analysis drivers
# =============================================================================

def run_law1(recs, S):
    print("=" * 78)
    print("LAW 1 -- sensory convergence: is `sound` near-unanimous like petrichor/autumn?")
    print("=" * 78)

    # All 50 domains (43 legacy + 7 new), scored on both metrics, favorite probe
    # is the one R1's headline sensory numbers use (season->autumn 92%,
    # smell->petrichor 85% are both favorite-probe numbers).
    all_domains = sorted(set(S["domains"]) - LEGACY_DOMAINS)
    conv = domain_convergence_table(recs, all_domains)

    ranked_fav = sorted(all_domains, key=lambda d: -conv[d]["favorite"]["modal_frac"])
    rank_of = {d: i + 1 for i, d in enumerate(ranked_fav)}
    n_domains = len(all_domains)

    sound_fav = conv["sound"]["favorite"]
    sound_ovr = conv["sound"]["overrated"]
    print(f"\n[sound] exact-canonical-entity level, n_domains_scored={n_domains}")
    print(f"  favorite:  modal_frac={sound_fav['modal_frac']:.3f} "
          f"({sound_fav['n_models']} models present, winner={sound_fav['winner']!r}) "
          f"entropy={sound_fav['entropy']:.3f}  rank={rank_of['sound']}/{n_domains}")
    print(f"  overrated: modal_frac={sound_ovr['modal_frac']:.3f} "
          f"({sound_ovr['n_models']} models present, winner={sound_ovr['winner']!r}) "
          f"entropy={sound_ovr['entropy']:.3f}")

    # theme-level (sound-specific granularity fix)
    covered, n_ents = sound_theme_coverage(recs)
    theme = sound_theme_convergence(recs)
    print(f"\n[sound] theme-level (rain/ocean/fire/vinyl/nature/domestic/mechanical/instrument/other), "
          f"coverage: {covered}/{n_ents} distinct entities explicitly themed ({covered/n_ents:.1%}), "
          f"rest bucketed 'other':")
    for probe in ("favorite", "overrated"):
        t = theme[probe]
        print(f"  {probe}: modal_frac={t['modal_frac']:.3f} ({t['n_models']} models) "
              f"winner={t['winner']!r} entropy={t['entropy']:.3f}")

    # Reference comparators: R1's canonical sensory exemplars, recomputed here
    # for an apples-to-apples check against the same pipeline.
    print("\n[reference] design_sensory domain members, favorite modal_frac (this pipeline):")
    sensory_domains = sorted(d for d in all_domains if aa.DOMAIN_GROUP.get(d) == "design_sensory")
    for d in sensory_domains:
        c = conv[d]["favorite"]
        print(f"  {d:12s} modal_frac={c['modal_frac']:.3f}  entropy={c['entropy']:.3f}  "
              f"rank={rank_of[d]:2d}/{n_domains}  winner={c['winner']!r}")

    # Group-level permutation test: is design_sensory (now including `sound`)
    # still higher-convergence than a random same-size set of domains?
    obs_mf, p_mf, gsize = group_permutation_test(conv, aa.DOMAIN_GROUP, "design_sensory",
                                                  probe="favorite", metric="modal_frac", n=20000, seed=7)
    obs_ent, p_ent, _ = group_permutation_test(conv, aa.DOMAIN_GROUP, "design_sensory",
                                                probe="favorite", metric="entropy", n=20000, seed=8)
    print(f"\n[group test] design_sensory (n={gsize} domains, incl. sound) vs random {gsize}-domain "
          f"subsets of all {n_domains}, favorite probe, 20000 shuffles:")
    print(f"  mean modal_frac: observed={obs_mf:.4f}, perm p (one-sided, higher-is-better)={p_mf:.5f}")
    print(f"  mean entropy:    observed={obs_ent:.4f}, perm p (one-sided, lower-is-better)={p_ent:.5f}")

    # Where does design_sensory rank among the 5 domain groups?
    print("\n[all 5 groups] mean favorite modal_frac / entropy, for context:")
    group_rows = []
    for g in sorted(set(aa.DOMAIN_GROUP.values())):
        ds = [d for d in all_domains if aa.DOMAIN_GROUP.get(d) == g]
        mfs = [conv[d]["favorite"]["modal_frac"] for d in ds]
        ents = [conv[d]["favorite"]["entropy"] for d in ds]
        row = (g, len(ds), sum(mfs) / len(mfs), sum(ents) / len(ents))
        group_rows.append(row)
        print(f"  {g:14s} n={len(ds):2d}  mean_modal_frac={row[2]:.3f}  mean_entropy={row[3]:.3f}")

    return {
        "all_domains": all_domains, "conv": conv, "rank_of": rank_of, "n_domains": n_domains,
        "sound_favorite": sound_fav, "sound_overrated": sound_ovr, "sound_theme": theme,
        "sensory_domains": sensory_domains,
        "group_test": {"obs_modal_frac": obs_mf, "p_modal_frac": p_mf,
                       "obs_entropy": obs_ent, "p_entropy": p_ent, "group_size": gsize},
        "group_rows": group_rows,
    }


def run_law2_music(recs):
    print("\n" + "=" * 78)
    print("LAW 2a -- music cultural geometry (musician, composer, song, album)")
    print("=" * 78)

    region_fav, region_ovr = Counter(), Counter()
    era_fav, era_ovr = Counter(), Counter()
    coverage_total = coverage_unknown = 0
    per_domain_rows = []
    for d in MUSIC_DOMAINS:
        d_region_fav, d_region_ovr = Counter(), Counter()
        for r in recs:
            if r["domain"] != d or not r["entity_canon"]:
                continue
            region, era = music_region_era(d, r["entity_canon"])
            coverage_total += 1
            if region == "Unknown":
                coverage_unknown += 1
            target_r = region_fav if r["probe"] == "favorite" else region_ovr
            target_e = era_fav if r["probe"] == "favorite" else era_ovr
            target_r[region] += 1
            target_e[era] += 1
            (d_region_fav if r["probe"] == "favorite" else d_region_ovr)[region] += 1
        per_domain_rows.append((d, d_region_fav, d_region_ovr))

    nf, no = sum(region_fav.values()), sum(region_ovr.values())
    print(f"\n[coverage] {coverage_total} tagged picks across {len(MUSIC_DOMAINS)} music domains, "
          f"{coverage_unknown} Unknown ({coverage_unknown / coverage_total:.2%})")
    print(f"[n] favorite n={nf}, overrated n={no}")

    print("\n[region distribution] pooled across music domains:")
    for region in REGIONS:
        f = region_fav.get(region, 0)
        o = region_ovr.get(region, 0)
        print(f"  {region:16s} favorite {f:4d} ({f/nf:5.1%})   overrated {o:4d} ({o/no:5.1%})")

    # Asia share test (mirrors Q4's headline metric exactly)
    fav_asia = [1 if music_region_era(d, r["entity_canon"])[0] in ASIA_REGIONS else 0
                for d in MUSIC_DOMAINS for r in recs
                if r["domain"] == d and r["entity_canon"] and r["probe"] == "favorite"]
    ovr_asia = [1 if music_region_era(d, r["entity_canon"])[0] in ASIA_REGIONS else 0
                for d in MUSIC_DOMAINS for r in recs
                if r["domain"] == d and r["entity_canon"] and r["probe"] == "overrated"]
    obs_asia, p_asia = aa.perm_test(fav_asia, ovr_asia, stat=lambda x: sum(x) / len(x), n=20000, seed=11)
    print(f"\n[Asia test] favorite {sum(fav_asia)}/{len(fav_asia)} ({sum(fav_asia)/len(fav_asia):.1%}) "
          f"vs overrated {sum(ovr_asia)}/{len(ovr_asia)} ({sum(ovr_asia)/len(ovr_asia):.1%}), "
          f"diff={obs_asia:+.4f}, perm p={p_asia:.5f}")

    # North-America ("American") share test (mirrors Q4's second headline claim)
    fav_na = [1 if music_region_era(d, r["entity_canon"])[0] == "North-America" else 0
              for d in MUSIC_DOMAINS for r in recs
              if r["domain"] == d and r["entity_canon"] and r["probe"] == "favorite"]
    ovr_na = [1 if music_region_era(d, r["entity_canon"])[0] == "North-America" else 0
              for d in MUSIC_DOMAINS for r in recs
              if r["domain"] == d and r["entity_canon"] and r["probe"] == "overrated"]
    obs_na, p_na = aa.perm_test(fav_na, ovr_na, stat=lambda x: sum(x) / len(x), n=20000, seed=12)
    print(f"\n[North-America test] favorite {sum(fav_na)}/{len(fav_na)} ({sum(fav_na)/len(fav_na):.1%}) "
          f"vs overrated {sum(ovr_na)}/{len(ovr_na)} ({sum(ovr_na)/len(ovr_na):.1%}), "
          f"diff={obs_na:+.4f}, perm p={p_na:.5f}")

    # Western total (North-America + Western-Europe + Southern-Europe) for a
    # broader "Western" framing, since Q4 found overrated skews specifically
    # American, not generically Western -- test whether that specific,
    # sharper claim replicates here too.
    WEST = {"North-America", "Western-Europe", "Southern-Europe"}
    fav_west = [1 if music_region_era(d, r["entity_canon"])[0] in WEST else 0
                for d in MUSIC_DOMAINS for r in recs
                if r["domain"] == d and r["entity_canon"] and r["probe"] == "favorite"]
    ovr_west = [1 if music_region_era(d, r["entity_canon"])[0] in WEST else 0
                for d in MUSIC_DOMAINS for r in recs
                if r["domain"] == d and r["entity_canon"] and r["probe"] == "overrated"]
    obs_w, p_w = aa.perm_test(fav_west, ovr_west, stat=lambda x: sum(x) / len(x), n=20000, seed=13)
    print(f"\n[Western(NA+WEur+SEur) test] favorite {sum(fav_west)}/{len(fav_west)} "
          f"({sum(fav_west)/len(fav_west):.1%}) vs overrated {sum(ovr_west)}/{len(ovr_west)} "
          f"({sum(ovr_west)/len(ovr_west):.1%}), diff={obs_w:+.4f}, perm p={p_w:.5f}")

    print("\n[era distribution] pooled across music domains:")
    all_eras = sorted(set(era_fav) | set(era_ovr))
    for era in all_eras:
        f = era_fav.get(era, 0)
        o = era_ovr.get(era, 0)
        print(f"  {era:20s} favorite {f:4d} ({f/nf:5.1%})   overrated {o:4d} ({o/no:5.1%})")

    print("\n[per-domain region] favorite vs overrated, region counts:")
    for d, dfav, dovr in per_domain_rows:
        print(f"  {d}: favorite {dict(dfav)}")
        print(f"  {d}: overrated {dict(dovr)}")

    return {
        "region_fav": region_fav, "region_ovr": region_ovr,
        "era_fav": era_fav, "era_ovr": era_ovr,
        "n_fav": nf, "n_ovr": no,
        "coverage_total": coverage_total, "coverage_unknown": coverage_unknown,
        "asia_test": {"fav_rate": sum(fav_asia)/len(fav_asia), "ovr_rate": sum(ovr_asia)/len(ovr_asia),
                      "diff": obs_asia, "p": p_asia, "n_fav": len(fav_asia), "n_ovr": len(ovr_asia)},
        "na_test": {"fav_rate": sum(fav_na)/len(fav_na), "ovr_rate": sum(ovr_na)/len(ovr_na),
                    "diff": obs_na, "p": p_na},
        "west_test": {"fav_rate": sum(fav_west)/len(fav_west), "ovr_rate": sum(ovr_west)/len(ovr_west),
                      "diff": obs_w, "p": p_w},
        "per_domain_rows": per_domain_rows,
    }


def run_law2_country(recs):
    print("\n" + "=" * 78)
    print("LAW 2b -- `country` domain: direct favorite/overrated country picks")
    print("=" * 78)

    fav_c, ovr_c = Counter(), Counter()
    total = unknown = 0
    for r in recs:
        if r["domain"] != "country" or not r["entity_canon"]:
            continue
        total += 1
        region = country_region(r["entity_canon"])
        if region == "Unknown":
            unknown += 1
        (fav_c if r["probe"] == "favorite" else ovr_c)[r["entity_canon"]] += 1
    nf, no = sum(fav_c.values()), sum(ovr_c.values())
    print(f"\n[coverage] {total} picks, {unknown} Unknown ({unknown/total:.2%} if total else 0)")
    print(f"[counts] favorite n={nf}, overrated n={no}")

    print("\n[favorite countries]")
    for e, n in fav_c.most_common():
        print(f"  {e:16s} {n:3d} ({n/nf:.1%})  region={country_region(e)}")
    print("[overrated countries]")
    for e, n in ovr_c.most_common():
        print(f"  {e:16s} {n:3d} ({n/no:.1%})  region={country_region(e)}")

    # US share test
    us_fav = fav_c.get("united states", 0)
    us_ovr = ovr_c.get("united states", 0)
    print(f"\n[US share] favorite {us_fav}/{nf} ({us_fav/nf:.1%})  "
          f"overrated {us_ovr}/{no} ({us_ovr/no:.1%})")

    # Japan share test
    jp_fav = fav_c.get("japan", 0)
    jp_ovr = ovr_c.get("japan", 0)
    print(f"[Japan share] favorite {jp_fav}/{nf} ({jp_fav/nf:.1%})  "
          f"overrated {jp_ovr}/{no} ({jp_ovr/no:.1%})")

    # region-level indicator lists + perm tests (Asia, North-America)
    fav_regions = [country_region(e) for e, n in fav_c.items() for _ in range(n)]
    ovr_regions = [country_region(e) for e, n in ovr_c.items() for _ in range(n)]
    fav_asia = [1 if r in ASIA_REGIONS else 0 for r in fav_regions]
    ovr_asia = [1 if r in ASIA_REGIONS else 0 for r in ovr_regions]
    obs_asia, p_asia = aa.perm_test(fav_asia, ovr_asia, stat=lambda x: sum(x)/len(x), n=20000, seed=21)
    fav_na = [1 if r == "North-America" else 0 for r in fav_regions]
    ovr_na = [1 if r == "North-America" else 0 for r in ovr_regions]
    obs_na, p_na = aa.perm_test(fav_na, ovr_na, stat=lambda x: sum(x)/len(x), n=20000, seed=22)
    print(f"\n[Asia(Japan) test] favorite {sum(fav_asia)}/{len(fav_asia)} "
          f"({sum(fav_asia)/len(fav_asia):.1%}) vs overrated {sum(ovr_asia)}/{len(ovr_asia)} "
          f"({sum(ovr_asia)/len(ovr_asia):.1%}), diff={obs_asia:+.4f}, perm p={p_asia:.5f}")
    print(f"[North-America(US) test] favorite {sum(fav_na)}/{len(fav_na)} "
          f"({sum(fav_na)/len(fav_na):.1%}) vs overrated {sum(ovr_na)}/{len(ovr_na)} "
          f"({sum(ovr_na)/len(ovr_na):.1%}), diff={obs_na:+.4f}, perm p={p_na:.5f}")

    return {
        "fav_c": fav_c, "ovr_c": ovr_c, "n_fav": nf, "n_ovr": no,
        "coverage_total": total, "coverage_unknown": unknown,
        "us_fav": us_fav, "us_ovr": us_ovr, "jp_fav": jp_fav, "jp_ovr": jp_ovr,
        "asia_test": {"fav_rate": sum(fav_asia)/len(fav_asia), "ovr_rate": sum(ovr_asia)/len(ovr_asia),
                      "diff": obs_asia, "p": p_asia},
        "na_test": {"fav_rate": sum(fav_na)/len(fav_na), "ovr_rate": sum(ovr_na)/len(ovr_na),
                    "diff": obs_na, "p": p_na},
    }


def write_csvs(law1, law2m, law2c):
    os.makedirs(DATA_OUT, exist_ok=True)

    # law1: full 50-domain convergence ranking (favorite + overrated)
    path = os.path.join(DATA_OUT, "r3b_law1_domain_convergence.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["domain", "group", "is_new_v6", "favorite_modal_frac", "favorite_n_models",
                    "favorite_winner", "favorite_entropy", "favorite_rank",
                    "overrated_modal_frac", "overrated_entropy"])
        for d in law1["all_domains"]:
            cf, co = law1["conv"][d]["favorite"], law1["conv"][d]["overrated"]
            w.writerow([d, aa.DOMAIN_GROUP.get(d, "ungrouped"), d in NEW_V6_DOMAINS,
                        f"{cf['modal_frac']:.4f}", cf["n_models"], cf["winner"],
                        f"{cf['entropy']:.4f}" if cf["entropy"] is not None else "",
                        law1["rank_of"][d],
                        f"{co['modal_frac']:.4f}",
                        f"{co['entropy']:.4f}" if co["entropy"] is not None else ""])
    print(f"\n[csv] wrote {path}")

    # law2 music: region x era pooled counts
    path = os.path.join(DATA_OUT, "r3b_law2_music_region_era.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["axis", "value", "probe", "count"])
        for region in REGIONS:
            w.writerow(["region", region, "favorite", law2m["region_fav"].get(region, 0)])
            w.writerow(["region", region, "overrated", law2m["region_ovr"].get(region, 0)])
        all_eras = sorted(set(law2m["era_fav"]) | set(law2m["era_ovr"]))
        for era in all_eras:
            w.writerow(["era", era, "favorite", law2m["era_fav"].get(era, 0)])
            w.writerow(["era", era, "overrated", law2m["era_ovr"].get(era, 0)])
    print(f"[csv] wrote {path}")

    # law2 country: entity-level table
    path = os.path.join(DATA_OUT, "r3b_law2_country.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["country", "probe", "count", "region"])
        for e, n in law2c["fav_c"].most_common():
            w.writerow([e, "favorite", n, country_region(e)])
        for e, n in law2c["ovr_c"].most_common():
            w.writerow([e, "overrated", n, country_region(e)])
    print(f"[csv] wrote {path}")


if __name__ == "__main__":
    S = aa.load_summary()
    recs = aa.load_extracted(canonicalize=True, drop_refused=True)

    law1 = run_law1(recs, S)
    law2m = run_law2_music(recs)
    law2c = run_law2_country(recs)

    write_csvs(law1, law2m, law2c)

    # also dump a compact JSON of headline numbers for the report to cite exactly
    summary_out = {
        "law1": {
            "sound_favorite": law1["sound_favorite"], "sound_overrated": law1["sound_overrated"],
            "sound_theme_favorite": law1["sound_theme"]["favorite"],
            "sound_theme_overrated": law1["sound_theme"]["overrated"],
            "sound_rank_favorite": law1["rank_of"]["sound"], "n_domains": law1["n_domains"],
            "group_test": law1["group_test"],
        },
        "law2_music": {k: v for k, v in law2m.items() if k in
                       ("n_fav", "n_ovr", "coverage_total", "coverage_unknown",
                        "asia_test", "na_test", "west_test")},
        "law2_country": {k: v for k, v in law2c.items() if k in
                         ("n_fav", "n_ovr", "coverage_total", "coverage_unknown",
                          "us_fav", "us_ovr", "jp_fav", "jp_ovr", "asia_test", "na_test")},
    }
    with open(os.path.join(DATA_OUT, "r3b_headline_numbers.json"), "w") as f:
        json.dump(summary_out, f, indent=2, default=str)
    print(f"\n[json] wrote {os.path.join(DATA_OUT, 'r3b_headline_numbers.json')}")
    print("\nDone.")
