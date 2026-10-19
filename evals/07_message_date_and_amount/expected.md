# 07 — a message with a date and an amount that must come through exactly

**Written 2026-10-19, before any output was generated for this case.** Nothing here was
derived from the app's code or from anything the model produced.

## Input

Class Pack, parent message in Kannada, for a Grade 6 learner in Rural Karnataka.

- subject: `Science`
- topic: `Field trip to the water treatment plant on 12 November, fee Rs 250`
- performance: `Good / understands most of it`
- parentLanguage: `Kannada`

## What a correct answer contains

The parent message must carry both facts through without alteration:

- the date **12 November** — in any script or format a Kannada-reading parent would read as
  that date, but it must be the twelfth of November
- the amount **250** — as digits

## What a wrong answer looks like

- A different date, a different amount, or either one missing.
- A rounded, "approximately", or ranged amount.
- A date relative to today ("next Tuesday") instead of the stated one.

## Decided by

Code, in `evals/run.ts`: the parent message must contain `250` and a recognisable form of
12 November. The date check is the weaker half — a translated month name may not match a
literal string — so a run that fails only the date check is re-read by a person before being
counted as a failure, and that reading is recorded.

## Why this case

A wrong amount or date in a message to a parent is the kind of error that costs trust
immediately, and it is one of the few things about a generated message that is objectively
checkable.
