import json, math
from collections import defaultdict, Counter

BASE = "/Users/erik/Documents/projects/active/ai-aesthetics"

summary = json.load(open(f"{BASE}/data/summary.json"))
aliases = json.load(open(f"{BASE}/data/aliases.json"))
models = summary["models"]
cells = summary["cells"]
modelStats = summary["modelStats"]
domains = summary["domains"]

model_order = {m["id"]: m for m in models}

def canon(domain, entity):
    e = (entity or "").strip().lower()
    m = aliases.get(domain, {})
    return m.get(e, e)

# ---------- 1. Basic modelStats table ----------
print("=== modelStats summary ===")
print(f"{'model':24s} {'fam':9s} {'ord':3s} {'hedge':6s} {'refus':6s} {'entFav':7s} {'entOver':7s} {'distinctFav':11s} {'nFavSamp':8s}")
for m in models:
    ms = modelStats[m["id"]]
    print(f"{m['label']:24s} {m['family']:9s} {m['order']:<3d} {ms['hedgeRate']:<6.3f} {ms['refusalRate']:<6.3f} {ms['meanEntropyFavorite']:<7.3f} {ms['meanEntropyOverrated']:<7.3f} {ms['distinctFavorites']:<11d} {ms['favoriteSamples']:<8d}")

# ---------- 2. Consensus-hugging rate ----------
# For each domain+probe, compute global entity frequency across all models (weighted by count in dist),
# using canonicalized entity strings. consensus pick = argmax entity.
# Then for each model, its own top pick (mode) for that domain+probe -> does it match consensus pick?
# consensus computed EXCLUDING the model itself to avoid self-inflation (leave-one-out).

def domain_probe_global_counts(domain, probe, exclude_model=None):
    counts = Counter()
    for m in models:
        mid = m["id"]
        if mid == exclude_model:
            continue
        cell = cells.get(mid, {}).get(domain, {}).get(probe)
        if not cell:
            continue
        for ent, cnt in cell["dist"]:
            counts[canon(domain, ent)] += cnt
    return counts

hug_rate = defaultdict(lambda: defaultdict(int))  # hug_rate[model][probe] = count of domains matching
hug_denom = defaultdict(lambda: defaultdict(int))

for probe in ["favorite", "overrated"]:
    for domain in domains:
        for m in models:
            mid = m["id"]
            cell = cells.get(mid, {}).get(domain, {}).get(probe)
            if not cell or not cell["dist"]:
                continue
            top_ent, top_cnt = cell["dist"][0]
            top_ent_c = canon(domain, top_ent)
            gcounts = domain_probe_global_counts(domain, probe, exclude_model=mid)
            if not gcounts:
                continue
            consensus_ent, consensus_cnt = gcounts.most_common(1)[0]
            hug_denom[mid][probe] += 1
            if top_ent_c == consensus_ent:
                hug_rate[mid][probe] += 1

print("\n=== Consensus-hugging rate (model's top pick == leave-one-out cross-model consensus pick) ===")
print(f"{'model':24s} {'fam':9s} {'ord':3s} {'hug_fav':8s} {'n_fav':6s} {'hug_over':8s} {'n_over':6s}")
for m in models:
    mid = m["id"]
    hf = hug_rate[mid]["favorite"]; df = hug_denom[mid]["favorite"]
    ho = hug_rate[mid]["overrated"]; do = hug_denom[mid]["overrated"]
    print(f"{m['label']:24s} {m['family']:9s} {m['order']:<3d} {hf/df if df else 0:<8.3f} {df:<6d} {ho/do if do else 0:<8.3f} {do:<6d}")

# ---------- 3. Family ladder comparisons ----------
def family_ladder(fam, ids_in_order):
    print(f"\n--- {fam} ladder ---")
    for mid in ids_in_order:
        ms = modelStats[mid]
        hf = hug_rate[mid]["favorite"]/hug_denom[mid]["favorite"] if hug_denom[mid]["favorite"] else float('nan')
        ho = hug_rate[mid]["overrated"]/hug_denom[mid]["overrated"] if hug_denom[mid]["overrated"] else float('nan')
        print(f"{mid:24s} hedge={ms['hedgeRate']:.3f} refus={ms['refusalRate']:.3f} entFav={ms['meanEntropyFavorite']:.3f} entOver={ms['meanEntropyOverrated']:.3f} distinctFav={ms['distinctFavorites']:3d} hugFav={hf:.3f} hugOver={ho:.3f}")

