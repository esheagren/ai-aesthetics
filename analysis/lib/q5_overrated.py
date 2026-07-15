"""Q5 — Who gets called overrated? Fame and gender asymmetries in the models' picks.

Part A: fame — zero-overlap ("most famous, never loved") entities + an internal,
non-circular fame proxy (cross-model breadth, leave-one-model-out).

Part B: gender — a transparent, hand-built name-gender lookup over person-domains
where gender is inferable, with an explicit "unknown" bucket and two robustness
re-runs (exclude-unknown, worst-case-for-the-effect).

Zero third-party deps except numpy (via aa.perm_test). No network. Run directly:
    cd /Users/erik/Documents/projects/active/ai-aesthetics
    python3 analysis/lib/q5_overrated.py
"""
import sys, os, json, csv, unicodedata, math, random
from collections import defaultdict, Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import aa

ROOT = aa.ROOT
DATA_OUT = os.path.join(ROOT, "analysis", "data")
os.makedirs(DATA_OUT, exist_ok=True)

EXCLUDE_DOMAINS = {"bookcover", "chair"}  # deprecated/extra domains, per data dictionary

# ============================================================================
# PART A — FAME
# ============================================================================

def part_a_zero_overlap(recs):
    """For every domain, find entities named ONLY as overrated (never favorite)
    and vice versa, using entity_canon (aliases.json-normalized). Quantify what
    share of each probe's total sample volume that zero-overlap bucket accounts for.
    """
    domains = sorted(set(r["domain"] for r in recs) - EXCLUDE_DOMAINS)

    fav_counts = defaultdict(Counter)   # domain -> entity_canon -> count
    ovr_counts = defaultdict(Counter)
    for r in recs:
        d = r["domain"]
        if d in EXCLUDE_DOMAINS:
            continue
        e = r["entity_canon"]
        if not e:
            continue
        if r["probe"] == "favorite":
            fav_counts[d][e] += 1
        elif r["probe"] == "overrated":
            ovr_counts[d][e] += 1

    rows = []
    total_ovr_samples = 0
    total_ovr_zero_fav = 0
    total_fav_samples = 0
    total_fav_zero_ovr = 0

    for d in domains:
        fc, oc = fav_counts[d], ovr_counts[d]
        fav_set, ovr_set = set(fc), set(oc)
        overrated_only = ovr_set - fav_set   # named overrated, never favorite
        favorite_only = fav_set - ovr_set    # named favorite, never overrated

        d_ovr_n = sum(oc.values())
        d_fav_n = sum(fc.values())
        d_ovr_zero_fav_n = sum(oc[e] for e in overrated_only)
        d_fav_zero_ovr_n = sum(fc[e] for e in favorite_only)

        total_ovr_samples += d_ovr_n
        total_ovr_zero_fav += d_ovr_zero_fav_n
        total_fav_samples += d_fav_n
        total_fav_zero_ovr += d_fav_zero_ovr_n

        top_ovr_only = sorted(((e, oc[e]) for e in overrated_only), key=lambda x: -x[1])[:3]
        top_fav_only = sorted(((e, fc[e]) for e in favorite_only), key=lambda x: -x[1])[:3]

        rows.append({
            "domain": d,
            "overrated_n": d_ovr_n, "favorite_n": d_fav_n,
            "overrated_only_n": d_ovr_zero_fav_n,
            "overrated_only_share": (d_ovr_zero_fav_n / d_ovr_n) if d_ovr_n else None,
            "favorite_only_n": d_fav_zero_ovr_n,
            "favorite_only_share": (d_fav_zero_ovr_n / d_fav_n) if d_fav_n else None,
            "top_overrated_only": top_ovr_only,
            "top_favorite_only": top_fav_only,
        })

    pooled = {
        "overrated_samples": total_ovr_samples,
        "overrated_zero_favorite_n": total_ovr_zero_fav,
        "overrated_zero_favorite_share": total_ovr_zero_fav / total_ovr_samples,
        "favorite_samples": total_fav_samples,
        "favorite_zero_overrated_n": total_fav_zero_ovr,
        "favorite_zero_overrated_share": total_fav_zero_ovr / total_fav_samples,
    }
    return rows, pooled


