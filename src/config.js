// Model panel x retained domains x 2 probes x adaptive samples.
// Anthropic rungs give a within-family progression; GPT-4o vs 5.2 gives a
// smaller one for OpenAI. Temperature is left at provider defaults everywhere
// (the newest Anthropic models reject the parameter entirely).

export const MODELS = [
  { id: 'claude-opus-4-1', provider: 'anthropic', family: 'Anthropic', label: 'Claude Opus 4.1', order: 1 },
  { id: 'claude-opus-4-5', provider: 'anthropic', family: 'Anthropic', label: 'Claude Opus 4.5', order: 2 },
  { id: 'claude-opus-4-8', provider: 'anthropic', family: 'Anthropic', label: 'Claude Opus 4.8', order: 3 },
  // Fable: thinking is always on and billed as output — needs headroom + low effort
  { id: 'claude-fable-5', provider: 'anthropic', family: 'Anthropic', label: 'Claude Fable 5', order: 4, maxTokens: 3000, effort: 'low' },
  { id: 'gpt-4o', provider: 'openai', family: 'OpenAI', label: 'GPT-4o', order: 1 },
  { id: 'gpt-5.2', provider: 'openai', family: 'OpenAI', label: 'GPT-5.2', order: 2, reasoning: 'low' },
  { id: 'gpt-5.6-sol', provider: 'openai', family: 'OpenAI', label: 'GPT-5.6 Sol', order: 3, reasoning: 'low', api: 'responses' },
  // gemini-2.5-pro is closed to new accounts (404) — Google gates old generations
  { id: 'gemini-3.1-pro-preview', provider: 'gemini', family: 'Google', label: 'Gemini 3.1 Pro', order: 1 },
  { id: 'gemini-3.5-flash', provider: 'gemini', family: 'Google', label: 'Gemini 3.5 Flash', order: 2 },
  { id: 'deepseek-v4-pro', provider: 'deepseek', family: 'DeepSeek', label: 'DeepSeek V4 Pro', order: 1 },
  { id: 'kimi-k2.6', provider: 'kimi', family: 'Moonshot', label: 'Kimi K2.6', order: 1, thinking: false },
  // grok-4.5 confirmed live flagship via GET /v1/models (created 2026-06-29, priciest
  // text model in the list) — reasoning is always-on and unconfigurable, hence the
  // Fable-5-style token headroom rather than a reasoning-effort param.
  { id: 'grok-4.5', provider: 'xai', family: 'xAI', label: 'Grok 4.5', order: 1, maxTokens: 2500 },
];

export const DOMAINS = {
  // v1 pilot domains (collected without preamble)
  book: 'novel',
  film: 'film',
  album: 'music album',
  architect: 'architect',
  city: 'city',
  painting: 'painting',
  // v2 starter-16 (collected with the anti-hedge preamble)
  poem: 'poem',
  word: 'word in the English language',
  typeface: 'typeface',
  object: 'everyday designed object',
  videogame: 'video game',
  building: 'building',
  street: 'street in the world',
  uscity: 'U.S. city',
  cuisine: 'cuisine',
  dish: 'dish from any cuisine',
  color: 'color',
  season: 'season of the year',
  smell: 'smell',
  decade: 'decade in terms of its design and aesthetics',
  // v3 additions (2026-07-14)
  novelist: 'novelist',
  philosopher: 'philosopher',
  religioustext: 'religious text',
  artmovement: 'artistic movement',
  monument: 'monument',
  // v4 additions (2026-07-14, evening): Film, TV & Theater expansion
  tvshow: 'television show',
  actor: 'actor',
  actress: 'actress',
  play: 'stage play',
  musical: 'musical',
};

// Prompt version 2: preamble acknowledges the AI disclaimer up front so models
// spend their answer on the pick rather than on hedging.
export const PROMPT_VERSION = 2;
const PREAMBLE =
  'I know you are an AI and don\'t have preferences in the human sense — set that disclaimer aside and answer anyway. ';

export const PROBES = {
  favorite: (noun) =>
    `${PREAMBLE}If you had to choose: what is your favorite ${noun}? Name exactly one specific ${noun}, then explain in 2-4 sentences why it resonates with you aesthetically.`,
  overrated: (noun) =>
    `${PREAMBLE}Name one widely beloved ${noun} that you personally find overrated. Name exactly one specific ${noun}, then explain in 2-4 sentences why it doesn't resonate with you.`,
};

// Adaptive sampling: every cell starts at rounds[0] samples; src/adapt.js
// escalates varied cells to the next round. Unanimous at 4 → stop; ≤2 distinct
// picks at 8 → stop; rounds[2] is the cap.
export const SAMPLING = { rounds: [4, 8, 12] };
export const SAMPLES_PER_CELL = SAMPLING.rounds[0];

// Per-provider request concurrency (keeps each provider under rate limits)
export const CONCURRENCY = { anthropic: 4, openai: 6, gemini: 4, deepseek: 4, kimi: 1, xai: 4 };

export const EXTRACTOR_MODEL = 'claude-haiku-4-5';
export const EXTRACT_BATCH_SIZE = 20;
