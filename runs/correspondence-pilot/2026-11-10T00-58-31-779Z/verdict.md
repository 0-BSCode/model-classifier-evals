# Verdict: NO-GO, decided by rule 7 (no benefit): non-inferior but neither cheaper nor faster enough to switch

Experiment `correspondence-pilot`, dataset sha256 `087c4f0339ec0bbc38291285bca9179e7bf855ce579730adb54acaa9e8962db2`, k=1.

## Accuracy (candidate - incumbent, paired bootstrap 95% CI over items)

delta -0.004  CI [-0.018, 0.007]  (n=279 items; incumbent 0.986, candidate 0.982)

## Guardrails

- [x] recall(notice_of_delay_or_claim) no regression > 0.0%: incumbent 100.0%, candidate 100.0%
- [x] incumbent parse failures <= 2.0%: 0.0%
- [x] candidate parse failures <= 2.0%: 0.0%

## Arms

| | incumbent | candidate |
|---|---|---|
| model | `openai/gpt-6-luna` | `google/gemini-3.8-flash` |
| served by | OpenAI | Google |
| calls | 279 | 279 |
| API error rate | 0.0% | 0.0% |
| parse failure rate | 0.0% | 0.0% |
| stability (all k repeats agree) | 100.0% | 100.0% |
| cost per call (pinned prices, USD) | 0.000053 | 0.001022 |
| median latency (ms, same run) | 1760 | 2977 |
| recall general_correspondence | 98.1% | 98.1% |
| recall rfi | 94.2% | 92.3% |
| recall variation_request | 100.0% | 100.0% |
| recall early_warning | 100.0% | 100.0% |
| recall notice_of_delay_or_claim | 100.0% | 100.0% |

Guardrails compare point estimates. With small classes this deliberately leans toward NO-GO.
