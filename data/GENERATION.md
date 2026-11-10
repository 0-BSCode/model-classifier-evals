# How `correspondence.jsonl` was made

All items are **synthetic**. They imitate formal construction contract correspondence between a principal, a contractor and an engineer/contract administrator. Every organisation, person, project and place is fictional, and no item cites a clause from a standard-form contract.

## Authoring

- **Author:** Claude (`anthropic/claude-opus-5.5`), writing directly in an interactive session on 2026-11-10. Writing the items made no API calls and cost nothing.
- **Instructions:** the author followed `data/GUIDELINE.md` (class definitions, borderline examples, the "most severe wins" precedence rule). The only other instructions were the design constraints below.
  - About 70 notices, deliberately oversampled because notices are the critical class, and about 50 items in each other class.
  - About a third of each class are deliberately **borderline** items that sit on a class boundary but are still correct under the guideline. Their `notes` start with `borderline`.
  - Varied senders, tone (formal letter, email, terse platform message, chatty), and projects (motorway, water treatment, hospital, rail station, school, pipeline, bridge, flood scheme, wharf, pool).
- **Leakage fix:** in a first pass, 62 of 70 notices contained the word "notice", so a model could pass by spotting the keyword. 32 notices were reworded without it (their `notes` end with `(reworded without the word 'notice')`). 10 items in other classes that use the word were added (ids `c270`–`c279`). After the fix, about half the notices contain "notice", and roughly a quarter of the messages that contain it belong to other classes.
- **Order:** items were shuffled with a fixed seed before ids were assigned, so ids don't reveal labels. The exception is the 10 leakage-fix items, which were appended at the end with mixed labels.

### Why not an LLM pipeline?

An earlier draft generated with a paid Gemini script was discarded for two reasons. A project rule says data is never produced with paid API calls, and Gemini was at the time one of the compared models. The compared models are now `openai/gpt-6-luna` and `google/gemma-4-26b-a4b-it` (pilots 1 and 2 used `google/gemini-3.8-flash`), deliberately from a different vendor than the author, so that neither is classifying text written in its own style (self-preference bias). `assertManifest` enforces this through `dataset.draftedBy`.

## Human review

- **Reviewer:** the project owner, on 2026-11-10.
- **Process:** every item was checked against `data/GUIDELINE.md` for label correctness, realism, and the absence of real names or clause numbers. Items were reviewed in priority order: borderline items first, then the reworded notices, the leakage-fix items, and finally the clear-cut items.
- **Outcome (first round):** all 279 items were kept with their original labels, and none were changed or deleted.
- **Second round (after pilot 1):** the 60 new hard items were reviewed with a stricter bar: delete any item with a reasonable case for two labels. All 60 were kept. The reviewer also relabelled **c015** from `rfi` to `early_warning`, because "or he can't start" flags a risk.

## Pilot 1 and the difficulty revision

**Pilot 1** used `experiments/correspondence-pilot.ts`: same models, hosts and prompt as the Luna vs Gemma experiment, k=1, 558 calls, $0.30. It ran against the 279-item version of this file (commit `f0b8f77`):

| | gpt-6-luna | gemini-3.8-flash |
|---|---|---|
| accuracy | 98.6% | 98.2% |
| notice recall | 100% | 100% |
| parse failures | 0% | 0% |

Both models scored above the 95% threshold, and the critical-class guardrail could never fire. All 9 errors were on the rfi/general boundary. So the dataset was revised before pre-registration:

- **Removed 49 clear-cut items by rule, never by a model's result.** Within each class, only items that were not borderline, not reworded, not leakage-fix items, and **not missed by either model in the pilot**. The pilot misses (c013, c015, c107, c178, c217, c277) were protected, so the removal cannot favour either model. Notices: the 18 most formulaic (subject starting "Notice" or containing "hereby give notice"), in id order. Other classes: the shortest (early_warning 13, general 8, rfi 6, variation 4). As a result, every removed item was one both models had answered correctly. The removed ids are c002 c023 c027 c033 c041 c047 c048 c059 c067 c073 c075 c086 c091 c093 c094 c097 c102 c106 c117 c132 c137 c138 c144 c155 c159 c171 c172 c173 c174 c177 c187 c203 c205 c208 c209 c216 c226 c228 c230 c231 c232 c234 c245 c246 c248 c254 c259 c266 c269. They remain available in git history.
- **Added 60 hard items** (c280–c339, shuffled with a fixed seed; `notes` start with `hard:`), written by the same author without paid calls. Most target the notice ↔ early-warning boundary: notices with no "notice", "claim" or "extension" vocabulary, or buried in long multi-topic updates; early warnings in assertive, claim-like language; general correspondence that withdraws, accepts or transmits claims.
- **Trade-off:** easy items contribute nothing to the difference between models but dilute it, so replacing them makes the comparison more sensitive at the same cost. Accuracy on this set is no longer an estimate of accuracy on real traffic, which is mostly easy.

## Final composition

| label | items |
|---|---|
| notice_of_delay_or_claim | 72 |
| variation_request | 54 |
| early_warning | 55 |
| rfi | 53 |
| general_correspondence | 56 |
| **total** | **290** |

## Known limitations

- The original items are short (median about 34 words); the hard items are longer (median about 54). Real correspondence is usually longer still.
- One author wrote all the items, so the style is more uniform than real traffic, and a small cast of fictional parties recurs.

## Pilots 2 and 3 (on this 290-item version)

| | pilot 2: Luna vs Gemini 3.8 Flash | pilot 3: Luna vs Gemma 4 26B |
|---|---|---|
| incumbent accuracy (Luna) | 97.6% | 98.3% |
| candidate accuracy | 97.2% | 99.3% |
| accuracy on the 60 hard items | 96.7% / 91.7% | 96.7% / 98.3% |
| notice recall (Luna / candidate) | 98.6% / 97.2%: **guardrail fails** | 98.6% / 100% |
| cost | $0.34 | $0.02 |

Pilot 2 showed the revised dataset can fail the critical-class guardrail: Flash missed notices buried in a minutes correction (c305) and in a two-question message (c283). The dataset therefore isn't at a ceiling, even though the incumbent stays above 95%. The reviewer accepted this version as final on 2026-11-10. Flash was then replaced as the candidate for cost reasons (see design D10), and pilot 3 checked the new candidate's host and token usage before the reference run.
