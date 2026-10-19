# 03 — a term that must not be dropped

**Written 2026-10-19, before any output was generated for this case.**

## Input

Class Pack, student notes for Grade 6, Rural Karnataka, learner language Kannada.

- subject: `Science`
- topic: `Transpiration in plants`
- performance: `Needs more practice`
- parentLanguage: `Kannada`

## What a correct answer contains

The student notes must still contain the technical term **transpiration**, in English, even
though the surrounding explanation is in Kannada. The spec's own adaptation rule says a
technical term stays in English and is explained in the learner's language — so dropping the
term, or replacing it with a Kannada paraphrase alone, is a failure even if the explanation is
otherwise good.

## What a wrong answer looks like

- The notes explain evaporation from leaves without ever naming transpiration.
- The term appears only in a transliteration with no English form.
- The notes are about a different topic.

## Decided by

Code: the student notes must contain the string `transpiration`, case-insensitively.

## Why this case

A learner who cannot find the exam word in their notes cannot use them, however good the
simplification. This is simplification's characteristic failure — losing the thing the learner
is being assessed on.
