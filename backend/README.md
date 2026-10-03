# Factory WHY Backend - Phase 1

This folder contains the Phase 1 backend slice for Factory WHY: a minimal
FastAPI application, a deterministic simulator ported from the frontend, and
fixture-backed endpoints used for local development and tests.

Important: Phase 1 is intentionally isolated. It does NOT integrate with
ADK / Vertex AI, Firestore, BigQuery, Cloud Storage, or Firebase Auth.

System requirements
- Python 3.12 (recommended). The code and tests were validated under
  Python 3.12.

Dependencies and packaging
- The backend declares dependencies in `backend/pyproject.toml`.
- Minimal runtime dependencies: FastAPI, Pydantic (v2), Uvicorn.
- Dev/test dependencies: pytest, httpx

Create and sync a development environment (example, macOS / Linux):

1. Create a Python 3.12 virtualenv:

   python3.12 -m venv .venv
   source .venv/bin/activate

2. Install dependencies into the venv (example):

   python -m pip install --upgrade pip
   python -m pip install fastapi pydantic uvicorn pytest httpx

   (Or use your preferred tooling reading `backend/pyproject.toml`.)

Running tests
- To run the Phase 1 backend tests:

  pytest -q backend/tests

  Tests assert schema validation, deterministic simulator parity, API
  endpoints, SSE content, and fixture parity checks.

Running FastAPI locally
- Start the server locally for manual testing:

  uvicorn backend.app.main:app --reload --port 8000

- The API is mounted under the prefix `/api`.

Fixture-backed architecture
- The backend owns a Phase 1 JSON fixture at `backend/fixtures/cnc04-primary.json`.
- The fixture was derived from the frontend canonical baseline at
  `src/data/mockScenarios.ts` and contains the full InvestigationCase object
  required by the Phase 1 Pydantic schemas and API.
- The repository intentionally does NOT parse TypeScript at runtime. Instead
  the backend reads its own JSON fixture. Tests include a parity check to
  detect drift between the frontend TypeScript source and the backend JSON
  fixture.

Available Phase 1 API endpoints (fixture-backed)
- GET  /api/health                       -> health check
- GET  /api/incidents/{incident_id}      -> return InvestigationCase fixture
- GET  /api/incidents/{incident_id}/audit-> return audit trail
- GET  /api/incidents/{incident_id}/stream -> server-sent events (SSE) demo stream
- POST /api/incidents/{incident_id}/simulate -> run deterministic simulator (Pydantic params)
- POST /api/incidents/{incident_id}/challenge -> return fixture-shaped critic finding

Notes on the SSE endpoint
- The SSE endpoint is fixture-driven for Phase 1. It returns a small
  sequence of events for the UI demo. For Phase 1 it is implemented as a
  synchronous generator with a short sleep for predictability; convert to an
  async generator if you migrate to production.

Deterministic simulator
- The simulator implementation was ported from `src/data/mockScenarios.ts`.
- It produces three ordered options: CONTINUE, INSPECT, REPAIR. Unit tests
  validate numerical outputs and trace strings.

Phase 2 integrations
- This slice intentionally omits production integrations. The following are
  NOT implemented in Phase 1 and will be added only in Phase 2 with
  explicit approval: ADK, Vertex AI, Firestore, BigQuery, Cloud Storage,
  Firebase Auth.

Developer notes
- The backend tests include a parity check that ensures a small set of
  canonical values from `backend/fixtures/cnc04-primary.json` are present in
  `src/data/mockScenarios.ts` to detect drift between frontend and backend
  representations. This test fails loudly when a mismatch is detected.

If you want me to prepare a commit combining these Phase 1 changes, say so.
