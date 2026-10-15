#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-factory-why-hackathon}"

required_firebase_vars=(
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
)

missing_firebase_vars=()
for var_name in "${required_firebase_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    missing_firebase_vars+=("$var_name")
  fi
done

if ((${#missing_firebase_vars[@]} > 0)); then
  printf 'Missing Firebase web config environment variables: %s\n' "${missing_firebase_vars[*]}" >&2
  echo "Export the public Firebase Web App values from Firebase Console before deploying." >&2
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI is required. Install it with 'npm install -g firebase-tools'." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm is required to build the frontend." >&2
  exit 1
fi

npm ci
VITE_RUNTIME_MODE=PRODUCTION VITE_API_BASE_URL= npm run build
firebase deploy --only hosting --project "$PROJECT_ID"
