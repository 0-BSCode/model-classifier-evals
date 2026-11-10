import type { Manifest } from '../src/types.ts';

// Can contract-correspondence triage switch from GPT-6 Luna (chat) to the same model through
// OpenRouter's Decisions API without missing delay notices? Same model, different interface.
// Everything below is pre-registered: changing any of it makes a new experiment, not a replication.
// Dataset, labels, seed, decision rule and guardrails are the same as experiments/correspondence-demo.ts.
export default {
  name: 'luna-chat-vs-decisions',
  dataset: { path: 'data/correspondence.jsonl', sha256: '8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf', draftedBy: 'anthropic/claude-opus-5.5' },
  prompt: 'prompts/triage-v1.md',
  labels: ['general_correspondence', 'rfi', 'variation_request', 'early_warning', 'notice_of_delay_or_claim'],
  // k=3 for both arms: the Decisions model looked deterministic on one probe item; this measures it on all items.
  k: 3,
  seed: 42,
  // temperature omitted: Luna's chat hosts don't accept it, and the Decisions API has no sampling parameters.
  bootstrap: 10_000,
  concurrency: 4,
  incumbent: { model: 'openai/gpt-6-luna', providers: ['openai'] },
  // Class definitions go in the question's criteria, precedence and the acknowledgement rule in its instructions
  // (wording identical to the chat prompt; src/prompts.test.ts enforces it). Azure also serves it, BYOK only.
  candidate: { model: 'openai/gpt-6-luna-decisions', providers: ['openai'], api: 'decisions', question: 'prompts/triage-v1.decisions.json' },
  // USD per million tokens from OpenRouter's endpoint listing on 2026-11-10. Decisions bills input only.
  prices: {
    'openai/gpt-6-luna': { inPerMTok: 0.1, outPerMTok: 0.5 },
    'openai/gpt-6-luna-decisions': { inPerMTok: 0.1, outPerMTok: 0 },
  },
  decision: { margin: -0.02, costGain: 0.2, latencyGain: 0.2, maxErrorRate: 0.02 },
  // Missing a delay notice is the costly error: the candidate may not lose any notice recall.
  guardrails: { criticalClasses: { notice_of_delay_or_claim: 0 }, maxParseFailureRate: 0.02 },
  // The committed run every replication is compared against (not part of the pre-registered comparison key).
  referenceRun: 'runs/luna-chat-vs-decisions/2026-11-10T05-52-44-968Z',
} satisfies Manifest;
