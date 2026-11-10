# experiment-verdict Specification

## Purpose

Turns a recorded response log into a reproducible go/no-go deploy verdict (candidate vs incumbent), and compares a replication run against the original run's verdict.

## Requirements

### Requirement: Offline deterministic scoring
Scoring SHALL depend only on the run directory and dataset, with no network access or API key. Scoring the same run twice MUST produce byte-identical output, including bootstrap CIs, by using a fixed seed declared in the manifest.

#### Scenario: Re-score committed run
- **WHEN** a user without an API key scores a committed run directory
- **THEN** the output is byte-identical to the committed `verdict.md`

#### Scenario: Run recorded before per-arm APIs
- **WHEN** a run directory committed before arms could declare an API is scored with the current harness
- **THEN** the output is byte-identical to that run's committed `verdict.md`

#### Scenario: Run with a decisions arm
- **WHEN** a run with a decisions arm is scored
- **THEN** the verdict, metrics and guardrails are computed from its records exactly as for a chat arm

### Requirement: Item-level paired accuracy
Per arm, each item's score SHALL be the fraction of its `k` repeats whose label matches gold, counting parse failures as incorrect. The accuracy delta (candidate minus incumbent) SHALL be reported with a 95% paired bootstrap CI that resamples items.

#### Scenario: Paired delta reported
- **WHEN** a run with two arms is scored
- **THEN** the report shows each arm's accuracy, the delta, and the delta's 95% CI

### Requirement: Run-to-run stability
For each arm, the report SHALL show the fraction of items whose `k` repeats all produced the same label.

#### Scenario: Unstable arm
- **WHEN** an arm gives different labels across repeats for some items
- **THEN** its stability is below 100% and is shown in the report

### Requirement: Guardrails
The report SHALL evaluate the manifest's guardrails: for each declared critical class, candidate recall MUST NOT be lower than incumbent recall by more than the declared tolerance; and each arm's parse-failure rate MUST NOT exceed the declared maximum.

#### Scenario: Critical class regression
- **WHEN** candidate recall on `notice_of_delay_or_claim` is below incumbent recall by more than the tolerance
- **THEN** the guardrail is reported as failed

### Requirement: API error handling in scoring
Calls recorded as errors (not parse failures) SHALL be excluded from accuracy, counted per arm, and reported. If any arm's error rate exceeds the manifest's maximum, the verdict MUST be INCONCLUSIVE.

#### Scenario: Provider outage during run
- **WHEN** 10% of an arm's calls are errors and the maximum is 2%
- **THEN** the verdict is INCONCLUSIVE with the error rate given as the reason

### Requirement: Cost and latency comparison
Cost per item SHALL be computed from recorded token counts and the manifest's pinned price table. Latency SHALL be compared only as the candidate/incumbent ratio of median latency within the same run.

#### Scenario: Price change after run
- **WHEN** OpenRouter prices change after a run
- **THEN** re-scoring that run reports the same cost figures as before

### Requirement: Decision rule
The verdict SHALL be computed in this order, after the API error check: (1) any guardrail failed → NO-GO; (2) delta CI upper bound below margin → NO-GO; (3) CI lower bound below margin → INCONCLUSIVE; (4) CI lower bound above 0 → GO; (5) candidate cheaper by at least the cost threshold → GO; (6) candidate faster by at least the latency threshold → GO; (7) otherwise NO-GO. The report MUST state which rule decided it.

#### Scenario: Non-inferior and cheaper
- **WHEN** the delta CI lies within [margin, 0] or straddles 0 above margin, guardrails pass, and the candidate is 40% cheaper with a 20% threshold
- **THEN** the verdict is GO, decided by the cost rule

#### Scenario: Close to the margin
- **WHEN** the delta CI includes the margin
- **THEN** the verdict is INCONCLUSIVE, with a note that more items are needed

#### Scenario: Guardrail fails while accuracy is uncertain
- **WHEN** the delta CI includes the margin and critical-class recall regresses beyond tolerance
- **THEN** the verdict is NO-GO, decided by the guardrail rule

#### Scenario: Strictly better but breaks guardrail
- **WHEN** the delta CI is entirely above 0 but critical-class recall regresses beyond tolerance
- **THEN** the verdict is NO-GO, decided by the guardrail rule

#### Scenario: No reason to switch
- **WHEN** the candidate is non-inferior, passes guardrails, and is neither cheaper nor faster beyond thresholds
- **THEN** the verdict is NO-GO, decided by the no-benefit rule

### Requirement: Human-readable verdict file
Scoring SHALL write `verdict.md` to the run directory, leading with the verdict and deciding rule, followed by the metrics, guardrails, stability, error counts, the dataset hash, and model ids and served-by providers.

#### Scenario: Verdict first
- **WHEN** a reader opens `verdict.md`
- **THEN** the first line states GO, NO-GO, or INCONCLUSIVE

### Requirement: Replication comparison
The user SHALL be able to compare a new run with a reference run of the same manifest. The comparison report SHALL show both verdicts side by side, state whether the verdict replicated, and give per-arm label agreement between the runs.

#### Scenario: Verdict replicated
- **WHEN** the original run's verdict was GO and the new run's verdict is GO
- **THEN** the report states "verdict replicated" even if the numbers differ

#### Scenario: Different manifest
- **WHEN** the two runs used manifests with different dataset hashes or margins
- **THEN** the comparison refuses and explains that the runs are not comparable

#### Scenario: Existing run compared with a new rerun
- **WHEN** a run committed before arms could declare an API is compared with a new run of the same, unchanged manifest
- **THEN** the runs are comparable

#### Scenario: Different decisions question
- **WHEN** two runs differ only in a decisions arm's question file
- **THEN** the comparison refuses and explains that the runs are not comparable

### Requirement: Complete run required for scoring
Before computing a report, scoring SHALL verify that the run's records contain every expected (item, arm, repeat) exactly once, where the items are those of the hash-checked dataset, the arms are incumbent and candidate, and the repeats are the integers 0 to k−1. Otherwise scoring MUST fail with an error stating that the run cannot be scored, and MUST NOT write or overwrite `verdict.md`. A record with an API error counts as an observation.

#### Scenario: Missing observation
- **WHEN** a run's log lacks the record for one expected (item, arm, repeat)
- **THEN** scoring fails, names the missing observation, suggests resuming the run, and leaves `verdict.md` unchanged

#### Scenario: Subset of a run
- **WHEN** a log keeps only the six records of one item from a 290-item, k=3 run
- **THEN** scoring fails instead of returning a verdict

#### Scenario: Duplicate observation
- **WHEN** one record is replaced by a copy of another record's (item, arm, repeat), so the record count is unchanged
- **THEN** scoring fails and names the duplicate

#### Scenario: Unknown item, arm or repeat
- **WHEN** a record names an item not in the dataset, an arm other than incumbent or candidate, or a repeat that is not an integer from 0 to k−1
- **THEN** scoring fails and names the offending record

#### Scenario: Complete run with API errors
- **WHEN** a run has one record per expected observation and some of them are API errors
- **THEN** scoring proceeds and the existing error-rate rule decides whether the verdict is INCONCLUSIVE

#### Scenario: Complete committed run
- **WHEN** a committed, complete run is scored
- **THEN** the output is byte-identical to its committed `verdict.md`
