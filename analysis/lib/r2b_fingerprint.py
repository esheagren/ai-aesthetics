"""R2-B — Each model's descriptor fingerprint: distinctive vocabulary via
log-odds-ratio with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008,
"Fightin' Words"). Answers: which adjectives does each model reach for MORE than
its peers, once raw-frequency noise ("elegant" is universal) and small-count
noise (a word used once by chance) are both controlled for?

Method (per model i, per probe):
  - target counts  y_i^w  = model i's count of descriptor w (pooled over all domains)
  - background counts y_j^w = pooled count of w across the OTHER 12 models
  - informative prior alpha_w = w's count in the FULL pooled corpus (all 13 models,
    that probe) -- i.e. the background/prior is the corpus's own frequency profile,
    the standard "informative Dirichlet prior" choice in Monroe et al. Frequent
    words (like "elegant") get a large, protective prior and need a big skew to
    register as distinctive; rare words get a small prior and don't run away on
    a single mention, because the z-score's variance term also shrinks with count.
  - log-odds-ratio:
        delta_w = log((y_i^w + a_w) / (n_i + a_0 - y_i^w - a_w))
                - log((y_j^w + a_w) / (n_j + a_0 - y_j^w - a_w))
    where n_i, n_j are total descriptor-token counts for model i / the rest,
    and a_0 = sum_w(a_w) over the vocabulary.
  - variance:  sigma^2(delta_w) = 1/(y_i^w + a_w) + 1/(y_j^w + a_w)
  - z_w = delta_w / sqrt(sigma^2(delta_w))   <- the ranking statistic (Monroe's
    "z-scored log-odds-ratio with informative Dirichlet prior")

We rank each model's descriptors by z descending (positive z = used MORE than the
z_w threshold self-adjusts for both word frequency and model sample size, so it
does the "rare-word noise" control asked for without an ad hoc count cutoff.

Same machinery is reused at the FAMILY level (pool all models in a family as the
target, all other families as background) for the 3 multi-model families
(Anthropic, OpenAI, Google); single-model families (DeepSeek, Moonshot, xAI)
have no within-family aggregation and are reported at the model level only.

Zero third-party deps except numpy (numpy only used for the sqrt/log vectorized
convenience below; falls back trivially to math if numpy unavailable). No network.
"""
import sys, os, math, csv
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aa
import q6_vocabulary as q6

PROBES = ("favorite", "overrated")


def log_odds_fightin_words(target_counts, rest_counts, prior_counts):
    """Core Monroe et al. computation. Returns {word: {delta, z, y_i, y_j, alpha}}
    for every word in the union of target/rest/prior vocab."""
    vocab = set(target_counts) | set(rest_counts) | set(prior_counts)
    n_i = sum(target_counts.values())
    n_j = sum(rest_counts.values())
    a_0 = sum(prior_counts.values())
    out = {}
    for w in vocab:
        y_i = target_counts.get(w, 0)
        y_j = rest_counts.get(w, 0)
        a_w = prior_counts.get(w, 0)
        if a_w <= 0:
            a_w = 1e-6  # shouldn't happen (prior = target+rest pooled) but guard anyway
        num_i = y_i + a_w
        den_i = n_i + a_0 - y_i - a_w
        num_j = y_j + a_w
        den_j = n_j + a_0 - y_j - a_w
        if den_i <= 0 or den_j <= 0 or num_i <= 0 or num_j <= 0:
            continue
        delta = math.log(num_i / den_i) - math.log(num_j / den_j)
        var = 1.0 / num_i + 1.0 / num_j
        z = delta / math.sqrt(var) if var > 0 else 0.0
        out[w] = {"delta": delta, "z": z, "y_i": y_i, "y_j": y_j, "alpha": a_w}
    return out


def model_fingerprints(recs, probe, top_n=10):
    """{model: [ (word, z, delta, count_model, count_rest), ... ]} top_n by z desc,
    restricted to words the model uses MORE than its peers (z > 0, delta > 0)."""
    counts = q6.per_model_descriptor_counts(recs, probe)  # {model: Counter}
    models = sorted(counts.keys())
    pooled_all = Counter()
    for m in models:
        pooled_all.update(counts[m])

    result = {}
    for m in models:
        target = counts[m]
        rest = Counter()
        for other in models:
            if other != m:
                rest.update(counts[other])
        stats = log_odds_fightin_words(target, rest, pooled_all)
        ranked = sorted(
            (w for w in stats if stats[w]["z"] > 0 and stats[w]["delta"] > 0),
            key=lambda w: -stats[w]["z"],
        )[:top_n]
        result[m] = [
            (w, stats[w]["z"], stats[w]["delta"], stats[w]["y_i"], stats[w]["y_j"])
            for w in ranked
        ]
    return result


MULTI_MODEL_FAMILIES = ("Anthropic", "OpenAI", "Google")


def family_fingerprints(recs, probe, top_n=10):
    """Same method, grouping models by family. Only families with >=2 models are
    meaningfully 'aggregated'; single-model families are included too (identical
    to their lone model's fingerprint) for completeness of the family table."""
    counts = q6.per_model_descriptor_counts(recs, probe)
    models = sorted(counts.keys())
    fam_counts = defaultdict(Counter)
    for m in models:
        fam_counts[aa.FAMILY[m]].update(counts[m])
    families = sorted(fam_counts.keys())
    pooled_all = Counter()
    for f in families:
        pooled_all.update(fam_counts[f])

    result = {}
    for f in families:
        target = fam_counts[f]
        rest = Counter()
        for other in families:
            if other != f:
                rest.update(fam_counts[other])
        stats = log_odds_fightin_words(target, rest, pooled_all)
        ranked = sorted(
            (w for w in stats if stats[w]["z"] > 0 and stats[w]["delta"] > 0),
            key=lambda w: -stats[w]["z"],
        )[:top_n]
        result[f] = [
            (w, stats[w]["z"], stats[w]["delta"], stats[w]["y_i"], stats[w]["y_j"])
            for w in ranked
        ]
    return result


def write_csv(path, recs, top_n=10):
    """model x top distinctive descriptors + scores, both probes, to CSV."""
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["scope", "group", "probe", "rank", "descriptor", "z", "log_odds_delta",
                    "count_in_group", "count_in_rest"])
        for probe in PROBES:
            mf = model_fingerprints(recs, probe, top_n=top_n)
            for m in sorted(mf.keys()):
                for rank, (word, z, delta, y_i, y_j) in enumerate(mf[m], start=1):
                    w.writerow(["model", aa.LABEL.get(m, m), probe, rank, word,
                                f"{z:.4f}", f"{delta:.4f}", y_i, y_j])
            ff = family_fingerprints(recs, probe, top_n=top_n)
            for fam in sorted(ff.keys()):
                for rank, (word, z, delta, y_i, y_j) in enumerate(ff[fam], start=1):
                    w.writerow(["family", fam, probe, rank, word,
                                f"{z:.4f}", f"{delta:.4f}", y_i, y_j])


if __name__ == "__main__":
    recs = q6.load_recs()
    out_path = os.path.join(aa.ROOT, "analysis", "data", "r2b_fingerprint.csv")
    write_csv(out_path, recs, top_n=10)
    print("wrote", out_path)

    # quick console sanity check
    mf = model_fingerprints(recs, "favorite", top_n=10)
    for m in sorted(mf.keys()):
        top3 = ", ".join(f"{w}(z={z:.1f})" for w, z, d, yi, yj in mf[m][:3])
        print(f"{aa.LABEL[m]:20s} FAV top3: {top3}")
