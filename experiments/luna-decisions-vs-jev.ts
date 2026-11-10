import type { Manifest } from '../src/types.ts';

// Can contract-correspondence triage switch from GPT-6 Luna Decisions to TypeSafe's cheaper Jev without
// missing delay notices? Both are decision models on OpenRouter's Decisions endpoint, given the same question file.
// Everything below is pre-registered: changing any of it makes a new experiment, not a replication.
// Dataset, labels, seed, decision rule and guardrails are the same as experiments/correspondence-demo.ts.
export default {
  name: 'luna-decisions-vs-jev',
  dataset: { path: 'data/correspondence.jsonl', sha256: '8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf', draftedBy: 'anthropic/claude-opus-5.5' },
  // unused by decisions arms, but part of every manifest
  prompt: 'prompts/triage-v1.md',
  labels: ['general_correspondence', 'rfi', 'variation_request', 'early_warning', 'notice_of_delay_or_claim'],
  // k=3: Jev's probabilities varied slightly across identical requests in the probe; Luna Decisions' did not.
  k: 3,
  seed: 42,
  bootstrap: 10_000,
  concurrency: 4,
  incumbent: { model: 'openai/gpt-6-luna-decisions', providers: ['openai'], api: 'decisions', question: 'prompts/triage-v1.decisions.json' },
  // Pinned to a numbered version, not ~typesafe/jev-latest, which moves when TypeSafe releases a new one. TypeSafe is its only host.
  candidate: { model: 'typesafe/jev-1.14', providers: ['typesafe'], api: 'decisions', question: 'prompts/triage-v1.decisions.json' },
  // USD per million tokens from OpenRouter's endpoint listing on 2026-11-10. Decisions bills input only
  // (Jev reports output tokens but they are not charged).
  prices: {
    'openai/gpt-6-luna-decisions': { inPerMTok: 0.1, outPerMTok: 0 },
    'typesafe/jev-1.14': { inPerMTok: 0.042, outPerMTok: 0 },
  },
  decision: { margin: -0.02, costGain: 0.2, latencyGain: 0.2, maxErrorRate: 0.02 },
  // Missing a delay notice is the costly error: the candidate may not lose any notice recall.
  guardrails: { criticalClasses: { notice_of_delay_or_claim: 0 }, maxParseFailureRate: 0.02 },
} satisfies Manifest;
