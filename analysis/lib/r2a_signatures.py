"""R2-A — each model's signature divergences: where does each model reliably
break from the field?

For every (model, domain, probe) cell we compare the model's own modal pick
against the LEAVE-ONE-OUT field modal pick (the modal pick pooled across the
*other* 12 models in that same domain/probe cell). A "divergence" is a cell
where the two differ. We weight each divergence by how confident *both* sides
are (model's own concentration x field's concentration), and separately track
the cross-model "breadth" of the model's pick (how many of the other 12
models ever name it at all in that cell) to distinguish "picks a different
majority" from "picks something almost nobody else says".

Restricted to the same 43-domain set Round 1 used (excludes legacy bookcover/
chair AND 7 newer pilot domains -- composer, country, director, musician,
proglang, song, sound -- that summary.json has grown since Round 1 but that
Round 1's headline 68% interaction number did not cover; see caveats in the
report).

Usage:
    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/r2a_signatures.py
"""
import sys, os, json, csv, re
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

ROOT = aa.ROOT
DATA_OUT = os.path.join(ROOT, "analysis", "data")
PROBES = ("favorite", "overrated")

# The 43 domains from DATA_DICTIONARY.md / Round 1 (excludes bookcover, chair,
# and the 7 domains added to summary.json after Round 1 shipped).
DOMAINS_43 = [
    "book", "film", "album", "architect", "city", "painting", "poem", "word",
    "typeface", "object", "videogame", "building", "street", "uscity",
    "cuisine", "dish", "color", "season", "smell", "decade", "novelist",
    "philosopher", "religioustext", "artmovement", "monument", "tvshow",
    "actor", "actress", "play", "musical", "economist", "scientist",
    "theologian", "mathematician", "blogger", "computerscientist",
    "airesearcher", "aimodel", "historian", "psychologist", "boardgame",
    "sport", "childrensbook",
]

MODELS = list(aa.FAMILY.keys())

# Confidence thresholds (empirically grounded, see report Method section):
# model_conc median across all cells = 0.83, 25th pctile = 0.58 -> 0.5 keeps
# a model's pick counting as "its own majority" without being so strict we
# throw out most cells. field_conc median = 0.36 (pooling 12 different
# models is naturally much more spread than one model's repeated samples)
# -> 0.3 marks a real plurality leader in the field, not noise.
MODEL_CONC_THRESH = 0.5
FIELD_CONC_THRESH = 0.3
MIN_N = 4  # below this a model's own "concentration" is too noisy to trust
GROUP_OF = dict(aa.DOMAIN_GROUP)
GROUP_OF.setdefault("blogger", "people")  # dictionary omits it from groupings; it's a thinker/creator domain

_ARTICLE_RE = re.compile(r"^(the|a|an)\s+")


def strip_article(s):
    """aa.py's canonicalization (lowercase+strip+alias-map) is documented as
    NOT catching near-duplicates like 'The Mona Lisa' vs 'Mona Lisa' --
    data/aliases.json ships with EMPTY per-domain maps for most domains
    (verified: painting, decade, religioustext, monument all {} ), so this
    exact collision is live in the data (19 article-prefix collision groups
    found across domains, e.g. painting: 'the mona lisa'/'mona lisa'; decade:
    'the 1980s'/'1980s'; religioustext: 'the tao te ching'/'tao te ching').
    We strip a leading the/a/an on top of aa's canon before grouping, purely
    to avoid manufacturing false divergences out of string-formatting noise."""
    return _ARTICLE_RE.sub("", s).strip()


def build_cell_counts(recs):
    """cell_counts[(domain, probe, model)] = Counter(entity_canon -> count)"""
    cc = {}
    for r in recs:
        if r["domain"] not in DOMAINS_43 or r["probe"] not in PROBES:
            continue
        if not r.get("entity_canon"):
            continue
        if r["model"] not in MODELS:
            continue
        k = (r["domain"], r["probe"], r["model"])
        cc.setdefault(k, Counter())[strip_article(r["entity_canon"])] += 1
    return cc


def top1(counter):
    """Deterministic modal pick: highest count, ties broken alphabetically."""
    return sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[0]


