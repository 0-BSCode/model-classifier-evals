# Spec Delta

## MODIFIED Requirements

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
