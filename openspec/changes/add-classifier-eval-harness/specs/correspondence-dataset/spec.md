# Spec Delta

## Purpose

Provides a committed, auditable demo dataset of synthetic construction contract correspondence, labeled for single-label triage, so that every replicator classifies exactly the same items against the same gold labels.

## ADDED Requirements

### Requirement: Committed dataset file
The dataset SHALL be a JSONL file committed to the repository. Each line has a unique `id`, the message `text`, a gold `label`, and an optional `notes` field. Labels MUST be exactly one of: `general_correspondence`, `rfi`, `variation_request`, `early_warning`, `notice_of_delay_or_claim`.

#### Scenario: Validation passes
- **WHEN** the dataset validation command runs on the committed file
- **THEN** it confirms unique ids, non-empty text, and labels from the allowed set

#### Scenario: Unknown label
- **WHEN** a line has a label outside the allowed set
- **THEN** validation fails and names the line id

### Requirement: Size and class balance
The dataset SHALL contain between 250 and 400 items, with at least 50 items labeled `notice_of_delay_or_claim` and at least 30 items for every other class.

#### Scenario: Critical class undersampled
- **WHEN** the dataset has fewer than 50 `notice_of_delay_or_claim` items
- **THEN** validation fails, reporting the per-class counts

### Requirement: Labeling guideline
The repository SHALL include a labeling guideline that defines each class, gives at least one positive and one borderline example per class, and states the precedence rule for mixed messages: the most severe applicable class wins, ordered `notice_of_delay_or_claim` > `variation_request` > `early_warning` > `rfi` > `general_correspondence`.

#### Scenario: Mixed message
- **WHEN** a message both asks an RFI and formally notifies a delay claim
- **THEN** per the guideline its gold label is `notice_of_delay_or_claim`

### Requirement: Generation provenance
The repository SHALL record how the items were produced: the drafting model id, the drafting prompt(s), the date, and the human verification step. The drafting model MUST NOT be used as an arm in the shipped demo experiment.

#### Scenario: Drafting model reused as arm
- **WHEN** the demo manifest lists an arm whose model id equals the recorded drafting model
- **THEN** manifest validation fails with an explanation of the self-preference bias

### Requirement: Generic contract wording
Items SHALL use generic contract language and MUST NOT cite clause numbers or text from a specific standard form (e.g., NZS 3910, AS 4000, NEC), nor real organisations, people, or projects.

#### Scenario: Reviewer audit
- **WHEN** a reviewer reads any item
- **THEN** it refers only to fictional parties and projects and to no standard-form clause numbers
