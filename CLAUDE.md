# Samaveshi — notes for the coding tool

**What this is.** A multimodal learning aid for learners facing language, disability, or
comprehension barriers. Four modes (Hear Images, See Sound, Easy Read, Class Pack) send a
photo, clip, or passage to Gemini and show an adapted result. React 19 + Vite front end,
Express server in `server.ts`, regional-analogy MCP server in `services/`.

**Where the written decisions live.**
- `specs/current-state.md` — what v2 does today, before any v3 change.
- `specs/review-spec.md` — what v3 must do. **This is the source of truth.**
- `evals/` — test cases for the quality of the model's output (a separate job from tests).
- `docs/build-log.md` — one line per change, with the requirement it serves.

**How to run things.** `npm run dev` (server + Vite on one port) · `npm test` (BDD runner over
`features/*.feature`) · needs `GEMINI_API_KEY` in `.env`, else the server serves canned output.

**Ask before changing anything not named in the spec.** In particular, do not touch the four
mode prompts in `server.ts` or `services/regionalContextMcpServer.ts` — they are not part of
the v3 job. Do not change the model version; v3 is measured against `gemini-2.5-flash`.
