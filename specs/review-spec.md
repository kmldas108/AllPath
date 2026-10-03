# Samaveshi v3 — the teacher review gate and the on-device profile

Status: **draft for Kamal's review.** Drafted 2026-10-02 from `Samaveshi_v3_build_guide.docx`
(Steps 3 and 4). The guide names a companion file `Samaveshi_v3_spec_and_process.md` to copy
from; it was not on this machine, so the headings below are filled in from the guide's own
description plus the code as it stands. **Read every line and change what you disagree with —
this is the document the build is answerable to.**

Two things are deliberately left open: the requirements marked [T1] wait on the teacher
conversations in Step 5, and anything marked TODO needs a decision from you.

---

## 1. Goal

A teacher sees everything the AI produces before a child or a parent does. They can fix it,
throw it away, or release it with one tap. Nothing reaches a learner until they release it.
The learner's profile stays on the device and the learner's name is never sent anywhere.

Nothing else about the app changes.

## 2. Technology

Unchanged from v2: React 19 + Vite, Express 5, @google/genai, the regional-context MCP
server, TypeScript.

**The model stays gemini-2.5-flash and does not change during this work.** Why this is a
requirement and not a preference: the evaluation measures one system. If the model changes
mid-build, the numbers in the paper describe a mixture of systems and no single one of them —
and there is no way to tell afterwards which result came from which. The version is pinned in
section 7 and restated at freeze (Step 10).

## 3. Constraints — the rules nothing may break

- **C1.** Nothing the AI produces reaches a learner, in any channel, before a teacher releases
  it. Screen and spoken output both count as reaching a learner.
- **C2.** Follow-up questions start switched off.
- **C3.** The source photo is deleted once the item is dealt with — released or discarded.
- **C4.** No learner's name is sent anywhere off the device.
- **C5.** The profile is stored on the device only. No profile field reaches the server except
  those needed to generate, and never the name.
- **C6.** The four mode prompts and the regional-context MCP server are not modified.

## 4. Inputs and outputs

**In:** the AI's output for one item; the source photo or clip; the teacher's decision
(release / edit then release / discard), and their edited text where they made one.

**Out:** the released content, visible to the learner; and one row in a review log recording
what happened.

The log row holds: item id, mode, timestamp generated, timestamp decided, the decision, whether
the teacher edited the text, and the seconds the teacher spent on the review. It does **not**
hold the learner's name (C4). Those seconds are the number Step 11 turns on, so the log is
evaluation apparatus, not a nice-to-have.

## 5. Acceptance criteria

Each line is plainly true or false and names what decides it. Criteria decided by a person
name the procedure, not just the person.

| # | Criterion | Decided by |
|---|---|---|
| A1 | A photo of a diagram produces output that does not appear in the learner's view until the teacher presses Release. | test test_release_gate |
| A2 | An item in the queue that has never been released is absent from the learner's view, and absent from the spoken output. | test test_unreleased_is_silent |
| A3 | A released item appears in the learner's view with the teacher's edits, not the model's original text. | test test_edits_are_what_ships |
| A4 | A discarded item never appears in the learner's view and leaves a log row with decision "discarded". | test test_discard_leaves_trace |
| A5 | After a decision, the stored source photo for that item is gone. | test test_photo_deleted_on_decision |
| A6 | A freshly generated item has follow-up questions switched off. | test test_followups_default_off |
| A7 | No request leaving the browser contains the learner's name, for any of the four modes. | test test_name_never_leaves |
| A8 | The profile survives a page reload without re-running onboarding, with no network call. | test test_profile_persists_locally |
| A9 | Every decision writes exactly one log row, carrying a review duration in seconds. | test test_log_one_row_per_decision |
| A10 | The version string on screen matches the tag that was deployed. | manual: read the footer on the deployed URL, compare with "git describe --tags"; recorded in docs/build-log.md at freeze |
| A11 | A teacher new to the app can review and release one Hear Images item without being told what to do. | manual: one educator, not from Step 5 and not from Step 11, is handed the device with no instruction; passes if they release an item within two minutes and never ask what a control does |
| A12 | [T1] — pending Step 5. | [T1] |
| A13 | [T1] — pending Step 5. | [T1] |
| A14 | [T1] — pending Step 5. | [T1] |

Eleven criteria have deciders; three are placeholders that the teacher conversations fill.
A11's procedure is deliberately specific because "easy to use" is not a criterion — "released
an item within two minutes without asking what a control does" is.

