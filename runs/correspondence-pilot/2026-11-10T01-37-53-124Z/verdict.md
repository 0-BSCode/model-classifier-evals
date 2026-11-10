# Verdict: GO, decided by rule 5 (cost): non-inferior and >= 20.0% cheaper

Experiment `correspondence-pilot`, dataset sha256 `8c0068f48ac91034ac3a5ba32fa08947f3fe25d8eadda337070b8bdded063dcf`, k=1.

## Accuracy (candidate - incumbent, paired bootstrap 95% CI over items)

delta 0.010  CI [-0.003, 0.028]  (n=290 items; incumbent 0.983, candidate 0.993)

## Guardrails

- [x] recall(notice_of_delay_or_claim) no regression > 0.0%: incumbent 98.6%, candidate 100.0%
- [x] incumbent parse failures <= 2.0%: 0.0%
- [x] candidate parse failures <= 2.0%: 0.0%

## Arms

| | incumbent | candidate |
|---|---|---|
| model | `openai/gpt-6-luna` | `google/gemma-4-26b-a4b-it` |
| served by | OpenAI | PrimeIntellect |
| calls | 290 | 290 |
| API error rate | 0.0% | 0.0% |
| parse failure rate | 0.0% | 0.0% |
| stability (all k repeats agree) | 100.0% | 100.0% |
| cost per call (pinned prices, USD) | 0.000056 | 0.000019 |
| median latency (ms, same run) | 2065 | 747 |
| recall general_correspondence | 96.4% | 98.2% |
| recall rfi | 96.2% | 100.0% |
| recall variation_request | 100.0% | 100.0% |
| recall early_warning | 100.0% | 98.2% |
| recall notice_of_delay_or_claim | 98.6% | 100.0% |

Guardrails compare point estimates. With small classes this deliberately leans toward NO-GO.
