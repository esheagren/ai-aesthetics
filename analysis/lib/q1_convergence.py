"""Q1 — structure of aesthetic convergence: domain vs model vs family.

Reusable functions + a __main__ driver that reproduces every number in
analysis/round1/Q1_convergence_structure.md and writes derived tables to
analysis/data/.

Usage:
    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/q1_convergence.py
"""
import sys, os, json, csv
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

ROOT = aa.ROOT
DATA_OUT = os.path.join(ROOT, "analysis", "data")
PROBES = ("favorite", "overrated")


# ---------------------------------------------------------------------------
# 1. Variance decomposition of the domain x model entropy matrix
# ---------------------------------------------------------------------------
def entropy_matrix(S, probe):
    """Return (domains, models, mat[D,M]) of cells[...][domain][probe].entropy."""
    domains = S["domains"]
    models = [m["id"] for m in S["models"]]
    mat = np.array([[S["cells"][m][d][probe]["entropy"] for m in models] for d in domains])
    return domains, models, mat


def decompose(mat):
    """Two-way (no-replication) additive decomposition:
    Y[d,m] = mu + a[d] + b[m] + resid[d,m], sum(a)=sum(b)=0.
    Returns dict with mu, a (domain effects), b (model effects), resid,
    and population variances of each component (which sum exactly to
    the total population variance of mat)."""
    mu = mat.mean()
    a = mat.mean(axis=1) - mu   # domain effects, len D
    b = mat.mean(axis=0) - mu   # model effects, len M
    resid = mat - mu - a[:, None] - b[None, :]
    var_domain = float(np.mean(a ** 2))
    var_model = float(np.mean(b ** 2))
    var_resid = float(np.mean(resid ** 2))
    var_total = float(np.var(mat))
    return {
        "mu": float(mu), "a": a, "b": b, "resid": resid,
        "var_domain": var_domain, "var_model": var_model, "var_resid": var_resid,
        "var_total": var_total,
        "ratio_domain_over_model": var_domain / var_model if var_model > 0 else float("inf"),
    }


def effect_perm_test(mat, axis, n=20000, seed=0):
    """Permutation test for the row-effect (axis='domain') or column-effect
    (axis='model') variance, permuting within the *other* axis so the
    other factor's structure is held fixed (a standard randomized two-way
    layout test). Returns (observed_var, p_value)."""
    rng = np.random.default_rng(seed)
    D, M = mat.shape
    if axis == "domain":
        # shuffle within each column (across domains) -> destroys domain
        # identity while preserving each model's marginal values
        obs = decompose(mat)["var_domain"]
        cnt = 0
        m2 = mat.copy()
        for _ in range(n):
            for j in range(M):
                rng.shuffle(m2[:, j])
            v = decompose(m2)["var_domain"]
            if v >= obs - 1e-12:
                cnt += 1
        return obs, (cnt + 1) / (n + 1)
    elif axis == "model":
        obs = decompose(mat)["var_model"]
        cnt = 0
        m2 = mat.copy()
        for _ in range(n):
            for i in range(D):
                rng.shuffle(m2[i, :])
            v = decompose(m2)["var_model"]
            if v >= obs - 1e-12:
                cnt += 1
        return obs, (cnt + 1) / (n + 1)
    else:
        raise ValueError(axis)


# ---------------------------------------------------------------------------
# 2. Pairwise agreement (Jaccard) matrices re-derived from extracted.jsonl,
#    for BOTH probes (summary.json's `overlap` is favorite-only).
# ---------------------------------------------------------------------------
def build_pairwise(recs, models, probe):
    """Jaccard overlap of each model's set of {domain}:{entity_canon} picks
    for the given probe, pooled across all 43 domains. Mirrors src/analyze.js's
    method for `overlap`, but computed from analysis/lib/aa.py canonicalization
    (lowercase+strip+alias-map; does not strip leading articles/quotes the way
    analyze.js's norm() does, so expect minor numeric drift vs summary.json's
    favorite-only `overlap` -- see caveats)."""
    sets = {m: set() for m in models}
    for r in recs:
        if r["probe"] != probe or r["model"] not in sets:
            continue
        if not r.get("entity"):
            continue
        sets[r["model"]].add(f"{r['domain']}:{r['entity_canon']}")
    n = len(models)
    mat = np.zeros((n, n))
    for i, a in enumerate(models):
        for j, b in enumerate(models):
            if i == j:
                continue
            A, B = sets[a], sets[b]
            union = len(A | B)
            mat[i, j] = (len(A & B) / union) if union else 0.0
    return mat, sets


def validate_against_summary(mat_fav, models, S, tol_report=True):
    """Compare our re-derived favorite-only Jaccard matrix to summary.json's
    shipped `overlap` (same method, different norm/canon details) -- a
    canonicalization-coverage sanity check, not a correctness requirement."""
    om = S["overlapModels"]
    idx = {m: i for i, m in enumerate(om)}
    shipped = np.array(S["overlap"])
    ours = np.zeros_like(shipped)
    for i, a in enumerate(models):
        for j, b in enumerate(models):
            ours[idx[a], idx[b]] = mat_fav[i, j]
    diff = ours - shipped
    off = ~np.eye(len(models), dtype=bool)
    mae = float(np.mean(np.abs(diff[off])))
    corr = float(np.corrcoef(ours[off], shipped[off])[0, 1])
    return {"mean_abs_diff": mae, "pearson_corr": corr}


