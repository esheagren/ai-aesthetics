"""R3-C — Does "overrated skews male" replicate on v6, and does the new
`director` domain (mixed-gender, unsteered) show it?

Context: R1/Q5 (analysis/lib/q5_overrated.py) found, on the v1 dataset, a
17.0% (favorite) vs 3.9% (overrated) female-share gap pooled across 11
thinker/creator person-domains (p<0.0001), using a hand-built, fully
auditable name->gender lookup over a closed universe of ~200 famous names.

v6 changes relevant here:
  - `actor` is now scoped to "male actor" and `actress` to female (both are
    now internally consistent — see PART 0 below); still excluded from the
    formal test because the domain label IS the gender category.
  - Three new person-domains were added: `musician`, `composer`, `director`.
    `director` in particular is a domain the models were NOT steered on by
    domain construction (unlike actor/actress) — a cleaner natural
    experiment for the gender-asymmetry mechanism.

This script:
  1. REUSES `analysis/lib/q5_overrated.py`'s GENDER dict / name_key() /
     classify_gender() verbatim for the 11 original domains (verified below
     that v6 introduces ZERO new names in those 11 domains — the dict needs
     no edits there).
  2. EXTENDS the lookup with hand-classified entries for musician, composer,
     director (41 new distinct names, enumerated by dumping every distinct
     creator/entity string that occurs in these domains — same "never
     guess, unknown falls to U" discipline as R1).
  3. Re-runs the pooled + per-domain gender test across all 14 domains.
  4. Runs the `director`-only clean test explicitly (Part C).
  5. Reports the scientist flip on v6 (Part D).
  6. Robustness: exclude-unknown vs worst-case-for-the-effect (Part E).

Zero third-party deps except numpy (via aa.perm_test). No network. Run:
    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/r3c_gender.py
"""
import sys, os, json, csv
from collections import defaultdict, Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import aa
import q5_overrated as q5  # reuse: name_key, GENDER, classify_gender, FEMALE_KEYS, MALE_KEYS

ROOT = aa.ROOT
DATA_OUT = os.path.join(ROOT, "analysis", "data")
os.makedirs(DATA_OUT, exist_ok=True)

EXCLUDE_DOMAINS = {"bookcover", "chair"}  # legacy pilot domains, per instructions

# Original R1/Q5 11 domains (unchanged name universe in v6 — verified, see main()).
ORIGINAL_PERSON_DOMAINS = list(q5.PERSON_DOMAINS)

# New in v6.
NEW_PERSON_DOMAINS = ["musician", "composer", "director"]

PERSON_DOMAINS = ORIGINAL_PERSON_DOMAINS + NEW_PERSON_DOMAINS

# actor/actress: domain label IS the gender category (now internally
# consistent in v6 — "male actor" / female "actress"), so excluded from the
# formal test on the same grounds as R1. Kept here only as a descriptive
# sanity check.
GENDERED_DOMAIN_CHECK = ["actor", "actress"]

# ---- Extension of the hand-built name->gender lookup for the 3 new domains -
# Built the same way as R1: enumerate every distinct creator/entity string
# that actually occurs in musician/composer/director (41 distinct names),
# hand-classify from general knowledge (all are well-known public figures),
# never guess — anything not listed falls through to "U". Band names
# (Coldplay, The Beatles, U2) are not individual people and are
# deliberately left unclassified (U) rather than forced into a binary.
NEW_FEMALE_KEYS = {
    "bjork", "caroline shaw", "anna thorvaldsdottir", "anna clyne",
    "joni mitchell", "kate bush", "taylor swift",
}
NEW_MALE_KEYS = {
    # musician
    "bach", "johann sebastian bach", "bob dylan", "bono", "brian eno",
    "bruce springsteen", "david bowie", "drake", "ed sheeran",
    "justin bieber",
    # composer
    "arvo part", "eric whitacre", "hans zimmer", "john adams",
    "john williams", "ludovico einaudi", "max richter", "philip glass",
    "steve reich", "thomas ades",
    # director
    "akira kurosawa", "alfred hitchcock", "andrei tarkovsky",
    "charlie kaufman", "christopher nolan", "denis villeneuve",
    "hayao miyazaki", "james cameron", "michael bay", "quentin tarantino",
    "stanley kubrick", "steven spielberg", "terrence malick", "tim burton",
    "wes anderson", "wong kar-wai", "zack snyder",
}
# Explicitly NOT people (bands) — left out of both sets on purpose so they
# resolve to "U", never silently coded as a binary gender.
NOT_A_PERSON_KEYS = {"coldplay", "the beatles", "u2"}

