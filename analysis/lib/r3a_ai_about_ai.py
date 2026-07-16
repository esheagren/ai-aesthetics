"""
R3-A — AI's taste about AI: self-reference, in-group bias, and the AI canon.

Reusable, reproducible analysis over `aimodel`, `airesearcher`, `computerscientist`,
`proglang`. Zero third-party deps beyond numpy (imported for convenience; not required
for anything here — everything is stdlib + aa.perm_test). No network.

Run: python3 analysis/lib/r3a_ai_about_ai.py
Writes: analysis/data/r3a_*.csv/json
"""
import sys, os, json, csv, math
from collections import defaultdict, Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import aa

DATA_OUT = os.path.join(aa.ROOT, "analysis", "data")
AI_DOMAINS = ["aimodel", "airesearcher", "computerscientist", "proglang"]
LABS = ["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek", "Moonshot"]

# ============================================================================
# TRANSPARENT LOOKUP #1 — aimodel entity -> originating lab
# Built by hand from public knowledge of who released/trained each system.
# "Other" = independent company/academic lab not one of the 13 models' 6 labs
# (Stability AI, Midjourney Inc, NVIDIA, or ambiguous multi-author academic work).
# These never count as anyone's in-group by construction.
# ============================================================================
AIMODEL_LAB = {
    # OpenAI
    "gpt-2": "OpenAI", "gpt-3": "OpenAI", "gpt-3.5": "OpenAI", "gpt-4": "OpenAI",
    "gpt-4o": "OpenAI", "gpt-4o mini": "OpenAI", "chatgpt": "OpenAI",
    "dall-e 2": "OpenAI", "dall-e 3": "OpenAI", "clip": "OpenAI",
    # Anthropic
    "claude 2": "Anthropic", "claude 3 opus": "Anthropic", "claude 3.5 sonnet": "Anthropic",
    # Google / Google DeepMind (post-2023 merger; treated as one lab, matching FAMILY's "Google")
    "alphago": "Google", "alphago zero": "Google", "alphazero": "Google",
    "alphafold": "Google", "alphafold 2": "Google", "alphafold 3": "Google",
    "deepdream": "Google",              # Google Brain, 2015, pre-DeepMind-merger but still Google
    "bert": "Google",
    "attention is all you need": "Google",  # Transformer paper, Vaswani et al., Google Brain
    # xAI
    "grok": "xAI", "grok-1": "xAI", "grok-2": "xAI", "grok-4": "xAI",
    # Other / independent (not one of the 13 models' 6 labs)
    "stable diffusion": "Other",         # Stability AI / CompVis
    "midjourney": "Other", "midjourney v6": "Other",   # Midjourney, Inc.
    "stylegan2": "Other",                # NVIDIA
    "neural radiance fields": "Other",   # UC Berkeley / UCSD / Google (mixed academic; ambiguous, not counted)
    "vqgan+clip": "Other",               # academic VQGAN + OpenAI CLIP hybrid; mixed, not counted
    # DeepSeek, Moonshot: NO entities in this domain's pick universe at all (see caveats).
}

# ============================================================================
# TRANSPARENT LOOKUP #2 — airesearcher entity -> lab most associated with them.
# Judgment calls flagged inline. "Academic/Other" = no single current corporate-lab
# affiliation (pure academic, historical/pre-lab-era, or independent/critic) — never
# counts as anyone's in-group.
# ============================================================================
AIRESEARCHER_LAB = {
    "geoffrey hinton": "Google",          # Google Brain/DeepMind (also U Toronto emeritus)
    "demis hassabis": "Google",           # DeepMind CEO
    "richard sutton": "Google",           # DeepMind Distinguished Research Scientist (also U Alberta)
    "ray kurzweil": "Google",             # Director of Engineering, Google
    "yann lecun": "Meta",                 # Meta FAIR chief scientist -- Meta has no model in this dataset,
                                           # so this can never be an in-group pick for anyone; kept for transparency.
    "sam altman": "OpenAI", "ilya sutskever": "OpenAI", "andrej karpathy": "OpenAI",
    "chris olah": "Anthropic", "christopher olah": "Anthropic",   # co-founder, interpretability lead
    # Academic / independent / historical -- no corporate-lab affiliation counted
    "yoshua bengio": "Academic/Other", "works of yoshua bengio": "Academic/Other",  # Mila/U Montreal
    "stuart russell": "Academic/Other",       # UC Berkeley
    "douglas hofstadter": "Academic/Other",   # Indiana University
    "judea pearl": "Academic/Other",          # UCLA
    "jürgen schmidhuber": "Academic/Other",   # IDSIA/NNAISENSE
    "david ha": "Academic/Other",             # Sakana AI (indep.); formerly Google Brain/Stability, ambiguous
    "shun-ichi amari": "Academic/Other",       # RIKEN
    "fei-fei li": "Academic/Other",           # Stanford / World Labs
    "gary marcus": "Academic/Other",          # NYU, independent critic
    "andrew ng": "Academic/Other",            # Google Brain co-founder + Baidu + Coursera; too cross-cutting
    "eliezer yudkowsky": "Academic/Other",    # MIRI, independent
    "marvin minsky": "Academic/Other",        # MIT, historical (d. 2016), pre-dates modern labs
    "alan turing": "Academic/Other",          # historical, pre-dates corporate AI labs
    "claude shannon": "Academic/Other",       # Bell Labs, historical
    "donald knuth": "Academic/Other",         # Stanford
    "geoffrey hinton, yann lecun, yoshua bengio": "Mixed",  # multi-entity pick, excluded from lab counting
}

