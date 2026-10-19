# Deploying AllPath to Cloud Run

For the IISc submission, which requires a URL where the project can be seen running.

**The $300 credit works here.** Gemini API usage is excluded from the Cloud Free Trial, but
Cloud Run and Cloud Build are ordinary Cloud services, so hosting is covered. The model calls
run on the Gemini free tier.

These steps need your Google account, so they are yours to run — `gcloud auth login` is
interactive and cannot be done from a non-interactive shell.

## Before you start

Neither `gcloud` nor Docker is installed on this machine. Docker is not needed:
`gcloud run deploy --source` builds in Cloud Build, using the Dockerfile already in the repo.

```bash
winget install --id Google.CloudSDK -e --accept-package-agreements --accept-source-agreements
```

Restart the terminal afterwards so `gcloud` lands on PATH.

## 1. Sign in and pick the project

```bash
gcloud auth login
```

```bash
gcloud config set project YOUR_PROJECT_ID
```

Use the same project the Gemini API key belongs to, so billing and quota live in one place.

## 2. Enable the services

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 3. Put the API key in Secret Manager

Not an environment variable on the service: env vars are visible to anyone who can read the
service config, and they end up in deployment history. Replace `PASTE_KEY_HERE` and run:

```bash
printf '%s' 'PASTE_KEY_HERE' | gcloud secrets create allpath-gemini-key --data-file=-
```

Then let the Cloud Run runtime service account read it:

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)') && gcloud secrets add-iam-policy-binding allpath-gemini-key --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
```

## 4. Deploy

```bash
gcloud run deploy allpath --source . --region asia-south1 --allow-unauthenticated --max-instances 2 --set-secrets GEMINI_API_KEY=allpath-gemini-key:latest
```

- `asia-south1` is Mumbai — closest to you and to any teacher who tries it.
- `--allow-unauthenticated` is required: the submission URL has to open for your instructor.
- `--max-instances 2` is a deliberate cap. See the warning below.

The command prints the service URL. That is what goes in the submission form.

## 5. Check it is actually working

```bash
curl -s https://YOUR-SERVICE-URL/api/health
```

Should return `{"status":"ok"}`. Then the check that matters more:

```bash
gcloud run services logs read allpath --region asia-south1 --limit 50
```

Generate something in the app first, then look for:

```
[analyze-content] Request received. mode=HEAR_IMAGES, isApiKeyMock=false
```

`isApiKeyMock=false` means the key arrived. If you instead see the loud
`LIVE MODEL CALL FAILED` line, the app is serving built-in sample text and the review screen
will say so — that is the behaviour added in spec 10e, and it is the thing to watch for during
a demo.

## Two things to be clear-eyed about

**The URL is public, and so is your quota.** The app's accounts are device-local by design
(spec C5, C7) — there is no server-side auth, so anyone with the link can use the app and
spend your Gemini free-tier quota. For a submission demo that is an acceptable trade; it is
not a posture to leave running indefinitely. `--max-instances 2` limits the blast radius.
Afterwards, either delete the service or put Cloud Run IAM in front of it.

**A hosted success is evidence about that environment at that time.** The course reader makes
this point directly (Chapter 9): a deployment that worked once is not proof that every
recovery path works. The controlled failure case for the presentation is better shown from the
test suite — removing the release filter fails 9 tests — than from the live service.

## Tearing it down

```bash
gcloud run services delete allpath --region asia-south1
```

## If the container will not start

The usual cause is the port. Cloud Run assigns one through `PORT` and marks a container that
ignores it as unhealthy. `server.ts` reads `process.env.PORT` with 3000 as the local default —
it was hardcoded to 3000 until 2026-10-19, so an older checkout will fail this way.