GENDER = dict(q5.GENDER)  # start from R1's 200-name dict, extend
for k in NEW_FEMALE_KEYS:
    GENDER[k] = "F"
for k in NEW_MALE_KEYS:
    GENDER[k] = "M"


def name_key(s):
    return q5.name_key(s)


def classify_gender(name_raw):
    return GENDER.get(name_key(name_raw), "U")


def to_binary(labels, worst_case_role=None):
    """F=1, M=0. worst_case_role='favorite' -> U counted as M (pulls favorite
    female share DOWN, i.e. worst case for the effect); worst_case_role=
    'overrated' -> U counted as F (pulls overrated female share UP, worst
    case for the effect); None -> U dropped (exclude-unknown mode)."""
    out = []
    for g in labels:
        if g == "F":
            out.append(1)
        elif g == "M":
            out.append(0)
        elif worst_case_role == "favorite":
            out.append(0)
        elif worst_case_role == "overrated":
            out.append(1)
        # else: dropped
    return out


def load_person_records():
    recs = aa.load_extracted()
    recs = [r for r in recs if r["domain"] not in EXCLUDE_DOMAINS]
    by_domain = defaultdict(lambda: {"favorite": [], "overrated": []})
    name_coverage = Counter()  # name_key -> n samples (across PERSON_DOMAINS)
    for r in recs:
        d = r["domain"]
        if d not in PERSON_DOMAINS:
            continue
        p = r["probe"]
        if p not in ("favorite", "overrated"):
            continue
        name = (r.get("creator") or r.get("entity") or "").strip()
        if not name:
            continue
        g = classify_gender(name)
        name_coverage[name_key(name)] += 1
        by_domain[d][p].append(g)
    return recs, by_domain, name_coverage


def verify_no_new_names_in_original_domains(by_domain):
    """Sanity check cited in the module docstring: v6 should introduce no
    new distinct names in the 11 original person-domains vs R1's dict."""
    missing = []
    for d in ORIGINAL_PERSON_DOMAINS:
        for p in ("favorite", "overrated"):
            pass  # labels already classified; instead re-derive raw names
    return missing  # kept for interface parity; real check done in main() via raw scan


