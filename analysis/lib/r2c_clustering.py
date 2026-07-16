"""R2-C -- taste-space map: hand-rolled average-linkage (UPGMA) agglomerative
clustering over the 13x13 pairwise-agreement matrices in analysis/data/.

No scipy. Only numpy + stdlib (csv, math). The linkage algorithm below is
implemented from scratch (see `upgma()`); it is *not* a call into any
clustering library.

Usage:
    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/r2c_clustering.py

Writes:
    analysis/data/r2c_clusters.csv   (merge order for `combined` + cluster
                                       assignments at k=6 for all 3 matrices)
Prints:
    dendrograms, family-purity numbers, cross-lab surprise pairs, and the
    capability-axis descriptive check, i.e. everything analysis/round2/
    R2C_taste_space.md is built from.
"""
import sys, os, csv, math, itertools
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

ROOT = aa.ROOT
DATA = os.path.join(ROOT, "analysis", "data")
FAMILY = aa.FAMILY
LABEL = aa.LABEL
LADDER = aa.LADDER


# ---------------------------------------------------------------------------
# 0. IO
# ---------------------------------------------------------------------------
def load_matrix(path):
    with open(path) as f:
        r = csv.reader(f)
        header = next(r)
        models = header[1:]
        mat = []
        for row in r:
            mat.append([float(x) for x in row[1:]])
    return models, np.array(mat)


def agreement_to_distance(mat):
    """distance = 1 - agreement. Diagonal (self-agreement, shipped as 0.0000,
    i.e. never actually computed) is irrelevant to clustering and zeroed out.
    Symmetrized against float/independent-computation rounding."""
    d = 1.0 - mat
    np.fill_diagonal(d, 0.0)
    d = (d + d.T) / 2.0
    return d


# ---------------------------------------------------------------------------
# 1. UPGMA (average-linkage agglomerative clustering), hand-rolled
# ---------------------------------------------------------------------------
def upgma(dist, labels):
    """Average-linkage agglomerative clustering.

    At each step, merge the two active clusters with the smallest average
    pairwise distance, where "average pairwise distance between cluster A
    and cluster B" = mean over all (a in A, b in B) of dist[a,b]. Updated
    via the standard size-weighted Lance-Williams recurrence for UPGMA:
        d(A u B, C) = (|A| d(A,C) + |B| d(B,C)) / (|A| + |B|)
    which is exact (provable by induction: if d(A,C) and d(B,C) are already
    the true means over their cross-pairs, the weighted combination is the
    true mean over (A u B) x C).

    Returns (merges, node) where:
      merges: list of dicts in merge order, each
        {"a": cluster_id, "b": cluster_id, "height": float, "size": int,
         "members": [leaf indices]}
        cluster ids 0..n-1 are leaves (index into `labels`); ids n, n+1, ...
        are internal nodes numbered in merge order (mirrors scipy's linkage
        numbering convention).
      node: dict {cluster_id: {"height", "left", "right", "label", "leaves"}}
        usable directly for tree rendering / cutting.
    """
    n = dist.shape[0]
    clusters = {i: [i] for i in range(n)}
    D = {}
    for i in range(n):
        for j in range(i + 1, n):
            D[(i, j)] = float(dist[i, j])
    active = list(range(n))
    next_id = n
    merges = []
    node = {i: {"height": 0.0, "left": None, "right": None,
                "label": labels[i], "leaves": [i]} for i in range(n)}

    while len(active) > 1:
        best = None
        for x, y in itertools.combinations(active, 2):
            key = (x, y) if x < y else (y, x)
            d = D[key]
            if best is None or d < best[0]:
                best = (d, x, y)
        d, a, b = best
        size_a, size_b = len(clusters[a]), len(clusters[b])
        merged_leaves = clusters[a] + clusters[b]
        new_id = next_id
        next_id += 1
        clusters[new_id] = merged_leaves

        for c in active:
            if c == a or c == b:
                continue
            key_a = (a, c) if a < c else (c, a)
            key_b = (b, c) if b < c else (c, b)
            new_d = (size_a * D[key_a] + size_b * D[key_b]) / (size_a + size_b)
            key_new = (new_id, c) if new_id < c else (c, new_id)
            D[key_new] = new_d

        active.remove(a)
        active.remove(b)
        active.append(new_id)
        merges.append({"a": a, "b": b, "height": d, "size": size_a + size_b,
                        "members": merged_leaves})
        node[new_id] = {"height": d, "left": a, "right": b,
                         "label": None, "leaves": merged_leaves}
    return merges, node


