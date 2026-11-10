# Design

## Context

See proposal.md for motivation. The harness today has one way to classify an item: `classify()` in `src/openrouter.ts` posts to OpenRouter chat completions with a strict JSON schema and turns the reply into a `CallRecord`. Everything downstream (scoring, guardrails, decision rule, replication) works only on `CallRecord`s and knows nothing about the API that produced them.

An exploration probe (5 calls, about $0.00016, not committed) established how OpenRouter's Decisions endpoint behaves for `openai/gpt-6-luna-decisions`:

- `POST https://openrouter.ai/api/alpha/decisions` with `{ model, state: [text], questions: { <name>: { type: 'choice', instructions, criteria: { <label>: <description> } } }, provider }`.
- The response is `{ model: 'openai/gpt-6-luna-decisions-20261006', answers: { <name>: { choice, probabilities: {...}, confidence } }, usage: { input_tokens, output_tokens: 0, cost }, provider: 'OpenAI' }`.
- `criteria` values may be descriptions (not only `null`).
- `provider: { order: ['openai'], allow_fallbacks: false }` is enforced: pinning to Azure, which is BYOK-only, returned a 404 rather than falling back.
- Three identical requests returned identical probabilities.
- About 381 input tokens and $0.000038 per call, against $0.000056 per Luna chat call. Latency was 0.5–0.9 s.

Two constraints shape everything below. First, committed runs must re-score byte for byte, and their manifests must stay comparable to reruns. `comparableKey` serializes the `incumbent` and `candidate` arm objects verbatim, and resuming compares `manifest.json` as text, so a chat arm's resolved form must not change at all. Second, the probe showed that the layout of the question changes the model's probabilities. The layout is therefore part of the pre-registered prompt, chosen on principle and frozen before any run.

## Goals / Non-Goals

**Goals:**
- A chat arm, and everything about runs made before this change, stays identical: requests, request hashes, `manifest.json`, comparison key and `verdict.md`.
- A decisions arm produces ordinary `CallRecord`s, so no scoring or comparison code needs to know about it.

**Non-Goals:**
- No new metrics or report rows. The probabilities are kept in `raw` for later work (thresholds, abstention, calibration), not used now.
- No generic plugin mechanism for APIs. There are two APIs, so a two-way branch is enough.

## Decisions

### D1. `api` is optional on an arm, and its absence means chat

`Arm` gains `api?: 'chat' | 'decisions'` and `question?: string` (a path). Nothing writes a default `api: 'chat'` into a resolved manifest. Writing it would change the serialized arm objects of new chat runs, so a rerun of the existing demo would no longer match its committed reference in `comparableKey` or in the resume check.

*Alternative:* a separate `decisionsArms` section or a new manifest type. Rejected because it would duplicate every arm-related code path and validation for no benefit.

### D2. The question file's hash lives on the resolved arm

`prepare()` reads a decisions arm's question file, validates it, and resolves the arm to `{ ...arm, questionSha256 }`. That is the same pattern as `promptSha256` on the manifest. Because `comparableKey` already compares arm objects verbatim, a changed question file makes two runs incomparable with no change to `compare.ts`. Chat arms get no extra field, so their keys are untouched.

*Alternative:* a top-level `questionSha256` map. Rejected because it needs a `comparableKey` change and a "present only if" rule to keep old keys stable.

### D3. Question file format and placement

`prompts/triage-v1.decisions.json` contains `{ "instructions": string, "criteria": { label: description } }`. It is sent as a single question named `label`. Following the exploration decision ("placement A"), each label's definition goes into `criteria` and the task description, precedence order and "acknowledging someone else's notice is not a notice" rule go into `instructions`. This is how the API is designed to be used, so it answers the deploy question as a team would actually deploy it. The "answer with JSON only" line is dropped, because the output is constrained by the API.

A unit test checks that every definition and instruction sentence appears word for word in `prompts/triage-v1.md`, so the two prompts can't drift apart. Validation also requires the `criteria` keys to equal the manifest's `labels` exactly.

*Alternative (placement B):* all definitions in `instructions` with `null` criteria. It mirrors the chat prompt's layout more closely but isn't how anyone would deploy the API. The two placements were compared on one probe item only to discover that layout matters, not to choose between them.

### D4. A separate Decisions client that shares the retry loop

The fetch, retry (429 and 5xx, twice, with backoff), timeout and latency logic is extracted from `classify()` into one shared helper. The chat client keeps its exact request body and response mapping. A new `src/decisions.ts` builds the Decisions request and maps the response:

| `CallRecord` field | from the Decisions response |
|---|---|
| `label` / `status` | `answers.label.choice` if it is in `labels`, giving `ok`; otherwise `parse_failure` |
| `raw` | `JSON.stringify(answers.label)` (choice, all probabilities, confidence) |
| `served_by` | `provider` |
| `model` | `model` (the dated snapshot) |
| `prompt_tokens` / `completion_tokens` | `usage.input_tokens` / `usage.output_tokens` |
| `cost_usd` | `usage.cost` |

`execute()` picks the client per task from `m[arm].api`. The request sends `provider: { order, allow_fallbacks: false }` without `require_parameters`, which is the form the probe verified. There are no optional sampling parameters to require.

*Alternative:* a separate `probabilities` field on `CallRecord`. Rejected because `raw` already holds them, and a new field would be one more thing for older records to lack.

### D5. Prices, estimate and repeats

The demo manifest pins `openai/gpt-6-luna-decisions` at `{ inPerMTok: 0.10, outPerMTok: 0 }`. The estimator needs no change: after the pilot it uses the measured token counts, and before that its assumed 300 output tokens cost $0 at this price. Both arms use k=3. The Decisions model looked deterministic, but on one item only. k=3 costs about $0.03 more and turns that into a measured result: stability is reported per arm, and 100% would confirm determinism.

### D6. Pilot only for plumbing, then a frozen reference run

`experiments/luna-chat-vs-decisions.ts` is pre-registered with the same dataset, labels, margin, thresholds, guardrails and seed as the demo. A k=1 pilot (about $0.03) checks that served-by, model snapshot, cost and parse status come out right for all 290 items. Nothing in the manifest or question may be changed because of the pilot's accuracy numbers; only a plumbing failure justifies a change. Then the reference run (about $0.08) is committed and set as `referenceRun`.

### D7. Proving that nothing existing changed

Verification re-scores all four committed run directories with the new code and requires `git diff --exit-code` to pass. It also compares the existing reference run with the second-machine replication and requires `VERDICT REPLICATED`. The chat client's existing request-body tests must pass unchanged.

## Risks / Trade-offs

- **The endpoint is labelled "alpha" and may change or disappear** → Committed responses always re-score offline. The README states that a live rerun of this experiment may fail or differ for that reason. The request hash and model snapshot are recorded with every call.
- **The model snapshot may be updated behind the same slug** → The returned dated model id is recorded per call, so a replication shows whether it ran against a different snapshot.
- **The question layout influences the result** → The layout was chosen on principle and frozen before any run. The README says the verdict is about this question format, not about decision models in general.
- **The parse-failure guardrail can't fail for a decisions arm** → This is acceptable: the API constrains the output. Choices outside the label set are still caught by the mapping in D4.
- **Determinism was checked on one item only** → k=3 measures stability on all 290 items.
- **The cost rule will likely decide the verdict, because output is free** → This is a legitimate pre-registered criterion. The accuracy CI and the notice-recall guardrail are still checked first.

## Migration Plan

None needed: the change is additive. Existing experiments and committed runs need no edits. Rollback is a revert of the change's commits.