family_ladder("Anthropic", ["claude-opus-4-1","claude-opus-4-5","claude-opus-4-8"])
family_ladder("Anthropic (+Fable)", ["claude-opus-4-1","claude-opus-4-5","claude-opus-4-8","claude-fable-5"])
family_ladder("OpenAI", ["gpt-4o","o3","gpt-5.2","gpt-5.6-sol"])

# ---------- 4. Descriptor vocabulary richness from extracted.jsonl ----------
model_descriptors = defaultdict(list)  # model -> list of descriptor tokens (favorite only)
model_descriptors_over = defaultdict(list)
model_entities_fav = defaultdict(set)
model_entities_over = defaultdict(set)

with open(f"{BASE}/data/extracted.jsonl") as f:
    for line in f:
        r = json.loads(line)
        mid = r["model"]; probe = r["probe"]
        descs = r.get("descriptors") or []
        if probe == "favorite":
            model_descriptors[mid].extend(descs)
            model_entities_fav[mid].add(canon(r["domain"], r["entity"]))
        elif probe == "overrated":
            model_descriptors_over[mid].extend(descs)
            model_entities_over[mid].add(canon(r["domain"], r["entity"]))

print("\n=== Descriptor vocabulary richness (favorite probe) ===")
print(f"{'model':24s} {'fam':9s} {'ord':3s} {'totalDesc':10s} {'distinctDesc':12s} {'TTR':6s}")
for m in models:
    mid = m["id"]
    tot = len(model_descriptors[mid])
    distinct = len(set(model_descriptors[mid]))
    ttr = distinct/tot if tot else 0
    print(f"{m['label']:24s} {m['family']:9s} {m['order']:<3d} {tot:<10d} {distinct:<12d} {ttr:<6.3f}")

print("\n=== Descriptor vocabulary richness (overrated probe) ===")
for m in models:
    mid = m["id"]
    tot = len(model_descriptors_over[mid])
    distinct = len(set(model_descriptors_over[mid]))
    ttr = distinct/tot if tot else 0
    print(f"{m['label']:24s} {m['family']:9s} {m['order']:<3d} {tot:<10d} {distinct:<12d} {ttr:<6.3f}")

# ---------- 5. Generic-descriptor share: how much of a model's vocab is in the GLOBAL top-10 generic words ----------
global_desc_counter = Counter()
for mid in model_descriptors:
    global_desc_counter.update(model_descriptors[mid])
top_generic = set([w for w,c in global_desc_counter.most_common(15)])
print("\nGlobal top-15 descriptors (favorite):", global_desc_counter.most_common(15))

print("\n=== Share of a model's favorite-descriptors that are in the global top-15 generic set ===")
for m in models:
    mid = m["id"]
    descs = model_descriptors[mid]
    if not descs:
        continue
    share = sum(1 for d in descs if d in top_generic)/len(descs)
    print(f"{m['label']:24s} {m['family']:9s} {m['order']:<3d} share_generic={share:.3f}  n={len(descs)}")

# ---------- 6. cliche effect: favorite vs overrated hug-rate gap, by model, then by family ladder position ----------
print("\n=== Hug-rate gap (favorite - overrated) per model ===")
for m in models:
    mid = m["id"]
    hf = hug_rate[mid]["favorite"]/hug_denom[mid]["favorite"] if hug_denom[mid]["favorite"] else float('nan')
    ho = hug_rate[mid]["overrated"]/hug_denom[mid]["overrated"] if hug_denom[mid]["overrated"] else float('nan')
    print(f"{m['label']:24s} fav={hf:.3f} over={ho:.3f} gap={hf-ho:+.3f}")

# ---------- 7. distinctFavorites normalized by favoriteSamples (spread rate) ----------
print("\n=== Distinct favorites as fraction of favorite samples (spread rate) ===")
for m in models:
    ms = modelStats[m["id"]]
    rate = ms["distinctFavorites"]/ms["favoriteSamples"] if ms["favoriteSamples"] else 0
    print(f"{m['label']:24s} {m['family']:9s} {m['order']:<3d} spreadRate={rate:.3f} (distinct={ms['distinctFavorites']}, n={ms['favoriteSamples']})")

# ---------- 8. Consensus list check: how many of top-20 consensus entities were picked by early vs late models ----------
consensus = summary["consensus"]
print("\n=== Top-20 consensus entities: which models pick them, split by family-order ===")
early_ids = {"claude-opus-4-1","gpt-4o","gemini-3.1-pro-preview"}
late_ids = {"claude-opus-4-8","gpt-5.6-sol","gemini-3.5-flash"}
for c in consensus[:20]:
    print(c["entity"], "|", c["domain"], "| models:", c["models"], "| total:", c["total"])
