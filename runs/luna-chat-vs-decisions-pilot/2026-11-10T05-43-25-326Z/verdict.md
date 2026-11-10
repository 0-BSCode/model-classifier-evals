# Verdict: INCONCLUSIVE, decided by rule 3 (accuracy): delta CI includes margin -0.020; more items needed

Experiment `luna-chat-vs-decisions-pilot`, dataset sha256 `8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf`, k=1.

## Accuracy (candidate - incumbent, paired bootstrap 95% CI over items)

delta -0.014  CI [-0.038, 0.010]  (n=290 items; incumbent 0.983, candidate 0.969)

## Guardrails

- [x] recall(notice_of_delay_or_claim) no regression > 0.0%: incumbent 98.6%, candidate 98.6%
- [x] incumbent parse failures <= 2.0%: 0.0%
- [x] candidate parse failures <= 2.0%: 0.0%

## Arms

| | incumbent | candidate |
|---|---|---|
| model | `openai/gpt-6-luna` | `openai/gpt-6-luna-decisions` |
| served by | OpenAI | OpenAI |
| calls | 290 | 290 |
| API error rate | 0.0% | 0.0% |
| parse failure rate | 0.0% | 0.0% |
| stability (all k repeats agree) | 100.0% | 100.0% |
| cost per call (pinned prices, USD) | 0.000056 | 0.000039 |
| median latency (ms, same run) | 2656 | 756 |
| recall general_correspondence | 94.6% | 96.4% |
| recall rfi | 98.1% | 96.2% |
| recall variation_request | 100.0% | 100.0% |
| recall early_warning | 100.0% | 92.7% |
| recall notice_of_delay_or_claim | 98.6% | 98.6% |

Guardrails compare point estimates. With small classes this deliberately leans toward NO-GO.
