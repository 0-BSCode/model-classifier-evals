# Tasks

## 1. Project setup

- [x] 1.1 Create `package.json` (pnpm, `engines.node`, scripts `eval`, `test`, `typecheck`), `.nvmrc`, `tsconfig.json`, and dev deps `tsx` + `typescript` only; verify `pnpm install --frozen-lockfile` succeeds on a clean checkout and `pnpm typecheck` passes on an empty `src/cli.ts`
- [x] 1.2 Add `.gitignore` (node_modules, draft files; NOT `runs/`) and `git init`; verify `git status` shows `runs/` would be tracked

## 2. Statistics and verdict (pure, offline)

- [x] 2.1 Check OpenRouter's current docs for `provider.order` / `allow_fallbacks` / `require_parameters`, `response_format` json_schema, usage accounting and the response `provider` field; record any differences from design D3 in design.md, and verify by noting the doc URLs there
- [x] 2.2 Implement `src/stats.ts` (mulberry32, seeded paired bootstrap over sorted item ids, per-class recall over repeats, median, stability); verify with `node:test` unit tests, including identical CIs on two calls with the same seed and a known-answer delta on a hand-built fixture
- [x] 2.3 Implement `src/verdict.ts` decision rule (rules 1-7 in spec order, plus the error-rate INCONCLUSIVE) and the `verdict.md` renderer; verify with one unit test per spec scenario (non-inferior+cheaper → GO/cost, straddles margin → INCONCLUSIVE, strictly better+guardrail fail → NO-GO, no benefit → NO-GO, error rate too high → INCONCLUSIVE) and that the first line is the verdict
- [x] 2.4 Implement `src/compare.ts` replication report (side-by-side verdicts, "verdict replicated" flag, per-arm label agreement, refusal on dataset hash or decision/guardrail mismatch); verify with unit tests for the replicated, not-replicated and incomparable cases

## 3. Manifest and dataset handling

- [x] 3.1 Implement `src/manifest.ts` (`Manifest` type, `assertManifest` covering required fields, sha256 format, and drafting model not used as an arm); verify with unit tests for a missing margin and a reused drafting model
- [x] 3.2 Implement `src/dataset.ts` (load JSONL, sha256, validate ids/text/labels, class-count rules 250-400 / ≥50 critical / ≥30 others); verify with unit tests on small fixtures for an unknown label, a duplicate id, and an undersampled critical class
- [x] 3.3 Wire `pnpm eval validate-data <path>` in `src/cli.ts`; verify it exits non-zero on a fixture with a bad label and prints per-class counts on success

## 4. Runner

- [x] 4.1 Implement `src/openrouter.ts` `classify(arm, item, prompt)` per design D3 (fetch, json_schema label enum, pinned provider, request hash, parse failure vs error status, latency); verify with a unit test that mocks `fetch` and covers a valid label, an out-of-set label (→ `parse_failure` with raw text kept), and an HTTP error (→ error status)
- [x] 4.2 Implement `src/run.ts`: dataset hash check, call-count and cost estimate with a confirmation prompt (`--yes` skips it), seeded shuffle of (item, arm, repeat), concurrency pool, append-and-flush to `responses.jsonl`, `manifest.json` and `env.json`, and resume by skipping existing triples; verify with mocked-fetch tests for hash mismatch → no calls, 2 arms × k=3 → 6N records with both arms interleaved, and resume after M records → 6N−M new calls
- [x] 4.3 Wire `pnpm eval run` (run → score → compare to `referenceRun` if set) and `pnpm eval score`; verify that scoring a run directory twice yields byte-identical `verdict.md` (`diff` is empty) without `OPENROUTER_API_KEY` set
- [x] 4.4 Write `prompts/triage-v1.md` (class definitions consistent with the guideline, precedence rule, JSON-only answer); verify it lists exactly the five dataset labels

## 5. Demo dataset

- [x] 5.1 Write `data/GUIDELINE.md` (five class definitions, a positive and a borderline example per class, the "most severe wins" precedence, generic wording with no standard-form clause numbers); verify every spec requirement for the guideline is covered by checking each against the spec
- [x] 5.2 Author the items directly (Claude, no paid calls; see D9) into `data/correspondence.jsonl`, with varied senders, tone and length, deliberate borderline cases, and oversampled notices; verify the file passes `validate-data`
- [x] 5.3 Human-review every item against GUIDELINE.md (fix or delete, check no real names or clause numbers), commit `data/correspondence.jsonl`, and write `data/GENERATION.md` (authoring model, date, review process); verify `validate-data` passes and that ≥50 items are notices
- [x] 5.4 Pilot-check difficulty: run both demo arms with k=1 on the dataset; if the dataset is at a ceiling (both above 95% and the critical-class guardrail cannot fail), add harder borderline items (written directly, no paid calls) and repeat; verify that the final pilot can fail the critical-class guardrail or shows a non-ceiling verdict, and record the pilot numbers in GENERATION.md

## 6. Demo experiment and docs

- [x] 6.1 Pin upstream providers for the D10 arms (`openai/gpt-6-luna` vs `google/gemma-4-26b-a4b-it`), pin prices from OpenRouter's listing, and write `experiments/correspondence-demo.ts` with the dataset sha256; verify `assertManifest` passes and the drafting model is not an arm
- [x] 6.2 Run the demo with k=3, commit the run directory, and set it as `referenceRun`; verify `runs/…/verdict.md` exists and re-scoring it offline is byte-identical
- [ ] 6.3 Write `README.md`: what a verdict means, the 3-command replication path (clone → `pnpm install --frozen-lockfile` → `pnpm eval run experiments/correspondence-demo.ts`), the offline `pnpm eval score` path, the approximate cost and time of the demo run, what to do if a model is retired (fork the manifest as a new experiment), and the synthetic-data caveat; verify by following the README verbatim in a fresh clone

## 7. Integration check

- [ ] 7.1 In a fresh clone (on a different machine or network if possible), run the README replication command end to end; verify the comparison prints "verdict replicated". If it doesn't, the task stays open until the cause is found and either fixed or documented in README as a known limitation
