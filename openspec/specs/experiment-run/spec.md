# experiment-run Specification

## Purpose

Executes a pre-registered classifier comparison against models served through OpenRouter, and records every model response so the run can be re-scored offline and replicated by others.

## Requirements

### Requirement: Pre-registered experiment manifest
An experiment SHALL be defined by a single manifest file declaring: arms (incumbent and candidate, each with a model id, provider routing, and optionally the API it uses and a decisions question file), prompt, dataset path and SHA-256, repeats `k`, a price table per arm, accuracy margin, cost and latency improvement thresholds, and guardrails. A run MUST NOT start if the manifest is incomplete.

#### Scenario: Missing margin
- **WHEN** a manifest omits the accuracy margin
- **THEN** the run aborts before any API call with an error naming the missing field

#### Scenario: Complete manifest
- **WHEN** a manifest declares every required field
- **THEN** the run proceeds to dataset verification

#### Scenario: Question file pre-registered
- **WHEN** a run uses a decisions arm
- **THEN** the run directory's manifest records the SHA-256 of that arm's question file alongside the prompt's hash

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
Each request SHALL send the arm's declared upstream provider order with fallbacks disabled, whichever API the arm uses. Chat requests SHALL also require the provider to support the requested structured-output parameters.

#### Scenario: Pinned provider unavailable
- **WHEN** the pinned provider cannot serve a request
- **THEN** the request is recorded as an error for that item and is not silently served by another provider

#### Scenario: Decisions arm pinned
- **WHEN** a decisions arm pins one provider and the model is offered by several
- **THEN** every successful call records that provider as served-by

### Requirement: Structured label output
The classifier prompt SHALL request a JSON object whose label is constrained to the dataset's class set; a decisions arm's question SHALL offer exactly the dataset's class set as its choices. A response that cannot be parsed into a valid label MUST be recorded as a parse failure, never dropped or coerced.

#### Scenario: Invalid label returned
- **WHEN** a model returns a label outside the class set
- **THEN** the response is stored with status `parse_failure` and the raw text preserved

### Requirement: Repeats with interleaved arms
Each item SHALL be classified `k` times per arm, and calls SHALL be ordered so that arms are interleaved over time, never one arm entirely before the other.

#### Scenario: Two arms, k=3
- **WHEN** an experiment with two arms and k=3 runs on N items
- **THEN** exactly 6N calls are attempted, and both arms have calls throughout the run's time window

### Requirement: Committed response log
Every call SHALL append one record to the run's `responses.jsonl` with: item id, arm, repeat index, request hash, raw output, parsed label or failure status, served-by provider, model id returned, prompt and completion token counts, latency in ms, and timestamp. Decisions calls SHALL record their input and output token counts in these same fields. The run directory SHALL also contain a copy of the resolved manifest and environment info (tool version, Node version).

#### Scenario: Record completeness
- **WHEN** a run finishes
- **THEN** every attempted call has exactly one record containing all listed fields

#### Scenario: Decisions model snapshot recorded
- **WHEN** a decisions call succeeds
- **THEN** its record's model id is the dated model version the API reports, and its cost is the cost the API reports

### Requirement: Resumable runs
An interrupted run SHALL be resumable, skipping calls whose (item, arm, repeat) record already exists in the run's log.

#### Scenario: Resume after interruption
- **WHEN** a run is interrupted after M of 6N calls and resumed
- **THEN** only the remaining 6N - M calls are made

### Requirement: Per-arm API
Each arm SHALL classify through either the chat API or the Decisions API, as declared by the arm. An arm that declares no API MUST be treated as a chat arm, with requests identical to those made before per-arm APIs existed. A decisions arm MUST declare a question file containing the question instructions and one description per label.

#### Scenario: Arm without an API declared
- **WHEN** a manifest's arms declare no API
- **THEN** both arms call the chat API with exactly the requests the harness sent before this change

#### Scenario: Chat incumbent, decisions candidate
- **WHEN** the incumbent declares no API and the candidate declares the Decisions API
- **THEN** incumbent calls go to the chat API and candidate calls go to the Decisions API, interleaved in the same run

#### Scenario: Decisions arm without a question file
- **WHEN** a decisions arm declares no question file
- **THEN** the run aborts before any API call with an error naming the arm

### Requirement: Decisions question matches the label set
A decisions arm's question file SHALL describe exactly the manifest's labels, one description each. A run MUST NOT start if the question file names a label not in the manifest or omits one.

#### Scenario: Question file missing a label
- **WHEN** the question file has descriptions for four of the manifest's five labels
- **THEN** the run aborts before any API call with an error naming the missing label

### Requirement: Decision-model call
A decisions arm SHALL send each item as the content to judge, with one single-choice question built from the arm's question file, and SHALL take the most likely choice as the item's label. The answer's per-label probabilities MUST be preserved in the call record's raw output.

#### Scenario: Successful decision
- **WHEN** the Decisions API returns a choice in the label set with a probability for every label
- **THEN** the record has status `ok`, that choice as its label, and the full answer, including all probabilities, as its raw output

#### Scenario: Choice outside the label set
- **WHEN** the Decisions API returns a choice that is not one of the labels, or no choice
- **THEN** the record has status `parse_failure` and the raw response is preserved
