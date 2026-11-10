import { sha256 } from './dataset.ts';
import type { Arm, ArmName, CallRecord, Item } from './types.ts';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

/** What every API call needs, whichever API the arm uses. */
export type CallOpts = {
  arm: ArmName;
  spec: Arm;
  item: Item;
  repeat: number;
  labels: string[];
  apiKey: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
};

export type ClassifyOpts = CallOpts & {
  prompt: string; // template with {{text}}
  temperature?: number;
};

/** The parts of a successful response that go into a record; null means a malformed response. */
export type Reading = {
  raw: string;
  label: unknown;
  served_by: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
};

/**
 * POST `body` with retries (429/5xx, twice, with backoff) and turn the response into a record via `read`.
 * Never throws: failures become `error` / `parse_failure` records.
 */
export async function call(o: CallOpts, url: string, body: object, read: (json: any) => Reading | null): Promise<CallRecord> {
  const text = JSON.stringify(body);
  const base = {
    item_id: o.item.id,
    arm: o.arm,
    repeat: o.repeat,
    request_hash: sha256(text),
    served_by: null,
    model: null,
    prompt_tokens: null,
    completion_tokens: null,
    cost_usd: null,
  };
  const f = o.fetch ?? fetch;
  let lastError = '';
  let latency = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, (o.retryDelayMs ?? 2000) * 2 ** (attempt - 1)));
    const t0 = performance.now();
    try {
      const res = await f(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' },
        body: text,
        signal: AbortSignal.timeout(120_000),
      });
      const resText = await res.text();
      latency = Math.round(performance.now() - t0); // latency of the final attempt only
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${resText.slice(0, 500)}`;
        if (RETRY_STATUS.has(res.status)) continue;
        break;
      }
      const json = JSON.parse(resText);
      const r = json.error ? null : read(json);
      if (!r) {
        lastError = `bad response: ${resText.slice(0, 500)}`;
        break;
      }
      const meta = { ...base, ...r, error: null, latency_ms: latency, ts: new Date().toISOString() };
      return typeof r.label === 'string' && o.labels.includes(r.label)
        ? { ...meta, status: 'ok', label: r.label }
        : { ...meta, status: 'parse_failure', label: null };
    } catch (e) {
      latency = Math.round(performance.now() - t0);
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ...base, status: 'error', label: null, raw: null, error: lastError, latency_ms: latency, ts: new Date().toISOString() };
}

export function requestBody(o: Pick<ClassifyOpts, 'spec' | 'item' | 'prompt' | 'labels' | 'temperature'>) {
  return {
    model: o.spec.model,
    messages: [{ role: 'user', content: o.prompt.replaceAll('{{text}}', o.item.text) }],
    ...(o.temperature === undefined ? {} : { temperature: o.temperature }),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'triage',
        strict: true,
        schema: {
          type: 'object',
          properties: { label: { type: 'string', enum: o.labels } },
          required: ['label'],
          additionalProperties: false,
        },
      },
    },
    // fallbacks off: a different host (e.g. other quantization) must never silently answer
    provider: { order: o.spec.providers, allow_fallbacks: false, require_parameters: true },
  };
}

/** One chat classification call. Never throws. */
export function classify(o: ClassifyOpts): Promise<CallRecord> {
  return call(o, URL, requestBody(o), (json) => {
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    let label: unknown;
    try {
      label = JSON.parse(content)?.label;
    } catch {}
    return {
      raw: content,
      label,
      served_by: json.provider ?? null, // undocumented field; recorded when present (design D3)
      model: json.model ?? null,
      prompt_tokens: json.usage?.prompt_tokens ?? null,
      completion_tokens: json.usage?.completion_tokens ?? null,
      cost_usd: json.usage?.cost ?? null,
    };
  });
}
