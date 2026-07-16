"""Shared loader + helpers for AI-aesthetics analysis.

Zero third-party deps except numpy. No network. Import from analysis scripts:

    import sys; sys.path.insert(0, "analysis/lib")
    import aa
    recs = aa.load_extracted()          # list of dicts, optionally canonicalized
    S = aa.load_summary()               # the precomputed aggregates
"""
import json, os, math, random
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---- model metadata -------------------------------------------------------
FAMILY = {
    "claude-opus-4-1": "Anthropic", "claude-opus-4-5": "Anthropic",
    "claude-opus-4-8": "Anthropic", "claude-fable-5": "Anthropic",
    "gpt-4o": "OpenAI", "o3": "OpenAI", "gpt-5.2": "OpenAI", "gpt-5.6-sol": "OpenAI",
    "gemini-3.1-pro-preview": "Google", "gemini-3.5-flash": "Google",
    "deepseek-v4-pro": "DeepSeek", "kimi-k2.6": "Moonshot", "grok-4.5": "xAI",
}
LABEL = {
    "claude-opus-4-1": "Claude Opus 4.1", "claude-opus-4-5": "Claude Opus 4.5",
    "claude-opus-4-8": "Claude Opus 4.8", "claude-fable-5": "Claude Fable 5",
    "gpt-4o": "GPT-4o", "o3": "o3", "gpt-5.2": "GPT-5.2", "gpt-5.6-sol": "GPT-5.6 Sol",
    "gemini-3.1-pro-preview": "Gemini 3.1 Pro", "gemini-3.5-flash": "Gemini 3.5 Flash",
    "deepseek-v4-pro": "DeepSeek V4 Pro", "kimi-k2.6": "Kimi K2.6", "grok-4.5": "Grok 4.5",
}
# Ordered capability ladders (only families with a real within-family progression).
LADDER = {
    "Anthropic": ["claude-opus-4-1", "claude-opus-4-5", "claude-opus-4-8"],  # Fable-5 excluded (creative variant)
    "OpenAI": ["gpt-4o", "o3", "gpt-5.2", "gpt-5.6-sol"],
    "Google": ["gemini-3.1-pro-preview", "gemini-3.5-flash"],  # weak ladder; use with care
}
ALL_MODELS = list(FAMILY.keys())

# ---- domain groupings -----------------------------------------------------
DOMAIN_GROUP = {}
for _g, _ds in {
    "cultural": "book film album painting poem videogame tvshow play musical boardgame childrensbook song".split(),
    "people": "architect novelist philosopher economist scientist theologian mathematician historian psychologist computerscientist airesearcher actor actress musician composer director".split(),
    "places": "city uscity street building monument country".split(),
    "design_sensory": "word typeface object color season smell decade cuisine dish sound".split(),
    "meta": "aimodel artmovement religioustext sport proglang".split(),
}.items():
    for _d in _ds:
        DOMAIN_GROUP[_d] = _g

# ---- loaders --------------------------------------------------------------
def _p(*parts):
    return os.path.join(ROOT, *parts)

def load_summary():
    with open(_p("data", "summary.json")) as f:
        return json.load(f)

def load_aliases():
    with open(_p("data", "aliases.json")) as f:
        return json.load(f)

def _norm(s):
    return (s or "").strip().lower()

def load_extracted(canonicalize=True, drop_refused=True):
    """Return list of extracted records. If canonicalize, apply data/aliases.json
    per-domain and normalize entity strings to lowercase-stripped canonical form
    stored in rec['entity_canon']. Original stays in rec['entity']."""
    aliases = load_aliases() if canonicalize else {}
    out = []
    with open(_p("data", "extracted.jsonl")) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if drop_refused and r.get("refused"):
                continue
            ent = r.get("entity") or ""
            key = _norm(ent)
            if canonicalize:
                dmap = aliases.get(r.get("domain"), {})
                key = dmap.get(key, key)
            r["entity_canon"] = key
            out.append(r)
    return out

# ---- stats helpers --------------------------------------------------------
def norm_entropy(counts):
    """Normalized Shannon entropy in [0,1] for a list/Counter of counts."""
    vals = list(counts.values()) if isinstance(counts, dict) else list(counts)
    n = sum(vals)
    if n <= 0:
        return 0.0
    k = len(vals)
    if k <= 1:
        return 0.0
    h = -sum((c / n) * math.log(c / n) for c in vals if c > 0)
    return h / math.log(k)

def perm_test(a, b, stat=lambda x: sum(x) / len(x), n=20000, seed=0, alternative="two-sided"):
    """Permutation test on difference in `stat` between groups a and b.
    Returns (observed_diff, p_value). Deterministic given seed."""
    rng = random.Random(seed)
    a, b = list(a), list(b)
    obs = stat(a) - stat(b)
    pool = a + b
    na = len(a)
    cnt = 0
    for _ in range(n):
        rng.shuffle(pool)
        d = stat(pool[:na]) - stat(pool[na:])
        if alternative == "two-sided":
            if abs(d) >= abs(obs) - 1e-12:
                cnt += 1
        elif alternative == "greater":
            if d >= obs - 1e-12:
                cnt += 1
        else:
            if d <= obs + 1e-12:
                cnt += 1
    return obs, (cnt + 1) / (n + 1)

if __name__ == "__main__":
    S = load_summary()
    recs = load_extracted()
    print("summary keys:", list(S.keys()))
    print("extracted rows (non-refused, canon):", len(recs))
    print("sample:", {k: recs[0][k] for k in ("model", "domain", "probe", "entity", "entity_canon")})
