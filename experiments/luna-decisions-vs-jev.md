# Luna Decisions vs Jev

Manifest: [`luna-decisions-vs-jev.ts`](luna-decisions-vs-jev.ts).

This experiment asks whether the Luna Decisions setup in [luna-chat-vs-decisions.md](luna-chat-vs-decisions.md) can switch to TypeSafe's cheaper Jev (`typesafe/jev-1.14`, pinned to its only host, TypeSafe). Both models get the same question file, so the comparison is between models, not prompts.

From [`runs/luna-decisions-vs-jev/2026-11-10T06-58-17-856Z/verdict.md`](../runs/luna-decisions-vs-jev/2026-11-10T06-58-17-856Z/verdict.md), with k=3 and 290 items:

| | Luna Decisions (incumbent) | Jev 1.14 (candidate) |
|---|---|---|
| accuracy | 96.9% | 96.9% |
| delay-notice recall | 98.6% | 97.2% |
| general-correspondence recall | 96.4% | 91.7% |
| early-warning recall | 92.7% | 97.6% |
| stability (all 3 repeats agree) | 100% | 99.3% |
| cost per call | $0.000039 | $0.000026 |
| median latency | 0.44 s | 0.37 s |

**Verdict: NO-GO**, decided by the delay-notice guardrail. Both models miss `c305` on every repeat. Jev also misses `c079` on every repeat: a short notice of claim sent with an attachment, which Jev reads as general correspondence. Overall accuracy is identical, but the two models make different mistakes, and the 95% CI of the difference, [−2.3, +2.2] points, crosses the −2 point margin. Jev is about a third cheaper per call: it bills fewer dollars per token but counts more tokens per request (617 against 381).

Unlike the chat comparison, this verdict is not near the line: both models gave the same answer on every repeat of both missed notices. Replicate it for about **$0.06**:

```sh
pnpm eval run experiments/luna-decisions-vs-jev.ts
```
