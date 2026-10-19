# IISc submission runbook

Everything still outstanding, in order, with the commands. Written 2026-10-19.

Commands are **PowerShell**, since that is the shell on this machine. Where Git Bash differs
it is called out. Times are rough.

The form needs four things: a title and abstract, a **deployed URL** (or an unlisted YouTube
demo), a **session transcript URL**, and a **design walkthrough URL**. The walkthrough is
already live at <https://kmldas108.github.io/AllPath/walkthrough.html>.

---

## Step 1 — Merge PR #1 (2 minutes, you)

Until this merges, `main` is still v2 and the released app has no review gate. Everything
else builds on it.

I tried and was refused: the permission classifier blocked `gh pr merge` as "Merge Without
Review". I did not route around it. Do it yourself:

1. Open <https://github.com/kmldas108/AllPath/pull/1>
2. **Merge pull request** → **Confirm merge**

Both checks are green and the PR is `MERGEABLE`, so there is nothing to fix first.

Then bring your local copy in line:

```
git checkout main
git pull allpath main
```

Afterwards tell me, and I will repoint GitHub Pages from the branch to `main` — right now the
walkthrough is served from `v3-review-gate`, which works but is odd once the branch is merged.

---

## Step 2 — Confirm the fallback fix works (5 minutes, optional but worth it)

Already built and committed. This is how you *see* it, which matters because it is the thing
most likely to embarrass you in a live demo.

With no key configured:

```
npm run dev
```

Sign in as a teacher, generate anything, and look at the review screen. You should see an
amber banner saying the content did not come from the AI. Then check the console for:

```
[analyze-content] Request received. mode=..., isApiKeyMock=true
```

That is the honest behaviour. Before this fix, the same situation showed polished Kannada
content with no warning at all.

And the suite:

```
npm test
```

56 tests, 6 files. If anything fails, stop and tell me before deploying.

---

## Step 3 — Deploy to Cloud Run (20–30 minutes, you)

Your $300 credit **does** cover Cloud Run and Cloud Build. It does not cover Gemini API usage
— that runs on the free tier. Full detail in `docs/deploy.md`; this is the short path.

### 3.1 Install the CLI

```
winget install --id Google.CloudSDK -e --accept-package-agreements --accept-source-agreements
```

Close and reopen the terminal so `gcloud` is on PATH.

### 3.2 Sign in and choose the project

```
gcloud auth login
```

```
gcloud config set project YOUR_PROJECT_ID
```

Use the project your Gemini key belongs to, so quota and billing sit together.

### 3.3 Enable the services

