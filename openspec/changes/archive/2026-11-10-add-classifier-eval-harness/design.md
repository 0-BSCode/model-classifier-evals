# Design

## Context

Greenfield: the repository holds only OpenSpec scaffolding. See proposal.md for motivation and specs/ for the required behavior. The main constraint is that a stranger must be able to rerun the experiment with the least setup possible. That rules out Docker, databases and services, and calls for as few dependencies as possible.

## Goals / Non-Goals

**Goals:**
- The entire harness is small enough to read in one sitting, so that a replicator can audit it as well as run it.
- Every number in `verdict.md` can be derived from files in the repo plus a fixed seed.
- The demo experiment is a working template: copying `experiments/<x>.ts` and swapping the dataset or models is how users adopt it.

**Non-Goals:**
- A general eval framework (plugins, metric registries, multi-task configs).
- Optimizing for throughput. Runs are a few thousand calls.
- Matching exact numbers across reruns. Only the verdict has to replicate.

## Decisions

### D1. Minimal stack: Node + tsx + fetch, no SDKs
- Node LTS pinned in `.nvmrc` and `package.json#engines`. `tsx` runs TS directly, and `typescript` is used for `tsc --noEmit` in CI.
- OpenRouter is called with native `fetch` against its OpenAI-compatible `/chat/completions` endpoint.
- *Alternatives:* the `openai` SDK pointed at OpenRouter (an extra dependency, and OpenRouter-specific fields such as `provider` routing are untyped there anyway); the Vercel AI SDK (heavy, and hides the request body that we need to hash).
- Tests use `node:test` run through tsx, which needs no test framework dependency.

### D2. The manifest is a typed TS module, not YAML/JSON
`experiments/<name>.ts` default-exports a `Manifest` object. Type-checking catches structural errors, and a small runtime check (`assertManifest`) covers what types can't: a missing margin when loaded untyped, the dataset hash format, and the drafting model being reused as an arm.
*Alternative:* JSON plus zod. Rejected because TS gives comments and types for free, and zod would be a dependency used for one check.

Sketch:
```ts
export default {
  name: 'correspondence-haiku-vs-sonnet',
  dataset: { path: 'data/correspondence.jsonl', sha256: '…' },
  prompt: 'prompts/triage-v1.md',
  k: 3, seed: 42, temperature: 0,
  incumbent: { model: '<openrouter id>', providers: ['<upstream>'] },
  candidate: { model: '<openrouter id>', providers: ['<upstream>'] },
  prices: { '<model>': { inPerMTok: …, outPerMTok: … } },   // pinned at pre-registration
  decision: { margin: -0.02, costGain: 0.20, latencyGain: 0.20, maxErrorRate: 0.02 },
  guardrails: { criticalClasses: { notice_of_delay_or_claim: 0 }, maxParseFailureRate: 0.02 },
  referenceRun: 'runs/correspondence-haiku-vs-sonnet/2026-…',  // optional; enables auto-compare
} satisfies Manifest
```