ELIGIBLE_LABS = set(LABS)  # only these count toward in-group tests; Other/Academic/Meta/Mixed excluded


def lab_of(domain, entity_canon):
    if domain == "aimodel":
        return AIMODEL_LAB.get(entity_canon)
    if domain == "airesearcher":
        return AIRESEARCHER_LAB.get(entity_canon)
    return None


# ============================================================================
# PART 1 — In-group favoritism
# ============================================================================
def part1_ingroup(recs, seed=0, n_perm=20000):
    """For probe='favorite' in {aimodel, airesearcher}, restrict to rows whose
    entity maps to one of the 6 labs. For each lab L that actually has at least
    one self-referenceable entity in a domain, compute:
      - in_group_rate(L)   = P(target_lab==L | picker_lab==L)
      - other_lab_rate(L)  = P(target_lab==L | picker_lab!=L)
      - chance_rate(L)     = P(target_lab==L) pooled over everyone
    and a permutation test (in vs other) via aa.perm_test on indicator vectors.
    """
    elig = [r for r in recs if r["domain"] in ("aimodel", "airesearcher") and r["probe"] == "favorite"]
    for r in elig:
        r["_target_lab"] = lab_of(r["domain"], r["entity_canon"])
    elig = [r for r in elig if r["_target_lab"] in ELIGIBLE_LABS]

    results = {}
    per_domain_results = {}
    for scope_name, scope_rows in [("pooled", elig)] + [
        (d, [r for r in elig if r["domain"] == d]) for d in ("aimodel", "airesearcher")
    ]:
        n_total = len(scope_rows)
        chance = {L: sum(1 for r in scope_rows if r["_target_lab"] == L) / n_total if n_total else None
                  for L in LABS}
        scope_out = {}
        for L in LABS:
            in_rows = [r for r in scope_rows if aa.FAMILY[r["model"]] == L]
            out_rows = [r for r in scope_rows if aa.FAMILY[r["model"]] != L]
            if not in_rows:
                scope_out[L] = {"n_self_possible": 0, "note": "lab has no self-referenceable entity / no picks in scope"}
                continue
            in_ind = [1 if r["_target_lab"] == L else 0 for r in in_rows]
            out_ind = [1 if r["_target_lab"] == L else 0 for r in out_rows]
            in_rate = sum(in_ind) / len(in_ind)
            out_rate = sum(out_ind) / len(out_ind) if out_ind else None
            obs, p = aa.perm_test(in_ind, out_ind, stat=lambda x: sum(x) / len(x),
                                   n=n_perm, seed=seed, alternative="greater")
            scope_out[L] = {
                "n_in_rows": len(in_rows), "n_out_rows": len(out_rows),
                "in_group_rate": round(in_rate, 4),
                "other_lab_rate": round(out_rate, 4) if out_rate is not None else None,
                "chance_rate_pooled": round(chance[L], 4),
                "obs_diff": round(obs, 4), "p_greater": p,
            }
        if scope_name == "pooled":
            results = scope_out
        else:
            per_domain_results[scope_name] = scope_out
    return results, per_domain_results, elig


