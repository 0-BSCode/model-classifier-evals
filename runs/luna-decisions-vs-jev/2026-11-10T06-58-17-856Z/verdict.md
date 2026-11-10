# Verdict: NO-GO, decided by rule 1 (guardrail): a guardrail failed

Experiment `luna-decisions-vs-jev`, dataset sha256 `8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf`, k=3.

## Accuracy (candidate - incumbent, paired bootstrap 95% CI over items)

delta 0.000  CI [-0.023, 0.022]  (n=290 items; incumbent 0.969, candidate 0.969)

## Guardrails

- [ ] recall(notice_of_delay_or_claim) no regression > 0.0%: incumbent 98.6%, candidate 97.2%
- [x] incumbent parse failures <= 2.0%: 0.0%
- [x] candidate parse failures <= 2.0%: 0.0%

## Arms

| | incumbent | candidate |
|---|---|---|
| model | `openai/gpt-6-luna-decisions` | `typesafe/jev-1.14` |
| served by | OpenAI | TypeSafe |
| calls | 870 | 870 |
| API error rate | 0.0% | 0.0% |
| parse failure rate | 0.0% | 0.0% |
| stability (all k repeats agree) | 100.0% | 99.3% |
| cost per call (pinned prices, USD) | 0.000039 | 0.000026 |
| median latency (ms, same run) | 439 | 370 |
| recall general_correspondence | 96.4% | 91.7% |
| recall rfi | 96.2% | 98.1% |
| recall variation_request | 100.0% | 100.0% |
| recall early_warning | 92.7% | 97.6% |
| recall notice_of_delay_or_claim | 98.6% | 97.2% |

Guardrails compare point estimates. With small classes this deliberately leans toward NO-GO.