def divergence_map(cell_counts):
    """Compute one row per (domain, probe, model). Returns list of dicts."""
    rows = []
    for d in DOMAINS_43:
        for p in PROBES:
            # cache pooled-all count for breadth lookups
            per_model_dist = {m: cell_counts.get((d, p, m), Counter()) for m in MODELS}
            for m in MODELS:
                own = per_model_dist[m]
                mn = sum(own.values())
                if mn == 0:
                    continue
                m_pick, m_count = top1(own)
                m_conc = m_count / mn

                field = Counter()
                for m2 in MODELS:
                    if m2 == m:
                        continue
                    field.update(per_model_dist[m2])
                fn = sum(field.values())
                if fn == 0:
                    continue
                f_pick, f_count = top1(field)
                f_conc = f_count / fn

                diverges = m_pick != f_pick
                score = (m_conc * f_conc) if diverges else 0.0
                breadth_other = sum(
                    1 for m2 in MODELS if m2 != m and per_model_dist[m2].get(m_pick, 0) > 0
                )
                confident = diverges and mn >= MIN_N and m_conc >= MODEL_CONC_THRESH and f_conc >= FIELD_CONC_THRESH

                rows.append({
                    "domain": d, "probe": p, "model": m, "group": GROUP_OF.get(d, "other"),
                    "model_n": mn, "model_pick": m_pick, "model_count": m_count, "model_conc": m_conc,
                    "field_n": fn, "field_pick": f_pick, "field_count": f_count, "field_conc": f_conc,
                    "diverges": diverges, "score": score, "breadth_other": breadth_other,
                    "confident_divergence": confident,
                })
    return rows


def per_model_signatures(rows):
    """Build the per-model signature bundle: confident divergences, top
    'uniquely loved/disdained' picks (low breadth_other), domain-group
    concentration, and overall/probe-split divergence rates."""
    by_model = {m: [] for m in MODELS}
    for r in rows:
        by_model[r["model"]].append(r)

    out = {}
    n_cells_per_probe = len(DOMAINS_43)  # denominator for a rate, per probe
    for m in MODELS:
        rs = by_model[m]
        confident = [r for r in rs if r["confident_divergence"]]
        conf_fav = [r for r in confident if r["probe"] == "favorite"]
        conf_ovr = [r for r in confident if r["probe"] == "overrated"]

        # "signature" picks: confident divergences ranked by (breadth_other asc,
        # score desc) -- prioritize things almost nobody else names, then by
        # how strongly both sides agree with themselves.
        sig_fav = sorted(conf_fav, key=lambda r: (r["breadth_other"], -r["score"]))
        sig_ovr = sorted(conf_ovr, key=lambda r: (r["breadth_other"], -r["score"]))

        # domain-group spread of this model's confident divergences (both probes)
        grp_counts = Counter(r["group"] for r in confident)
        total_conf = len(confident)
        if total_conf > 0:
            top_group, top_group_n = grp_counts.most_common(1)[0]
            top_group_share = top_group_n / total_conf
            group_entropy = aa.norm_entropy(grp_counts)
        else:
            top_group, top_group_n, top_group_share, group_entropy = None, 0, 0.0, 0.0

        out[m] = {
            "model": m, "family": aa.FAMILY[m], "label": aa.LABEL[m],
            "n_confident_favorite": len(conf_fav),
            "n_confident_overrated": len(conf_ovr),
            "n_confident_total": total_conf,
            "rate_favorite": len(conf_fav) / n_cells_per_probe,
            "rate_overrated": len(conf_ovr) / n_cells_per_probe,
            "rate_total": total_conf / (2 * n_cells_per_probe),
            "top_group": top_group, "top_group_n": top_group_n,
            "top_group_share": top_group_share, "group_entropy": group_entropy,
            "group_counts": dict(grp_counts),
            "signature_favorite": sig_fav,
            "signature_overrated": sig_ovr,
        }
    return out


def fmt_row(r):
    return (f"{r['domain']}/{r['probe']}: \"{r['model_pick']}\" "
            f"({r['model_count']}/{r['model_n']}={r['model_conc']:.2f}) vs field "
            f"\"{r['field_pick']}\" ({r['field_count']}/{r['field_n']}={r['field_conc']:.2f}); "
            f"breadth_other={r['breadth_other']}/12")


