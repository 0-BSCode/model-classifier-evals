# Tasks

## 1. Refuse incomplete runs

- [x] 1.1 Add the completeness check at the start of `buildReport` in `src/verdict.ts` (design D1–D4) and verify `pnpm typecheck` passes
- [x] 1.2 Add regression tests in `src/verdict.test.ts` and verify they pass: a missing observation fails with a resume hint; a duplicate with an unchanged record count fails; unknown item, unknown arm, a repeat ≥ k, a negative repeat and a non-integer repeat each fail; a complete run whose records include API errors reaches rule 0 (INCONCLUSIVE); the six-record subset of `runs/correspondence-luna-vs-gemma/2026-11-10T01-50-29-800Z` fails instead of returning GO
- [x] 1.3 Verify `pnpm eval score` on a copy of a committed run with one record removed exits with the error and leaves that copy's `verdict.md` unchanged
- [x] 1.4 Re-score every committed run (except the first pilot, which fails on the dataset hash as before) and verify `git status` shows no changed `verdict.md`; run `pnpm test` and verify everything passes

## 2. Describe reproducibility accurately

- [x] 2.1 Rewrite the README opening to separate offline re-scoring (reproduces the saved report exactly) from fresh live runs (test whether the decision repeats and may give a different verdict), and verify no sentence promises fresh runs reach the same verdict
- [x] 2.2 Rename "Reruns reach the same verdict because" to "How the comparison controls variation" and revise the repeats/CI bullet to say these measure and reduce variation but don't guarantee the verdict, and that the critical-class guardrail compares point estimates; verify the section agrees with the Luna chat vs Decisions NO-GO/INCONCLUSIVE result, and that the non-replication disclosure and the synthetic-data and pilot-revision caveats are still present

## Workflow follow-up

- Commit the code fix and the README fix separately.
- Archive the change once implemented.