def check_monotone(merges):
    """UPGMA heights are provably non-decreasing under a metric-like distance
    (no guaranteed inversions like single/complete linkage can't have either,
    but worth a runtime check on real, noisy data)."""
    heights = [m["height"] for m in merges]
    return all(heights[i] <= heights[i + 1] + 1e-12 for i in range(len(heights) - 1)), heights


# ---------------------------------------------------------------------------
# 2. Cutting the tree into k flat clusters
# ---------------------------------------------------------------------------
def cut_k(n, merges, k):
    """Union-find over leaves, replaying the first (n-k) merges (lowest
    heights first, since merges is already in ascending-height order) ->
    exactly k groups remain. Returns {leaf_idx: cluster_root_id}."""
    parent = {i: i for i in range(n)}
    cache = {}  # per-call cache, keyed on this specific `merges` list

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[ry] = rx

    m = max(0, n - k)
    for step in range(m):
        merge = merges[step]
        a_leaves = leaves_of(merges, n, merge["a"], cache)
        b_leaves = leaves_of(merges, n, merge["b"], cache)
        union(a_leaves[0], b_leaves[0])
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return groups


def leaves_of(merges, n, cid, cache):
    if cid < n:
        return [cid]
    if cid in cache:
        return cache[cid]
    merge = merges[cid - n]
    out = merge["members"]
    cache[cid] = out
    return out


# ---------------------------------------------------------------------------
# 3. ASCII dendrogram (tree form, annotated with merge heights)
# ---------------------------------------------------------------------------
def render_ascii_tree(node, root_id):
    lines = []

    def rec(nid, prefix, is_last, is_root):
        n = node[nid]
        if n["left"] is None:
            connector = "" if is_root else ("`-- " if is_last else "|-- ")
            lines.append(f"{prefix}{connector}{n['label']}")
            return
        connector = "" if is_root else ("`-- " if is_last else "|-- ")
        lines.append(f"{prefix}{connector}[h={n['height']:.4f}] (n={len(n['leaves'])})")
        new_prefix = prefix if is_root else prefix + ("    " if is_last else "|   ")
        rec(n["left"], new_prefix, False, False)
        rec(n["right"], new_prefix, True, False)

    rec(root_id, "", True, True)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 4. Family purity at a cut
# ---------------------------------------------------------------------------
def family_purity(groups, labels, family_of):
    """Standard purity: sum over clusters of (size of that cluster's majority
    family) / total n. 1.0 = perfectly recovers family partition (as a
    refinement or exact match); low values = clustering cuts across family."""
    n = sum(len(v) for v in groups.values())
    correct = 0
    detail = []
    for cid, idxs in groups.items():
        fams = [family_of[labels[i]] for i in idxs]
        cnt = {}
        for f in fams:
            cnt[f] = cnt.get(f, 0) + 1
        maj_fam, maj_n = max(cnt.items(), key=lambda kv: kv[1])
        correct += maj_n
        detail.append({
            "cluster_members": [labels[i] for i in idxs],
            "families": fams, "majority_family": maj_fam,
            "majority_count": maj_n, "size": len(idxs),
        })
    return correct / n, detail