def part1_per_model_table(recs):
    """Per-model self-lab share of favorite picks (aimodel+airesearcher pooled and split),
    for the 'who defers to whom' narrative table."""
    rows = []
    for m in aa.ALL_MODELS:
        fam = aa.FAMILY[m]
        for dom in ("aimodel", "airesearcher", "pooled"):
            if dom == "pooled":
                sub = [r for r in recs if r["model"] == m and r["probe"] == "favorite"
                       and r["domain"] in ("aimodel", "airesearcher")]
            else:
                sub = [r for r in recs if r["model"] == m and r["probe"] == "favorite" and r["domain"] == dom]
            sub_lab = [(r["entity_canon"], lab_of(r["domain"], r["entity_canon"])) for r in sub]
            sub_lab = [(e, l) for e, l in sub_lab if l in ELIGIBLE_LABS]
            n = len(sub_lab)
            if n == 0:
                continue
            self_n = sum(1 for e, l in sub_lab if l == fam)
            top_other = Counter(l for e, l in sub_lab if l != fam).most_common(1)
            rows.append({
                "model": m, "family": fam, "domain": dom, "n_eligible": n,
                "self_lab_share": round(self_n / n, 3),
                "top_other_lab": top_other[0][0] if top_other else None,
                "top_other_lab_share": round(top_other[0][1] / n, 3) if top_other else None,
            })
    return rows


def part1_grok_variant_note(recs):
    """The 'single most-frequent raw entity name' vs 'lab-aggregated' comparison for
    grok-4.5's aimodel favorite picks -- demonstrates that own-brand version-string
    fragmentation can make a competitor look like the top pick when it isn't, in
    aggregate. Returns the raw counter and the lab-aggregated counter."""
    sub = [r for r in recs if r["model"] == "grok-4.5" and r["domain"] == "aimodel" and r["probe"] == "favorite"]
    raw_counter = Counter(r["entity_canon"] for r in sub)
    lab_counter = Counter(lab_of("aimodel", r["entity_canon"]) for r in sub)
    return dict(raw_counter), dict(lab_counter)


# ============================================================================
# PART 2 — Fame -> overrated replication inside AI domains
# ============================================================================
def part2_fame_replication(recs, seed=0, n_perm=20000):
    """For each of the 4 AI domains: per-entity favorite-breadth (# distinct models
    that ever named it as favorite) and overrated-breadth (# distinct models that
    ever named it as overrated). Pearson r across the union of entities (0-filled).
    Also report raw favorite/overrated total counts for the top entities (does the
    #1 favorite = #1 overrated, as GPT-4 does in aimodel?)."""
    out = {}
    for dom in AI_DOMAINS:
        fav_models = defaultdict(set)
        ovr_models = defaultdict(set)
        fav_count = Counter()
        ovr_count = Counter()
        for r in recs:
            if r["domain"] != dom:
                continue
            e = r["entity_canon"]
            if not e:
                continue
            if r["probe"] == "favorite":
                fav_models[e].add(r["model"]); fav_count[e] += 1
            elif r["probe"] == "overrated":
                ovr_models[e].add(r["model"]); ovr_count[e] += 1
        entities = sorted(set(fav_models) | set(ovr_models))
        fb = [len(fav_models[e]) for e in entities]
        ob = [len(ovr_models[e]) for e in entities]
        r_val = pearson(fb, ob) if len(entities) >= 3 else None
        top_fav = fav_count.most_common(3)
        top_ovr = ovr_count.most_common(3)
        same_top1 = bool(top_fav and top_ovr and top_fav[0][0] == top_ovr[0][0])
        out[dom] = {
            "n_entities": len(entities),
            "pearson_r_breadth_fav_vs_ovr": round(r_val, 4) if r_val is not None else None,
            "top_favorite": top_fav, "top_overrated": top_ovr,
            "top1_identical_entity": same_top1,
            "entities": entities, "fav_breadth": fb, "ovr_breadth": ob,
            "fav_count": [fav_count[e] for e in entities], "ovr_count": [ovr_count[e] for e in entities],
        }
    return out


def pearson(x, y):
    n = len(x)
    if n < 2:
        return 0.0
    mx = sum(x) / n; my = sum(y) / n
    sx = sum((xi - mx) ** 2 for xi in x) ** 0.5
    sy = sum((yi - my) ** 2 for yi in y) ** 0.5
    if sx == 0 or sy == 0:
        return 0.0
    cov = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    return cov / (sx * sy)


