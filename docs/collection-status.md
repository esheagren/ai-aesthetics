# Collection status

Updated: 2026-07-14

The DeepSeek V4 Pro and Kimi K2.6 collection was intentionally stopped during
the third adaptive round. The current report includes every response collected
and extracted before that stop.

## Current coverage

| Model | Extracted responses | Cells at target | Calls remaining |
| --- | ---: | ---: | ---: |
| DeepSeek V4 Pro | 309 | 37 of 40 | 3 |
| Kimi K2.6 | 307 | 35 of 40 | 17 |

The 40 cells per model are 20 retained domains times two probes. All cells have
at least the four-sample baseline; the remaining calls only complete adaptive
expansion targets for the most variable cells.

## Provider settings

- DeepSeek uses `deepseek-v4-pro` through the official chat-completions API.
- Kimi uses `kimi-k2.6` with thinking explicitly disabled for comparable,
  short single-turn answers.
- Kimi collection concurrency is limited to one because the account enforces a
  low organization concurrency limit.
- Credentials are read from the ignored `.env` file.

## Resume

From the repository root, run:

```sh
SKIP_PROVIDERS=anthropic,openai,gemini node src/run.js
```

Collection is key-based and resumable. Existing successful responses and
extractions will be skipped; the command will collect the 20 remaining calls,
extract them, rerun adaptive settlement, and regenerate the analyses.
