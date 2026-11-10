// Test helpers only.
import type { CallRecord, ResolvedManifest } from './types.ts';

export function rec(p: Partial<CallRecord> & Pick<CallRecord, 'item_id' | 'arm'>): CallRecord {
  return {
    repeat: 0,
    request_hash: 'h',
    status: 'ok',
    label: null,
    raw: null,
    error: null,
    served_by: 'p',
    model: 'm',
    prompt_tokens: 100,
    completion_tokens: 10,
    cost_usd: null,
    latency_ms: 100,
    ts: '2026-01-01T00:00:00Z',
    ...p,
  };
}


export const manifestFixture = (): ResolvedManifest => ({
  name: 't',
  dataset: { path: 'x', sha256: 'a'.repeat(64), draftedBy: 'v/x' },
  prompt: 'p',
  promptSha256: 'b'.repeat(64),
  labels: ['x', 'n'],
  k: 1,
  seed: 1,
  temperature: 0,
  bootstrap: 500,
  incumbent: { model: 'a/big', providers: ['p'] },
  candidate: { model: 'a/small', providers: ['p'] },
  prices: { 'a/big': { inPerMTok: 3, outPerMTok: 15 }, 'a/small': { inPerMTok: 1, outPerMTok: 5 } },
  decision: { margin: -0.02, costGain: 0.2, latencyGain: 0.2, maxErrorRate: 0.02 },
  guardrails: { criticalClasses: { n: 0 }, maxParseFailureRate: 0.02 },
});