def part_a_fame_proxy(recs, seed=0, n_perm=20000):
    """Internal fame proxy #1 (primary): cross-probe breadth. For each sample,
    compute how many OTHER models (leave-one-model-out) ever named this exact
    entity_canon in this domain, under EITHER probe. This is a name-recognition/
    salience measure independent of the sample's own valence label — the only
    circularity is that a model's OTHER samples (e.g. a repeat pick across its
    own 4-12 draws) still count, which we accept and flag.

    Internal fame proxy #2 (secondary, literal reading of "other probe" cue):
    for each sample, the count of the SAME entity_canon named under the OPPOSITE
    probe, across all OTHER models (leave-one-model-out).

    Both are explicitly internal / dataset-derived — NOT a real-world fame
    measure. See caveats in the writeup.
    """
    domains = sorted(set(r["domain"] for r in recs) - EXCLUDE_DOMAINS)
    dom_set = set(domains)

    # models_by_entity[domain][entity_canon] = set of models that ever named it (either probe)
    models_by_entity = defaultdict(lambda: defaultdict(set))
    # probe_count[domain][entity_canon][probe][model] = count
    probe_model_count = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))

    for r in recs:
        d = r["domain"]
        if d not in dom_set:
            continue
        e = r["entity_canon"]
        if not e:
            continue
        models_by_entity[d][e].add(r["model"])
        probe_model_count[d][e][r["probe"]][r["model"]] += 1

    fav_breadth, ovr_breadth = [], []
    fav_otherprobe, ovr_otherprobe = [], []
    per_domain = defaultdict(lambda: {"fav_breadth": [], "ovr_breadth": []})

    for r in recs:
        d, e, m, p = r["domain"], r["entity_canon"], r["model"], r["probe"]
        if d not in dom_set or not e or p not in ("favorite", "overrated"):
            continue
        all_models_for_e = models_by_entity[d][e]
        breadth_loo = len(all_models_for_e - {m})  # out of 12 other models

        other_probe = "overrated" if p == "favorite" else "favorite"
        other_probe_models = probe_model_count[d][e][other_probe]
        other_probe_n_loo = sum(c for mm, c in other_probe_models.items() if mm != m)

        if p == "favorite":
            fav_breadth.append(breadth_loo)
            fav_otherprobe.append(other_probe_n_loo)
            per_domain[d]["fav_breadth"].append(breadth_loo)
        else:
            ovr_breadth.append(breadth_loo)
            ovr_otherprobe.append(other_probe_n_loo)
            per_domain[d]["ovr_breadth"].append(breadth_loo)

    obs_breadth, p_breadth = aa.perm_test(ovr_breadth, fav_breadth, stat=lambda x: sum(x) / len(x),
                                          n=n_perm, seed=seed)
    obs_other, p_other = aa.perm_test(ovr_otherprobe, fav_otherprobe, stat=lambda x: sum(x) / len(x),
                                       n=n_perm, seed=seed)

    domain_rows = []
    for d in domains:
        fb, ob = per_domain[d]["fav_breadth"], per_domain[d]["ovr_breadth"]
        if not fb or not ob:
            continue
        domain_rows.append({
            "domain": d,
            "n_favorite": len(fb), "n_overrated": len(ob),
            "mean_breadth_favorite": sum(fb) / len(fb),
            "mean_breadth_overrated": sum(ob) / len(ob),
        })

    return {
        "n_favorite": len(fav_breadth), "n_overrated": len(ovr_breadth),
        "mean_breadth_favorite": sum(fav_breadth) / len(fav_breadth),
        "mean_breadth_overrated": sum(ovr_breadth) / len(ovr_breadth),
        "breadth_obs_diff": obs_breadth, "breadth_perm_p": p_breadth,
        "mean_otherprobe_favorite": sum(fav_otherprobe) / len(fav_otherprobe),
        "mean_otherprobe_overrated": sum(ovr_otherprobe) / len(ovr_otherprobe),
        "otherprobe_obs_diff": obs_other, "otherprobe_perm_p": p_other,
    }, domain_rows


# ============================================================================
# PART B — GENDER
# ============================================================================

PERSON_DOMAINS = ["novelist", "philosopher", "economist", "scientist", "theologian",
                  "mathematician", "historian", "psychologist", "computerscientist",
                  "airesearcher", "architect"]
