// Thin fetch wrappers for the three provider APIs, with shared retry logic.
// No SDKs — the surface we need is tiny and identical across runs.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dotenv dependency)
for (const line of readFileSync(join(here, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  kimi: process.env.KIMI_API_KEY,
  xai: process.env.XAI_API_KEY,
};

async function withRetries(fn, { retries = 5, label = '' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.status ?? 0;
      const retryable = status === 429 || status >= 500 || status === 0;
      if (!retryable || attempt === retries) throw err;
      const retryAfter = Number(err.retryAfter) || 0;
      const delay = Math.max(retryAfter * 1000, 1500 * 2 ** attempt) + Math.random() * 500;
      console.error(`  retry ${attempt + 1}/${retries} for ${label} (${status}): waiting ${(delay / 1000).toFixed(1)}s`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function postJSON(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
    err.status = res.status;
    err.retryAfter = res.headers.get('retry-after');
    throw err;
  }
  return res.json();
}

async function callAnthropic(model, prompt, system) {
  const body = {
    model: model.id,
    max_tokens: model.maxTokens ?? 400,
    messages: [{ role: 'user', content: prompt }],
  };
  if (model.effort) body.output_config = { effort: model.effort };
  if (system) body.system = system;
  const data = await postJSON('https://api.anthropic.com/v1/messages', {
    'x-api-key': KEYS.anthropic,
    'anthropic-version': '2023-06-01',
  }, body);
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, stop: data.stop_reason, usage: data.usage };
}

async function callOpenAI(model, prompt, system) {
  if (model.api === 'responses') {
    const body = {
      model: model.id,
      input: prompt,
      max_output_tokens: model.maxTokens ?? (model.reasoning ? 2000 : 600),
    };
    if (model.reasoning) body.reasoning = { effort: model.reasoning };
    if (system) body.instructions = system;
    const data = await postJSON('https://api.openai.com/v1/responses', {
      authorization: `Bearer ${KEYS.openai}`,
    }, body);
    const text = data.output_text ?? (data.output ?? []).flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text').map((item) => item.text).join('');
    return { text, stop: data.status, usage: data.usage };
  }
  const body = {
    model: model.id,
    max_completion_tokens: model.maxTokens ?? (model.reasoning ? 2000 : 600),
    messages: system
      ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }],
  };
  if (model.reasoning) body.reasoning_effort = model.reasoning;
  const data = await postJSON('https://api.openai.com/v1/chat/completions', {
    authorization: `Bearer ${KEYS.openai}`,
  }, body);
  const choice = data.choices?.[0] ?? {};
  return { text: choice.message?.content ?? '', stop: choice.finish_reason, usage: data.usage };
}

async function callGemini(model, prompt, system) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2048 },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const data = await postJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`,
    { 'x-goog-api-key': KEYS.gemini },
    body,
  );
  const cand = data.candidates?.[0] ?? {};
  const parts = cand.content?.parts ?? [];
  // Gemini 3.x can include thought parts (part.thought === true) — exclude them
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  return { text, stop: cand.finishReason, usage: data.usageMetadata };
}

async function callCompatible(model, prompt, system, url, key) {
  const body = {
    model: model.id,
    messages: system
      ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }],
  };
  if (model.provider === 'kimi') body.max_completion_tokens = model.maxTokens ?? 600;
  else body.max_tokens = model.maxTokens ?? 600;
  if (model.thinking === false) body.thinking = { type: 'disabled' };
  const data = await postJSON(url, { authorization: `Bearer ${key}` }, body);
  const choice = data.choices?.[0] ?? {};
  return { text: choice.message?.content ?? '', stop: choice.finish_reason, usage: data.usage };
}

const callDeepSeek = (model, prompt, system) => callCompatible(
  model, prompt, system, 'https://api.deepseek.com/chat/completions', KEYS.deepseek,
);
const callKimi = (model, prompt, system) => callCompatible(
  model, prompt, system, 'https://api.moonshot.ai/v1/chat/completions', KEYS.kimi,
);
const callXai = (model, prompt, system) => callCompatible(
  model, prompt, system, 'https://api.x.ai/v1/chat/completions', KEYS.xai,
);

const CALLERS = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini, deepseek: callDeepSeek, kimi: callKimi, xai: callXai };

export function callModel(model, prompt, system) {
  return withRetries(() => CALLERS[model.provider](model, prompt, system), { label: model.id });
}

export { KEYS, postJSON, withRetries };