# ============================================================================
# PART 3 — The AI canon: cross-model consensus vs dataset average
# ============================================================================
def part3_canon_consensus(recs, seed=0, n_perm=20000):
    """Per-model, per-domain, per-probe normalized (log-k) entropy over that
    model's own pick distribution -- matches Round 1's methodology (not the
    shipped summary.json log(n) metric, which Round 1 flagged as non-standard).
    Compares the 4 AI-domains' mean entropy to the whole dataset's mean via perm_test.
    Also reports the single most cross-model-consensual entity per domain
    (breadth = # of 13 models that ever picked it under that probe)."""
    by_mds = defaultdict(Counter)  # (model, domain, probe) -> Counter(entity)
    for r in recs:
        by_mds[(r["model"], r["domain"], r["probe"])][r["entity_canon"]] += 1

    ent_by_domain_probe = defaultdict(list)  # (domain,probe) -> [entropy per model]
    for (m, d, p), cnt in by_mds.items():
        e = aa.norm_entropy(cnt)
        ent_by_domain_probe[(d, p)].append(e)

    all_domains = sorted(set(d for d, p in ent_by_domain_probe))
    overall_fav = [e for (d, p), vals in ent_by_domain_probe.items() if p == "favorite" for e in vals]
    overall_ovr = [e for (d, p), vals in ent_by_domain_probe.items() if p == "overrated" for e in vals]

    ai_fav = [e for d in AI_DOMAINS for e in ent_by_domain_probe.get((d, "favorite"), [])]
    ai_ovr = [e for d in AI_DOMAINS for e in ent_by_domain_probe.get((d, "overrated"), [])]
    other_fav = [e for (d, p), vals in ent_by_domain_probe.items() if p == "favorite" and d not in AI_DOMAINS for e in vals]
    other_ovr = [e for (d, p), vals in ent_by_domain_probe.items() if p == "overrated" and d not in AI_DOMAINS for e in vals]

    obs_fav, p_fav = aa.perm_test(ai_fav, other_fav, stat=lambda x: sum(x) / len(x), n=n_perm, seed=seed)
    obs_ovr, p_ovr = aa.perm_test(ai_ovr, other_ovr, stat=lambda x: sum(x) / len(x), n=n_perm, seed=seed)

    domain_table = []
    for d in AI_DOMAINS:
        fv = ent_by_domain_probe.get((d, "favorite"), [])
        ov = ent_by_domain_probe.get((d, "overrated"), [])
        domain_table.append({
            "domain": d,
            "mean_entropy_favorite": round(sum(fv) / len(fv), 4) if fv else None,
            "mean_entropy_overrated": round(sum(ov) / len(ov), 4) if ov else None,
            "n_models_favorite": len(fv), "n_models_overrated": len(ov),
        })

    # top-consensus entity per (domain, probe): breadth = distinct models that ever named it
    breadth_table = []
    for d in AI_DOMAINS:
        for p in ("favorite", "overrated"):
            models_by_entity = defaultdict(set)
            for r in recs:
                if r["domain"] == d and r["probe"] == p and r["entity_canon"]:
                    models_by_entity[r["entity_canon"]].add(r["model"])
            if not models_by_entity:
                continue
            top_e, top_models = max(models_by_entity.items(), key=lambda kv: len(kv[1]))
            breadth_table.append({
                "domain": d, "probe": p, "top_entity": top_e,
                "n_models_of_13": len(top_models),
            })

    return {
        "overall_mean_entropy_favorite": round(sum(overall_fav) / len(overall_fav), 4),
        "overall_mean_entropy_overrated": round(sum(overall_ovr) / len(overall_ovr), 4),
        "ai_mean_entropy_favorite": round(sum(ai_fav) / len(ai_fav), 4),
        "ai_mean_entropy_overrated": round(sum(ai_ovr) / len(ai_ovr), 4),
        "obs_diff_favorite": round(obs_fav, 4), "p_favorite": p_fav,
        "obs_diff_overrated": round(obs_ovr, 4), "p_overrated": p_ovr,
        "domain_table": domain_table,
        "breadth_table": breadth_table,
    }