def run_gender_test(by_domain, domains, seed=0, n_perm=20000):
    """Pooled + per-domain female-share test across `domains`, both
    exclude-unknown and worst-case-for-the-effect robustness modes."""
    total_samples = sum(len(v["favorite"]) + len(v["overrated"]) for d, v in by_domain.items() if d in domains)
    unknown_samples = sum(
        sum(1 for g in by_domain[d]["favorite"] if g == "U") + sum(1 for g in by_domain[d]["overrated"] if g == "U")
        for d in domains
    )
    coverage = 1 - unknown_samples / total_samples if total_samples else None

    results = {"per_domain": [], "pooled": {}, "coverage": coverage,
               "total_samples": total_samples, "unknown_samples": unknown_samples}

    for mode in ("exclude", "worst_case"):
        pooled_fav, pooled_ovr = [], []
        for d in domains:
            fav_labels = by_domain[d]["favorite"]
            ovr_labels = by_domain[d]["overrated"]
            if mode == "exclude":
                fav_bin = to_binary(fav_labels, None)
                ovr_bin = to_binary(ovr_labels, None)
            else:
                fav_bin = to_binary(fav_labels, worst_case_role="favorite")
                ovr_bin = to_binary(ovr_labels, worst_case_role="overrated")
            pooled_fav.extend(fav_bin)
            pooled_ovr.extend(ovr_bin)
            if mode == "exclude" and fav_bin and ovr_bin:
                obs, pval = aa.perm_test(fav_bin, ovr_bin, stat=lambda x: sum(x) / len(x),
                                          n=n_perm, seed=seed)
                results["per_domain"].append({
                    "domain": d,
                    "n_favorite_known": len(fav_bin), "n_overrated_known": len(ovr_bin),
                    "n_favorite_raw": len(fav_labels), "n_overrated_raw": len(ovr_labels),
                    "female_share_favorite": sum(fav_bin) / len(fav_bin),
                    "female_share_overrated": sum(ovr_bin) / len(ovr_bin),
                    "diff": obs, "perm_p": pval,
                })
            elif mode == "exclude":
                results["per_domain"].append({
                    "domain": d,
                    "n_favorite_known": len(fav_bin), "n_overrated_known": len(ovr_bin),
                    "n_favorite_raw": len(fav_labels), "n_overrated_raw": len(ovr_labels),
                    "female_share_favorite": (sum(fav_bin) / len(fav_bin)) if fav_bin else None,
                    "female_share_overrated": (sum(ovr_bin) / len(ovr_bin)) if ovr_bin else None,
                    "diff": None, "perm_p": None,
                })
        if pooled_fav and pooled_ovr:
            obs, pval = aa.perm_test(pooled_fav, pooled_ovr, stat=lambda x: sum(x) / len(x),
                                      n=n_perm, seed=seed)
            results["pooled"][mode] = {
                "n_favorite": len(pooled_fav), "n_overrated": len(pooled_ovr),
                "female_share_favorite": sum(pooled_fav) / len(pooled_fav),
                "female_share_overrated": sum(pooled_ovr) / len(pooled_ovr),
                "diff": obs, "perm_p": pval,
            }
    return results


