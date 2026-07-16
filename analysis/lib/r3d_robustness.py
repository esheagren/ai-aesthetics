"""R3-D — v5->v6 robustness re-test.

The dataset grew ~14% between when Round 1 / Round 2 shipped their headline
numbers and now: 9,262 -> ~10.5k non-refused rows, 43 -> 50 domains (7 new:
musician, composer, song, director, proglang, sound, country), same 13 models.
The derived tables committed under analysis/data/ (q1_*, q2_*, r2a_*, r2c_*)
are v5-era snapshots (generated before the domain-add commit). This module
re-runs the SAME methods from analysis/lib/{q1_convergence,q2_asymmetry,
r2a_signatures,r2c_clustering,r2b_fingerprint}.py over the current v6
data/extracted.jsonl + data/summary.json and writes v6_-prefixed tables to
analysis/data/ so the v5 tables are never clobbered.

Zero third-party deps except numpy. No network.

Usage:
    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/r3d_robustness.py
"""
import sys, os, csv, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa
import q1_convergence as q1
import q2_asymmetry as q2
import r2a_signatures as r2a
import r2c_clustering as r2c
import r2b_fingerprint as r2b
import q6_vocabulary as q6

ROOT = aa.ROOT
DATA_OUT = os.path.join(ROOT, "analysis", "data")
PROBES = ("favorite", "overrated")

LEGACY_DOMAINS = {"bookcover", "chair"}
NEW_V6_DOMAINS = ["musician", "composer", "song", "director", "proglang", "sound", "country"]


# ===========================================================================
# 1. Q1 — convergence structure (domain vs model vs interaction; family gap)
# ===========================================================================
def run_q1(S, recs, models, family_of):
    out = {"decomposition": {}, "family": {}}

    for probe in PROBES:
        domains, mmodels, mat = q1.entropy_matrix(S, probe)
        dec = q1.decompose(mat)
        obs_d, p_d = q1.effect_perm_test(mat, "domain", n=20000, seed=1)
        obs_m, p_m = q1.effect_perm_test(mat, "model", n=20000, seed=2)
        out["decomposition"][probe] = {
            "n_domains": len(domains), "grand_mean": dec["mu"],
            "var_domain": dec["var_domain"], "var_model": dec["var_model"],
            "var_resid": dec["var_resid"], "var_total": dec["var_total"],
            "ratio_domain_over_model": dec["ratio_domain_over_model"],
            "pct_domain": dec["var_domain"] / dec["var_total"],
            "pct_model": dec["var_model"] / dec["var_total"],
            "pct_interaction": dec["var_resid"] / dec["var_total"],
            "p_domain_effect": p_d, "p_model_effect": p_m,
        }
    with open(os.path.join(DATA_OUT, "v6_q1_variance_decomposition.json"), "w") as f:
        json.dump(out["decomposition"], f, indent=2)

    pairwise = {}
    for probe in PROBES:
        mat, sets = q1.build_pairwise(recs, models, probe)
        pairwise[probe] = mat
        w_mean, b_mean, gap, p = q1.family_perm_test(mat, models, family_of, n=20000, seed=3)
        breakdown = q1.per_family_breakdown(mat, models, family_of)
        out["family"][probe] = {"within_mean": w_mean, "between_mean": b_mean, "gap": gap,
                                 "p": p, "per_family": breakdown}
    with open(os.path.join(DATA_OUT, "v6_q1_family_gap.json"), "w") as f:
        json.dump(out["family"], f, indent=2)

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
        path = os.path.join(DATA_OUT, f"v6_q1_pairwise_agreement_{probe}.csv")
        with open(path, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["model"] + models)
            for i, m in enumerate(models):
                w.writerow([m] + [f"{mat[i, j]:.4f}" for j in range(n)])

    rank_out = {}
    for probe, mat in pairwise.items():
        mo = q1.mean_overlap_with_others(mat, models)
        rank_out[probe] = sorted(mo.items(), key=lambda x: x[1])
    with open(os.path.join(DATA_OUT, "v6_q1_model_convergence_rank.json"), "w") as f:
        json.dump({p: [{"model": m, "family": family_of[m], "mean_overlap": v} for m, v in r]
                   for p, r in rank_out.items()}, f, indent=2)

    out["model_convergence_rank"] = rank_out
    out["pairwise"] = pairwise
    return out


