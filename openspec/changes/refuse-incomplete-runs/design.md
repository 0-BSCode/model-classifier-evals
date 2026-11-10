# Design

## Context

Every scoring path ends in `buildReport(records, gold, manifest)` in `src/verdict.ts`:

```
run      --> execute --> score(runDir) --+
score    -------------> score(runDir) --+--> buildReport --> renderVerdict --> verdict.md
compare  --> score(ref), score(run) ----+       ^
tests  ----------------------------------------+
```

`score()` in `src/cli.ts` checks the dataset hash, builds `gold` from that dataset, and writes `verdict.md` only after `buildReport` returns. Records are not checked against the dataset or `k` anywhere today.

## Goals / Non-Goals

**Goals:**
- One check, in the shared path, that protects every caller.
- Valid runs produce byte-identical reports.

**Non-Goals:**
- Checking record contents beyond identity (labels, token counts, served-by): existing rules already handle parse failures, errors and providers.
- Repairing or partially scoring incomplete runs.
- Any change to `execute`, the run format or resume logic.

## Decisions

**D1. Check inside `buildReport`, not in the CLI.** Direct callers (tests, and anyone scripting the harness) are protected too, and the CLI needs no change, because an exception thrown there happens before `verdict.md` is written. Alternative: a separate validator that the CLI calls. Rejected because a direct `buildReport` call would skip it, which is how the six-record reproduction was produced.

**D2. Expected items are the keys of `gold`.** `gold` is already built from the hash-checked dataset, so `buildReport`'s signature does not change. Expected arms come from `ARMS`, and repeats from `m.k`.

**D3. One pass with a set of `item|arm|repeat` keys.** Each record is validated (known item, known arm, `Number.isInteger(repeat)` with `0 ≤ repeat < k`) and checked against the set for duplicates. Then every expected key is checked for presence. Problems are collected, and the error lists the first few with a total count, so a run missing 1,700 records gives a readable message. Missing records add "resume the run with `pnpm eval run <experiment> --resume <runDir>`". `buildReport` doesn't know the run directory, so the message uses placeholders.

**D4. Error records count.** `status` is not considered by the check, so a recorded API error is an observation. Rule 0 keeps deciding runs with too many errors.

## Risks / Trade-offs

- [An older committed run turns out incomplete and can no longer be re-scored] → Every committed run was counted: each has exactly items × 2 × k unique records. The first pilot run (279 items) already fails earlier on the dataset hash, so it is unaffected.
- [Test fixtures that build partial runs start failing] → The fixtures in `verdict.test.ts` and `compare.test.ts` are complete k=1 runs. Any other fixture that breaks shows a real gap and gets completed rather than exempted.
- [Small cost per score] → One pass over at most a few thousand records. Negligible.
