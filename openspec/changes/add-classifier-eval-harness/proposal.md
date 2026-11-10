# Proposal

## Why

Most LLM-classifier evaluations report a single number ("87.3% accuracy"). A rerun gets a slightly different number, and nobody can say whether the result replicated. We want a TypeScript harness that turns a model comparison into a **go/no-go deploy verdict** that someone else can rerun with one command and reach the same verdict, even though the exact numbers will differ. The demo task is triage of construction contract correspondence, styled on the domain of a project-controls firm (Blue Harbour). Missing a time-barred delay notice is the costly error in that task.

## What Changes

- New greenfield TypeScript project (pnpm, frozen lockfile, pinned Node version) with a single CLI entrypoint.
- **Experiment manifest**: a TS file that pre-registers the arms (OpenRouter model ids and pinned provider routing), the prompt, the dataset hash, the repeats `k`, the pinned price table, the non-inferiority margin, and the guardrails.
- **Runner**: calls OpenRouter with structured output, runs each item `k` times per arm with arms interleaved, prints a cost estimate before running, and writes a committed `responses.jsonl` that records the served-by provider, token usage and latency.
- **Scorer and verdict**: pure functions over `responses.jsonl` that compute paired accuracy delta CIs (bootstrap), per-class recall, parse-failure rate, cost per item (tokens × pinned prices) and the relative latency ratio. They output **GO / NO-GO / INCONCLUSIVE** through a fixed decision tree with priority accuracy, then cost, then latency.
- **Offline re-score**: anyone can rerun scoring on the committed responses without an API key and get identical numbers.
- **Replication report**: a fresh run is shown next to the original run's verdict and reports label agreement.
- **Demo dataset**: about 300 synthetic correspondence items committed as jsonl across 5 classes, with the critical `notice_of_delay_or_claim` class oversampled (at least 50 items). Includes a labeling guideline and a generation provenance record. The drafting model must not be one of the arms.

## Capabilities

### New Capabilities
- `experiment-run`: experiment manifest, OpenRouter execution with pinned routing, repeats, interleaving, pre-run cost estimate, and the committed response log.
- `experiment-verdict`: deterministic offline scoring, paired statistics, guardrails, the GO/NO-GO/INCONCLUSIVE decision rule, and the replication comparison against an original run.
- `correspondence-dataset`: the committed demo dataset, its integrity hash, labeling guideline, and generation provenance.

### Modified Capabilities
<!-- none: greenfield project -->

## Impact

- New repository contents: `src/`, `experiments/`, `data/`, `runs/`, `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `README.md`.
- External dependency: the OpenRouter API (requires `OPENROUTER_API_KEY` for live runs only; never needed for re-scoring).
- Spend: each live run costs real money, so the cost estimate and a confirmation are shown before any calls are made.
- Out of scope: multiple providers or direct provider SDKs, absolute-threshold-only claims (supported only as a degenerate comparison), a web UI, real or confidential client correspondence, and multi-label classification.
