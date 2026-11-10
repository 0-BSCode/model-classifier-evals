# Reproducible LLM classifier evals

A small TypeScript harness that turns "should we switch our classifier from model A to model B?" into a **GO / NO-GO / INCONCLUSIVE** verdict that anyone can rerun and reach the same conclusion. The goal is to replicate the verdict; the exact numbers will vary from run to run.

The first experiment, Luna vs Gemma, asks whether construction **contract-correspondence triage** can be downgraded from `openai/gpt-6-luna` to the cheaper `google/gemma-4-26b-a4b-it` without missing more delay notices. Each message is classified as `general_correspondence`, `rfi`, `variation_request`, `early_warning` or `notice_of_delay_or_claim`. Missing a delay notice is the costly error, because contracts time-bar late claims.

## Results

Each experiment has a notes file with its numbers, verdict and caveats.

| experiment | verdict | replicated | notes |
|---|---|---|---|
| Luna vs Gemma | GO (cost) | yes | [correspondence-luna-vs-gemma.md](experiments/correspondence-luna-vs-gemma.md) |
| Luna chat vs Luna Decisions | NO-GO (delay-notice guardrail) | no: INCONCLUSIVE on the second machine | [luna-chat-vs-decisions.md](experiments/luna-chat-vs-decisions.md) |
| Luna Decisions vs Jev | NO-GO (delay-notice guardrail) | yes | [luna-decisions-vs-jev.md](experiments/luna-decisions-vs-jev.md) |

## Replicate Luna vs Gemma in 3 commands

```sh
git clone https://github.com/0-BSCode/llm-classifier-evals.git && cd llm-classifier-evals
pnpm install --frozen-lockfile                       # Node 26 (.nvmrc), pnpm 12
cp .env.example .env                                 # then put your OpenRouter key in .env
pnpm eval run experiments/correspondence-luna-vs-gemma.ts
```

`run` verifies the dataset hash, prints a cost estimate and asks for confirmation, then classifies every item 3 times per model. It scores the run, writes `runs/<experiment>/<timestamp>/verdict.md`, and compares your verdict with the committed reference run:

```
# VERDICT REPLICATED
| run | verdict | accuracy delta [95% CI] | deciding rule |
```

This experiment costs about **$0.06** and takes about **15 minutes** (1,740 calls, measured on the reference run). The estimate printed before the run is based on the reference run's token usage. An interrupted run can be continued with `--resume runs/<experiment>/<timestamp>`.

## Check the numbers without an API key

Every model response from the reference run is committed. Re-scoring is offline and deterministic (seeded bootstrap), so this reproduces the committed `verdict.md` byte for byte:

```sh
pnpm eval score runs/correspondence-luna-vs-gemma/2026-11-10T01-50-29-800Z
pnpm eval compare <runDirA> <runDirB>       # replication report for any two runs
pnpm eval validate-data data/correspondence.jsonl
pnpm test
```

## How a verdict is decided

Everything in `experiments/correspondence-luna-vs-gemma.ts` is **pre-registered** before the run: models, pinned hosts, prompt, dataset hash, repeats, prices, margin and guardrails. Changing any of it makes a new experiment, and `compare` refuses to call that a replication.

```
accuracy delta = candidate - incumbent, paired bootstrap 95% CI over items

0  API errors above max rate                      -> INCONCLUSIVE
1  a guardrail fails                              -> NO-GO
      - candidate recall on delay notices < incumbent's
      - either model's unparseable answers > 2%
2  CI entirely below margin (-2 pts)              -> NO-GO
3  CI includes the margin                         -> INCONCLUSIVE (need more items)
4  CI entirely above 0 (strictly better)          -> GO
5  non-inferior and >= 20% cheaper                -> GO
6  non-inferior and >= 20% faster (same run)      -> GO
7  otherwise: no reason to switch                 -> NO-GO
```

