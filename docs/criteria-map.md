# Every criterion against the check that decides it

Build guide Step 8. Written 2026-10-03 from specs/review-spec.md, not from the code.
Suite: `npm test` — 49 tests, 5 files, all passing. `npm run typecheck` clean.

## Decided by a test, and passing

| # | Criterion | Check | File |
|---|---|---|---|
| A1 | Output does not reach the learner until Release | test_release_gate | tests/releaseGate.test.ts |
| A2 | An unreleased item is absent from screen and speech | test_unreleased_is_silent | tests/releaseGate.test.ts |
| A3 | The learner sees the teacher's edits, not the model's text | test_edits_are_what_ships | tests/releaseGate.test.ts |
| A4 | A discarded item never appears, and leaves a row | test_discard_leaves_trace | tests/releaseGate.test.ts |
| A5 | The source photo is gone after a decision | test_photo_deleted_on_decision | tests/releaseGate.test.ts |
| A6 | Follow-ups start off | test_followups_default_off | tests/releaseGate.test.ts |
| A7 | No request carries the learner's name, all four modes | test_name_never_leaves | tests/privacy.test.ts |
| A8 | The profile survives reload with no network call | test_profile_persists_locally | tests/privacy.test.ts |
| A9 | One log row per decision, with review seconds | test_log_one_row_per_decision | tests/reviewLog.test.ts |
| A15 | A learner cannot reach the review queue | test_learner_cannot_review | tests/roleGate.test.tsx |
| A16 | Each learner account has its own profile | test_profile_is_per_account | tests/privacy.test.ts |
| A17 | No password in the clear, no credential on the wire | test_credentials_stay_local | tests/privacy.test.ts |
| A18 | The gate holds for all four modes | test_release_gate_all_modes | tests/releaseGate.test.ts |
| A19 | Identical input skips the model call | test_cache_hit_skips_model | tests/cache.test.ts |
| A20 | A cache hit still needs a teacher's decision | test_cache_hit_still_reviewed | tests/cache.test.ts |
| A21 | Any key component changing misses the cache | test_cache_key_is_complete | tests/cache.test.ts |
| A22 | The cache holds no media and no name | test_cache_holds_no_media | tests/cache.test.ts |
| A23 | Eval mode calls the model every time | test_cache_off_in_eval_mode | tests/cache.test.ts |
| A24 | Every log row records cache hit or miss | test_log_records_cache_hit | tests/cache.test.ts |

## Decided by a person, not yet done

| # | Criterion | Procedure | Blocked on |
|---|---|---|---|
| A10 | Version on screen matches the deployed tag | Read the footer on the deployed URL against `git describe --tags`, record in the build log | Step 10 freeze. **The version footer is not built yet** — see the gap below |
| A11 | A teacher can review and release unaided | One educator, not from Step 5 or Step 11, handed the device with no instruction; passes if they release within two minutes without asking what a control does | A person |
| A12-A14 | Requirements from teachers | — | Your Step 5 conversations |

## The deliberate break

Run twice on a throwaway copy of services/reviewQueue.ts, then restored.

1. **Gate removed** — `releasedItemsFor` stopped filtering on `status === 'released'`, so the
   learner query returned everything. **9 tests failed**: A1, A2, A4, A18 (all four modes),
   A20, and the rendered-app check in A15. The suite caught it.
2. **Cache bypassing the gate** — a cache hit enqueued as `released` instead of `pending`.
   **2 tests failed**: A20 and A24. The suite caught it.

Both breaks were reverted and the suite is green again. This is the evidence that A1-A24 are
load-bearing rather than decorative.

## Gaps, stated plainly

- **A10 has no implementation yet.** Nothing renders a version string on screen. The criterion
  cannot pass until the freeze task adds one; it is not a failing test, it is an absent
  feature, and it belongs to Step 10.
- **The model's output quality is untested here.** That is Step 9 and the evals/ folder, a
  different job. Nothing in this suite says the AI is any good — only that the app does what
  the spec says with the output it gets.
- **`npm run test:bdd` fails on this machine, for reasons that predate this build.** The
  pre-existing BDD runner spawns the regional-context MCP server through `npx tsx` with an
  8-second timeout (services/mcpClient.ts:136). Cold start alone measured 5.0s here, so the
  handshake times out. Those files are in the spec's must-not-change list, so the timeout was
  left alone. Confirmed untouched: `git diff main -- services/mcpClient.ts
  services/regionalContextMcpServer.ts scripts/runTests.ts features/` is empty.
- **The two tautological assertions in the old BDD runner are still there**, by the same
  must-not-change rule. They are documented in specs/current-state.md. The new suite does not
  rely on them.
