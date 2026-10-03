# Samaveshi v2 — what the app does today

Written 2026-10-02, before any v3 change, at commit `eba3f06` on `main`.
Every claim below was read off the code; file and line references are given so you can check
them. This is the starting point the paper will compare v3 against.

## Shape of the thing

A single-page React 19 app (`App.tsx`, 292 lines) talking to an Express 5 server
(`server.ts`, 723 lines). One process serves both: `npm run dev` runs `tsx server.ts`, which
mounts Vite as middleware in development and serves `dist/` in production. Generation happens
server-side through `@google/genai`; the browser never holds the API key.

If `GEMINI_API_KEY` is absent or set to `PLACEHOLDER_API_KEY`, the server flips to
`isApiKeyMock` (`server.ts:54`) and returns hard-coded sample content — Water Cycle notes, a
parent message in one of twelve languages. Useful for demos; it means a green screen does not
prove the model was called.

## The four modes

Declared in `types.ts` as `AppMode`, surfaced by `constants.ts:APP_MODES`:

| Mode | Input | What the learner gets |
|---|---|---|
| `HEAR_IMAGES` | photo/video | `spatialDescription`, `tactileModelSuggestion` |
| `SEE_SOUND` | audio/video | `transcript` with visual cues, `summary`, `emotionalTone`, `keyTerms` |
| `EASY_READ` | photo of a passage | `simplifiedText`, `analogies`, `quiz` |
| `CLASS_PACK` | a form, no media | `studentNotes`, `parentSummary` (for WhatsApp) |

`AppMode` also carries screen states (`ONBOARDING`, `CAMERA`, `ANALYZING`, `RESULT`,
`SETTINGS`) — modes and screens share one enum.

All four go through `POST /api/analyze-content`. Three further endpoints exist:
`/api/generate-speech`, `/api/transcribe-audio`, `/api/send-chat-message`.

## What the profile stores, and where it lives

`UserPreferences` (`types.ts:22`): `name`, `grade`, `language`, `location`, `disability`
(`NONE` | `VISUAL` | `HEARING` | `DYSLEXIA`), `culturalContext`.

**It is held in React state and nowhere else** — `useState(DEFAULT_PREFERENCES)` at
`App.tsx:14`. There is no `localStorage`, no IndexedDB, no server-side store; a grep for all
three across the source returns nothing. Consequences worth being precise about in the paper:

- The profile is **lost on every page reload**, and onboarding runs again.
- The effect at `App.tsx:25-29` means to skip onboarding when a name is already known, but
  `DEFAULT_PREFERENCES.name` is `""` (`constants.ts`), so the branch can never be taken. It is
  dead code today, not a working "remember me".
- "The profile stays on the device instead of on a server" is therefore not quite the v2→v3
  change it sounds like. Today the profile is not stored anywhere at all, *and* it is
  transmitted: the whole object is posted with every analyze call and interpolated into the
  system prompt at `server.ts:82-95`, learner's name included. v3 has to add local persistence
  **and** stop sending the name.

## What happens after the AI produces something

Nothing checks it. `handleProcessInput` (`App.tsx:112-130`) sets `ANALYZING`, awaits
`analyzeContent`, and on return does `setContent(result)` then `setMode(AppMode.RESULT)`.
The model's output is on the learner's screen in the same tick it arrives. There is no queue,
no review step, no teacher, no release, no log, and no record that generation happened.

Two related behaviours: `followUpSuggestions` is always populated and rendered, and
`ResultView` can speak output aloud via `speechSynthesis` for `VISUAL` learners — so output
reaches a learner through two channels, screen and voice.

## The photo

Held as a base64 data URL in `currentInputSrc` (`App.tsx:19`) for the life of the component and
posted to the server. Nothing deletes it; it goes when the component unmounts or the tab
closes.

## Model and regional context

`gemini-2.5-flash`, hard-coded at four places: `server.ts:250`, `:568`, `:601`, `:655`. No
pinned snapshot, no version constant.

`services/regionalContextMcpServer.ts` (124 lines) is a Model Context Protocol server on the
official SDK — `Server` plus `StdioServerTransport`, with `ListTools` and `CallTool` handlers
and one tool, `get_regional_analogy(location, concept, theme)`. `services/mcpClient.ts`
(167 lines) spawns it and calls that tool from the Easy Read path at `server.ts:278`.

**The tool's content is hardcoded.** A single branch — location containing "karnataka" AND
concept containing "photosynthesis" AND theme containing "agricultur" — returns the Rice Paddy
analogy with its Kannada glossary. Anything else returns a stub whose whole payload is
`"keyDriver": "Mapped to local environmental elements."`. The source comment says
`// Match the BDD Feature constraints`. The plumbing is real and standards-compliant; the
knowledge behind it is one example written to satisfy one test.
`skills/easy_read/SKILL.md` holds that agent's prompt harness. **These are out of scope for
v3** and must not be edited.

## The existing tests, and why they prove less than they appear to

`npm test` runs `scripts/runTests.ts` (149 lines), a hand-written BDD runner that reads
`features/analogy_engine.feature` line by line and matches each step with `includes()`.

It passes, and it is close to worthless as evidence. Most of its assertions compare a value
the runner itself set a few steps earlier:

```
// Background set state.userProfile.grade = "Grade 6"; the Then step asserts:
if (state.userProfile.grade !== expectedGrade) { throw ... }   // runTests.ts:93-96
```

The language check (`:102-105`) has the same shape. Neither looks at anything the app or the
model produced — they confirm the runner can remember a string. Only the MCP steps
(`:66-88`) exercise real code: they call `getRegionalAnalogy` and assert the returned analogy
is "Rice Paddy" and mentions sunlight.

And even that one is circular at a level the code makes explicit: the feature file asserts
"Rice Paddy", and the MCP server hardcodes "Rice Paddy" under a comment saying it exists to
match the feature. The call crosses a real process boundary, so it is a genuine integration
check in form — but what it verifies is a constant.

So: no test in this repository currently checks behaviour that could come out differently.
Two tautologies, one assertion against a hardcoded constant, and no coverage at all of the
app, the endpoints, or the model's output. Step 8 of the build guide ("break
something on purpose") would currently catch almost nothing, because there is almost nothing
to break. v3's acceptance criteria cannot lean on this suite; they need real checks.

## Repository hygiene, worth fixing before building

`components/` contains a second, near-complete copy of the application — its own `App.tsx`,
`server.ts`, `services/geminiService.ts`, `package.json`, `.env.example`, a nested
`components/components/`, and `samaveshi-learning-for-all.zip`. The copies have drifted
(`components/ResultView.tsx` is 552 lines, `components/components/ResultView.tsx` is 480).

The real app imports from `./components/CameraView` etc., so the *leaf* component files there
are live, but the duplicated `App.tsx`, `server.ts`, and `services/` under `components/` are
not reachable from `index.tsx`. This matters for v3: "which files may be touched" is
ambiguous while two files called `App.tsx` exist, and a coding tool asked to add a review
screen may well edit the wrong one.
