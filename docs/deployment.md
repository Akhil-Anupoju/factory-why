# GCP deployment runbook

Factory WHY's intended deployment is a React app on Firebase Hosting, with
FastAPI on Cloud Run, using the existing project and runtime identity:

- Project: `factory-why-hackathon`
- Region: `asia-south1`
- Cloud Run service: `factory-why-api`
- Runtime service account: `factory-why-runtime@factory-why-hackathon.iam.gserviceaccount.com`
- Firebase Hosting and Authentication project: `factory-why-hackathon`

## Deployment files

- `Dockerfile` builds the backend image from `backend/` and listens on Cloud
  Run's `$PORT`.
- `.dockerignore` excludes local dependencies, credentials, and build output.
- `firebase.json` serves `dist/`, rewrites `/api/**` to Cloud Run, and routes
  the remaining paths to the React SPA.
- `.firebaserc` selects the existing Firebase project.
- `scripts/deploy-backend-gcp.sh` builds and deploys the Cloud Run service.
- `scripts/deploy-frontend-firebase.sh` builds and deploys Firebase Hosting.

## One-time prerequisites

1. Install and authenticate the Google Cloud and Firebase CLIs:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   npm install --global firebase-tools
   firebase login
   ```

2. Set the active project and verify billing:

   ```bash
   gcloud config set project factory-why-hackathon
   gcloud billing projects describe factory-why-hackathon
   ```

3. Enable required APIs (the deploy script creates the Artifact Registry
   repository if needed):

   ```bash
   gcloud services enable \
     run.googleapis.com \
     cloudbuild.googleapis.com \
     artifactregistry.googleapis.com \
     aiplatform.googleapis.com \
     firestore.googleapis.com \
     bigquery.googleapis.com \
     storage.googleapis.com \
     --project=factory-why-hackathon
   ```

4. Verify that the runtime service account exists and has the roles documented
   in `docs/factory-why-environment.md` (Vertex AI User, BigQuery Job User,
   Datastore User, Logging Log Writer, dataset-scoped BigQuery access, and
   bucket-scoped Storage access). Grant `roles/run.invoker` to the Cloud Run
   service agent/runtime as required by the project's deployment policy.
   The human/deployment identity needs permission to submit Cloud Build jobs,
   write to the Artifact Registry repository, deploy Cloud Run, and attach the
   runtime service account (`roles/iam.serviceAccountUser`).

5. Verify Firebase Authentication's Google provider and authorized domains
   include the Firebase Hosting domains. Do not put service-account JSON or
   Gemini credentials in frontend environment variables.

6. Set up Firebase Hosting once if it is not already initialized for this
   Firebase project. This repository's `firebase.json` is the source of truth;
   do not replace it with an interactive `firebase init` result.

## Deploy

Deploy the API first:

```bash
GCP_PROJECT=factory-why-hackathon GCP_REGION=asia-south1 bash scripts/deploy-backend-gcp.sh
```

The script deploys with Cloud Run unauthenticated ingress so Firebase Hosting's
server-side `/api/**` rewrite can reach it. Application routes still verify
Firebase ID tokens for protected operations. Keep authorization in the API;
Cloud Run ingress settings are not a substitute for Firebase token checks.

Check the health endpoint and retrieve the URL:

```bash
gcloud run services describe factory-why-api \
  --project=factory-why-hackathon --region=asia-south1 \
  --format='value(status.url)'
```

```bash
curl "$(gcloud run services describe factory-why-api --project=factory-why-hackathon --region=asia-south1 --format='value(status.url)')/api/health"
```

Then deploy the frontend:

```bash
export VITE_FIREBASE_API_KEY="..."
export VITE_FIREBASE_AUTH_DOMAIN="factory-why-hackathon.firebaseapp.com"
export VITE_FIREBASE_PROJECT_ID="factory-why-hackathon"
export VITE_FIREBASE_STORAGE_BUCKET="factory-why-hackathon.firebasestorage.app"
export VITE_FIREBASE_MESSAGING_SENDER_ID="..."
export VITE_FIREBASE_APP_ID="..."
GCP_PROJECT=factory-why-hackathon bash scripts/deploy-frontend-firebase.sh
```

Get the public web configuration values from the Firebase Console's Web App
settings. They are browser configuration, not service-account credentials, but
must still match this Firebase project. The script refuses to build if any
required value is absent.

The frontend uses same-origin `/api` requests; Firebase Hosting proxies them to
the Cloud Run service. This avoids exposing the Cloud Run URL in the browser
and avoids cross-origin browser requests in production.

## Runtime configuration

The backend deploy script sets production mode, the canonical project, Firestore
database, BigQuery dataset/table, GCS bucket, Vertex AI provider/model and
Vertex AI client mode (`GOOGLE_GENAI_USE_VERTEXAI=true` with explicit project
and location), and Firebase Hosting CORS origins. Cloud Run uses its attached runtime service
account through Application Default Credentials; do not upload a service-account
key. Configure any new secrets with Secret Manager rather than source files or
plain committed environment files.

If the Hosting domain changes, update `ALLOWED_ORIGINS` in
`scripts/deploy-backend-gcp.sh` and redeploy the backend. Firebase Hosting's
same-origin proxy is the production API path; CORS is primarily needed for
local development and any explicitly permitted direct browser origin.

## Verify after deployment

1. Open the Firebase Hosting URL and sign in with Google.
2. Confirm the incident selector loads `GET /api/incidents`.
3. Open a fresh pending incident and verify telemetry/evidence/hypotheses load.
4. Run **Challenge the hypothesis** and **Request Evidence**; verify success or
   explicit error toasts, and confirm the audit trail reflects completed calls.
5. Confirm the Decision Readiness Check recomputes from the refreshed server
   state and that overlapping live actions are disabled.
6. Exercise approval, simulated action, and outcome only on a disposable test
   incident. Do not use the resolved reference case for destructive test flows.
7. Review Cloud Run logs for startup/auth/model errors and confirm no credentials
   or tokens appear in logs.

## Test incident fixtures

The test set and targeted seed instructions are in
[`test-incidents-firestore.md`](./test-incidents-firestore.md). Seed with
Application Default Credentials before the demo; the seed command is dry-run by
default and should only use the intended new IDs or a fresh replay ID.

## Local checks

```bash
backend/.venv/bin/python -m pytest -q backend/tests
npm ci
npm run lint
npm test
npm run build
```

Deployment preparation does not deploy cloud resources. Run the two deploy
scripts only after confirming project, IAM, APIs, Firebase domains, and billing.