# ---------------------------------------------------------------------------
# 5. Cross-lab surprises
# ---------------------------------------------------------------------------
def all_pairs(mat, labels):
    n = len(labels)
    out = []
    for i in range(n):
        for j in range(i + 1, n):
            out.append((labels[i], labels[j], float(mat[i, j])))
    return out


def cross_lab_extremes(mat, labels, family_of, top_n=6):
    pairs = all_pairs(mat, labels)
    diff_lab = [(a, b, v) for a, b, v in pairs if family_of[a] != family_of[b]]
    same_lab = [(a, b, v) for a, b, v in pairs if family_of[a] == family_of[b]]
    diff_lab.sort(key=lambda x: -x[2])
    same_lab.sort(key=lambda x: x[2])
    return diff_lab[:top_n], same_lab[:top_n]


def singleton_nearest_family(mat, labels, family_of, singleton_model):
    n = len(labels)
    idx = {m: i for i, m in enumerate(labels)}
    i = idx[singleton_model]
    by_fam = {}
    for j, m in enumerate(labels):
        if j == i:
            continue
        fam = family_of[m]
        by_fam.setdefault(fam, []).append(mat[i, j])
    means = {fam: float(np.mean(vs)) for fam, vs in by_fam.items()}
    ranked = sorted(means.items(), key=lambda kv: -kv[1])
    return ranked


# ---------------------------------------------------------------------------
# 6. Capability axis (descriptive)
# ---------------------------------------------------------------------------
def capability_rung_matchup(mat, labels):
    """Cross-family agreement at matched capability rungs: Anthropic rung i
    vs OpenAI rung i (both real ladders per aa.LADDER), i=1..3 (Anthropic
    ladder tops out at 3; Fable-5 excluded as a creative variant per aa.py)."""
    idx = {m: i for i, m in enumerate(labels)}
    anth = LADDER["Anthropic"]
    openai = LADDER["OpenAI"]
    rows = []
    for r in range(min(len(anth), len(openai))):
        a, b = anth[r], openai[r]
        rows.append((r + 1, a, b, float(mat[idx[a], idx[b]])))
    return rows


def within_family_rung_gap(mat, labels, family_of):
    """Within Anthropic and OpenAI: does agreement between adjacent rungs
    change as capability rises? (weakest-vs-2nd vs top-two-rungs-vs-each-other)"""
    idx = {m: i for i, m in enumerate(labels)}
    out = {}
    for fam, ladder in LADDER.items():
        if fam == "Google":
            continue  # weak ladder per aa.py, skip for this test
        vals = []
        for i in range(len(ladder) - 1):
            a, b = ladder[i], ladder[i + 1]
            vals.append((f"{a}~{b}", float(mat[idx[a], idx[b]])))
        out[fam] = vals
    return out


# ---------------------------------------------------------------------------
# main driver
# ---------------------------------------------------------------------------
def analyze_matrix(name, path, k=6):
    labels, agree = load_matrix(path)
    dist = agreement_to_distance(agree)
    merges, node = upgma(dist, labels)
    mono, heights = check_monotone(merges)
    root_id = max(node.keys())
    tree_txt = render_ascii_tree(node, root_id)
    groups = cut_k(len(labels), merges, k)
    purity, detail = family_purity(groups, labels, FAMILY)
    diff_lab, same_lab = cross_lab_extremes(agree, labels, FAMILY)
    return {
        "labels": labels, "agree": agree, "dist": dist,
        "merges": merges, "node": node, "monotone": mono,
        "tree_txt": tree_txt, "groups": groups, "purity": purity,
        "detail": detail, "diff_lab_top": diff_lab, "same_lab_bottom": same_lab,
    }