Reruns reach the same verdict because:
- **Repeats and CIs.** Each item is classified k=3 times, and the verdict uses a confidence interval rather than a point estimate. A result near the line comes out INCONCLUSIVE instead of flipping between GO and NO-GO.
- **Pinned hosts.** Each model is pinned to one OpenRouter host, standard tier, with fallbacks off. A rerun can't silently be served by a different host or quantization.
- **Pinned prices.** Cost is computed as tokens × prices fixed in the manifest, so later price changes don't move it. Latency is compared only within a run, with the two models' calls interleaved so they share network conditions.
- **Hashed dataset.** The dataset is committed and hash-checked, and the prompt's hash is recorded with each run.

## Compare two other models

An experiment is one manifest file. You do not have to change code.

1. Copy an existing manifest:
   ```sh
   cp experiments/correspondence-luna-vs-gemma.ts experiments/my-comparison.ts
   ```
2. In the copy, change these fields:
   - `name`: a new name. The run goes to `runs/<name>/`.
   - `incumbent` and `candidate`: the model IDs. Pin exactly one provider for each. If many hosts serve the model, also pin the precision (for example, `host/bf16`).
   - `prices`: input and output price per million tokens for each model. Get them from OpenRouter's endpoint listing and write the date in a comment.
   - Remove `referenceRun`. A new experiment has no run to replicate yet.
3. Run it:
   ```sh
   pnpm eval run experiments/my-comparison.ts
   ```
4. Optional: commit the run directory and set `referenceRun` to it. Then reruns compare against your run.
5. Write the results and caveats in `experiments/my-comparison.md`. Add a row to the Results table above.

The manifest check stops the run if:
- a model has no price in `prices`.
- an arm does not pin exactly one provider.
- a model is from the same vendor as `dataset.draftedBy`. The correspondence dataset was drafted by Claude, so you cannot use it to compare Claude models.

Do not set `temperature` if a model's host does not accept it.

To change the task, add a dataset in `data/`, check it with `pnpm eval validate-data <file>`, and put its sha256 in `dataset.sha256`. Then change `prompt`, `labels` and `guardrails.criticalClasses` to match.

To do a cheap test run first, use `k: 1`. See `experiments/correspondence-pilot.ts`.

For a model with no past runs, the cost estimate assumes 300 output tokens per call. The real cost can be different.

## Compare an LLM with a decision model

Decision models answer a classification question directly: instead of generating text, they return a label with a probability for every option. OpenRouter serves them through its Decisions endpoint (`/api/alpha/decisions`), with the same API key, billed on input tokens only.

To use one as an arm, add `api: 'decisions'` and a question file:

```ts
candidate: { model: 'openai/gpt-6-luna-decisions', providers: ['openai'], api: 'decisions', question: 'prompts/triage-v1.decisions.json' },
```

The question file has `instructions` and one description per label in `criteria`; its labels must match `labels` exactly. An arm without `api` is a chat arm, as in every other experiment. Price the decision model with `outPerMTok: 0`.

See [luna-chat-vs-decisions.md](experiments/luna-chat-vs-decisions.md) and [luna-decisions-vs-jev.md](experiments/luna-decisions-vs-jev.md) for the experiments that use decision models.

## Layout

```
experiments/   pre-registered experiment manifests (.ts) and their result notes (.md)
data/          dataset (jsonl), labeling GUIDELINE.md, GENERATION.md provenance
prompts/       classifier prompt, and question files for decision models
runs/          committed run directories: responses.jsonl, manifest.json, env.json, verdict.md
src/           harness (stats, verdict and compare are pure and unit-tested)
openspec/      the spec-driven change that defined this project
```

## Caveats

- **Synthetic data.** The 290 messages were written by Claude and reviewed by a human (see `data/GENERATION.md`). After pilot runs showed the first version was too easy, 49 clear-cut items were replaced by 60 harder ones, so accuracy here measures the hard part of the task, not accuracy on typical traffic. They are shorter and more uniform than real correspondence, so read the verdict as a demonstration of the method, not a statement about real traffic. The author model is deliberately from a different vendor than both compared models, to avoid self-preference bias.
- **Models get retired.** If a pinned model or host disappears, the committed run can still be re-scored offline. Rerunning means copying the manifest with a successor model, which makes it a new experiment by design.
- **Default sampling.** Luna's hosts don't accept `temperature`, so for a like-for-like comparison neither model is sent one; both use their default sampling. The k=3 repeats measure that run-to-run variation, reported as "stability" in `verdict.md`.
