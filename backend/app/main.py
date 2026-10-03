from fastapi import FastAPI
from .api import incidents
from .auth import AuthService, FirebaseVerifier
from .repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo, InMemoryTelemetryRepo, InMemoryStorageRepo
from .seed.seed_from_fixture import seed_from_fixture


def create_app() -> FastAPI:
    app = FastAPI(title="Factory WHY - Backend Slice")

    # initialize shared in-memory repositories for the app lifetime
    inc_repo = InMemoryIncidentRepo()
    ev_repo = InMemoryEvidenceRepo()
    au_repo = InMemoryAuditRepo()
    te_repo = InMemoryTelemetryRepo()
    st_repo = InMemoryStorageRepo()

    app.state.repos = {
        "inc_repo": inc_repo,
        "ev_repo": ev_repo,
        "au_repo": au_repo,
        "te_repo": te_repo,
        "st_repo": st_repo,
    }

    # provide an application-scoped AuthService instance; tests may replace
    # this on app.state.auth_service with a fake implementation for offline
    # testing. Keep Firebase SDK usage inside FirebaseVerifier (lazy).
    app.state.auth_service = AuthService(FirebaseVerifier())

    # seed fixture data into shared in-memory repos so endpoints operate
    try:
        seed_from_fixture(inc_repo, ev_repo, au_repo, fixture_path="backend/fixtures/cnc04-primary.json")
    except Exception:
        # non-fatal: if seeding fails, the app can still run (tests will fail later)
        pass

    app.include_router(incidents.router, prefix="/api")
    return app


app = create_app()