# ===========================================================================
# 2. Q2 — overrated > favorite asymmetry, metric dependence
# ===========================================================================
def run_q2(recs):
    dist = q2.build_dist(recs)
    rows = q2.build_rows(dist)
    csv_path = os.path.join(DATA_OUT, "v6_q2_consensus_by_domain.csv")
    q2.write_csv(rows, csv_path)

    modal_diffs = [r["modal_gap_ovr_minus_fav"] for r in rows]
    entropy_diffs = [r["entropy_gap_fav_minus_ovr"] for r in rows if r["entropy_gap_fav_minus_ovr"] != ""]

    obs_m, p_m = q2.paired_sign_flip_test(modal_diffs)
    pos, neg, zero, p_sign = q2.exact_sign_test(modal_diffs)
    obs_e, p_e = q2.paired_sign_flip_test(entropy_diffs)
    pos2, neg2, zero2, p_sign2 = q2.exact_sign_test(entropy_diffs)

    out = {
        "n_domains": len(rows),
        "modal": {"gap_ovr_minus_fav": obs_m, "p_perm": p_m,
                  "sign_pos": pos, "sign_neg": neg, "sign_zero": zero, "p_sign": p_sign},
        "entropy": {"gap_fav_minus_ovr": obs_e, "p_perm": p_e,
                    "sign_pos": pos2, "sign_neg": neg2, "sign_zero": zero2, "p_sign": p_sign2},
    }
    with open(os.path.join(DATA_OUT, "v6_q2_summary.json"), "w") as f:
        json.dump(out, f, indent=2)
    return out


# ===========================================================================
# 3. R2-A — signature divergences / contrarian ranking, over an arbitrary
#    domain scope (monkey-patches r2a_signatures' module-global DOMAINS_43,
#    which every function in that module reads dynamically at call time).
# ===========================================================================
def run_r2a(recs, domains, label):
    r2a.DOMAINS_43 = list(domains)
    cell_counts = r2a.build_cell_counts(recs)
    rows = r2a.divergence_map(cell_counts)
    sigs = r2a.per_model_signatures(rows)

    ranked_total = sorted(sigs.values(), key=lambda s: -s["rate_total"])
    top6 = [s["model"] for s in ranked_total[:6]]
    bottom6 = [s["model"] for s in ranked_total[-6:]]

    n_domains = len(domains)
    cell_flags = {m: [0] * (2 * n_domains) for m in r2a.MODELS}
    idx_of_cell = {}
    ci = 0
    for d in domains:
        for p in r2a.PROBES:
            idx_of_cell[(d, p)] = ci
            ci += 1
    for row in rows:
        cell_flags[row["model"]][idx_of_cell[(row["domain"], row["probe"])]] = int(row["confident_divergence"])

    group_a = [v for m in top6 for v in cell_flags[m]]
    group_b = [v for m in bottom6 for v in cell_flags[m]]
    obs_gap, p_gap = aa.perm_test(group_a, group_b, stat=lambda x: sum(x) / len(x), n=20000, seed=7)

    out = {
        "label": label, "n_domains": n_domains,
        "ranking": [{"model": s["model"], "label": s["label"], "family": s["family"],
                     "rate_total": s["rate_total"], "n_confident_total": s["n_confident_total"],
                     "rate_favorite": s["rate_favorite"], "rate_overrated": s["rate_overrated"]}
                    for s in ranked_total],
        "top6_vs_bottom6_perm_test": {"top6": top6, "bottom6": bottom6,
                                       "observed_gap": obs_gap, "p": p_gap},
        "rows": rows,
    }
    return out


def write_r2a_csv(out, path):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rank", "model", "label", "family", "rate_total", "n_confident_total",
                    "rate_favorite", "rate_overrated"])
        for i, r in enumerate(out["ranking"], 1):
            w.writerow([i, r["model"], r["label"], r["family"], f"{r['rate_total']:.4f}",
                        r["n_confident_total"], f"{r['rate_favorite']:.4f}", f"{r['rate_overrated']:.4f}"])