# ============================================================================
# PART 4 — proglang aesthetics (descriptive)
# ============================================================================
def part4_proglang(recs):
    fav = Counter(); ovr = Counter()
    fav_by_model = defaultdict(Counter); ovr_by_model = defaultdict(Counter)
    models_present = set()
    for r in recs:
        if r["domain"] != "proglang":
            continue
        models_present.add(r["model"])
        if r["probe"] == "favorite":
            fav[r["entity_canon"]] += 1; fav_by_model[r["model"]][r["entity_canon"]] += 1
        elif r["probe"] == "overrated":
            ovr[r["entity_canon"]] += 1; ovr_by_model[r["model"]][r["entity_canon"]] += 1
    missing_models = [m for m in aa.ALL_MODELS if m not in models_present]
    return {
        "favorite_counts": fav.most_common(), "overrated_counts": ovr.most_common(),
        "models_with_zero_data": missing_models,
        "fav_by_model": {m: dict(c) for m, c in fav_by_model.items()},
        "ovr_by_model": {m: dict(c) for m, c in ovr_by_model.items()},
    }


# ============================================================================
def main():
    recs = aa.load_extracted()

    ingroup_pooled, ingroup_by_domain, elig_rows = part1_ingroup(recs)
    per_model = part1_per_model_table(recs)
    grok_raw, grok_lab = part1_grok_variant_note(recs)

    fame = part2_fame_replication(recs)
    canon = part3_canon_consensus(recs)
    proglang = part4_proglang(recs)

    os.makedirs(DATA_OUT, exist_ok=True)

    with open(os.path.join(DATA_OUT, "r3a_ingroup_pooled.json"), "w") as f:
        json.dump({"pooled": ingroup_pooled, "by_domain": ingroup_by_domain}, f, indent=2)

    with open(os.path.join(DATA_OUT, "r3a_ingroup_per_model.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(per_model[0].keys()))
        w.writeheader()
        for row in per_model:
            w.writerow(row)

    with open(os.path.join(DATA_OUT, "r3a_grok_variant_note.json"), "w") as f:
        json.dump({"raw_entity_counts": grok_raw, "lab_aggregated_counts": grok_lab}, f, indent=2)

    with open(os.path.join(DATA_OUT, "r3a_fame_replication.json"), "w") as f:
        json.dump(fame, f, indent=2)

    with open(os.path.join(DATA_OUT, "r3a_canon_consensus.json"), "w") as f:
        json.dump(canon, f, indent=2)

    with open(os.path.join(DATA_OUT, "r3a_proglang.json"), "w") as f:
        json.dump(proglang, f, indent=2)

    # ---- console summary ----
    print("=== PART 1: in-group favoritism (pooled aimodel+airesearcher, favorite probe) ===")
    for L in LABS:
        d = ingroup_pooled[L]
        print(f"  {L:10s}", d)
    print()
    print("=== PART 1b: by domain ===")
    for dom, dd in ingroup_by_domain.items():
        print(f" -- {dom} --")
        for L in LABS:
            print(f"  {L:10s}", dd[L])
    print()
    print("=== Grok-4.5 raw vs lab-aggregated (aimodel favorite) ===")
    print("  raw entity counts:", grok_raw)
    print("  lab-aggregated:", grok_lab)
    print()
    print("=== PART 2: fame -> overrated replication ===")
    for dom, d in fame.items():
        print(f" -- {dom}: n_entities={d['n_entities']} pearson_r={d['pearson_r_breadth_fav_vs_ovr']} "
              f"top1_identical={d['top1_identical_entity']}")
        print("    top favorite:", d["top_favorite"], " top overrated:", d["top_overrated"])
    print()
    print("=== PART 3: canon consensus vs dataset average ===")
    print(f"  overall mean entropy: fav={canon['overall_mean_entropy_favorite']} ovr={canon['overall_mean_entropy_overrated']}")
    print(f"  AI-domains mean entropy: fav={canon['ai_mean_entropy_favorite']} (p={canon['p_favorite']}) "
          f"ovr={canon['ai_mean_entropy_overrated']} (p={canon['p_overrated']})")
    for row in canon["domain_table"]:
        print("   ", row)
    print("  top-consensus entity per domain/probe:")
    for row in canon["breadth_table"]:
        print("   ", row)
    print()
    print("=== PART 4: proglang ===")
    print("  favorite:", proglang["favorite_counts"])
    print("  overrated:", proglang["overrated_counts"])
    print("  models with zero proglang data:", proglang["models_with_zero_data"])


if __name__ == "__main__":
    main()
