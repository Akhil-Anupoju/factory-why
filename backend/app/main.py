from fastapi import FastAPI
from .api import incidents
from .auth import AuthService, FirebaseVerifier
from .repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo, InMemoryTelemetryRepo, InMemoryStorageRepo
from .seed.seed_from_fixture import seed_from_fixture


def create_app() -> FastAPI:
    app = FastAPI(title="Factory WHY - Backend Slice")

    # Initialize application-scoped dependencies using the same wiring logic
    # as the application factory. Default to LOCAL in absence of full factory.
    from .config import get_settings
    settings = get_settings()
    # Use app_factory.create_app-like wiring but keep simple for this module
    if settings.runtime_mode.upper() in ("PRODUCTION", "CLOUD"):
        # In cloud mode, create cloud-backed repos via cloud_repo_factory
        from .repositories.cloud_repo_factory import create_cloud_repos

        try:
            incident_repo, evidence_repo, audit_repo, telemetry_repo, storage_repo = create_cloud_repos(
                settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket
            )
        except Exception:
            # Fail fast: if cloud repos cannot be created, raise so operator notices
            raise
    else:
        # LOCAL / TEST mode uses in-memory repositories and seeds fixtures.
        # Keep behavior unchanged for local development and tests.
        inc_repo = InMemoryIncidentRepo()
        ev_repo = InMemoryEvidenceRepo()
        au_repo = InMemoryAuditRepo()
        te_repo = InMemoryTelemetryRepo()
        st_repo = InMemoryStorageRepo()

        incident_repo = inc_repo
        evidence_repo = ev_repo
        audit_repo = au_repo
        telemetry_repo = te_repo
        storage_repo = st_repo

        # Seed fixtures only in LOCAL mode. This is explicitly gated to avoid
        # contaminating cloud-backed runs. Seed failures are non-fatal in
        # local dev but will be surfaced in tests that expect seeded data.
        try:
            from .seed.seed_from_fixture import seed_from_fixture

            seed_from_fixture(inc_repo, ev_repo, au_repo, fixture_path="backend/fixtures/cnc04-primary.json")
        except Exception:
            # non-fatal: if seeding fails, the app can still run (tests will fail later)
            pass

    app.state.deps = {
        "settings": settings,
        "incident_repo": incident_repo,
        "evidence_repo": evidence_repo,
        "audit_repo": audit_repo,
        "telemetry_repo": telemetry_repo,
        "storage_repo": storage_repo,
    }

    # Mirror older `repos` mapping for backward compatibility
    app.state.repos = {
        "inc_repo": incident_repo,
        "ev_repo": evidence_repo,
        "au_repo": audit_repo,
        "te_repo": telemetry_repo,
        "st_repo": storage_repo,
    }

    # Provide an application-scoped AuthService using the real Firebase
    # verifier. In production/cloud modes, validate that application
    # credentials are present so the process fails fast on misconfiguration.
    from .auth import AuthService, FirebaseVerifier, validate_firebase_credentials

    if settings.runtime_mode.upper() in ("PRODUCTION", "CLOUD"):
        # Will raise RuntimeError if credentials are missing.
        validate_firebase_credentials(raise_on_missing=True)

    app.state.auth_service = AuthService(FirebaseVerifier())

    app.include_router(incidents.router, prefix="/api")
    return app


app = create_app()
