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

An earlier draft generated with a paid Gemini script was discarded for two reasons. A project rule says data is never produced with paid API calls, and Gemini later became one of the compared models. The compared models are `openai/gpt-6-luna` and `google/gemini-3.8-flash`, deliberately from a different vendor than the author, so that neither is classifying text written in its own style (self-preference bias). `assertManifest` enforces this through `dataset.draftedBy`.

## Human review

- **Reviewer:** the project owner, on 2026-11-10.
- **Process:** every item was checked against `data/GUIDELINE.md` for label correctness, realism, and the absence of real names or clause numbers. Items were reviewed in priority order: borderline items first, then the reworded notices, the leakage-fix items, and finally the clear-cut items.
- **Outcome:** all 279 items were kept with their original labels, and none were changed or deleted.

## Final composition

| label | items |
|---|---|
| notice_of_delay_or_claim | 70 |
| variation_request | 51 |
| early_warning | 52 |
| rfi | 52 |
| general_correspondence | 54 |
| **total** | **279** |

## Known limitations

- The items are shorter than typical real correspondence (median about 35 words), which narrows the cost and latency differences between models.
- One author wrote all the items, so the style is more uniform than real traffic, and a small cast of fictional parties recurs.
- Almost every notice still contains claim vocabulary ("claim", "extension of time"). The pilot (below) checks whether this keeps the task too easy.

## Pilot (difficulty check)

_Filled in after task 5.4._
