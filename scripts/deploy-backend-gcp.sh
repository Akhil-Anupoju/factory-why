#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-factory-why-hackathon}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE="${CLOUD_RUN_SERVICE:-factory-why-api}"
RUNTIME_SA="${CLOUD_RUN_SERVICE_ACCOUNT:-factory-why-runtime@factory-why-hackathon.iam.gserviceaccount.com}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/factory-why/${SERVICE}:$(git rev-parse --short HEAD)"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required. Install it and run 'gcloud auth login'." >&2
  exit 1
fi

if ! gcloud config get-value project 2>/dev/null | grep -qx "$PROJECT_ID"; then
  echo "Setting active gcloud project to ${PROJECT_ID}."
  gcloud config set project "$PROJECT_ID" >/dev/null
fi

if ! gcloud artifacts repositories describe factory-why --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create factory-why \
    --repository-format=docker \
    --location="$REGION" \
    --description="Factory WHY Cloud Run images" \
    --project="$PROJECT_ID"
fi

gcloud builds submit . \
  --project="$PROJECT_ID" \
  --tag="$IMAGE"

gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$RUNTIME_SA" \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --min=0 \
  --max=3 \
  --env-vars-file=deploy-env.yaml

SERVICE_URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo "Backend deployed: ${SERVICE_URL}"
echo "Health: ${SERVICE_URL}/api/health"