# ---------------------------------------------------------------------------
# 3. Family clustering: within- vs between-family pairwise agreement +
#    a family-label permutation test.
# ---------------------------------------------------------------------------
def family_gap(mat, models, family_of):
    n = len(models)
    within, between = [], []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            fi, fj = family_of[models[i]], family_of[models[j]]
            v = mat[i, j]
            (within if fi == fj else between).append(v)
    return within, between


def per_family_breakdown(mat, models, family_of):
    """For each family with >=2 members: within-family mean vs its
    between-family mean (all pairs touching that family but crossing out),
    descriptive only (small n for Google, n=2 members -> 2 ordered pairs)."""
    fams = {}
    for m in models:
        fams.setdefault(family_of[m], []).append(m)
    out = {}
    idx_of = {m: i for i, m in enumerate(models)}
    for fam, ms in fams.items():
        if len(ms) < 2:
            continue
        idxs = [idx_of[x] for x in ms]
        within = [mat[i, j] for i in idxs for j in idxs if i != j]
        between = [mat[i, j] for i in idxs for j in range(len(models)) if j not in idxs]
        out[fam] = {
            "within_mean": float(np.mean(within)), "within_n": len(within),
            "between_mean": float(np.mean(between)), "between_n": len(between),
            "gap": float(np.mean(within) - np.mean(between)),
        }
    return out


def family_perm_test(mat, models, family_of, n=20000, seed=0):
    """Shuffle which family label goes to which of the 13 models (permuting
    the label vector; family group sizes preserved), recompute the
    within-between gap under the null of 'family labels are meaningless',
    two-sided p-value against the observed gap."""
    rng = np.random.default_rng(seed)
    fam_vec = [family_of[m] for m in models]
    within, between = family_gap(mat, models, family_of)
    obs_gap = float(np.mean(within) - np.mean(between))
    idx = np.arange(len(models))
    cnt = 0
    for _ in range(n):
        perm = fam_vec.copy()
        rng.shuffle(perm)
        fam_perm = {models[k]: perm[k] for k in idx}
        w, b = family_gap(mat, models, fam_perm)
        gap = np.mean(w) - np.mean(b)
        if abs(gap) >= abs(obs_gap) - 1e-12:
            cnt += 1
    p = (cnt + 1) / (n + 1)
    return float(np.mean(within)), float(np.mean(between)), obs_gap, p


# ---------------------------------------------------------------------------
# 4. Odd-models-out & domain ranking
# ---------------------------------------------------------------------------
def mean_overlap_with_others(mat, models):
    n = len(models)
    out = {}
    for i, m in enumerate(models):
        others = [mat[i, j] for j in range(n) if j != i]
        out[m] = float(np.mean(others))
    return out


