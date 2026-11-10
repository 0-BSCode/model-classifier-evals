# Tasks

## 1. Manifest: per-arm API and question file

- [x] 1.1 Add optional `api?: 'chat' | 'decisions'` and `question?: string` to `Arm` in `src/types.ts`, and `questionSha256` on resolved decisions arms (design D1, D2); verify with `pnpm typecheck`
- [x] 1.2 Extend `assertManifest` so a decisions arm must declare `question`, and `api` must be `chat`, `decisions` or absent; verify with unit tests for a decisions arm without a question file and an unknown `api` value, and that the existing manifest tests pass unchanged
- [x] 1.3 In `prepare()`, read each decisions arm's question file, check that its `criteria` keys equal `labels` exactly, and resolve the arm with `questionSha256`; leave chat arms untouched; verify with unit tests for a missing label, an extra label, and that a chat-only manifest resolves to exactly the same JSON as before

## 2. Decisions client

- [x] 2.1 Extract the fetch/retry/timeout/latency loop from `classify()` in `src/openrouter.ts` into a shared helper without changing chat requests or records; verify the existing `src/openrouter.test.ts` passes unchanged
- [x] 2.2 Add `src/decisions.ts`: build the request (`state`, one `choice` question named `label`, `provider: { order, allow_fallbacks: false }`) and map the response to a `CallRecord` as in design D4; verify with unit tests using a stubbed `fetch` for an ok answer (label, raw holding all probabilities, served-by, snapshot model id, token counts, cost), a choice outside the labels (`parse_failure`), a retried 429 then success, and a 404 from an unavailable pinned provider (`error`)
- [x] 2.3 Dispatch per task in `execute()` on `m[arm].api`, passing a decisions arm its parsed question; verify with a run test whose stubbed `fetch` sees chat requests for the incumbent and Decisions requests for the candidate, interleaved, with 6N records for k=3

## 3. Comparability and backward compatibility

- [x] 3.1 Add compare tests: two runs differing only in a decisions arm's `questionSha256` are refused, and a manifest without `api` stays comparable with an identical one; verify `pnpm test` passes
- [x] 3.2 Re-score all four committed run directories with the new code and verify `git diff --exit-code runs/` reports no changes; then verify `pnpm eval compare runs/correspondence-luna-vs-gemma/2026-11-10T01-50-29-800Z runs/correspondence-luna-vs-gemma/2026-11-10T03-18-13-680Z` still prints `VERDICT REPLICATED`

## 4. The Luna chat vs Luna Decisions experiment

- [x] 4.1 Write `prompts/triage-v1.decisions.json` (placement A, design D3) and a unit test that every definition and instruction sentence appears word for word in `prompts/triage-v1.md`; verify the test passes and fails when one word is changed
- [x] 4.2 Write `experiments/luna-chat-vs-decisions.ts` (incumbent `openai/gpt-6-luna` chat pinned to `openai`; candidate `openai/gpt-6-luna-decisions` with `api: 'decisions'`, pinned to `openai`, question file above; demo's dataset, labels, k=3, seed, decision and guardrails; price `{ 0.10, 0 }` for the decisions model) and a k=1 pilot manifest; verify both load with `assertManifest` and `pnpm eval run` prints a cost estimate before asking to proceed (answer no)
- [ ] 4.3 Run the pilot (about $0.03, with the user's go-ahead) and check plumbing only: every candidate record has served-by `OpenAI`, a dated snapshot model id, a cost and status `ok` or `parse_failure`, and the error rate is under 2%; record the result in design.md and commit the pilot run. Nothing in the manifest or question changes because of accuracy numbers
- [ ] 4.4 Run the reference run (about $0.08, with the user's go-ahead), verify an offline `pnpm eval score` of it is byte-identical, set `referenceRun` in the manifest, and commit the run
- [ ] 4.5 Add a README section on decision-model arms (how to declare `api: 'decisions'` and a question file), the new reference result, and caveats (alpha endpoint, question layout is part of the experiment, probabilities kept in `raw` but unused); verify the existing demo instructions are unchanged and the documented commands run as written

## 5. Integration check

- [ ] 5.1 In a fresh clone, run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and offline `pnpm eval score` on every committed run; verify all pass and `git status` shows no changes

## Workflow follow-up

- A replication of the new experiment on another machine, as for the demo, verifies the new reference result end to end.
- Archive the change with `/opsx:archive` once the replication is done.
