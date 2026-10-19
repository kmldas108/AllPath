# evals — testing what the model writes

This is a different job from testing that the app works. The app tests (A1-A9 in
specs/review-spec.md) ask "does the release gate hold". These ask "is what the model produced
any good". Keep them apart; they fail for different reasons and get reported separately.

Status: **scaffold only.** The eight case folders are empty. Fill them at Step 9, after the
build works end to end.

## The eight kinds of case

| Folder | What it probes |
|---|---|
| 01_diagram_known_layout/ | a diagram where the directions and labels are known in advance |
| 02_diagram_unsafe_tactile/ | a diagram where a touch-model suggestion might name something a small child could swallow |
| 03_passage_term_must_survive/ | a passage with a term that must not be dropped |
| 04_passage_cause_and_effect/ | a passage where cause and effect must stay in order |
| 05_passage_local_example/ | a passage needing a local example for a named district |
| 06_clip_background_sound/ | a clip with a background sound that must be named |
| 07_message_date_and_amount/ | a message with a date and an amount that must come through exactly |
| 08_message_addressed_to_parent/ | a message that must address a parent, not the child |

## Three rules, and they are the ones people get wrong

1. **Write the right answer first, before you look at what the model said.** Each case folder
   gets an expected.md written before any model output is generated. Otherwise a convincing
   answer quietly becomes the standard. For teacher-raters: they write what a correct
   description must contain, then they look at the output.
2. **Never derive the right answer from the app's own code.** If the app's logic is wrong, the
   test agrees with it and both look fine.
3. **Run each case at least three times.** The model does not say the same thing twice. One run
   tells you about one run.

## Reporting

Counts and totals, never adjectives. "19 of 20 descriptions had no factual error" says
something; "highly accurate" says nothing and a reviewer will mark it. Every table carries the
model version, the date, and the number of repeats.

Case 02 is the gate: if an unsafe tactile-model suggestion can still reach a learner's screen,
that gets fixed before the Step 11 evaluation runs.

---

## Running them

Three of the eight cases are filled: 03, 07 and 08. All three go through Class Pack, which is
the text-based mode — no photo or clip needed. The image and audio cases (01, 02, 04, 05, 06)
need real source material and real expectations, and are deliberately still empty rather than
filled with something convenient.

**This matters for what the results can claim.** Three text-path cases say nothing about Hear
Images or See Sound, which are the modes the accessibility argument rests on. Say so when
reporting.

Start the server in measurement mode, in its own terminal:

```bash
ALLPATH_EVAL_MODE=1 npm run dev
```

PowerShell: `$env:ALLPATH_EVAL_MODE=1; npm run dev`

Then:

```bash
npm run eval
```

Measurement mode makes the server return 503 rather than hardcoded sample text when a model
call fails, and the harness aborts if any response is not `generationSource: "model"`. Both
exist so a run cannot quietly score canned text and produce a reassuring table.

Raw outputs land in `evals/results/` (gitignored — they are run artefacts, and may be large).
Keep the ones you cite in the write-up somewhere permanent, with the date and the model
version that the harness records alongside them.

## What the harness can and cannot decide

Code decides the hard-edged parts: a term is present, an amount is exact, a name is absent.
That is genuinely all it decides. "Would a parent read this as addressed to them" is a
person's judgement, and case 08 carries the procedure for making it. A count of passed code
checks is not a quality score, and should never be presented as one.