def domain_ranking(S, probe):
    domains = S["domains"]
    models = [m["id"] for m in S["models"]]
    rows = []
    for d in domains:
        vals = [S["cells"][m][d][probe]["entropy"] for m in models]
        rows.append((d, float(np.mean(vals))))
    rows.sort(key=lambda x: x[1])
    return rows


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    os.makedirs(DATA_OUT, exist_ok=True)
    S = aa.load_summary()
    recs = aa.load_extracted(canonicalize=True, drop_refused=True)
    models = [m["id"] for m in S["models"]]
    family_of = aa.FAMILY

    print("=" * 70)
    print("1. VARIANCE DECOMPOSITION (domain x model entropy matrix)")
    print("=" * 70)
    decomp_out = {}
    for probe in PROBES:
        domains, mmodels, mat = entropy_matrix(S, probe)
        dec = decompose(mat)
        obs_d, p_d = effect_perm_test(mat, "domain", n=20000, seed=1)
        obs_m, p_m = effect_perm_test(mat, "model", n=20000, seed=2)
        print(f"\n-- {probe} --")
        print(f"  grand mean entropy = {dec['mu']:.4f}")
        print(f"  var_domain = {dec['var_domain']:.5f}  (perm p={p_d:.5f})")
        print(f"  var_model  = {dec['var_model']:.5f}  (perm p={p_m:.5f})")
        print(f"  var_resid  = {dec['var_resid']:.5f}")
        print(f"  var_total  = {dec['var_total']:.5f}")
        print(f"  ratio domain/model = {dec['ratio_domain_over_model']:.2f}x")
        decomp_out[probe] = {
            "grand_mean": dec["mu"], "var_domain": dec["var_domain"],
            "var_model": dec["var_model"], "var_resid": dec["var_resid"],
            "var_total": dec["var_total"],
            "ratio_domain_over_model": dec["ratio_domain_over_model"],
            "p_domain_effect": p_d, "p_model_effect": p_m,
        }
    with open(os.path.join(DATA_OUT, "q1_variance_decomposition.json"), "w") as f:
        json.dump(decomp_out, f, indent=2)

    print("\n" + "=" * 70)
    print("2. FAMILY CLUSTERING (re-derived pairwise Jaccard, both probes)")
    print("=" * 70)
    pairwise = {}
    validation = {}
    family_out = {}
    for probe in PROBES:
        mat, sets = build_pairwise(recs, models, probe)
        pairwise[probe] = mat
        if probe == "favorite":
            validation = validate_against_summary(mat, models, S)
        w_mean, b_mean, gap, p = family_perm_test(mat, models, family_of, n=20000, seed=3)
        breakdown = per_family_breakdown(mat, models, family_of)
        print(f"\n-- {probe} --")
        print(f"  within-family mean = {w_mean:.4f}, between-family mean = {b_mean:.4f}")
        print(f"  observed gap = {gap:+.4f}, permutation p (two-sided) = {p:.5f}")
        for fam, d in breakdown.items():
            print(f"    {fam:10s} within={d['within_mean']:.4f} (n={d['within_n']})  "
                  f"between={d['between_mean']:.4f} (n={d['between_n']})  gap={d['gap']:+.4f}")
        family_out[probe] = {"within_mean": w_mean, "between_mean": b_mean, "gap": gap, "p": p,
                              "per_family": breakdown}
    print(f"\nValidation vs shipped summary.json favorite `overlap`: "
          f"mean|diff|={validation['mean_abs_diff']:.4f}, corr={validation['pearson_corr']:.4f}")
    family_out["_validation_vs_summary_overlap"] = validation
    with open(os.path.join(DATA_OUT, "q1_family_gap.json"), "w") as f:
        json.dump(family_out, f, indent=2)

    # combined matrix pooling both probes into one Jaccard set per model
    combined_sets = {m: set() for m in models}
    for r in recs:
        if r["model"] not in combined_sets or not r.get("entity"):
            continue
        combined_sets[r["model"]].add(f"{r['probe']}:{r['domain']}:{r['entity_canon']}")
    n = len(models)
    combined_mat = np.zeros((n, n))
    for i, a in enumerate(models):
        for j, b in enumerate(models):
            if i == j:
                continue
            A, B = combined_sets[a], combined_sets[b]
            union = len(A | B)
            combined_mat[i, j] = (len(A & B) / union) if union else 0.0
    pairwise["combined"] = combined_mat

    for probe, mat in pairwise.items():
        with open(os.path.join(DATA_OUT, f"q1_pairwise_agreement_{probe}.csv"), "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["model"] + models)
            for i, m in enumerate(models):
                w.writerow([m] + [f"{mat[i, j]:.4f}" for j in range(n)])

    print("\n" + "=" * 70)
    print("3. ODD MODELS OUT (mean overlap with the other 12)")
    print("=" * 70)
    rank_out = {}
    for probe, mat in pairwise.items():
        mo = mean_overlap_with_others(mat, models)
        ranked = sorted(mo.items(), key=lambda x: x[1])
        rank_out[probe] = ranked
        print(f"\n-- {probe} -- (lowest = least convergent)")
        for m, v in ranked:
            print(f"  {m:28s} {family_of[m]:10s} {v:.4f}")
    # top pair overall (combined matrix)
    best = None
    for i, a in enumerate(models):
        for j, b in enumerate(models):
            if i < j:
                v = combined_mat[i, j]
                if best is None or v > best[2]:
                    best = (a, b, v)
    print(f"\nHighest single pairwise value (combined matrix): {best[0]} x {best[1]} = {best[2]:.4f}")
    all_pairs = [(models[i], models[j], float(combined_mat[i, j]))
                 for i in range(n) for j in range(n) if i < j]
    all_pairs.sort(key=lambda x: -x[2])
    print("Top 6 pairs (combined):")
    for a, b, v in all_pairs[:6]:
        print(f"  {a} x {b} = {v:.4f}")
    print("Bottom 6 pairs (combined):")
    for a, b, v in all_pairs[-6:]:
        print(f"  {a} x {b} = {v:.4f}")
    with open(os.path.join(DATA_OUT, "q1_model_convergence_rank.json"), "w") as f:
        json.dump({p: [{"model": m, "family": family_of[m], "mean_overlap": v} for m, v in r]
                   for p, r in rank_out.items()}, f, indent=2)

    print("\n" + "=" * 70)
    print("4. DOMAIN RANKING (mean entropy across 13 models)")
    print("=" * 70)
    domain_rank_out = {}
    for probe in PROBES:
        ranked = domain_ranking(S, probe)
        domain_rank_out[probe] = ranked
        print(f"\n-- {probe} -- most unifying (low entropy) first")
        for d, v in ranked[:5]:
            print(f"  {d:16s} {v:.4f}")
        print(f"  ... most fracturing (high entropy) last:")
        for d, v in ranked[-5:]:
            print(f"  {d:16s} {v:.4f}")
    with open(os.path.join(DATA_OUT, "q1_domain_ranking.json"), "w") as f:
        json.dump({p: [{"domain": d, "mean_entropy": v} for d, v in r]
                   for p, r in domain_rank_out.items()}, f, indent=2)

    print("\nDone. Derived tables written to analysis/data/.")
