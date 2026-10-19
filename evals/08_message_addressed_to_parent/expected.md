# 08 — a message addressed to a parent, not to the child

**Written 2026-10-19, before any output was generated for this case.**

## Input

Class Pack, parent message in Kannada, Grade 6, Rural Karnataka.

- subject: `Science`
- topic: `Water cycle`
- performance: `Excellent / strong understanding`
- parentLanguage: `Kannada`

## What a correct answer contains

A message a parent reads *about* their child: it refers to the child in the third person, or
as "your child", and asks something of the parent.

Note the interaction with spec C4: the learner's name is never sent to the server, so the
model cannot use it. A correct message therefore refers to "your child" rather than any name —
and if a name appears at all, that is a serious failure worth investigating, not a style note.

## What a wrong answer looks like

- The message speaks to the child ("you learned about the water cycle today").
- It contains any personal name.
- It asks the child to do something rather than the parent.

## Decided by

A person, with this procedure: read the message and answer one question — "if a parent read
this aloud, would it make sense addressed to them?" Pass or fail, recorded per run. Code
checks only the hard part: the message must contain no name, and the harness asserts the
learner's name was never sent in the first place.

## Why this case

The Class Pack mode produces the only output that leaves the classroom. Getting the addressee
wrong is not a cosmetic error — it is a message sent to the wrong person.
