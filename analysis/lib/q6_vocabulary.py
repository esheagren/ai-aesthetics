"""Q6 — Is there a universal AI aesthetic vocabulary?

Reusable functions for:
  1. Cross-model descriptor-vocabulary convergence vs entity-pick convergence
     (top-K Jaccard overlap, "how many models share word/entity X in their top-K").
  2. Praise (favorite) vs critique (overrated) descriptor lexicon disjointness.
  3. Within- vs between-family descriptor Jaccard + permutation test.

Zero third-party deps except numpy (only used indirectly via aa.perm_test's caller
if needed; this module itself is pure stdlib). Excludes domains 'bookcover' and
'chair' per instructions (deprecated/extra domains not in the official 43).

Usage:
    import sys; sys.path.insert(0, "analysis/lib")
    import q6_vocabulary as q6
    recs = q6.load_recs()
    ...
"""
import sys, os, json, math, random
from collections import defaultdict, Counter
from itertools import combinations

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

EXCLUDE_DOMAINS = {"bookcover", "chair"}


def load_recs():
    """All non-refused extracted records, canonicalized, excluding bookcover/chair."""
    recs = aa.load_extracted(canonicalize=True, drop_refused=True)
    return [r for r in recs if r.get("domain") not in EXCLUDE_DOMAINS]


def _norm_desc(d):
    return (d or "").strip().lower()


def per_model_descriptor_counts(recs, probe):
    """{model: Counter(descriptor -> count)} for given probe, pooled over all domains."""
    out = defaultdict(Counter)
    for r in recs:
        if r.get("probe") != probe:
            continue
        m = r.get("model")
        for d in (r.get("descriptors") or []):
            d = _norm_desc(d)
            if d:
                out[m][d] += 1
    return out


def per_model_entity_counts(recs, probe):
    """{model: Counter(entity_canon -> count)} for given probe, pooled over all domains.
    Uses entity_canon (aliases.json-canonicalized) so this is an apples-to-apples
    comparison basis with the descriptor counters above (both canonical/normalized)."""
    out = defaultdict(Counter)
    for r in recs:
        if r.get("probe") != probe:
            continue
        m = r.get("model")
        e = r.get("entity_canon") or ""
        if e:
            out[m][e] += 1
    return out


def pooled_counts(recs, probe):
    """Counter pooled across ALL models for a probe (descriptors)."""
    c = Counter()
    for r in recs:
        if r.get("probe") != probe:
            continue
        for d in (r.get("descriptors") or []):
            d = _norm_desc(d)
            if d:
                c[d] += 1
    return c


def topk_set(counter, k):
    return set(w for w, _ in counter.most_common(k))


def jaccard(a, b):
    if not a and not b:
        return 0.0
    u = len(a | b)
    if u == 0:
        return 0.0
    return len(a & b) / u


def pairwise_jaccard_matrix(sets_by_model, models):
    """Returns dict[(mi,mj)] -> jaccard, for all ordered pairs mi != mj (both directions,
    symmetric values, matching the convention used in data/summary.json's `overlap` and
    in conv-H1 (ordered pairs, n=13*12=156 total, diagonal excluded)."""
    out = {}
    for mi in models:
        for mj in models:
            if mi == mj:
                continue
            out[(mi, mj)] = jaccard(sets_by_model[mi], sets_by_model[mj])
    return out


def mean_pairwise_jaccard(sets_by_model, models):
    mat = pairwise_jaccard_matrix(sets_by_model, models)
    vals = list(mat.values())
    return sum(vals) / len(vals), mat


def models_sharing_topk(sets_by_model, models, universe=None):
    """For every item that appears in ANY model's top-K set, count how many of the
    `models` have it in their own top-K set. Returns Counter(item -> n_models),
    sorted desc by n_models then item."""
    cnt = Counter()
    for m in models:
        for item in sets_by_model[m]:
            cnt[item] += 1
    return cnt


def family_perm_test(sets_by_model, models, family_map, n=20000, seed=0):
    """Within- vs between-family mean Jaccard + label-permutation test.
    Mirrors conv-H1's method: ordered pairs, shuffle family labels across the fixed
    set of models n times, recompute (within_mean - between_mean), compare to observed.
    Returns dict with observed within/between means, gap, and two-sided p-value.
    """
    mat = pairwise_jaccard_matrix(sets_by_model, models)
    fam = {m: family_map[m] for m in models}

    def gap_for(fam_assignment):
        within, between = [], []
        for mi, mj in mat:
            v = mat[(mi, mj)]
            if fam_assignment[mi] == fam_assignment[mj]:
                within.append(v)
            else:
                between.append(v)
        wm = sum(within) / len(within) if within else float("nan")
        bm = sum(between) / len(between) if between else float("nan")
        return wm, bm, wm - bm, len(within), len(between)

    obs_w, obs_b, obs_gap, n_within, n_between = gap_for(fam)

    rng = random.Random(seed)
    fam_values = list(fam.values())
    cnt = 0
    for _ in range(n):
        rng.shuffle(fam_values)
        shuffled = dict(zip(models, fam_values))
        _, _, gap, _, _ = gap_for(shuffled)
        if abs(gap) >= abs(obs_gap) - 1e-12:
            cnt += 1
    p = (cnt + 1) / (n + 1)
    return {
        "within_mean": obs_w, "between_mean": obs_b, "gap": obs_gap,
        "n_within_pairs": n_within, "n_between_pairs": n_between, "p_value": p,
    }


def top_exclusive_terms(fav_counts, ovr_counts, top_n=50, min_total=10):
    """Given pooled Counters for favorite and overrated descriptors, return:
      - overlap: set of words in top_n of BOTH lists
      - fav_exclusive: words in top_n(fav) with the lowest ovr-share, sorted desc by fav count
      - ovr_exclusive: words in top_n(ovr) with the lowest fav-share, sorted desc by ovr count
    Each exclusive entry: (word, probe_count, other_probe_count, share)
    share = probe_count / (probe_count + other_probe_count)
    """
    fav_top = set(w for w, _ in fav_counts.most_common(top_n))
    ovr_top = set(w for w, _ in ovr_counts.most_common(top_n))
    overlap = fav_top & ovr_top

    fav_excl = []
    for w in fav_top:
        fc, oc = fav_counts[w], ovr_counts.get(w, 0)
        if fc + oc < min_total:
            continue
        share = fc / (fc + oc)
        fav_excl.append((w, fc, oc, share))
    fav_excl.sort(key=lambda x: (-x[3], -x[1]))

    ovr_excl = []
    for w in ovr_top:
        oc, fc = ovr_counts[w], fav_counts.get(w, 0)
        if fc + oc < min_total:
            continue
        share = oc / (fc + oc)
        ovr_excl.append((w, oc, fc, share))
    ovr_excl.sort(key=lambda x: (-x[3], -x[1]))

    return {"overlap": overlap, "fav_exclusive": fav_excl, "ovr_exclusive": ovr_excl,
            "fav_top": fav_top, "ovr_top": ovr_top}


if __name__ == "__main__":
    recs = load_recs()
    print("recs (excl. bookcover/chair, non-refused):", len(recs))
    fav_desc = per_model_descriptor_counts(recs, "favorite")
    models = sorted(fav_desc.keys())
    print("models:", len(models))
    top1 = {m: fav_desc[m].most_common(1) for m in models}
    n_elegant_top1 = sum(1 for m in models if top1[m] and top1[m][0][0] == "elegant")
    print("elegant #1 for", n_elegant_top1, "/", len(models), "models")