**The one that must pass before any teacher sees the app:** if an unsafe tactile-model
suggestion can still reach a learner's screen, that is fixed before the Step 11 evaluation.
Everything else can be measured as it stands.

## 6. Output files

**May be created:**
- features/review_gate.feature and step definitions, or a real test runner — see the open
  question in section 8.
- a review queue store, a review screen component, a local profile store, a log writer
  (names to be proposed in the Step 6 plan, not decided here).

**May be changed:** App.tsx, types.ts, constants.ts, components/ResultView.tsx,
components/OnboardingView.tsx, components/SettingsModal.tsx, and the request/response
plumbing in server.ts and services/geminiService.ts needed to drop the name and carry an
item id.

**Must not be changed:**
- the four mode prompt blocks in server.ts (the TASK strings around lines 287, 308, 337, 376)
  except to remove the learner's name,
- services/regionalContextMcpServer.ts, services/mcpClient.ts, skills/easy_read/SKILL.md,
- the model name gemini-2.5-flash.

**Do not touch, and do not tidy:** the duplicate application tree under components/
(components/App.tsx, components/server.ts, components/services/, components/components/,
samaveshi-learning-for-all.zip). It is a real problem — see specs/current-state.md — but
cleaning it up mid-build changes what is being measured. It gets its own commit, before
Step 7 starts or after Step 11 ends, never during.

## 7. Out of scope

No new modes. ~~No accounts, no login, no teacher identity beyond "a teacher is at the device".~~
**Superseded by section 10** — login is now in scope.
No redesign of existing screens beyond what the review gate needs. No newer model, no model
snapshot change. No cloud sync of the profile or the log. No analytics. No fixing of the
duplicate tree during the build.

Pinned for the evaluation: model gemini-2.5-flash; base commit eba3f06; tag, deployment URL
and date to be filled in at Step 10.

---

## 8. Open questions for Kamal

1. **The test suite.** npm test today is a hand-rolled includes() matcher whose assertions
   mostly compare values it set itself (specs/current-state.md has the detail). A1-A9 cannot
   be expressed honestly in it. Add a real runner (Vitest fits a Vite project), or extend the
   BDD runner? I would add Vitest and leave the existing feature file alone.
2. **Where the queue and log live.** IndexedDB keeps C5 simple and survives reload; a file on
   the server would be easier to read for the paper but puts learner-adjacent data back on a
   server. I lean IndexedDB with a "download the log as CSV" button for analysis.
3. **How the learner's view knows a teacher released something.** One device shared between
   teacher and learner, or two? The answer changes the design considerably, and the guide does
   not say.
4. **The name, exactly.** C4 says the name never leaves the device. The prompts currently
   greet the learner by name. Drop the greeting, or substitute a neutral word locally?
5. **location and culturalContext.** location is needed server-side for the regional analogy.
   Confirm it is not considered identifying for your ethics approval.

---

## 9. Decisions — 2026-10-03

Answers to section 8, from Kamal. These are now binding on the build; section 8 is kept as
the record of what was asked.

1. **Test suite** — Vitest, with the existing BDD feature file left alone. `npm test` becomes
   Vitest; `npm run test:bdd` keeps the old runner.
2. **Queue and log** — on the device. Profile in localStorage, queue/log/photos in IndexedDB.
3. **Device** — **one shared device**, with a different login for the teacher and the learner.
4. **Greeting / name** — assumed dropped, not substituted. Not yet confirmed.
5. **location** — still open; it remains the one profile field that leaves the device.

**Consequence for section 7.** "No accounts, no login" no longer holds as written. The build
assumes a **local teacher passcode** that switches the device between teacher and learner
mode — no server, no identity, no user records. A new criterion A15 follows from it:

| # | Criterion | Decided by |
|---|---|---|
| A15 | In learner mode the review queue is unreachable without the teacher passcode. | test test_learner_cannot_review |

If real accounts are wanted instead, section 7 has to be rewritten and the plan re-estimated.

---

## 10. Amendments — 2026-10-03

Three changes from Kamal. Each supersedes what came before where they conflict.

### 10a. Login is in scope

Supersedes section 7 ("no accounts, no login") and the passcode proposal in section 9.

The teacher and the learner each sign in with their own credentials on the shared device.

