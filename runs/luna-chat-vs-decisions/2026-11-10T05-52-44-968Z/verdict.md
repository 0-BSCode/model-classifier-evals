# Verdict: NO-GO, decided by rule 1 (guardrail): a guardrail failed

Experiment `luna-chat-vs-decisions`, dataset sha256 `8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf`, k=3.

## Accuracy (candidate - incumbent, paired bootstrap 95% CI over items)

delta -0.018  CI [-0.039, 0.001]  (n=290 items; incumbent 0.987, candidate 0.969)

## Guardrails

- [ ] recall(notice_of_delay_or_claim) no regression > 0.0%: incumbent 99.1%, candidate 98.6%
- [x] incumbent parse failures <= 2.0%: 0.0%
- [x] candidate parse failures <= 2.0%: 0.0%

## Arms

| | incumbent | candidate |
|---|---|---|
| model | `openai/gpt-6-luna` | `openai/gpt-6-luna-decisions` |
| served by | OpenAI | OpenAI |
| calls | 870 | 870 |
| API error rate | 0.0% | 0.0% |
| parse failure rate | 0.0% | 0.0% |
| stability (all k repeats agree) | 97.9% | 100.0% |
| cost per call (pinned prices, USD) | 0.000056 | 0.000039 |
| median latency (ms, same run) | 2712 | 737 |
| recall general_correspondence | 96.4% | 96.4% |
| recall rfi | 98.7% | 96.2% |
| recall variation_request | 100.0% | 100.0% |
| recall early_warning | 99.4% | 92.7% |
| recall notice_of_delay_or_claim | 99.1% | 98.6% |

Guardrails compare point estimates. With small classes this deliberately leans toward NO-GO.
