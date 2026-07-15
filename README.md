# Machines of Loving Taste

An interactive report on the aesthetic preferences of 12 AI models — what they call their favorites, what they call overrated, and the vocabulary they use to justify both — across 25 domains (novels, paintings, buildings, dishes, smells, philosophers, …).

**Live site:** [machinesoflovingtaste.com](https://machinesoflovingtaste.com) · built as a single self-contained HTML file.

## How it works

1. **Ask** — the same two questions, put cold to 12 models from 6 companies (Anthropic, OpenAI, Google, xAI, DeepSeek, Moonshot): *what is your favorite ___?* and *which widely beloved ___ is overrated?* A short preamble concedes the "I'm an AI" disclaimer up front so answers start at the answer.
2. **Sample** — 25 domains × 2 probes × 12 models, adaptively sampled 4–12 times per cell (unanimous cells stop early).
3. **Distill** — a fast reader model extracts the named pick and the descriptive vocabulary from each response; wording variants of the same referent are merged (LLM-proposed aliases, hand-reviewed).
4. **Map** — picks become the Index (green = favourite share, red = overrated share, shrinkage-weighted ranking); descriptor vocabularies are embedded and PCA-projected onto three interpretable axes to place each model on a rotatable 3D map.

Every quote shown in the report is a verbatim extract from a model's actual response (programmatically audited).

## Structure

- `src/` — zero-dependency Node ESM pipeline: `collect` → `extract` → `adapt` (adaptive escalation) → `canonicalize` → `analyze` → `vocab` → `entitycards` → `site`
- `data/` — derived JSON (summaries, aliases, entity cards, embedded imagery). Raw response `.jsonl` files are local-only.
- `report/` — build outputs; `site.html` is the full standalone page
- `public/` — the deployed copy
- `.claude/skills/add-domain/` — one-command recipe for adding a new domain end to end

## Running

Requires API keys in `.env` (Anthropic, OpenAI, Google, DeepSeek, Moonshot, xAI) for collection; rebuilding the site from the committed derived data needs the local `.jsonl` response files.

```sh
node src/site.js   # rebuild report/site.html + report/artifact.html
```

Imagery: Wikimedia Commons (credits in the site's Method section).
