"""Q3 — Does more capability produce less cliché / more distinctive taste?

Reusable computation for analysis/round1/Q3_capability_vs_cliche.md.

Tests the director's central hunch on the two REAL capability ladders
(Anthropic: opus-4-1 < opus-4-5 < opus-4-8; OpenAI: gpt-4o < o3 < gpt-5.2 <
gpt-5.6-sol), with an explicit hedged-in vs hedged/refused-excluded control,
since hedge rate moves wildly and non-monotonically across the two ladders
(H1 in hypotheses_capability.md) and could mechanically drive entropy /
distinct-pick counts rather than reflecting real taste.

Zero third-party deps beyond numpy (not even used directly here — stdlib only).
Run: python3 analysis/lib/q3_capability.py
"""
import sys, os, json, math, itertools
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

EXCLUDE_DOMAINS = {"bookcover", "chair"}
LADDERS = {
    "Anthropic": ["claude-opus-4-1", "claude-opus-4-5", "claude-opus-4-8"],
    "OpenAI": ["gpt-4o", "o3", "gpt-5.2", "gpt-5.6-sol"],
}
ALL_MODELS = aa.ALL_MODELS


# ---------------------------------------------------------------------------
# 1. Build (model, domain, probe) -> Counter(entity_canon -> count), for a
#    given subset ("all" = every non-refused row per aa.load_extracted default,
#    "clean" = additionally drop hedged rows).
# ---------------------------------------------------------------------------
def build_cells(subset="all"):
    """subset: 'all' (non-refused only, matches summary.json/data dict convention)
    or 'clean' (non-refused AND non-hedged)."""
    assert subset in ("all", "clean")
    recs = aa.load_extracted(canonicalize=True, drop_refused=True)
    cells = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))
    descriptors_fav = defaultdict(list)  # model -> list of descriptor tokens (favorite probe)
    n_fav = defaultdict(int)
    for r in recs:
        if r["domain"] in EXCLUDE_DOMAINS:
            continue
        if subset == "clean" and r.get("hedged"):
            continue
        cells[r["model"]][r["domain"]][r["probe"]][r["entity_canon"]] += 1
        if r["probe"] == "favorite":
            n_fav[r["model"]] += 1
            descriptors_fav[r["model"]].extend(r.get("descriptors") or [])
    return cells, descriptors_fav, n_fav


DOMAINS = [d for d in aa.load_summary()["domains"] if d not in EXCLUDE_DOMAINS]


# ---------------------------------------------------------------------------
# 2. Consensus-hugging rate: model's own modal pick == leave-one-out
#    cross-model modal pick (weighted by sample count), per probe.
# ---------------------------------------------------------------------------
def hug_rate(cells, mid, probe):
    hits = denom = 0
    for domain in DOMAINS:
        cell = cells.get(mid, {}).get(domain, {}).get(probe)
        if not cell:
            continue
        top_ent, _ = cell.most_common(1)[0]
        gcounts = Counter()
        for m2 in ALL_MODELS:
            if m2 == mid:
                continue
            c2 = cells.get(m2, {}).get(domain, {}).get(probe)
            if c2:
                gcounts.update(c2)
        if not gcounts:
            continue
        consensus_ent, _ = gcounts.most_common(1)[0]
        denom += 1
        if top_ent == consensus_ent:
            hits += 1
    return (hits / denom if denom else float("nan")), denom


# ---------------------------------------------------------------------------
# 3. Within-model spread: mean normalized entropy (favorite), distinct
#    favorite entity count, spread rate (distinct / total favorite samples).
#
# IMPORTANT: the house convention used in data/summary.json's precomputed
# `cells[...].entropy` (see src/report.js: "Entropy is Shannon entropy of the
# pick distribution normalized by log(n)") normalizes by log(SAMPLE COUNT n),
# NOT log(number of distinct picks k) as aa.norm_entropy does. We match the
# house convention here (norm_entropy_by_n) so our recomputed "all-subset"
# numbers are comparable to the modelStats.meanEntropyFavorite values already
# reported in hypotheses_capability.md, and so hedged-in vs hedged-out is an
# apples-to-apples comparison under one consistent definition. Verified: for
# claude-opus-4-1/book/favorite (dist 4/2/2/1/1, n=10) this gives 0.639,
# matching summary.json's precomputed cell entropy exactly; aa.norm_entropy
# (log(k) normalization) would give 0.914 for the same cell.
# ---------------------------------------------------------------------------
def norm_entropy_by_n(counts):
    vals = list(counts.values())
    n = sum(vals)
    if n <= 1:
        return 0.0
    h = -sum((c / n) * math.log(c / n) for c in vals if c > 0)
    return h / math.log(n)


def spread_stats(cells, mid, probe, n_samples):
    ents = set()
    entropies = []
    for domain in DOMAINS:
        cell = cells.get(mid, {}).get(domain, {}).get(probe)
        if not cell:
            continue
        ents.update(cell.keys())
        entropies.append(norm_entropy_by_n(cell))
    mean_ent = sum(entropies) / len(entropies) if entropies else float("nan")
    distinct = len(ents)
    spread_rate = distinct / n_samples if n_samples else float("nan")
    return mean_ent, distinct, spread_rate