**Credentials stay on the device.** This is not a preference; it is forced by C4 and C5. A
server-side account directory would put learner records back on a server, which is the thing
v3 exists to stop. So: accounts are local to the device, passwords are stored only as a salted
hash, and nothing about an account is transmitted. If you want cross-device accounts later,
that is a server, an authority to hold the data, and a different ethics conversation — it is
not this build.

A device may hold several learner accounts. Signing in selects whose profile is in use, which
answers the earlier open question about one learner or several: several.

- **C7.** Every person using the app signs in. Credentials and the account list never leave
  the device, and passwords are never stored in the clear.
- **C8.** Review is reachable only from a teacher account.

| # | Criterion | Decided by |
|---|---|---|
| A15 | A learner account cannot reach the review queue by any route — navigation, deep link, or restored state. | test test_learner_cannot_review |
| A16 | A learner signing in gets their own profile, not the previous learner's. | test test_profile_is_per_account |
| A17 | No stored password is readable in the clear, and no request carries a credential. | test test_credentials_stay_local |

### 10b. The review gate covers all four modes

Supersedes the plan's "Hear Images only" scope. Hear Images, See Sound, Easy Read and Class
Pack all route through the queue, and C1 is therefore true of the whole app rather than one
quarter of it.

| # | Criterion | Decided by |
|---|---|---|
| A18 | For each of the four modes, generated output does not reach the learner's view or the spoken channel until a teacher releases it. | test test_release_gate_all_modes, run once per mode |

The smallest working journey is still built first, on Hear Images, so there is something to
look at early. The other three follow immediately after, in the same task block, before the
build is called finished.

### 10c. An output cache, to save latency and tokens

Identical input returns the stored output instead of calling the model again.

**The key** is a hash of the input media, plus the mode, plus the generation-relevant profile
fields (language, grade, disability, location, culturalContext), plus the model version. Every
one of those is load-bearing: drop the profile fields and a Kannada Grade 6 learner gets output
tailored for an English Grade 10 one; drop the model version and the cache silently serves v2
output after a model change, which would corrupt the very comparison the paper rests on.

**What it stores:** the model's output and that key. **Not** the source photo or clip — C3
says the media is deleted once the item is dealt with, and a cache holding it would quietly
undo that. A hash of the media is not the media. No learner name is in the key or the value,
per C4.

- **C9.** A cache hit never shortens the review path. It saves the model call, not the gate:
  cached output enters the queue unreleased exactly as fresh output does.
- **C10.** The cache is off whenever the model's output is being measured, and every log row
  records whether it was a cache hit.

**Why C10 matters more than it looks.** Step 9 of the build guide says to run each eval case
at least three times, because the model does not say the same thing twice, and one run tells
you about one run. A cache returns the same answer every time by design. With it on during
evals, three runs would produce one model call and two copies — the variation you are trying
to measure would vanish, the numbers would look beautifully consistent, and they would mean
nothing. The same applies to the Step 11 teacher sessions: a second teacher hitting a cached
item is not reviewing the model's output, they are reviewing the first teacher's cache entry,
and the review-duration figure stops being comparable.

So the cache is a production feature that must be inert during measurement. Hence the log
column: when a reviewer asks whether your figures came from live generation, the log answers.

| # | Criterion | Decided by |
|---|---|---|
| A19 | The same input in the same mode with the same profile returns the stored output with no model call. | test test_cache_hit_skips_model |
| A20 | A cache hit still enters the review queue unreleased, and still requires a teacher decision. | test test_cache_hit_still_reviewed |
| A21 | A change to any key component — media, mode, language, grade, disability, location, model version — misses the cache. | test test_cache_key_is_complete |
| A22 | The cache holds no source media and no learner name. | test test_cache_holds_no_media |
| A23 | With eval mode on, every run calls the model and nothing is served from cache. | test test_cache_off_in_eval_mode |
| A24 | Every log row says whether its item came from a cache hit. | test test_log_records_cache_hit |

Amends A9's row shape in section 4: add a cache-hit boolean.

**Where it lives.** On the device, in IndexedDB, alongside the queue and log — same privacy
story as everything else, and it needs no new infrastructure. A shared server-side cache would
save far more tokens across a classroom of devices, but it puts learner-submitted content on a
server and needs its own retention rule, so it is deliberately not in this build. Worth
revisiting after the evaluation, if token cost turns out to matter.

**Open:** a size cap and an expiry. I propose 200 entries, evicting the least recently used,
and no time-based expiry while the model is pinned. Say if you would rather have a date limit.
