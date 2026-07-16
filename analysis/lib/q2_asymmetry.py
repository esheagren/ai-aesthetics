"""Q2 — Do models converge more on what they REJECT (overrated) than what they LOVE
(favorite), and does this reverse for people/thinker domains?

Reusable computation backing analysis/round1/Q2_reject_vs_love.md. Uses aa.py's
canonicalized loader (data/aliases.json applied) and its norm_entropy(); implements its
own PAIRED permutation machinery (aa.perm_test is an independent-samples pooled-shuffle
test, wrong tool for a per-domain paired design).

Run directly: `python3 analysis/lib/q2_asymmetry.py` — prints the full results and writes
analysis/data/q2_consensus_by_domain.csv.

No network, no scipy/pandas — python3 + numpy(unused here)/stdlib only, per house style.
"""
import sys, os, csv, random
from math import comb
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa

# ---------------------------------------------------------------------------
# Domain scope: 43 official domains per DATA_DICTIONARY.md. aa.DOMAIN_GROUP covers 42 of
# them (cultural/people/places/design_sensory/meta); "blogger" is the 43rd domain and is
# NOT assigned to any of the five groups in the data dictionary's own grouping table — we
# keep it in the overall 43-domain paired test but mark its group "ungrouped" and exclude
# it from the group-vs-group reversal test. Legacy pilot domains bookcover/chair (in the
# raw data but not the shipped 43-domain panel) are excluded throughout.
LEGACY_DOMAINS = {"bookcover", "chair"}
OFFICIAL_DOMAINS = sorted(set(aa.DOMAIN_GROUP.keys()) | {"blogger"})
# Round 1 shipped 43 domains. v6 (2026-07) added musician, composer, song, director,
# proglang, sound, country to aa.DOMAIN_GROUP -> 50. Tolerate either known vintage
# (this module is re-run as-is for the v6 robustness check in analysis/round3) but
# still fail loud if aa.py's domain map breaks in some other way.
assert len(OFFICIAL_DOMAINS) in (43, 50), len(OFFICIAL_DOMAINS)
GROUP_OF = dict(aa.DOMAIN_GROUP)  # blogger absent -> .get(..., "ungrouped")


def build_dist(recs):
    """dist[domain][probe][model] = Counter(entity_canon), non-empty picks only."""
    dist = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))
    for r in recs:
        d, p, m, e = r["domain"], r["probe"], r["model"], r["entity_canon"]
        if d not in OFFICIAL_DOMAINS or d in LEGACY_DOMAINS:
            continue
        if not e:
            continue
        dist[d][p][m][e] += 1
    return dist


def modal_agreement(dist_dp):
    """dist_dp: {model: Counter(entity_canon)} for one (domain, probe).
    Metric (a): fraction of present models whose OWN modal pick equals the plurality
    modal pick across models. Returns (frac, n_models_present, winning_entity)."""
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
    """Metric (b): mean of per-model normalized Shannon entropy over that model's own
    pick distribution for this (domain, probe). Lower = more decisive/consensual."""
    vals = [aa.norm_entropy(c) for c in dist_dp.values() if c]
    return (sum(vals) / len(vals)) if vals else None


def paired_sign_flip_test(diffs, n=20000, seed=0):
    """Paired permutation test on domain-level differences. Null: the sign of each
    domain's (overrated - favorite) difference is an independent fair coin flip (i.e.
    favorite/overrated are exchangeable within each domain-pair — the 'swap within pair'
    null). Two-sided p on the mean difference. Deterministic given seed."""
    rng = random.Random(seed)
    diffs = list(diffs)
    obs = sum(diffs) / len(diffs)
    absd = [abs(d) for d in diffs]
    cnt = 0
    for _ in range(n):
        s = sum(a if rng.random() < 0.5 else -a for a in absd)
        m = s / len(diffs)
        if abs(m) >= abs(obs) - 1e-12:
            cnt += 1
    return obs, (cnt + 1) / (n + 1)