```
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 3.4 Store the key — carefully

**Do not pipe the key into `gcloud` in PowerShell.** PowerShell appends a CRLF, and a trailing
newline inside an API key produces authentication failures that look like a bad key. Write the
file without a newline instead:

```
[IO.File]::WriteAllText("$env:TEMP\k.txt", "PASTE_YOUR_KEY_HERE")
```

```
gcloud secrets create allpath-gemini-key --data-file="$env:TEMP\k.txt"
```

```
Remove-Item "$env:TEMP\k.txt"
```

In Git Bash the one-liner `printf '%s' 'KEY' | gcloud secrets create allpath-gemini-key --data-file=-` is safe, because `printf` adds nothing.

Let the Cloud Run service account read it:

```
$PN = gcloud projects describe (gcloud config get-value project) --format='value(projectNumber)'; gcloud secrets add-iam-policy-binding allpath-gemini-key --member="serviceAccount:$PN-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
```

### 3.5 Deploy

```
gcloud run deploy allpath --source . --region asia-south1 --allow-unauthenticated --max-instances 2 --set-secrets GEMINI_API_KEY=allpath-gemini-key:latest
```

First build takes a few minutes. The command prints the service URL — that is the submission
URL.

### 3.6 Verify it is really working

```
curl.exe -s https://YOUR-SERVICE-URL/api/health
```

Expect `{"status":"ok"}`. Then generate something in the browser and check the logs:

```
gcloud run services logs read allpath --region asia-south1 --limit 50
```

Look for `isApiKeyMock=false`. **That line is the deployment actually working.** A page that
loads proves only that the container started.

If you see `LIVE MODEL CALL FAILED`, the key did not arrive or has no quota — check for the
trailing-newline problem from 3.4 first.

---

## Step 4 — Run the evals (15 minutes, you; then 20 minutes reading)

This is the weakest area against the course rubric, which explicitly covers AI quality where
a project contains a runtime model. Three cases will not fix that, but they move it from
nothing to something defensible.

### 4.1 Put the key in `.env`

```
Copy-Item .env.example .env
```

Open `.env`, set `GEMINI_API_KEY=your-key`, save. Then confirm it cannot be committed:

```
git check-ignore -v .env
```

It must print a `.gitignore` line. If it prints nothing, stop — the repo is public.

### 4.2 Start the server in measurement mode

In its own terminal:

```
$env:ALLPATH_EVAL_MODE=1; npm run dev
```

Measurement mode means the server returns an error instead of built-in sample text when a
model call fails. That is deliberate: a failed run must look like a failure, not like a
suspiciously tidy result.

### 4.3 Run the harness

In a second terminal:

```
npm run eval
```

Nine calls total — three cases, three runs each — so free-tier rate limits are not a concern.
It prints a count per case and writes every raw output to `evals/results/`.

If it aborts saying a response was not `generationSource: "model"`, that is the harness
refusing to score canned text. Fix the key rather than the harness.

### 4.4 Read the outputs — this part is not optional

The code checks decide only the hard-edged parts: the term is present, the amount is exact,
no name appears. Two cases need you:

- **07** — if the amount passed but the date string did not match, open the output and decide
  whether the twelfth of November is actually stated. A translated month name will not match a
  literal string. Record what you decided.
- **08** — read the parent message and answer one question: if a parent read this aloud, would
  it make sense addressed to them? Pass or fail, per run.

Each case folder's `expected.md` holds the procedure. Write your verdicts down somewhere
permanent with the date — `evals/results/` is gitignored because the raw files are run
artefacts.

### 4.5 Report it as counts

"7 of 9 runs kept the term" says something. "Highly accurate" says nothing and a reviewer will
mark it. Always give the model version, the date, and the number of repeats — the harness
records all three alongside the results.

**State the limit plainly in the submission:** three cases, all on the text-based Class Pack
path. They say nothing about Hear Images or See Sound, which are the modes the accessibility
argument rests on. Owning that is worth more than hoping nobody asks.

---

## Step 5 — The walkthrough (done)

Live: <https://kmldas108.github.io/AllPath/walkthrough.html>

Paste that into the "Design decision walkthrough" field. It covers the six parts, one full
journey, four failure cases, what the log can and cannot tell you, built versus planned, and
the three deliberate breaks.

Read it once before the interview. It is the structure the course reader's §9.10 asks for, so
it doubles as your preparation: goal and boundaries, one design choice with the alternative
considered, the journey plus a controlled failure, evidence with counts, and what remains
unverified.

---

## Step 6 — The three remaining form fields (30 minutes)

**Project title and abstract.** Not written. Offer to draft from the specs — say the word.

**Session transcript URL.** The form wants a clickable link to the record of your work. Options,
best first:

1. Export this Claude Code session and commit it to the repo, then link the GitHub Pages or
   blob URL. Durable, and tied to the project.
2. The `.antigravity/` session transcript already in the repo — it is a real record, though a
   machine-readable one.
3. A Google Doc export, set to view-only by link.

**Deployed URL.** From step 3.6.

---

## The order that wastes least time

1. Merge (2 min) — everything else assumes it
2. Key into `.env` (5 min)
3. Evals (15 min running, 20 min reading) — do this before deploying, while iteration is cheap
4. Deploy (30 min)
5. Title, abstract, transcript link (30 min)
6. Read the walkthrough once, then submit

Evals before deploy on purpose: if the model output is poor, you want to know while the app is
still on your laptop.