# ===========================================================================
# 4. R2-C — taste-space clustering, reusing r2c_clustering.analyze_matrix
#    directly against the freshly written v6 pairwise CSVs.
# ===========================================================================
def run_r2c():
    K = 6
    matrices = {
        "combined": os.path.join(DATA_OUT, "v6_q1_pairwise_agreement_combined.csv"),
        "favorite": os.path.join(DATA_OUT, "v6_q1_pairwise_agreement_favorite.csv"),
        "overrated": os.path.join(DATA_OUT, "v6_q1_pairwise_agreement_overrated.csv"),
    }
    results = {name: r2c.analyze_matrix(name, path, k=K) for name, path in matrices.items()}
    r2c.write_clusters_csv(results, os.path.join(DATA_OUT, "v6_r2c_clusters.csv"), k=K)
    return results


# ===========================================================================
# 5. R2-B — descriptor fingerprints (already domain-agnostic: q6.load_recs()
#    only excludes bookcover/chair, so this naturally runs over all v6 data
#    with zero changes needed).
# ===========================================================================
def run_r2b(recs):
    out_path = os.path.join(DATA_OUT, "v6_r2b_fingerprint.csv")
    r2b.write_csv(out_path, recs, top_n=10)
    mf_fav = r2b.model_fingerprints(recs, "favorite", top_n=10)
    mf_ovr = r2b.model_fingerprints(recs, "overrated", top_n=10)
    return {"favorite": mf_fav, "overrated": mf_ovr}


# ===========================================================================
# 6. New-domain effect check: do the 7 v6-only domains give any model a
#    distinctive personality signal the old 43-domain scope didn't show?
# ===========================================================================
def run_new_domains_check(recs):
    r2a_new = run_r2a(recs, NEW_V6_DOMAINS, "new_domains_only")
    new_recs = [r for r in recs if r["domain"] in NEW_V6_DOMAINS]
    fp = {
        "favorite": r2b.model_fingerprints(new_recs, "favorite", top_n=5),
        "overrated": r2b.model_fingerprints(new_recs, "overrated", top_n=5),
    }
    return r2a_new, fp


