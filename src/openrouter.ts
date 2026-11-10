import { sha256 } from './dataset.ts';
import type { Arm, ArmName, CallRecord, Item } from './types.ts';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export type ClassifyOpts = {
  arm: ArmName;
  spec: Arm;
  item: Item;
  repeat: number;
  prompt: string; // template with {{text}}
  labels: string[];
  temperature: number;
  apiKey: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
};

export function requestBody(o: Pick<ClassifyOpts, 'spec' | 'item' | 'prompt' | 'labels' | 'temperature'>) {
  return {
    model: o.spec.model,
    messages: [{ role: 'user', content: o.prompt.replaceAll('{{text}}', o.item.text) }],
    temperature: o.temperature,
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

/** One classification call. Never throws: failures become `error` / `parse_failure` records. */
export async function classify(o: ClassifyOpts): Promise<CallRecord> {
  const body = JSON.stringify(requestBody(o));
  const base = {
    item_id: o.item.id,
    arm: o.arm,
    repeat: o.repeat,
    request_hash: sha256(body),
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
      const res = await f(URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      latency = Math.round(performance.now() - t0); // latency of the final attempt only
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${text.slice(0, 500)}`;
        if (RETRY_STATUS.has(res.status)) continue;
        break;
      }
      const json = JSON.parse(text);
      const content = json.choices?.[0]?.message?.content;
      if (json.error || typeof content !== 'string') {
        lastError = `bad response: ${text.slice(0, 500)}`;
        break;
      }
      const meta = {
        ...base,
        served_by: json.provider ?? null, // undocumented field; recorded when present (design D3)
        model: json.model ?? null,
        prompt_tokens: json.usage?.prompt_tokens ?? null,
        completion_tokens: json.usage?.completion_tokens ?? null,
        cost_usd: json.usage?.cost ?? null,
        raw: content,
        error: null,
        latency_ms: latency,
        ts: new Date().toISOString(),
      };
      let label: unknown;
      try {
        label = JSON.parse(content)?.label;
      } catch {}
      return typeof label === 'string' && o.labels.includes(label)
        ? { ...meta, status: 'ok', label }
        : { ...meta, status: 'parse_failure', label: null };
    } catch (e) {
      latency = Math.round(performance.now() - t0);
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ...base, status: 'error', label: null, raw: null, error: lastError, latency_ms: latency, ts: new Date().toISOString() };
}
