# Proposal

## Why

Specialized decision models now answer classification questions directly, returning a label with a probability for each option instead of generated text. OpenRouter serves about 35 of them, including GPT-6 Luna Decisions and Jev, through one endpoint (`/api/alpha/decisions`), billed on input tokens only. For a triage deployment, the obvious question is whether switching from a chat LLM to a decision model is a GO. Today the harness can only compare chat models, so that question can't be answered with the same reproducible method.

## What Changes

- An arm in an experiment manifest can declare `api: 'decisions'`, which calls OpenRouter's Decisions endpoint instead of chat completions. An arm without `api` is a chat arm, exactly as today.
- A decisions arm declares a committed question file with the `instructions` and per-label `criteria` descriptions. Its hash is pre-registered like the chat prompt's.
- The Decisions response maps onto the existing call record: the top choice becomes the label, the raw answer (including every class's probability) is kept in `raw`, and token counts, cost, served-by provider and model snapshot are recorded as for chat calls. Scoring, guardrails, the decision rule and replication comparison work unchanged on these records.
- A new pre-registered experiment, `experiments/luna-chat-vs-decisions.ts`, compares Luna through chat (incumbent) with Luna through the Decisions API (candidate) on the existing dataset, margin and guardrails. It gets a pilot, a reference run and a README section, including a caveat that the endpoint is labelled alpha.
- **Not breaking:** existing manifests, committed runs, the demo experiment and the README's 3-command replication behave exactly as before. Every committed run must still re-score byte for byte and stay comparable to its replications.

Out of scope: using the probabilities in the verdict (thresholds, abstention), comparing Jev or other decision models (possible later with only a new manifest), and calling providers directly instead of through OpenRouter.

## Capabilities

### New Capabilities
- None. Decision-model calls are a second way for an experiment run to classify an item, so they belong to `experiment-run`.

### Modified Capabilities
- `experiment-run`: the manifest may declare a per-arm API and a decisions question file; adds the decision-model call requirement (request shape, pinned host, response mapping); structured-output and pinned-routing requirements cover both APIs.
- `experiment-verdict`: runs recorded before this change must keep re-scoring byte for byte and stay comparable with their replications (an arm without `api` is a chat arm).

## Impact

- **Code:** `src/types.ts` (optional `api` and `question` on an arm), `src/manifest.ts` (validation of decisions arms), a new Decisions client next to `src/openrouter.ts`, `src/run.ts` (dispatch per arm, question-file hashing), `src/compare.ts` (question hashes in the comparison key, without changing keys of existing runs), with tests.
- **New files:** `prompts/triage-v1.decisions.json`, `experiments/luna-chat-vs-decisions.ts`, its pilot manifest, committed pilot and reference run directories.
- **Docs:** a README section on decision-model arms and the new reference result.
- **Dependencies:** none. Same `OPENROUTER_API_KEY`, native `fetch`, no SDK.
- **Cost:** pilot about $0.03, reference run about $0.08 (per-call costs measured in the exploration probe).