def exact_sign_test(diffs):
    """Exact two-sided binomial sign test (p=0.5 null) on nonzero paired differences."""
    pos = sum(1 for d in diffs if d > 0)
    neg = sum(1 for d in diffs if d < 0)
    zero = sum(1 for d in diffs if d == 0)
    n = pos + neg
    if n == 0:
        return pos, neg, zero, 1.0
    k = min(pos, neg)
    tail = sum(comb(n, i) for i in range(0, k + 1)) / (2 ** n)
    return pos, neg, zero, min(1.0, 2 * tail)


def group_label_shuffle_test(vals_a, vals_b, n=20000, seed=1):
    """Unpaired label-shuffle permutation test: does mean(vals_a) differ from
    mean(vals_b)? Used to test whether the people-group gap differs from the pooled
    cultural+places gap. Two-sided p on the mean difference."""
    rng = random.Random(seed)
    obs = (sum(vals_a) / len(vals_a)) - (sum(vals_b) / len(vals_b))
    pool = list(vals_a) + list(vals_b)
    na = len(vals_a)
    cnt = 0
    for _ in range(n):
        rng.shuffle(pool)
        d = (sum(pool[:na]) / na) - (sum(pool[na:]) / len(pool[na:]))
        if abs(d) >= abs(obs) - 1e-12:
            cnt += 1
    return obs, (cnt + 1) / (n + 1)


def find_dual_entities(recs):
    """Per domain: canonicalized entities named under BOTH favorite and overrated,
    with their (favorite_count, overrated_count), sorted by the smaller side (most
    balanced / most simultaneously-loved-and-hated first)."""
    fav, ovr = defaultdict(Counter), defaultdict(Counter)
    for r in recs:
        d, e = r["domain"], r["entity_canon"]
        if d not in OFFICIAL_DOMAINS or d in LEGACY_DOMAINS or not e:
            continue
        (fav if r["probe"] == "favorite" else ovr)[d][e] += 1
    out = {}
    for d in OFFICIAL_DOMAINS:
        shared = set(fav[d]) & set(ovr[d])
        if not shared:
            continue
        rows = sorted(((e, fav[d][e], ovr[d][e]) for e in shared), key=lambda x: -min(x[1], x[2]))
        out[d] = rows
    return out


def build_rows(dist):
    rows = []
    for d in OFFICIAL_DOMAINS:
        fav_dp, ovr_dp = dist[d].get("favorite", {}), dist[d].get("overrated", {})
        fav_frac, fav_n, fav_win = modal_agreement(fav_dp)
        ovr_frac, ovr_n, ovr_win = modal_agreement(ovr_dp)
        fav_ent, ovr_ent = mean_cell_entropy(fav_dp), mean_cell_entropy(ovr_dp)
        rows.append({
            "domain": d, "group": GROUP_OF.get(d, "ungrouped"),
            "n_models_favorite": fav_n, "n_models_overrated": ovr_n,
            "modal_frac_favorite": round(fav_frac, 4), "modal_frac_overrated": round(ovr_frac, 4),
            "modal_winner_favorite": fav_win, "modal_winner_overrated": ovr_win,
            "modal_gap_ovr_minus_fav": round(ovr_frac - fav_frac, 4),
            "entropy_favorite": round(fav_ent, 4) if fav_ent is not None else "",
            "entropy_overrated": round(ovr_ent, 4) if ovr_ent is not None else "",
            "entropy_gap_fav_minus_ovr": round(fav_ent - ovr_ent, 4) if (fav_ent is not None and ovr_ent is not None) else "",
        })
    return rows


