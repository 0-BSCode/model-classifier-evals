# Demo: Luna vs Gemma

Manifest: [`correspondence-demo.ts`](correspondence-demo.ts). Can contract-correspondence triage be downgraded from `openai/gpt-6-luna` to the cheaper `google/gemma-4-26b-a4b-it` without missing more delay notices?

From [`runs/correspondence-luna-vs-gemma/2026-11-10T01-50-29-800Z/verdict.md`](../runs/correspondence-luna-vs-gemma/2026-11-10T01-50-29-800Z/verdict.md), with k=3 and 290 items:

| | gpt-6-luna (incumbent) | gemma-4-26b-a4b-it (candidate) |
|---|---|---|
| accuracy | 98.5% | 99.1% |
| delay-notice recall | 99.5% | 100% |
| cost per call | $0.000056 | $0.000019 |
| median latency | 2.2 s | 0.8 s |

**Verdict: GO**, decided by the cost rule. The accuracy difference is +0.6 points, 95% CI [−0.6, +1.8], which is well above the −2 point margin. Gemma doesn't miss more delay notices, and it is about a third of the price.

**Replicated** on a different machine (Linux; the reference ran on macOS) in [`runs/correspondence-luna-vs-gemma/2026-11-10T03-18-13-680Z`](../runs/correspondence-luna-vs-gemma/2026-11-10T03-18-13-680Z/replication.md): GO by the same rule, delta +0.8 points, CI [−0.2, +2.0]. The two runs gave the same majority label on 98.6% (Luna) and 100% (Gemma) of items.
