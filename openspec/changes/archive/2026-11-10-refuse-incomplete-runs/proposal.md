# Proposal

## Why

Scoring trusts the response log as given. A run with missing, duplicated or foreign records still gets a verdict: keeping only the six records for one correctly classified delay notice from the Luna vs Gemma reference run returns GO by the cost rule, from one item. Before the repository is shared, scoring must refuse such runs instead of reporting a confident verdict.

Separately, the README promises more than the evidence supports. It says anyone can rerun an experiment "and reach the same conclusion", and that confidence intervals stop verdicts flipping near a threshold. The repository's own Luna chat vs Luna Decisions comparison went NO-GO on one machine and INCONCLUSIVE on another, through the guardrail, which compares point estimates.

## What Changes

- Scoring checks, before computing anything, that the run contains every expected observation exactly once: each dataset item × both arms × repeats `0 … k−1`. Missing, duplicate, unknown-item, unknown-arm and invalid-repeat records make scoring fail with an error saying the run cannot be scored. For missing observations, the error points to resuming the run. No `verdict.md` is written or overwritten when the check fails.
- A record with an API error still counts as an observation, so complete runs with errors keep reaching the existing error-rate rule.
- The check covers every scoring path: `score`, the scoring at the end of `run`, `compare` (both runs), and direct calls to the report builder.
- The README distinguishes exact offline re-scoring, which reproduces the saved report, from fresh live runs, which test whether the decision repeats but may give a different verdict. The "Reruns reach the same verdict because" section becomes "How the comparison controls variation", and its repeats/CI bullet no longer claims verdicts can't flip. The existing disclosure of the non-replication, and the synthetic-data and pilot-revision caveats, stay.
- Not breaking for valid runs: every committed run is complete, so all committed `verdict.md` files stay byte-identical. Experiment thresholds, the decision rule, the run format and dependencies are unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `experiment-verdict`: adds the requirement that scoring refuses a run whose response log is not exactly one record per expected (item, arm, repeat).

## Impact

- `src/verdict.ts`: a completeness check run at the start of report building.
- `src/verdict.test.ts`: regression tests for each rejection case, the error-run case, and the six-record reproduction.
- `src/cli.ts`: no structural change; it already writes `verdict.md` only after the report is built.
- `README.md`: reproducibility wording in the opening and in the verdict section.
- No model calls, no new experiments and no changes to committed runs.
