# experiment-run Specification

## Purpose

Executes a pre-registered classifier comparison against models served through OpenRouter, and records every model response so the run can be re-scored offline and replicated by others.

## Requirements

### Requirement: Pre-registered experiment manifest
An experiment SHALL be defined by a single manifest file declaring: arms (incumbent and candidate, each with a model id and provider routing), prompt, dataset path and SHA-256, repeats `k`, a price table per arm, accuracy margin, cost and latency improvement thresholds, and guardrails. A run MUST NOT start if the manifest is incomplete.

#### Scenario: Missing margin
- **WHEN** a manifest omits the accuracy margin
- **THEN** the run aborts before any API call with an error naming the missing field

#### Scenario: Complete manifest
- **WHEN** a manifest declares every required field
- **THEN** the run proceeds to dataset verification

### Requirement: Dataset integrity check
Before running, the system SHALL compute the SHA-256 of the dataset file and abort if it differs from the hash declared in the manifest.

#### Scenario: Dataset edited after pre-registration
- **WHEN** the dataset file's hash does not match the manifest
- **THEN** the run aborts with both hashes printed and makes no API calls

### Requirement: One-command run
A replicator SHALL be able to run an experiment end to end (verify, estimate, execute, score, print verdict) with one documented command, given only a fresh clone, `pnpm install --frozen-lockfile`, and `OPENROUTER_API_KEY`.

#### Scenario: Fresh clone replication
- **WHEN** a user on a fresh clone sets the API key and runs the documented command for an experiment
- **THEN** a new run directory is created and a verdict is printed without any other setup

### Requirement: Pre-run cost estimate
Before making API calls, the system SHALL print the number of calls and an estimated cost from the manifest price table, and require confirmation unless a non-interactive flag is given.

#### Scenario: User declines
- **WHEN** the estimate is shown and the user declines
- **THEN** no API calls are made and the process exits without error

### Requirement: Pinned provider routing
Each request SHALL send the arm's declared upstream provider order with fallbacks disabled, and SHALL require the provider to support the requested structured-output parameters.

#### Scenario: Pinned provider unavailable
- **WHEN** the pinned provider cannot serve a request
- **THEN** the request is recorded as an error for that item and is not silently served by another provider

### Requirement: Structured label output
The classifier prompt SHALL request a JSON object whose label is constrained to the dataset's class set. A response that cannot be parsed into a valid label MUST be recorded as a parse failure, never dropped or coerced.

#### Scenario: Invalid label returned
- **WHEN** a model returns a label outside the class set
- **THEN** the response is stored with status `parse_failure` and the raw text preserved

### Requirement: Repeats with interleaved arms
Each item SHALL be classified `k` times per arm, and calls SHALL be ordered so that arms are interleaved over time, never one arm entirely before the other.

#### Scenario: Two arms, k=3
- **WHEN** an experiment with two arms and k=3 runs on N items
- **THEN** exactly 6N calls are attempted, and both arms have calls throughout the run's time window

### Requirement: Committed response log
Every call SHALL append one record to the run's `responses.jsonl` with: item id, arm, repeat index, request hash, raw output, parsed label or failure status, served-by provider, model id returned, prompt and completion token counts, latency in ms, and timestamp. The run directory SHALL also contain a copy of the resolved manifest and environment info (tool version, Node version).

#### Scenario: Record completeness
- **WHEN** a run finishes
- **THEN** every attempted call has exactly one record containing all listed fields

### Requirement: Resumable runs
An interrupted run SHALL be resumable, skipping calls whose (item, arm, repeat) record already exists in the run's log.

#### Scenario: Resume after interruption
- **WHEN** a run is interrupted after M of 6N calls and resumed
- **THEN** only the remaining 6N - M calls are made
