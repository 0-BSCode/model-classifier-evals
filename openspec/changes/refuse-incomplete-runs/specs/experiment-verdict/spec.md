# Spec Delta

## ADDED Requirements

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