# actor/actress deliberately excluded from the formal test — the domain label
# itself IS the gender category, so any name-gender coding would trivially
# reproduce the domain split rather than measure anything (see writeup caveats).
GENDERED_DOMAIN_CHECK = ["actor", "actress"]


def name_key(s):
    """Normalize a raw creator/entity string to a lookup key: strip, fold accents
    (with manual handling for letters NFKD doesn't decompose, e.g. Nordic ø/æ),
    drop periods/commas, lowercase, collapse whitespace."""
    s = (s or "").strip()
    s = s.replace("ø", "o").replace("Ø", "O").replace("æ", "ae").replace("Æ", "AE")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower().replace(".", "").replace(",", "")
    s = " ".join(s.split())
    return s


# ---- Hand-built, auditable name -> gender lookup ---------------------------
# Built by enumerating every distinct creator/entity string that actually occurs
# in the 11 PERSON_DOMAINS above (closed set, 152 distinct name-keys as of this
# dataset — see analysis/data/q5_gender_coverage.csv for the full audit list).
# Every name below is a well-known real public figure; classification is by the
# analyst's general-knowledge recall, NOT a verified external biography/Wikidata
# lookup — treat as YELLOW-tractability per content-H3. Names not in this dict
# fall through to "U" (unknown) rather than being guessed.
FEMALE_KEYS = {
    "ada lovelace", "ayn rand", "barbara liskov", "barbara tuchman", "barbara w tuchman",
    "doris kearns goodwin", "elinor ostrom", "emmy noether", "fei-fei li", "george eliot",
    "grace hopper", "iris murdoch", "jane austen", "joan robinson", "marie curie",
    "mary beard", "natalie zemon davis", "simone weil", "toni morrison",
    "ursula k le guin", "virginia woolf", "zaha hadid",
}
MALE_KEYS = {
    "abraham maslow", "adam smith", "alan kay", "alan turing", "albert einstein",
    "albert o hirschman", "alexander grothendieck", "amartya sen", "andrej karpathy",
    "andrew ng", "andrew wiles", "antoni gaudi", "aristotle", "augustine of hippo",
    "baruch spinoza",
    "c s lewis", "carl friedrich gauss", "carl gustav jung", "carl jung", "carl rogers",
    "carl sagan", "carlo ginzburg", "carlo scarpa", "charles dickens", "chris olah",
    "christopher olah", "claude shannon", "cs lewis", "dan brown", "daniel kahneman",
    "david ha", "david hilbert", "david hume", "david mccullough", "demis hassabis",
    "dietrich bonhoeffer", "donald e knuth", "donald knuth", "douglas adams",
    "douglas hofstadter", "edsger dijkstra", "edsger w dijkstra", "edward gibbon",
    "eliezer yudkowsky", "ep thompson", "epicurus", "eric hobsbawm", "ernest hemingway",
    "euclid", "euler", "evariste galois", "felix klein", "fernand braudel", "fibonacci",
    "frank gehry", "frank lloyd wright", "friedrich hayek", "friedrich nietzsche",
    "fyodor dostoevsky", "gabriel garcia marquez", "gary marcus", "geoffrey hinton",
    "geoffrey hinton yann lecun yoshua bengio",  # multi-person string, all male (n=1); see caveats
    "georg wilhelm friedrich hegel", "gh hardy", "gilles deleuze",
    "gottfried wilhelm leibniz", "gregory of nyssa", "gwf hegel", "hans urs von balthasar",
    "haruki murakami", "hegel", "heidegger", "herbert simon", "hermann rorschach",
    "herodotus", "howard zinn", "ibn khaldun", "ilya sutskever", "immanuel kant",
    "isaac newton", "italo calvino", "jack kerouac", "jacques lacan", "james clerk maxwell",
    "jared diamond", "jd salinger", "jean-jacques rousseau", "jean-paul sartre",
    "john calvin", "john kenneth galbraith", "john maynard keynes", "john nash",
    "john von neumann", "jordan peterson", "jorge luis borges", "joseph schumpeter",
    "judea pearl", "jurgen schmidhuber", "karl barth", "karl rahner", "kazuo ishiguro",
    "kurt godel", "kurt lewin", "le corbusier", "leon walras", "leonhard euler",
    "linus pauling", "linus torvalds", "louis kahn", "ludwig mies van der rohe",
    "ludwig wittgenstein", "luis barragan", "marc bloch", "marcus aurelius",
    "mark zuckerberg", "martin heidegger", "marvin minsky", "michael faraday",
    "michio kaku", "milton friedman", "neil degrasse tyson", "niall ferguson",
    "nikola tesla", "origen of alexandria", "paul erdos", "paul krugman",
    "paul samuelson", "paul tillich", "paulo coelho", "peter eisenman", "peter zumthor",
    "philip zimbardo", "pierre de fermat", "pierre teilhard de chardin", "plato",
    "pseudo-dionysius the areopagite", "pythagoras", "pythagoras of samos", "ramanujan",
    "ray kurzweil", "rene descartes", "richard feynman", "richard sutton",
    "sam altman", "santiago calatrava", "santiago ramon y cajal", "shun-ichi amari",
    "sigmund freud", "simon schama", "slavoj zizek", "socrates", "soren kierkegaard",
    "srinivasa ramanujan", "st augustine", "stephen ambrose", "stephen hawking",
    "stephen wolfram", "steve jobs", "stuart russell", "tacitus", "tadao ando",
    "terence tao", "thomas aquinas", "thomas edison", "thomas malthus",
    "thomas piketty", "thomas schelling", "thucydides", "viktor frankl",
    "vladimir nabokov", "wassily leontief", "william cronon", "william james",
    "wittgenstein", "yann lecun", "yoshua bengio", "yuval noah harari",
}