if __name__ == "__main__":
    os.makedirs(DATA_OUT, exist_ok=True)
    recs = aa.load_extracted(canonicalize=True, drop_refused=True)
    cell_counts = build_cell_counts(recs)
    rows = divergence_map(cell_counts)
    sigs = per_model_signatures(rows)

    # ---- contrarian ranking -------------------------------------------
    ranked_total = sorted(sigs.values(), key=lambda s: -s["rate_total"])
    ranked_fav = sorted(sigs.values(), key=lambda s: -s["rate_favorite"])
    ranked_ovr = sorted(sigs.values(), key=lambda s: -s["rate_overrated"])

    print("=" * 78)
    print(f"Divergence map: {len(rows)} (model,domain,probe) cells scored, "
          f"{sum(1 for r in rows if r['confident_divergence'])} confident divergences "
          f"(model_conc>={MODEL_CONC_THRESH}, field_conc>={FIELD_CONC_THRESH}, n>={MIN_N})")
    print("=" * 78)
    print("\nCONTRARIAN RANKING (total confident-divergence rate, out of 86 cells each)")
    for i, s in enumerate(ranked_total, 1):
        print(f"  {i:2d}. {s['label']:20s} {s['family']:9s} total={s['rate_total']:.3f} "
              f"({s['n_confident_total']}/86)  fav={s['rate_favorite']:.3f} ovr={s['rate_overrated']:.3f}")

    print("\nFAVORITE-only ranking:")
    for i, s in enumerate(ranked_fav, 1):
        print(f"  {i:2d}. {s['label']:20s} rate={s['rate_favorite']:.3f} ({s['n_confident_favorite']}/43)")

    print("\nOVERRATED-only ranking:")
    for i, s in enumerate(ranked_ovr, 1):
        print(f"  {i:2d}. {s['label']:20s} rate={s['rate_overrated']:.3f} ({s['n_confident_overrated']}/43)")

    print("\n" + "=" * 78)
    print("PER-MODEL SIGNATURE SKETCHES (top signature picks)")
    print("=" * 78)
    for m in MODELS:
        s = sigs[m]
        print(f"\n--- {s['label']} ({s['family']}) ---")
        print(f"  confident divergences: {s['n_confident_total']}/86 "
              f"(fav {s['n_confident_favorite']}/43, ovr {s['n_confident_overrated']}/43)")
        if s["n_confident_total"] > 0:
            print(f"  domain-group concentration: top group = {s['top_group']} "
                  f"({s['top_group_n']}/{s['n_confident_total']} = {s['top_group_share']:.2f}), "
                  f"group-spread entropy = {s['group_entropy']:.2f} (0=all one group, 1=maximally spread)")
            print(f"  group breakdown: {s['group_counts']}")
        print("  top uniquely-favored picks (favorite probe):")
        for r in s["signature_favorite"][:5]:
            print(f"    {fmt_row(r)}")
        print("  top uniquely-panned picks (overrated probe):")
        for r in s["signature_overrated"][:5]:
            print(f"    {fmt_row(r)}")

    # ---- is the model-to-model spread in divergence rate real, or noise? --
    # Split into top-6 vs bottom-6 by rate_total (drop the median 13th model),
    # flatten each model's 86 per-cell confident_divergence 0/1 indicators,
    # and permutation-test the difference in mean rate (aa.perm_test).
    cell_flags = {m: [0] * (2 * len(DOMAINS_43)) for m in MODELS}
    idx_of_cell = {}
    ci = 0
    for d in DOMAINS_43:
        for p in PROBES:
            idx_of_cell[(d, p)] = ci
            ci += 1
    for r in rows:
        cell_flags[r["model"]][idx_of_cell[(r["domain"], r["probe"])]] = int(r["confident_divergence"])

    top6 = [s["model"] for s in ranked_total[:6]]
    bottom6 = [s["model"] for s in ranked_total[-6:]]
    group_a = [v for m in top6 for v in cell_flags[m]]
    group_b = [v for m in bottom6 for v in cell_flags[m]]
    obs_gap, p_gap = aa.perm_test(group_a, group_b, stat=lambda x: sum(x) / len(x), n=20000, seed=7)
    print("\n" + "=" * 78)
    print("IS THE MODEL SPREAD REAL? top-6 vs bottom-6 contrarian-rate permutation test")
    print("=" * 78)
    print(f"  top-6 models:    {[aa.LABEL[m] for m in top6]}")
    print(f"  bottom-6 models: {[aa.LABEL[m] for m in bottom6]}")
    print(f"  observed gap in per-cell confident-divergence rate = {obs_gap:+.4f}, "
          f"permutation p (two-sided, n=20000) = {p_gap:.5f}")

    # favorite vs overrated rate correlation across the 13 models (descriptive)
    import numpy as np
    fav_rates = np.array([sigs[m]["rate_favorite"] for m in MODELS])
    ovr_rates = np.array([sigs[m]["rate_overrated"] for m in MODELS])
    fav_ovr_corr = float(np.corrcoef(fav_rates, ovr_rates)[0, 1])
    print(f"\n  Pearson r between each model's favorite-divergence-rate and "
          f"overrated-divergence-rate across the 13 models: {fav_ovr_corr:.3f} (descriptive, n=13)")

    # ---- cross-check against Q1 odd-model-out ranking -------------------
    q1_path = os.path.join(DATA_OUT, "q1_model_convergence_rank.json")
    if os.path.exists(q1_path):
        with open(q1_path) as f:
            q1 = json.load(f)
        q1_combined = q1["combined"]  # list of {model, family, mean_overlap}, ascending = least convergent first
        q1_rank = {row["model"]: i + 1 for i, row in enumerate(q1_combined)}  # rank 1 = least convergent (most idiosyncratic)
        our_rank = {s["model"]: i + 1 for i, s in enumerate(ranked_total)}  # rank 1 = most divergent
        print("\n" + "=" * 78)
        print("CROSS-CHECK vs Q1 odd-model-out ranking (combined-probe mean overlap, rank 1 = most idiosyncratic)")
        print("=" * 78)
        for m in MODELS:
            print(f"  {aa.LABEL[m]:20s} R2A divergence rank={our_rank[m]:2d}   Q1 odd-one-out rank={q1_rank[m]:2d}")
        # simple rank correlation (Spearman via Pearson on ranks, no scipy)
        import numpy as np
        a = np.array([our_rank[m] for m in MODELS])
        b = np.array([q1_rank[m] for m in MODELS])
        corr = float(np.corrcoef(a, b)[0, 1])
        print(f"\n  Spearman rank correlation (R2A divergence rank vs Q1 odd-one-out rank): {corr:.3f}")

    # ---- write CSV: per-model signature table ---------------------------
    csv_path = os.path.join(DATA_OUT, "r2a_signatures.csv")
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "model", "label", "family", "n_confident_favorite", "n_confident_overrated",
            "n_confident_total", "rate_favorite", "rate_overrated", "rate_total",
            "top_group", "top_group_share", "group_entropy",
            "top_favorite_pick_1", "top_favorite_pick_2", "top_favorite_pick_3",
            "top_overrated_pick_1", "top_overrated_pick_2", "top_overrated_pick_3",
        ])

        def pick_str(r):
            if r is None:
                return ""
            return (f"{r['domain']}:{r['model_pick']} "
                    f"(own {r['model_count']}/{r['model_n']}, breadth {r['breadth_other']}/12, "
                    f"field picks {r['field_pick']} {r['field_count']}/{r['field_n']})")

        for m in MODELS:
            s = sigs[m]
            fav = s["signature_favorite"] + [None, None, None]
            ovr = s["signature_overrated"] + [None, None, None]
            w.writerow([
                m, s["label"], s["family"], s["n_confident_favorite"], s["n_confident_overrated"],
                s["n_confident_total"], f"{s['rate_favorite']:.4f}", f"{s['rate_overrated']:.4f}",
                f"{s['rate_total']:.4f}", s["top_group"], f"{s['top_group_share']:.3f}",
                f"{s['group_entropy']:.3f}",
                pick_str(fav[0]), pick_str(fav[1]), pick_str(fav[2]),
                pick_str(ovr[0]), pick_str(ovr[1]), pick_str(ovr[2]),
            ])
    print(f"\nWrote {csv_path}")

    # ---- write full JSON dump for reproducibility / report-writing -----
    json_path = os.path.join(DATA_OUT, "r2a_full_results.json")

    def ser_rows(rs):
        return [{k: v for k, v in r.items()} for r in rs]

    dump = {
        "params": {
            "MODEL_CONC_THRESH": MODEL_CONC_THRESH, "FIELD_CONC_THRESH": FIELD_CONC_THRESH,
            "MIN_N": MIN_N, "n_domains": len(DOMAINS_43),
        },
        "top6_vs_bottom6_perm_test": {
            "top6": top6, "bottom6": bottom6, "observed_gap": obs_gap, "p": p_gap,
        },
        "favorite_vs_overrated_rate_corr": fav_ovr_corr,
        "contrarian_ranking_total": [{"model": s["model"], "label": s["label"], "family": s["family"],
                                       "rate_total": s["rate_total"], "n": s["n_confident_total"]}
                                      for s in ranked_total],
        "contrarian_ranking_favorite": [{"model": s["model"], "label": s["label"],
                                          "rate_favorite": s["rate_favorite"], "n": s["n_confident_favorite"]}
                                         for s in ranked_fav],
        "contrarian_ranking_overrated": [{"model": s["model"], "label": s["label"],
                                           "rate_overrated": s["rate_overrated"], "n": s["n_confident_overrated"]}
                                          for s in ranked_ovr],
        "per_model": {
            m: {
                "label": s["label"], "family": s["family"],
                "n_confident_favorite": s["n_confident_favorite"],
                "n_confident_overrated": s["n_confident_overrated"],
                "n_confident_total": s["n_confident_total"],
                "rate_favorite": s["rate_favorite"], "rate_overrated": s["rate_overrated"],
                "rate_total": s["rate_total"],
                "top_group": s["top_group"], "top_group_share": s["top_group_share"],
                "group_entropy": s["group_entropy"], "group_counts": s["group_counts"],
                "signature_favorite": ser_rows(s["signature_favorite"][:10]),
                "signature_overrated": ser_rows(s["signature_overrated"][:10]),
            } for m, s in sigs.items()
        },
    }
    with open(json_path, "w") as f:
        json.dump(dump, f, indent=2)
    print(f"Wrote {json_path}")