def write_csv(rows, path):
    fields = ["domain", "group", "n_models_favorite", "n_models_overrated",
              "modal_frac_favorite", "modal_frac_overrated",
              "modal_winner_favorite", "modal_winner_overrated",
              "modal_gap_ovr_minus_fav", "entropy_favorite", "entropy_overrated",
              "entropy_gap_fav_minus_ovr"]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main():
    recs = aa.load_extracted()
    dist = build_dist(recs)
    rows = build_rows(dist)

    csv_path = os.path.join(aa.ROOT, "analysis", "data", "q2_consensus_by_domain.csv")
    write_csv(rows, csv_path)

    modal_diffs = [r["modal_gap_ovr_minus_fav"] for r in rows]
    entropy_diffs = [r["entropy_gap_fav_minus_ovr"] for r in rows if r["entropy_gap_fav_minus_ovr"] != ""]

    print(f"n domains = {len(rows)} (43 official, legacy bookcover/chair excluded)")
    print(f"mean modal_frac favorite = {sum(r['modal_frac_favorite'] for r in rows)/len(rows):.4f}")
    print(f"mean modal_frac overrated = {sum(r['modal_frac_overrated'] for r in rows)/len(rows):.4f}")
    obs_m, p_m = paired_sign_flip_test(modal_diffs)
    print(f"[modal] paired sign-flip perm test: mean gap(ovr-fav) = {obs_m:.4f}, p = {p_m:.4f}")
    pos, neg, zero, p_sign = exact_sign_test(modal_diffs)
    print(f"[modal] exact sign test: {pos} domains ovr>fav, {neg} fav>ovr, {zero} ties, p = {p_sign:.4g}")

    print(f"mean entropy favorite = {sum(r['entropy_favorite'] for r in rows if r['entropy_favorite']!='')/len(entropy_diffs):.4f}")
    print(f"mean entropy overrated = {sum(r['entropy_overrated'] for r in rows if r['entropy_overrated']!='')/len(entropy_diffs):.4f}")
    obs_e, p_e = paired_sign_flip_test(entropy_diffs)
    print(f"[entropy] paired sign-flip perm test: mean gap(fav-ovr) = {obs_e:.4f}, p = {p_e:.4f}")
    pos2, neg2, zero2, p_sign2 = exact_sign_test(entropy_diffs)
    print(f"[entropy] exact sign test: {pos2} domains fav>ovr entropy (ovr more consensual), {neg2} reverse, {zero2} ties, p = {p_sign2:.4g}")

    print("\n-- by group (mean gap) --")
    groups = defaultdict(list)
    for r in rows:
        groups[r["group"]].append(r)
    for g, rs in sorted(groups.items()):
        mg = sum(r["modal_gap_ovr_minus_fav"] for r in rs) / len(rs)
        eg_vals = [r["entropy_gap_fav_minus_ovr"] for r in rs if r["entropy_gap_fav_minus_ovr"] != ""]
        eg = sum(eg_vals) / len(eg_vals) if eg_vals else float("nan")
        print(f"  {g:16s} n={len(rs):2d}  modal_gap={mg:+.4f}  entropy_gap={eg:+.4f}")

    people_modal = [r["modal_gap_ovr_minus_fav"] for r in rows if r["group"] == "people"]
    cp_modal = [r["modal_gap_ovr_minus_fav"] for r in rows if r["group"] in ("cultural", "places")]
    obs_gm, p_gm = group_label_shuffle_test(people_modal, cp_modal)
    print(f"\n[modal] people vs cultural+places gap diff = {obs_gm:+.4f}, p = {p_gm:.4f}")

    people_ent = [r["entropy_gap_fav_minus_ovr"] for r in rows if r["group"] == "people" and r["entropy_gap_fav_minus_ovr"] != ""]
    cp_ent = [r["entropy_gap_fav_minus_ovr"] for r in rows if r["group"] in ("cultural", "places") and r["entropy_gap_fav_minus_ovr"] != ""]
    obs_ge, p_ge = group_label_shuffle_test(people_ent, cp_ent)
    print(f"[entropy] people vs cultural+places gap diff = {obs_ge:+.4f}, p = {p_ge:.4f}")

    print("\n-- biggest per-domain swings (by |modal_gap|) --")
    for r in sorted(rows, key=lambda r: -abs(r["modal_gap_ovr_minus_fav"]))[:10]:
        print(f"  {r['domain']:14s} fav={r['modal_frac_favorite']:.2f}({r['modal_winner_favorite']!r}) "
              f"-> ovr={r['modal_frac_overrated']:.2f}({r['modal_winner_overrated']!r})  gap={r['modal_gap_ovr_minus_fav']:+.2f}")

    print("\n-- dual loved-and-hated entities (top by balance) --")
    dual = find_dual_entities(recs)
    flat = [(d, e, f, o) for d, rs in dual.items() for (e, f, o) in rs]
    flat.sort(key=lambda x: -min(x[2], x[3]))
    for d, e, f, o in flat[:15]:
        print(f"  {d:14s} {e!r:35s} favorite={f:3d}  overrated={o:3d}")

    return rows


if __name__ == "__main__":
    main()