GENDER = {}
for k in FEMALE_KEYS:
    GENDER[k] = "F"
for k in MALE_KEYS:
    GENDER[k] = "M"


def classify_gender(name_raw):
    return GENDER.get(name_key(name_raw), "U")


def part_b_gender(recs, seed=0, n_perm=20000):
    by_domain = defaultdict(lambda: {"favorite": [], "overrated": []})
    all_names_seen = Counter()

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
        all_names_seen[name_key(name)] += 1
        by_domain[d][p].append(g)

    # coverage
    total_samples = sum(len(v["favorite"]) + len(v["overrated"]) for v in by_domain.values())
    unknown_samples = sum(
        sum(1 for g in v["favorite"] if g == "U") + sum(1 for g in v["overrated"] if g == "U")
        for v in by_domain.values()
    )
    coverage = 1 - unknown_samples / total_samples if total_samples else None

    def female_share(labels, mode):
        """mode: 'exclude' (drop U), 'worst_fav' (U->M in favorite pool),
        'worst_ovr' (U->F in overrated pool)."""
        if mode == "exclude":
            known = [g for g in labels if g != "U"]
            if not known:
                return None, 0
            return sum(1 for g in known if g == "F") / len(known), len(known)
        return None, 0

    def to_binary(labels, worst_case_role=None):
        """Convert labels to 0/1 (F=1,M=0), handling U per worst_case_role:
        worst_case_role='favorite' -> U counted as M (pulls favorite female share DOWN)
        worst_case_role='overrated' -> U counted as F (pulls overrated female share UP)
        worst_case_role=None -> U dropped (exclude-unknown mode)
        """
        out = []
        for g in labels:
            if g == "F":
                out.append(1)
            elif g == "M":
                out.append(0)
            else:  # U
                if worst_case_role == "favorite":
                    out.append(0)
                elif worst_case_role == "overrated":
                    out.append(1)
                # else: dropped (exclude mode) -> skip
        return out

    results = {"per_domain": [], "pooled": {}, "coverage": coverage,
               "total_samples": total_samples, "unknown_samples": unknown_samples}

    for mode in ("exclude", "worst_case"):
        pooled_fav, pooled_ovr = [], []
        for d in PERSON_DOMAINS:
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
                    "female_share_favorite": sum(fav_bin) / len(fav_bin),
                    "female_share_overrated": sum(ovr_bin) / len(ovr_bin),
                    "diff": obs, "perm_p": pval,
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

    # gendered-domain sanity check (descriptive only, NOT part of the formal test)
    check = {}
    for d in GENDERED_DOMAIN_CHECK:
        names = Counter()
        for r in recs:
            if r["domain"] == d:
                nm = (r.get("creator") or r.get("entity") or "").strip()
                if nm:
                    names[name_key(nm)] += 1
        check[d] = dict(names.most_common(5))
    results["gendered_domain_check"] = check
    results["name_coverage_detail"] = dict(all_names_seen)
    return results


