import type { Manifest } from '../src/types.ts';

// Can we downgrade contract-correspondence triage from GPT-6 Luna to the cheaper Gemma 4 26B without missing delay notices?
// Everything below is pre-registered: changing any of it makes a new experiment, not a replication.
export default {
  name: 'correspondence-luna-vs-gemma',
  dataset: { path: 'data/correspondence.jsonl', sha256: '8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf', draftedBy: 'anthropic/claude-opus-5.5' },
  prompt: 'prompts/triage-v1.md',
  labels: ['general_correspondence', 'rfi', 'variation_request', 'early_warning', 'notice_of_delay_or_claim'],
  k: 3,
  seed: 42,
  // temperature omitted: Luna's hosts don't accept it, so both use the model's default sampling.
  bootstrap: 10_000,
  concurrency: 4,
  // Standard tier only: a base/regional slug never matches flex, fast or priority endpoints.
  incumbent: { model: 'openai/gpt-6-luna', providers: ['openai'] },
  // bf16 pinned on purpose: the same model id is also served in fp8 and fp4 by other hosts.
  candidate: { model: 'google/gemma-4-26b-a4b-it', providers: ['primeintellect/bf16'] },
  // USD per million tokens from OpenRouter's endpoint listing on 2026-11-10.
  prices: {
    'openai/gpt-6-luna': { inPerMTok: 0.1, outPerMTok: 0.5 },
    'google/gemma-4-26b-a4b-it': { inPerMTok: 0.042, outPerMTok: 0.125 },
  },
  decision: { margin: -0.02, costGain: 0.2, latencyGain: 0.2, maxErrorRate: 0.02 },
  // Missing a delay notice is the costly error: the candidate may not lose any notice recall.
  guardrails: { criticalClasses: { notice_of_delay_or_claim: 0 }, maxParseFailureRate: 0.02 },
} satisfies Manifest;