### D3. OpenRouter request shape
Each call sends: `model`, `messages`, `temperature`, `response_format: { type: 'json_schema', json_schema: { strict: true, schema: {label: enum[classes]} } }`, `provider: { order: arm.providers, allow_fallbacks: false, require_parameters: true }`, and usage accounting enabled. From the response it records the top-level `provider`, `model`, and `usage` token counts. The request hash is the SHA-256 of the canonical JSON request body.
Verified against the docs on 2026-11-09 (task 2.1):
- `provider.order` / `allow_fallbacks` / `require_parameters` and the `response_format` json_schema shape (`name`, `strict`, `schema`) match: https://openrouter.ai/docs/features/provider-routing, https://openrouter.ai/docs/features/structured-outputs
- Usage is always returned and the `usage: {include: true}` flag is deprecated and has no effect, so we don't send it. `usage.cost` gives the actual charged USD, which we record as `cost_usd` (live $). The verdict still uses tokens × the pinned prices: https://openrouter.ai/docs/use-cases/usage-accounting
- The documented chat-completion schema has **no** top-level `provider` field (https://openrouter.ai/docs/api-reference/overview), and only `GET /api/v1/generation` has `provider_name`. Decision: record `served_by = response.provider ?? null` and skip the extra per-call lookup. Because `allow_fallbacks: false` restricts serving to the hosts in `order`, pinning one host per arm guarantees served-by, even when the field is absent.

### D4. Scheduling: seeded shuffle, small concurrency
All `(item, arm, repeat)` triples are built, shuffled with a seeded PRNG, and run through a small fixed concurrency pool (default 4). Shuffling interleaves the arms for free, so latency comparisons share network conditions. It also spreads any provider hiccup across both arms instead of concentrating it in one.
*Alternative:* strict round-robin by item. Rejected because it is less robust to time-correlated outages and no simpler.

### D5. Append-only JSONL log = cache = resume state
`runs/<experiment>/<timestamp>/responses.jsonl` is appended with one line per completed call and flushed per line. On resume the existing triples are read and skipped. No separate cache layer is needed. Each run directory also holds `manifest.json` (resolved), `env.json`, and `verdict.md`.

### D6. Statistics
- The per-item score per arm is the mean correctness over k repeats. Parse failures count as wrong and API errors are excluded (spec: experiment-verdict).
- The delta CI is a paired percentile bootstrap: resample item ids with replacement, B = 10,000 times, with a seeded `mulberry32` PRNG (about 5 lines and no dependency). Byte-identical re-scoring follows from the fixed seed plus a stable item order (sorted by id).
- Critical-class recall is computed on the items whose gold label is in that class, averaged over repeats. The guardrail compares point estimates against the tolerance. *Why not a CI:* with about 50 items the recall CI is roughly ±0.1, which would make the guardrail almost never fail. A point-estimate "no regression" rule is the conservative deploy choice.
- Latency is reported as the ratio of median latencies.
*Alternative:* McNemar's test. It needs a single binary outcome per item, which k > 1 breaks, and it yields a p-value rather than the CI on the delta that the margin rule needs.

### D7. Single CLI, no CLI library
`src/cli.ts` dispatches on `argv[2]`:
```
pnpm eval run      experiments/<x>.ts [--yes]   # verify → estimate → run → score → (compare to referenceRun)
pnpm eval score    runs/<exp>/<id>              # offline, no key
pnpm eval compare  runs/<exp>/<a> runs/<exp>/<b>
pnpm eval validate-data data/correspondence.jsonl
```

### D8. Module layout
```
src/
  cli.ts          arg dispatch
  manifest.ts     types + assertManifest
  dataset.ts      load, sha256, validate
  openrouter.ts   one function: classify(arm, item) → record
  run.ts          schedule, pool, append log, resume
  stats.ts        prng, bootstrap, recall, medians        (pure)
  verdict.ts      decision rule + verdict.md render       (pure)
  compare.ts      replication report                      (pure)
prompts/triage-v1.md
data/correspondence.jsonl, data/GUIDELINE.md, data/GENERATION.md
experiments/correspondence-demo.ts
runs/…            committed reference run
```
`stats.ts`, `verdict.ts` and `compare.ts` are pure, so the decision rule is unit-tested from hand-built fixtures without the network.

### D9. Dataset production
The items are written by Claude (`anthropic/claude-opus-5.5`) directly in the authoring session, with no paid API calls. A first draft made with a paid Gemini script was discarded on 2026-11-10, for two reasons: a project rule says data changes never use paid calls, and Gemini became an arm. A human then reviews every item against `GUIDELINE.md`, fixing or deleting items. `GENERATION.md` records the authoring model, date and review process.

### D10. Demo arms
Incumbent: `openai/gpt-6-luna` (host `openai`). Candidate: `google/gemma-4-26b-a4b-it` (host `primeintellect/bf16`), the *cheaper* model, so the demo asks "can we downgrade to save cost without missing delay notices?". All decision rules, including cost (rule 5), can fire. The first choice of candidate, `google/gemini-3.8-flash`, was dropped on 2026-11-10 after two pilots: it cost about 20× more than Luna per call (hidden reasoning tokens), so pilots were expensive and the cost rule could never fire. Gemma 4 26B is the current-generation Gemma; bf16 is pinned because the same model id is also served at fp8 and fp4. Neither arm's vendor matches the drafter's vendor (anthropic). Upstream providers and prices are pinned in task 6.1.

## Risks / Trade-offs

- [The OpenRouter API shape changes or a field name is wrong] → task 2.1 verifies against the docs first, and every OpenRouter detail is confined to `openrouter.ts`.
- [A pinned upstream provider gets delisted] → with fallbacks disabled, the run errors loudly instead of drifting. The replicator updates `providers` in a new manifest, and the comparison flags it as a different manifest.
- [The model id is retired] → this is inherent. The committed run still gives level-A reproducibility, and the README tells replicators to fork the manifest with a successor model, which makes it a new experiment.
- [Synthetic data is easier or more uniform than real correspondence] → it's a demo, and this is stated in README and GENERATION.md. Deliberate borderline items reduce the ceiling effect.
- [The baseline accuracy is too high (ceiling), so every candidate is GO] → after drafting, a pilot run is checked, and if both arms score above 95%, more hard items are added (task 5.4).
- [The point-estimate guardrail is noisy at n≈50] → this is a deliberate conservative bias toward NO-GO, documented in verdict.md.
- [The run costs money] → there is a pre-run estimate and confirmation, and the README states the approximate cost of the demo run.

## Open Questions

- Upstream provider for each arm: pick, in task 6.1, one that supports structured outputs.
- The final bootstrap B. 10,000 is the default, to be lowered only if scoring is noticeably slow.
