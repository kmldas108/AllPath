# v3 plan — the smallest working journey

Proposed 2026-10-03, for approval before any code is written.
Source of truth: specs/review-spec.md. Current state: specs/current-state.md.

**The journey this plan delivers, and nothing more:** a teacher generates one Hear Images
item, reviews it, releases it, and the learner sees it. Not all four modes. Not the
evaluation apparatus beyond the log the journey needs.

## Decisions taken since the spec was drafted

| Question | Answer | Consequence |
|---|---|---|
| One device or two? | **One shared device**, with a different login for teacher and learner | Needs a role switch, task T6 below |
| Test runner for A1-A9 | **Vitest**, existing BDD feature file left alone | T1 |
| Where the queue and log live | **On the device.** Profile in localStorage; queue, log and photos in IndexedDB | T2, T4, T5 |

On the split between localStorage and IndexedDB: the profile is six short fields read on every
render, so localStorage suits it; photos are large binary and the log grows without limit, so
those want IndexedDB. Both are on-device and satisfy C5. Say if you would rather have one
mechanism for all of it.

## Task order

The build guide's order is profile, log, queue, review screen, learner view. T1 comes before
all of them because none of the others can be shown finished without it.

### T1. A test runner that can actually decide A1-A9

- **Implements:** no requirement directly; it is what makes the other deciders real.
- **Why first:** the existing npm test compares values it set itself (see current-state.md).
  A1-A9 cannot be stated honestly in it.
- **Creates:** vitest.config.ts, tests/setup.ts, one trivial test.
- **Changes:** package.json — add vitest + jsdom + @testing-library/react; npm test runs
  Vitest, npm run test:bdd keeps the old runner.
- **Finished when:** npm test runs Vitest green, npm run test:bdd still passes, and a
  deliberately false assertion fails the run.

### T2. The profile lives on the device

- **Implements:** C5, A8.
- **Creates:** services/profileStore.ts — load, save, clear against localStorage.
- **Changes:** App.tsx (hydrate prefs from the store before first paint; delete the dead
  skip-onboarding effect at lines 25-29), components/OnboardingView.tsx and
  components/SettingsModal.tsx (persist on save).
- **Finished when:** test_profile_persists_locally passes — reload the app, onboarding does
  not run, and no network request fires during hydration.

### T3. The learner's name never leaves the device

- **Implements:** C4, A7.
- **Changes:** types.ts (split UserPreferences into the local profile and a GenerationPrefs
  payload with no name field), services/geminiService.ts (send the payload, not the profile),
  server.ts (drop the Name line from the prompt block at lines 82-95 — the spec permits
  touching the prompts for exactly this).
- **Finished when:** test_name_never_leaves passes for all four modes: every outbound request
  body is asserted not to contain the profile name.
- **Open:** whether the prompts should greet the learner neutrally instead. Question 4 below.

### T4. The review log

- **Implements:** A9, A4, and the output half of spec section 4.
- **Creates:** services/reviewLog.ts — append one row, read all, export CSV. Row shape:
  item id, mode, generated at, decided at, decision, edited (bool), review seconds. No name.
- **Finished when:** test_log_one_row_per_decision passes, including that a second click on
  Release does not write a second row.

### T5. The review queue, and the photo that gets deleted

- **Implements:** C3, A5, and the storage half of C1.
- **Creates:** services/reviewQueue.ts — enqueue a generated item with its source photo,
  fetch pending, mark released or discarded, delete the photo on decision.
- **Changes:** App.tsx handleProcessInput — on a result, enqueue instead of
  setMode(AppMode.RESULT). This is the line where the gate actually gets built.
- **Finished when:** test_photo_deleted_on_decision passes: after either decision, reading
  the photo for that item returns nothing.

### T6. Teacher mode and learner mode on one device

- **Implements:** a new constraint from your answer, plus the enforcement half of C1.
- **What I propose:** a passcode, not an account. The device remembers a teacher passcode set
  on first run. Teacher mode is entered by typing it and exited with one tap; learner mode is
  the default state. No server, no identity, no user records.
- **Why not real logins:** the guide's own out-of-scope list says no accounts, and anything
  server-side would put teacher credentials and learner-adjacent data back on a server,
  against C5. If you do want real accounts, say so now — it is a different and much larger
  job, and the spec's out-of-scope section has to change with it.
- **Creates:** components/RoleGate.tsx, services/roleStore.ts.
- **Changes:** App.tsx, types.ts (add the role), constants.ts.
- **Finished when:** a new test test_learner_cannot_review passes — in learner mode the
  review queue is unreachable without the passcode. This is a new acceptance criterion; I
  will add it to the spec as A15 once you approve the approach.

### T7. The review screen

- **Implements:** A3, A6, A11.
- **Creates:** components/ReviewView.tsx — shows the source photo and the model output side
  by side, the output editable, with Release, Edit and Release, and Discard. Starts a timer
  on open and stops it on decision; that figure is the review seconds in T4.
- **Changes:** App.tsx, types.ts (AppMode gains REVIEW), components/ResultView.tsx (follow-up
  questions default off).
- **Finished when:** test_edits_are_what_ships and test_followups_default_off pass. A11 is
  manual and waits for a teacher.

### T8. The learner sees only what was released