def write_clusters_csv(results, out_path, k=6):
    fieldnames = ["record_type", "matrix", "step", "a", "b", "height", "size",
                  "model", "cluster_k", "family"]
    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        # full merge order only for the primary (combined) matrix
        r = results["combined"]
        labels = r["labels"]
        for step, m in enumerate(r["merges"], start=1):
            a_lab = labels[m["a"]] if m["a"] < len(labels) else f"cluster{m['a']}"
            b_lab = labels[m["b"]] if m["b"] < len(labels) else f"cluster{m['b']}"
            w.writerow({"record_type": "merge", "matrix": "combined", "step": step,
                        "a": a_lab, "b": b_lab, "height": f"{m['height']:.4f}",
                        "size": m["size"], "model": "", "cluster_k": "", "family": ""})
        # cluster assignment at k for every matrix
        for name, r in results.items():
            labels = r["labels"]
            for cid, idxs in r["groups"].items():
                for i in idxs:
                    w.writerow({"record_type": "assignment", "matrix": name, "step": "",
                                "a": "", "b": "", "height": "", "size": len(idxs),
                                "model": labels[i], "cluster_k": cid,
                                "family": FAMILY[labels[i]]})


if __name__ == "__main__":
    os.makedirs(DATA, exist_ok=True)
    K = 6
    matrices = {
        "combined": os.path.join(DATA, "q1_pairwise_agreement_combined.csv"),
        "favorite": os.path.join(DATA, "q1_pairwise_agreement_favorite.csv"),
        "overrated": os.path.join(DATA, "q1_pairwise_agreement_overrated.csv"),
    }
    results = {}
    for name, path in matrices.items():
        results[name] = analyze_matrix(name, path, k=K)

    for name in ("combined", "favorite", "overrated"):
        r = results[name]
        print("=" * 78)
        print(f"MATRIX: {name}   (monotone heights: {r['monotone']})")
        print("=" * 78)
        print(r["tree_txt"])
        print(f"\n-- cut at k={K} -- family purity = {r['purity']:.4f}")
        for d in r["detail"]:
            fams = ",".join(sorted(set(d["families"])))
            print(f"  cluster(n={d['size']}): {d['cluster_members']}  "
                  f"families={fams}  majority={d['majority_family']}({d['majority_count']}/{d['size']})")
        print(f"\n-- top cross-lab (different-family) agreements --")
        for a, b, v in r["diff_lab_top"]:
            print(f"  {a} ({FAMILY[a]}) x {b} ({FAMILY[b]}) = {v:.4f}")
        print(f"-- bottom same-lab (same-family) agreements --")
        for a, b, v in r["same_lab_bottom"]:
            print(f"  {a} x {b}  [{FAMILY[a]}] = {v:.4f}")
        print()

    print("=" * 78)
    print("SINGLETON FAMILIES -- nearest lab by mean agreement (combined matrix)")
    print("=" * 78)
    labels_c, agree_c = results["combined"]["labels"], results["combined"]["agree"]
    for singleton in ("deepseek-v4-pro", "kimi-k2.6", "grok-4.5"):
        ranked = singleton_nearest_family(agree_c, labels_c, FAMILY, singleton)
        print(f"  {singleton}: " + ", ".join(f"{f}={v:.4f}" for f, v in ranked))

    print("\n" + "=" * 78)
    print("CAPABILITY AXIS (descriptive) -- combined matrix")
    print("=" * 78)
    print("Matched-rung cross-family agreement (Anthropic rung i vs OpenAI rung i):")
    for rung, a, b, v in capability_rung_matchup(agree_c, labels_c):
        print(f"  rung {rung}: {a} x {b} = {v:.4f}")
    print("\nWithin-ladder adjacent-rung agreement (does it rise with capability?):")
    for fam, vals in within_family_rung_gap(agree_c, labels_c, FAMILY).items():
        print(f"  {fam}: " + ", ".join(f"{k}={v:.4f}" for k, v in vals))

    out_csv = os.path.join(DATA, "r2c_clusters.csv")
    write_clusters_csv(results, out_csv, k=K)
    print(f"\nWrote {out_csv}")