# ---------------------------------------------------------------------------
# 4. Descriptor richness: type-token ratio + generic-adjective share
#    (favorite probe). Generic set = top-15 most frequent descriptor tokens
#    *within the current subset*, pooled across all 13 models — recomputed
#    fresh per subset (all vs clean) rather than hardcoded, so the hedge-
#    controlled version isn't silently using an "all-rows" generic list.
# ---------------------------------------------------------------------------
def descriptor_stats(descriptors_fav):
    global_counter = Counter()
    for mid in descriptors_fav:
        global_counter.update(descriptors_fav[mid])
    top_generic = set(w for w, _ in global_counter.most_common(15))
    out = {}
    for mid, descs in descriptors_fav.items():
        tot = len(descs)
        if tot == 0:
            out[mid] = (float("nan"), float("nan"), 0)
            continue
        ttr = len(set(descs)) / tot
        generic_share = sum(1 for d in descs if d in top_generic) / tot
        out[mid] = (ttr, generic_share, tot)
    return out, top_generic


# ---------------------------------------------------------------------------
# 5. Exact monotonicity test for tiny-n ladders (n=3 or 4).
#    Kendall's tau between metric value and ladder position (order is fixed;
#    we permute the metric values across positions -- exact, exchangeable
#    under the null of "no association with capability order").
# ---------------------------------------------------------------------------
def kendall_tau(y):
    n = len(y)
    conc = disc = 0
    for i in range(n):
        for j in range(i + 1, n):
            if y[j] > y[i]:
                conc += 1
            elif y[j] < y[i]:
                disc += 1
    total = conc + disc
    return (conc - disc) / total if total else 0.0


def exact_monotonic_test(values):
    """values: list of floats in ladder order (weakest -> strongest).
    Returns (tau_obs, p_exact_two_sided, direction_label, n_perms)."""
    vals = [v for v in values if v == v]  # drop NaN defensively
    n = len(vals)
    if n < 3:
        return float("nan"), float("nan"), "insufficient points", 0
    obs = kendall_tau(vals)
    count = 0
    total = 0
    for perm in itertools.permutations(vals):
        total += 1
        t = kendall_tau(list(perm))
        if abs(t) >= abs(obs) - 1e-12:
            count += 1
    p = count / total
    if obs >= 0.999:
        label = "strictly monotonic increasing"
    elif obs <= -0.999:
        label = "strictly monotonic decreasing"
    elif obs > 0:
        label = "non-monotonic, net positive"
    elif obs < 0:
        label = "non-monotonic, net negative"
    else:
        label = "flat / no net trend"
    return obs, p, label, total


# ---------------------------------------------------------------------------
# 6. Top-level driver: build the full per-model, per-subset table.
# ---------------------------------------------------------------------------
def build_table():
    rows = []
    for subset in ("all", "clean"):
        cells, descriptors_fav, n_fav = build_cells(subset)
        desc_stats, top_generic = descriptor_stats(descriptors_fav)
        for fam, ids_ in LADDERS.items():
            for order_i, mid in enumerate(ids_, start=1):
                hf, nf = hug_rate(cells, mid, "favorite")
                ho, no = hug_rate(cells, mid, "overrated")
                ent_fav, distinct_fav, spread_fav = spread_stats(cells, mid, "favorite", n_fav.get(mid, 0))
                ttr, gshare, ndesc = desc_stats.get(mid, (float("nan"), float("nan"), 0))
                rows.append({
                    "subset": subset, "family": fam, "order": order_i, "model": mid,
                    "label": aa.LABEL[mid],
                    "hugFav": hf, "hugOver": ho,
                    "entFav": ent_fav, "distinctFav": distinct_fav, "spreadRateFav": spread_fav,
                    "nFavSamples": n_fav.get(mid, 0),
                    "TTRfav": ttr, "genericShareFav": gshare, "nDescFav": ndesc,
                })
    return rows


def write_csv(rows, path):
    cols = ["subset", "family", "order", "model", "label", "hugFav", "hugOver",
            "entFav", "distinctFav", "spreadRateFav", "nFavSamples",
            "TTRfav", "genericShareFav", "nDescFav"]
    with open(path, "w") as f:
        f.write(",".join(cols) + "\n")
        for r in rows:
            f.write(",".join(str(r[c]) for c in cols) + "\n")


def print_ladder_report(rows):
    for subset in ("all", "clean"):
        print(f"\n{'='*70}\nSUBSET = {subset.upper()} "
              f"({'non-refused' if subset=='all' else 'non-refused AND non-hedged'})\n{'='*70}")
        for fam, ids_ in LADDERS.items():
            print(f"\n--- {fam} ladder ---")
            sub = [r for r in rows if r["subset"] == subset and r["family"] == fam]
            sub.sort(key=lambda r: r["order"])
            for r in sub:
                print(f"  {r['label']:20s} hugFav={r['hugFav']:.3f} hugOver={r['hugOver']:.3f} "
                      f"entFav={r['entFav']:.3f} distinctFav={r['distinctFav']:3d} "
                      f"spreadFav={r['spreadRateFav']:.3f} (n={r['nFavSamples']:4d}) "
                      f"TTRfav={r['TTRfav']:.3f} genericShare={r['genericShareFav']:.3f} (nDesc={r['nDescFav']})")
            for metric in ("hugFav", "hugOver", "entFav", "distinctFav", "spreadRateFav", "TTRfav", "genericShareFav"):
                vals = [r[metric] for r in sub]
                tau, p, label, nperm = exact_monotonic_test(vals)
                print(f"    monotonic test [{metric:16s}]: values={['%.3f'%v for v in vals]} "
                      f"tau={tau:+.3f} p={p:.3f} ({nperm} perms) -> {label}")


if __name__ == "__main__":
    rows = build_table()
    out_path = os.path.join(aa.ROOT, "analysis", "data", "q3_capability_table.csv")
    write_csv(rows, out_path)
    print(f"Wrote {out_path} ({len(rows)} rows)")
    print_ladder_report(rows)