- **Implements:** C1, C2, A1, A2, A4.
- **Changes:** components/ResultView.tsx — render from released items only, and do not speak
  anything unreleased (the speechSynthesis path at ResultView.tsx:91 and 119 is a second
  channel to a learner and is governed by C1 too), App.tsx routing.
- **Finished when:** test_release_gate, test_unreleased_is_silent and
  test_discard_leaves_trace all pass.

### T9. Check the checks (build guide Step 8)

- **Implements:** nothing new; it is how we find out whether T1-T8 are worth anything.
- **Creates:** docs/criteria-map.md — every criterion in spec section 5 against the check that
  decides it, with the ones that have no check and the ones needing a person listed plainly.
- **The deliberate break:** on a throwaway copy, remove the release check in ResultView and
  run the suite. test_release_gate must fail. If the suite stays green the tests are not
  testing what they claim and T8 is not finished. Then throw the copy away.
- **Finished when:** the map has no unexplained gaps and the break was caught.

## What is still unchecked when this plan is done

- A10 (version on screen) — waits for the freeze at Step 10.
- A11 (a teacher can use it unaided) — needs a person, and one who is not among your Step 5
  or Step 11 educators.
- A12-A14 — the [T1] placeholders, waiting on your two teacher conversations.
- The quality of the model's output — that is Step 9 and the evals/ folder, a separate job
  from everything above.
- See Sound, Easy Read and Class Pack still bypass the queue after this plan. The gate is
  built once in App.tsx, so extending it to the other three is small, but it is not in this
  plan and C1 is therefore only true for Hear Images until it is done. **This is the largest
  honest gap in the plan — flagging it rather than quietly scoping it out.**

## What the spec leaves unclear

1. **Accounts versus a passcode.** T6 above. Your "login is different for each" against the
   guide's "no accounts". I have assumed a local passcode.
2. **One learner per device, or several?** If several, the profile store holds a set of
   profiles and the learner login picks one, which changes T2 and probably T6. I have assumed
   one learner profile per device.
3. **What the learner sees after release.** Immediately on the shared screen when the teacher
   hands the device over, or a list of released items the learner opens themselves? I have
   assumed the former, which is simpler and matches a teacher passing a tablet across.
4. **The greeting.** C4 removes the name from the prompt. Drop the greeting entirely, or
   greet with a neutral word held locally? I have assumed dropped.
5. **location.** Still sent to the server for the regional analogy. Confirm that is acceptable
   to your ethics approval, since it is the one profile field that still leaves the device.

## Approval

Nothing above is built yet. On your go, T1 through T9 in order, and after each one I report
which criteria now pass and how you can see it for yourself.

---

# Revision 2 — 2026-10-03

Kamal's three changes, folded in. Everything not mentioned here stands as written above.

**T6 is replaced.** The passcode proposal is dead; see spec section 10a.

### T6 (revised). Local accounts and login

- **Implements:** C7, C8, A15, A16, A17.
- **Creates:** services/accountStore.ts (account list, salted password hashes via Web Crypto —
  never plain text, never transmitted), components/LoginView.tsx.
- **Changes:** App.tsx (login before anything else; sign-out), types.ts (Account, Role),
  services/profileStore.ts from T2 (profiles become per-account, keyed by account id —
  several learners per device).
- **Finished when:** test_learner_cannot_review, test_profile_is_per_account and
  test_credentials_stay_local pass.
- **Note:** T2 gets written per-account from the start rather than retrofitted, so the order
  stays T2 then T6 but T2's store takes an account id.

### T10 (new). The gate covers all four modes

- **Implements:** C1 in full, A18.
- **Changes:** App.tsx (the one enqueue point serves all four modes),
  components/ResultView.tsx and components/ClassPackForm.tsx (routing), nothing in the
  prompts.
- **Finished when:** test_release_gate_all_modes passes once per mode — four runs, not one
  with a loop that could pass on the first and never reach the rest.

### T11 (new). The output cache

- **Implements:** C9, C10, A19-A24.
- **Creates:** services/outputCache.ts — key from hash(media) + mode + language + grade +
  disability + location + culturalContext + model version; stores output only; LRU at 200
  entries; a single exported eval-mode switch that disables reads and writes.
- **Changes:** services/geminiService.ts (consult the cache before the request, write after),
  services/reviewLog.ts from T4 (add the cache-hit column), server.ts only if the hash has to
  be computed server-side — preferably not, so the media never needs re-sending on a hit.
- **Finished when:** A19-A24 pass, and in particular test_cache_hit_still_reviewed, which is
  the one protecting C1 from the cache.
- **Order:** last of the build tasks, after T10. A cache over a half-built gate is a way to
  cache a bug.

### T9 moves to the end

Check the checks runs after T11, and the deliberate break now covers two things: remove the
release check and test_release_gate_all_modes must fail; force a cache hit on an unreleased
item and test_cache_hit_still_reviewed must fail.

## Revised order

T1 harness · T2 profile (per account) · T3 name never leaves · T4 log · T5 queue + photo
deletion · T6 accounts and login · T7 review screen · T8 learner sees only released · T10 all
four modes · T11 cache · T9 check the checks.

## What is still unchecked when this is done

A10 (freeze), A11 (a teacher unaided), A12-A14 (the [T1] placeholders from your Step 5
conversations), and the quality of the model's output, which is Step 9 and the evals folder.
The "Hear Images only" gap from revision 1 is closed by T10.
