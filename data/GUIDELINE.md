# Labeling guideline: contract correspondence triage

Each item is one formal message exchanged between the parties to a construction contract: the **principal** (client), the **contractor**, and the **engineer/contract administrator** (who administers the contract for the principal). Give every item exactly **one** label.

All items are synthetic. They use generic contract language, with no clause numbers from any standard form (NZS 3910, AS 4000, NEC, etc.) and no real organisations, people or projects.

## Precedence for mixed messages: the most severe class wins

Real messages often do several things at once. Label by the most consequential thing the message does:

```
notice_of_delay_or_claim  >  variation_request  >  early_warning  >  rfi  >  general_correspondence
```

Reason: triage exists so that nothing with a contractual deadline goes untracked. A delay notice buried under an RFI must still be caught.

## Classes

### `notice_of_delay_or_claim` (critical)
The sender **formally notifies** a claim for more time and/or money, or formally notifies a delay event they intend to claim for. Typical markers: "hereby give notice", "notice of claim", "extension of time", "we reserve our right to claim", or an explicit reference to the contract's notice requirements. The claim doesn't need to be quantified yet.

- *Positive:* "We hereby give notice that the late handover of the northern laydown area has delayed the works and we will be claiming an extension of time and associated costs. Particulars will follow within the period required by the contract."
- *Borderline (still this class):* "Further to our early warning of 3 March, the ground conditions at Pier 4 have now delayed piling by six working days. Please treat this letter as our formal notice of delay; we reserve our entitlement to time and cost." The message escalates from a warning to a formal notice, so the notice wins.

### `variation_request`
The sender asks for, instructs, proposes or prices a **change to the scope** of the works, without formally notifying a delay or claim.

- *Positive:* "The principal wishes to add a second passenger lift to Block B. Please provide a quotation and programme impact for this change."
- *Borderline:* "If the revised façade detail is adopted, we estimate an additional $48,000. Please confirm whether you wish us to proceed." This prices a proposed change but doesn't claim anything for an event that already happened, so it is `variation_request`, not a notice.

### `early_warning`
The sender flags a **possible future** problem (delay, cost increase, quality or safety issue) so that it can be managed early. Nothing is claimed or formally notified yet. The language is conditional: "may", "could", "we anticipate", "risk".

- *Positive:* "Our geotechnical team has observed softer material than shown in the site investigation report near Pier 4. This may affect the piling programme. We suggest a meeting this week to discuss options."
- *Borderline:* "Steel deliveries from the fabricator are running two weeks behind their own schedule; if this continues it could affect erection of level 3." This mentions delay but is conditional and claims nothing, so it is `early_warning`.

### `rfi` (request for information)
The sender asks a **question** that needs an answer to proceed, typically about drawings, specifications, conflicts or clarifications. It doesn't propose a scope change or flag a risk.

- *Positive:* "Drawing S-201 shows a 300 mm slab thickness at gridline C, but the specification calls for 250 mm. Please confirm which governs."
- *Borderline:* "Could you confirm the colour of the balustrade powder-coat? Our order must be placed by Friday to hold the programme." It mentions the programme, but it is a plain question with a deadline and no risk flagged, so it is `rfi`.

### `general_correspondence`
Everything else: meeting minutes, transmittals, acknowledgements, scheduling, courtesy updates, and administrative matters.

- *Positive:* "Please find attached the minutes of site meeting 14. The next meeting is scheduled for Tuesday at 10am in the site office."
- *Borderline:* "We acknowledge receipt of your notice of delay dated 12 May and will respond within the period required by the contract." This *mentions* a notice but doesn't itself notify anything, so it is `general_correspondence`.

## Quick decision path

```
Does it formally notify a delay/claim for time or money?  -> notice_of_delay_or_claim
Does it request, instruct, propose or price a scope change? -> variation_request
Does it flag a possible future problem, with nothing claimed? -> early_warning
Does it ask a question that needs an answer?                -> rfi
otherwise                                                   -> general_correspondence
```

If an item is genuinely ambiguous after applying this guideline, **delete it** rather than guess. The aim is clean gold labels, not coverage.