# ============================================================================
# main — run everything, print + write derived tables
# ============================================================================

def main():
    recs = aa.load_extracted()
    recs = [r for r in recs if r["domain"] not in EXCLUDE_DOMAINS]

    print("=" * 70)
    print("PART A.1 — zero-overlap fame pattern")
    print("=" * 70)
    rows_a1, pooled_a1 = part_a_zero_overlap(recs)
    print(json.dumps(pooled_a1, indent=2))
    with open(os.path.join(DATA_OUT, "q5_zero_overlap_by_domain.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["domain", "overrated_n", "favorite_n", "overrated_only_n",
                    "overrated_only_share", "favorite_only_n", "favorite_only_share",
                    "top_overrated_only", "top_favorite_only"])
        for r in sorted(rows_a1, key=lambda x: -(x["overrated_only_share"] or 0)):
            w.writerow([r["domain"], r["overrated_n"], r["favorite_n"], r["overrated_only_n"],
                        round(r["overrated_only_share"], 3) if r["overrated_only_share"] is not None else "",
                        r["favorite_only_n"],
                        round(r["favorite_only_share"], 3) if r["favorite_only_share"] is not None else "",
                        "; ".join(f"{e} ({c})" for e, c in r["top_overrated_only"]),
                        "; ".join(f"{e} ({c})" for e, c in r["top_favorite_only"])])
    print("wrote q5_zero_overlap_by_domain.csv")

    print("\n" + "=" * 70)
    print("PART A.2 — internal fame proxy (breadth, leave-one-model-out)")
    print("=" * 70)
    fame_pooled, fame_by_domain = part_a_fame_proxy(recs)
    print(json.dumps(fame_pooled, indent=2))
    with open(os.path.join(DATA_OUT, "q5_fame_proxy_by_domain.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["domain", "n_favorite", "n_overrated", "mean_breadth_favorite", "mean_breadth_overrated"])
        for r in sorted(fame_by_domain, key=lambda x: -(x["mean_breadth_overrated"] - x["mean_breadth_favorite"])):
            w.writerow([r["domain"], r["n_favorite"], r["n_overrated"],
                        round(r["mean_breadth_favorite"], 3), round(r["mean_breadth_overrated"], 3)])
    print("wrote q5_fame_proxy_by_domain.csv")

    print("\n" + "=" * 70)
    print("PART B — gender")
    print("=" * 70)
    gender_results = part_b_gender(recs)
    print(f"coverage: {gender_results['coverage']:.4f} "
          f"({gender_results['total_samples'] - gender_results['unknown_samples']}/{gender_results['total_samples']})")
    print(json.dumps(gender_results["pooled"], indent=2))
    with open(os.path.join(DATA_OUT, "q5_gender_by_domain.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["domain", "n_favorite_known", "n_overrated_known",
                    "female_share_favorite", "female_share_overrated", "diff", "perm_p"])
        for r in gender_results["per_domain"]:
            w.writerow([r["domain"], r["n_favorite_known"], r["n_overrated_known"],
                        round(r["female_share_favorite"], 4), round(r["female_share_overrated"], 4),
                        round(r["diff"], 4), round(r["perm_p"], 6)])
    print("wrote q5_gender_by_domain.csv")

    with open(os.path.join(DATA_OUT, "q5_gender_coverage.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name_key", "n_samples", "gender_label"])
        for k, c in sorted(gender_results["name_coverage_detail"].items(), key=lambda x: -x[1]):
            w.writerow([k, c, GENDER.get(k, "U")])
    print("wrote q5_gender_coverage.csv")

    print("\ngendered-domain sanity check (descriptive only, not in formal test):")
    print(json.dumps(gender_results["gendered_domain_check"], indent=2))

    return {
        "zero_overlap": {"rows": rows_a1, "pooled": pooled_a1},
        "fame_proxy": {"pooled": fame_pooled, "by_domain": fame_by_domain},
        "gender": gender_results,
    }


if __name__ == "__main__":
    main()
