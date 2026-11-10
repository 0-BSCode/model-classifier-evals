# Luna chat vs Luna Decisions

Manifest: [`luna-chat-vs-decisions.ts`](luna-chat-vs-decisions.ts).

This experiment compares GPT-6 Luna through chat with the same model through the Decisions API, on the same dataset, margin and guardrails as the demo. Its question file uses the chat prompt's wording word for word (`src/prompts.test.ts` checks this): class definitions go in `criteria`, the precedence order and the acknowledgement rule in `instructions`.

From [`runs/luna-chat-vs-decisions/2026-11-10T05-52-44-968Z/verdict.md`](../runs/luna-chat-vs-decisions/2026-11-10T05-52-44-968Z/verdict.md), with k=3 and 290 items:

| | Luna chat (incumbent) | Luna Decisions (candidate) |
|---|---|---|
| accuracy | 98.7% | 96.9% |
| delay-notice recall | 99.1% | 98.6% |
| early-warning recall | 99.4% | 92.7% |
| stability (all 3 repeats agree) | 97.9% | 100% |
| cost per call | $0.000056 | $0.000039 |
| median latency | 2.7 s | 0.7 s |

**Verdict: NO-GO**, decided by the delay-notice guardrail. Both models miss the same notice (`c305`, a claim buried in a correction to meeting minutes): the Decisions model on all 3 repeats, Luna chat on 2 of 3. Accuracy alone would not have given a GO either: the difference is −1.8 points, 95% CI [−3.9, +0.1], which crosses the −2 point margin. The Decisions API is about 30% cheaper and 3.7× faster, but on this dataset it is not shown to be as accurate, mostly because of early warnings it gets wrong.

**Not replicated** on a different machine (Linux; the reference ran on macOS) in [`runs/luna-chat-vs-decisions/2026-11-10T06-45-27-524Z`](../runs/luna-chat-vs-decisions/2026-11-10T06-45-27-524Z/replication.md): INCONCLUSIVE (rule 3), delta −1.5 points, CI [−3.7, +0.6]. The Decisions model gave the same answers in both runs. Luna chat missed `c305` on all 3 repeats this time, so the guardrail tied and passed. This is the near-line case in the caveats below. Both runs say "not GO".

Replicate it like the demo (see the README), for about **$0.08**:

```sh
pnpm eval run experiments/luna-chat-vs-decisions.ts
```

Caveats specific to this experiment:
- **The verdict sits near two lines.** The guardrail fails by one repeat of one item, and Luna chat's answer on that item varies between runs. A rerun where Luna chat also misses `c305` 3 times passes the guardrail and, with a CI like this one, comes out INCONCLUSIVE (rule 3: the CI includes the margin) instead of NO-GO. Either way the answer is "not GO".
- **The endpoint is labelled alpha.** OpenRouter may change or remove it, so a live rerun can fail or behave differently. The committed responses always re-score offline, and every record keeps the dated model version that answered (`openai/gpt-6-luna-decisions-20261006`).
- **The question layout is part of the experiment.** Putting the same definitions in `instructions` instead of `criteria` changed the model's probabilities in an exploration probe, so the layout was chosen before any run and is pre-registered with its hash.
- **Probabilities are recorded, not used.** Each decision's probabilities for every label are kept in `raw` in `responses.jsonl`. The verdict uses only the top label.
