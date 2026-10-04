# AllPath

**One lesson, no one left out.**

A multimodal learning aid for learners who hit a wall that has nothing to do with their ability
to learn: a diagram they cannot see, a lesson they cannot hear, a passage written for someone
else's reading level, an example drawn from a place they have never been.

Point it at a textbook page, a recording, or a passage. It produces an adapted version for one
specific learner — their language, their grade, their access needs, their region.

## Status

| | |
|---|---|
| `main` | **v2, as released.** The four modes work. No teacher review step. |
| [PR #1](https://github.com/kmldas108/AllPath/pull/1) | **v3 in review.** Adds the teacher review gate, on-device profile, local accounts, and an output cache. |

This is a research prototype under evaluation, not a product. The model version is pinned on
purpose (see [Pinned for measurement](#pinned-for-measurement)).

`main` is deliberately left at v2 so the version boundary stays a real commit — the evaluation
compares v2 against v3, and that comparison needs a before.

## The four modes

| Mode | You give it | It gives back |
|---|---|---|
| **Hear Images** | a photo of a diagram | a spatial description, and a touch-model you can build from things to hand |
| **See Sound** | audio or video | a transcript with visual cues, a summary, the emotional tone, key terms |
| **Easy Read** | a photo of a passage | simplified text, a local analogy, a short quiz |
| **Class Pack** | a form | student notes and a parent message, ready to send |

Each one is shaped by the learner's profile: language, grade, location, and access need
(none / visual / hearing / dyslexia).

## What v3 adds, and why

A teacher sees everything the AI produces before a child or a parent does.

In v2, the model's output went straight from the API call to the learner's screen in the same
tick it arrived. Nothing checked it. For a tool aimed at children with disabilities, that is
the wrong default: a plausible-sounding description of a diagram can be wrong about which way
the arrows point, and a touch-model suggestion can name something a small child should not have
in their hands.

So v3 puts a gate in front of it:

- **Review queue** — everything the model produces lands as `pending` and goes no further. The
  learner's view reads released items only, so there is exactly one path to a learner and it
  runs through a teacher's decision.
- **Review screen** — source and output side by side, output editable, Release or Discard. A
  timer runs from opening the item to the decision.
- **Review log** — one row per decision, with the seconds the review took. That number is the
  point of the study: if checking the AI takes longer than adapting the material by hand, the
  design is in trouble, and the write-up has to say so.
- **On-device profile** — v2 kept it in React state, so it died on every reload. It now
  persists per account on the device.
- **The learner's name never leaves the device.** v2 put it in the system prompt on every
  request.
- **Local accounts** — teacher and learner share a tablet and each sign in. Passwords are
  PBKDF2-hashed on the device and never transmitted. There is no account server.
- **Output cache** — identical input returns the stored answer instead of calling the model
  again. A cache hit still enters the review queue unreleased: it saves the model call, never
  the teacher's decision. The cache goes inert during measurement, because a cache that returns
  the same answer three times would erase the variance the evaluation exists to measure.

## Running it

Needs Node 20+ and a Gemini API key.

```bash
npm install
cp .env.example .env     # then put your GEMINI_API_KEY in it
npm run dev              # server and Vite on one port
```

Without a key the server returns canned sample content instead of calling the model, which is
useful for walking through the UI — but a working screen then proves nothing about generation.

```bash
npm run build            # client bundle + server bundle
npm start                # serve the built app
```

## How it is put together

```
App.tsx                 screen routing, and the one place generation is kicked off
server.ts               Express: /api/analyze-content and the speech/transcribe/chat endpoints
components/             the screens — camera, result, onboarding, settings, class pack
services/
  geminiService.ts      client calls to the server
  regionalContextMcpServer.ts   MCP server: localised analogies
  mcpClient.ts          spawns and calls it
skills/easy_read/       the Easy Read agent's prompt harness
features/               BDD feature files
```

Generation is server-side, so the API key never reaches the browser.

### The MCP server

`services/regionalContextMcpServer.ts` is a Model Context Protocol server on the official SDK —
stdio transport, a declared tool schema, spawned as a real subprocess by `services/mcpClient.ts`
and called from the Easy Read path.

**Its content is one worked example.** A single branch (Rural Karnataka + photosynthesis +
agricultural analogies) returns a Rice Paddy analogy with a Kannada glossary; every other input
returns a stub. The plumbing is real and standards-compliant; the knowledge behind it is not yet
a regional dataset. Said plainly here so nobody infers more from the architecture than is there.

## Tests

On the v3 branch:

```bash
npm test             # 49 tests, each named for the requirement it decides
npm run typecheck
```

Every test maps to a numbered criterion in `specs/review-spec.md`, and
`docs/criteria-map.md` lists which check decides which criterion — including the criteria that
need a person rather than a test, and the ones with no check yet.

The suite was validated by breaking the app on purpose: removing the release filter failed 9
tests, and letting a cache hit skip review failed 2. A suite that stays green when you break the
thing it claims to protect is worth nothing, so this is recorded rather than assumed.

`npm run test:bdd` runs the older feature-file runner. It currently fails on Windows: it spawns
the MCP server through `npx tsx` with an 8-second timeout, and cold start alone takes about 5
seconds here.

## Pinned for measurement

The model is pinned to `gemini-2.5-flash` and does not change during this phase of work.

An evaluation measures one system. If the model changes mid-build, the results describe a
mixture of systems and no single one of them, with no way to tell afterwards which number came
from which. For the same reason the output cache keys on the model version, so a version change
can never be served stale output from the pinned one.

## Written decisions

The build follows a specification-first process; the written decisions are in the repository
rather than in anyone's head.

| | |
|---|---|
| `specs/current-state.md` | what v2 does today, with file and line references |
| `specs/review-spec.md` | what v3 must do — the source of truth |
| `docs/plan-v3.md` | the task plan, and what each task is finished when |
| `docs/criteria-map.md` | every criterion against the check that decides it |
| `docs/build-log.md` | one line per change, and what was decided against |
| `evals/` | test cases for the quality of the model's output — a different job from testing the app |

Those files arrive with PR #1.

## Not built yet

- The model's output quality is **untested**. The `evals/` cases are scaffolded and empty. The
  app being correct says nothing about whether the AI is any good.
- No version string on screen yet; it arrives at the freeze.
- The teacher-facing requirements marked `[T1]` in the spec are waiting on interviews with
  special educators.
- The review gate is on PR #1, not on `main`. Until that merges, the released app has no gate.