# ===========================================================================
if __name__ == "__main__":
    os.makedirs(DATA_OUT, exist_ok=True)
    S = aa.load_summary()
    recs = aa.load_extracted(canonicalize=True, drop_refused=True)
    models = [m["id"] for m in S["models"]]
    family_of = aa.FAMILY
    all_domains = sorted(set(aa.DOMAIN_GROUP.keys()) | {"blogger"})  # v6: 50 domains

    print(f"v6 corpus: {len(recs)} non-refused rows, {len(all_domains)} domains, {len(models)} models\n")

    print("=" * 78); print("1. Q1 — convergence structure"); print("=" * 78)
    q1_out = run_q1(S, recs, models, family_of)
    for probe in PROBES:
        d = q1_out["decomposition"][probe]
        print(f"-- {probe} -- ratio domain/model = {d['ratio_domain_over_model']:.2f}x  "
              f"(domain {d['pct_domain']*100:.1f}%, model {d['pct_model']*100:.1f}%, "
              f"interaction {d['pct_interaction']*100:.1f}%)  p_domain={d['p_domain_effect']:.5f} "
              f"p_model={d['p_model_effect']:.5f}")
        f = q1_out["family"][probe]
        print(f"   family gap = {f['gap']:+.4f} (within={f['within_mean']:.4f} "
              f"between={f['between_mean']:.4f}) p={f['p']:.5f}")

    print("\n" + "=" * 78); print("2. Q2 — overrated>favorite asymmetry, metric dependence"); print("=" * 78)
    q2_out = run_q2(recs)
    print(f"[modal]   gap(ovr-fav) = {q2_out['modal']['gap_ovr_minus_fav']:+.4f}  "
          f"p_perm={q2_out['modal']['p_perm']:.4f}  p_sign={q2_out['modal']['p_sign']:.4g}")
    print(f"[entropy] gap(fav-ovr) = {q2_out['entropy']['gap_fav_minus_ovr']:+.4f}  "
          f"p_perm={q2_out['entropy']['p_perm']:.4f}  p_sign={q2_out['entropy']['p_sign']:.4g}")

    print("\n" + "=" * 78); print("3. R2-A — contrarian ranking (full v6 domain scope)"); print("=" * 78)
    r2a_out = run_r2a(recs, all_domains, "v6_full")
    write_r2a_csv(r2a_out, os.path.join(DATA_OUT, "v6_r2a_signatures.csv"))
    with open(os.path.join(DATA_OUT, "v6_r2a_full_results.json"), "w") as f:
        json.dump({"label": r2a_out["label"], "n_domains": r2a_out["n_domains"],
                    "ranking": r2a_out["ranking"],
                    "top6_vs_bottom6_perm_test": r2a_out["top6_vs_bottom6_perm_test"]}, f, indent=2)
    for i, r in enumerate(r2a_out["ranking"], 1):
        print(f"  {i:2d}. {r['label']:20s} {r['family']:9s} total={r['rate_total']:.3f} "
              f"({r['n_confident_total']}/{2*len(all_domains)})")
    tb = r2a_out["top6_vs_bottom6_perm_test"]
    print(f"  top6/bottom6 perm test: gap={tb['observed_gap']:+.4f} p={tb['p']:.5f}")

    print("\n" + "=" * 78); print("4. R2-C — taste-space clustering"); print("=" * 78)
    r2c_out = run_r2c()
    rc = r2c_out["combined"]
    print(f"family purity @k=6 (combined) = {rc['purity']:.4f}")
    for d in rc["detail"]:
        fams = ",".join(sorted(set(d["families"])))
        print(f"  cluster(n={d['size']}): {d['cluster_members']} families={fams}")
    all_pairs = r2c.all_pairs(rc["agree"], rc["labels"])
    all_pairs.sort(key=lambda x: -x[2])
    rank_of = {(a, b): i + 1 for i, (a, b, v) in enumerate(all_pairs)}
    def pair_rank(x, y):
        return rank_of.get((x, y)) or rank_of.get((y, x))
    print(f"  o3 x grok-4.5 rank = {pair_rank('o3', 'grok-4.5')} of {len(all_pairs)}  "
          f"value={dict(((a,b),v) for a,b,v in all_pairs).get(('o3','grok-4.5'), dict(((a,b),v) for a,b,v in all_pairs).get(('grok-4.5','o3')))}")
    print(f"  gpt-4o x gpt-5.6-sol rank = {pair_rank('gpt-4o', 'gpt-5.6-sol')} of {len(all_pairs)}")

    print("\n" + "=" * 78); print("5. R2-B — descriptor fingerprints (spot check)"); print("=" * 78)
    r2b_out = run_r2b(recs)
    for m in ("claude-opus-4-5", "grok-4.5", "gpt-4o", "deepseek-v4-pro"):
        top = [w for w, z, d, yi, yj in r2b_out["favorite"][m][:5]]
        print(f"  {aa.LABEL[m]:20s} FAV top5: {top}")

    print("\n" + "=" * 78); print("6. New-domain effect (musician/composer/song/director/proglang/sound/country)"); print("=" * 78)
    r2a_new, fp_new = run_new_domains_check(recs)
    write_r2a_csv(r2a_new, os.path.join(DATA_OUT, "v6_r2a_new_domains_only.csv"))
    print("Contrarian rate on JUST the 7 new domains (14 cells max per model):")
    for i, r in enumerate(r2a_new["ranking"], 1):
        print(f"  {i:2d}. {r['label']:20s} rate={r['rate_total']:.3f} ({r['n_confident_total']}/14)")
    print("\nFingerprint on JUST the 7 new domains (favorite, top word per model):")
    for m in aa.ALL_MODELS:
        top = fp_new["favorite"].get(m, [])
        w0 = top[0][0] if top else "(none confident)"
        print(f"  {aa.LABEL[m]:20s} {w0}")

    print("\nDone. v6_-prefixed tables written to analysis/data/.")
