 # Factory WHY Backend - Phase 2 (Architecture Summary)

 This backend slice implements Phase 2 infrastructure: an application
 factory with dependency injection, typed repository boundaries, an
 EvidenceService that validates evidence and preserves provenance, and a
 small set of read-only allowlisted tools. The implementation preserves the
 Phase 1 fixture-backed API contracts while enabling a clear path to
 production adapters for Firestore, BigQuery and Cloud Storage.

 Key concepts
 - Application factory / dependency injection: use `create_app(settings)`
   from `backend/app/app_factory.py` to create a FastAPI application wired
   with the desired repositories and services. The factory stores runtime
   dependencies on `app.state.deps` and exposes small FastAPI dependency
   getters (eg. `get_incident_repo`, `get_evidence_service`) used by
   route handlers.

 - Local / test mode: by default the app runs in LOCAL mode and uses
   in-memory repository fakes (`backend/app/repositories/in_memory.py`) so
   unit tests and local development do not require cloud credentials.

 - Production adapters: the application factory contains production
   adapters (lazy-imported) for Firestore, BigQuery, and GCS in
   `backend/app/repositories/{firestore_repo.py,bigquery_repo.py,storage_repo.py}`.
   Those adapters are only constructed when the factory is invoked with
   `runtime_mode=PRODUCTION` and the google-cloud libraries are available.

 Repositories and boundaries
 - IncidentRepository: read/write and list incidents.
 - EvidenceRepository: list/get/upsert evidence items.
 - AuditRepository: list/append audit events.
 - TelemetryRepository: query telemetry rows (used by EvidenceService to
   normalize telemetry into EvidenceItem objects).
 - StorageRepository: metadata listing and object metadata retrieval.

 EvidenceService
 - `backend/app/services/evidence_service.py` performs evidence
   normalization and validation. It validates all evidence items with the
   Pydantic `EvidenceItem` schema and filters out `inferred`/generated
   evidence. Telemetry rows are normalized to EvidenceItems and validated
   as well.

 Allowlisted read-only tools
 - Implemented as thin wrappers that delegate to repositories and
   EvidenceService (business logic remains in services/repositories).
 - Tools (read-only):
   - `get_asset_context` — returns typed asset metadata for a given asset_id
   - `get_telemetry_window` — returns a time-windowed telemetry point list
     (aggregates sensor channels into TelemetryPoint objects)
   - `get_maintenance_history` — returns maintenance work orders derived
     from validated evidence items (observed only)
   - `search_manual` — simple asset-scoped manual text search over
     service-manual evidence (no external search infra)
   - `get_prior_incidents` — returns prior incident summaries for an asset
   - `get_inspection_image` — returns inspection image metadata and storage
     repository metadata derived from evidence provenance

 - Tool contracts are explicitly typed with Pydantic models in
   `backend/app/tools/tool_impl.py` and the wrappers never call databases
   directly or construct arbitrary URLs. get_inspection_image uses the
   StorageRepository to obtain metadata; it does not produce signed URLs.

 Fixture seeding
 - The canonical Phase 1 fixture is `backend/fixtures/cnc04-primary.json`.
 - Seed helpers (`backend/app/seed/seed_from_fixture.py`) populate the
   InMemory repositories for tests and local runs. Tests seed explicitly
   from the fixture; seeding is not automatic in test setup to avoid
   accidental cloud writes.

Development notes
 - Python 3.12 is the supported runtime for local development and CI.
 - Runtime dependencies are declared in `backend/pyproject.toml`.
- Run tests locally:
    - `pytest -q backend/tests`
 - Run the FastAPI app for manual testing:
   - `uvicorn backend.app.main:app --reload --port 8000`

Safety and constraints
- Unit tests and local runs do NOT use production cloud clients; the
  production adapters are lazy-imported and only created when
  `runtime_mode=PRODUCTION` and the google-cloud libraries are installed.
- The codebase must not include service-account keys or secrets in source.
- ADK / Gemini / Vertex AI / Cloud write workflows are Phase 3 work and
  are explicitly out of scope for Phase 2.

Authentication (Phase 4C)
  - Approval and Action endpoints require Firebase ID tokens passed in the
    `Authorization: Bearer <ID_TOKEN>` header. Tokens are verified server-side
    by the application using an AuthService that encapsulates the verification
    boundary.
  - Actor identity is authoritative only when derived from the verified token
    (the server uses the token uid for audit records). Do NOT rely on any
    `actor` field supplied in the request body.
  - For local tests the AuthService is replaceable (injected into
    `app.state.auth_service`) and tests use a fake AuthService so no Firebase
    credentials or network calls are required.
  - Production verification uses Application Default Credentials / runtime
    identity. Do NOT commit service account JSON keys to source.

  Additional notes (REST / SSE contract):

  - REST endpoints that modify state (for example: `/incidents/{id}/approve`,
    `/incidents/{id}/actions`) expect an `Authorization: Bearer <ID_TOKEN>`
    header. Missing or malformed tokens result in HTTP 401. Tokens that are
    valid but do not grant the required role will result in HTTP 403.

  - The SSE endpoint `/incidents/{id}/stream` enforces the same token
    semantics: missing/invalid/expired token -> 401, valid token -> stream
    allowed. A demo/anonymous fallback for the SSE endpoint is available only
    when the environment variable `FACTORY_WHY_ALLOW_ANONYMOUS_DEMO` is set to
    a truthy value (`1`, `true`, or `yes`). The default behavior is to require
    authentication for the live stream.

  - Authorization and identity are determined solely from the verified token
    on the server (the server trusts the token's `uid` as the canonical actor
    identifier for audit records). Do not accept or persist any client-supplied
    actor identity in request bodies.

  - For tests and local development, the AuthService is injectable so tests
    can mock verification without network calls or service-account keys.

 If you'd like, I can prepare a final commit for Phase 2 that includes the
 tool implementations, tests, README updates and a minimal CI workflow.