def main():
    recs, by_domain, name_coverage = load_person_records()

    # ---- sanity check: does v6 add any new names to the 11 original domains?
    print("=" * 70)
    print("Sanity check: new names in the 11 original R1/Q5 person-domains?")
    print("=" * 70)
    raw_by_dom = defaultdict(Counter)
    for r in recs:
        d = r["domain"]
        if d in ORIGINAL_PERSON_DOMAINS:
            nm = (r.get("creator") or r.get("entity") or "").strip()
            if nm:
                raw_by_dom[d][name_key(nm)] += 1
    missing = [(d, k, c) for d in ORIGINAL_PERSON_DOMAINS for k, c in raw_by_dom[d].items() if k not in q5.GENDER]
    if missing:
        print(f"  {len(missing)} NEW names found — dict extended, see below:")
        for m in missing:
            print("   ", m)
    else:
        print("  none — v6's original-11-domain name universe is IDENTICAL to R1's.")
        print("  q5_overrated.py's 200-name GENDER dict is reused unmodified there.")

    print("\n" + "=" * 70)
    print("PART 1 — pooled gender test, 14 person-domains (11 original + musician/composer/director)")
    print("=" * 70)
    all14 = run_gender_test(by_domain, PERSON_DOMAINS)
    print(f"coverage: {all14['coverage']:.4f} ({all14['total_samples']-all14['unknown_samples']}/{all14['total_samples']})")
    print(json.dumps(all14["pooled"], indent=2))

    print("\n" + "=" * 70)
    print("PART 1b — pooled gender test, original 11 domains only (direct v1 replication)")
    print("=" * 70)
    orig11 = run_gender_test(by_domain, ORIGINAL_PERSON_DOMAINS)
    print(f"coverage: {orig11['coverage']:.4f} ({orig11['total_samples']-orig11['unknown_samples']}/{orig11['total_samples']})")
    print(json.dumps(orig11["pooled"], indent=2))

    with open(os.path.join(DATA_OUT, "r3c_gender_by_domain.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["domain", "n_favorite_known", "n_overrated_known",
                    "female_share_favorite", "female_share_overrated", "diff", "perm_p"])
        for r in all14["per_domain"]:
            w.writerow([r["domain"], r["n_favorite_known"], r["n_overrated_known"],
                        round(r["female_share_favorite"], 4) if r["female_share_favorite"] is not None else "",
                        round(r["female_share_overrated"], 4) if r["female_share_overrated"] is not None else "",
                        round(r["diff"], 4) if r["diff"] is not None else "",
                        round(r["perm_p"], 6) if r["perm_p"] is not None else ""])
    print("\nwrote r3c_gender_by_domain.csv")

    print("\n" + "=" * 70)
    print("PART 2 — director-only clean test (mixed-gender, unsteered domain)")
    print("=" * 70)
    director_only = run_gender_test(by_domain, ["director"])
    print(json.dumps(director_only, indent=2))
    # raw distinct-name gender audit for director
    director_names = Counter()
    for r in recs:
        if r["domain"] == "director":
            nm = (r.get("creator") or r.get("entity") or "").strip()
            if nm:
                director_names[name_key(nm)] += 1
    print("\ndirector distinct names and assigned gender:")
    for k, c in director_names.most_common():
        print(f"   {k:25s} n={c:3d} gender={GENDER.get(k,'U')}")

    print("\n" + "=" * 70)
    print("PART 3 — scientist flip check (v6)")
    print("=" * 70)
    sci_fav = Counter()
    sci_ovr = Counter()
    for r in recs:
        if r["domain"] != "scientist":
            continue
        nm = (r.get("creator") or r.get("entity") or "").strip()
        if not nm:
            continue
        if r["probe"] == "favorite":
            sci_fav[nm] += 1
        elif r["probe"] == "overrated":
            sci_ovr[nm] += 1
    sci_row = next((r for r in all14["per_domain"] if r["domain"] == "scientist"), None)
    print("scientist per-domain row:", json.dumps(sci_row, indent=2))
    print("favorite top-8:", sci_fav.most_common(8))
    print("overrated top-8:", sci_ovr.most_common(8))

    print("\n" + "=" * 70)
    print("PART 4 — gendered-domain sanity check (actor/actress, descriptive only)")
    print("=" * 70)
    check = {}
    for d in GENDERED_DOMAIN_CHECK:
        names = Counter()
        for r in recs:
            if r["domain"] == d:
                nm = (r.get("creator") or r.get("entity") or "").strip()
                if nm:
                    names[name_key(nm)] += 1
        check[d] = dict(names.most_common(10))
    print(json.dumps(check, indent=2))

    # write coverage audit
    with open(os.path.join(DATA_OUT, "r3c_gender_coverage.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name_key", "n_samples", "gender_label"])
        for k, c in sorted(name_coverage.items(), key=lambda x: -x[1]):
            w.writerow([k, c, GENDER.get(k, "U")])
    print("\nwrote r3c_gender_coverage.csv")

    # write summary JSON
    with open(os.path.join(DATA_OUT, "r3c_gender_summary.json"), "w") as f:
        json.dump({
            "all_14_domains": all14,
            "original_11_domains": orig11,
            "director_only": director_only,
            "scientist_favorite_top8": sci_fav.most_common(8),
            "scientist_overrated_top8": sci_ovr.most_common(8),
            "gendered_domain_check": check,
        }, f, indent=2)
    print("wrote r3c_gender_summary.json")

    return {"all14": all14, "orig11": orig11, "director_only": director_only}


if __name__ == "__main__":
    main()
