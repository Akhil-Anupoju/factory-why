from __future__ import annotations
from fastapi import FastAPI, Depends, Request
from .config import Settings, get_settings
from .repositories.in_memory import (
    InMemoryIncidentRepo,
    InMemoryEvidenceRepo,
    InMemoryAuditRepo,
    InMemoryTelemetryRepo,
    InMemoryStorageRepo,
)
from .repositories.firestore_repo import FirestoreIncidentRepo, FirestoreEvidenceRepo, FirestoreAuditRepo
from .repositories.bigquery_repo import BigQueryTelemetryRepo
from .repositories.storage_repo import GCSStorageRepo
from .services.evidence_service import EvidenceService


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Factory WHY - Backend")

    # Dependency wiring based on runtime mode. Support both 'PRODUCTION' and
    # 'CLOUD' as explicit cloud modes. Do not silently fall back from cloud
    # mode to in-memory repositories; raise if cloud libraries are missing.
    if settings.runtime_mode.upper() in ("PRODUCTION", "CLOUD"):
        # Create cloud repositories via factory that centralizes client creation
        from .repositories.cloud_repo_factory import create_cloud_repos

        try:
            incident_repo, evidence_repo, audit_repo, telemetry_repo, storage_repo = create_cloud_repos(
                settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket
            )
        except Exception as e:
            # Fail fast in production mode — do not silently fall back to in-memory repos
            raise RuntimeError("Failed to initialize cloud repositories: %s" % str(e)) from e
    else:
        # Local/test mode uses in-memory repos; no cloud clients created
        incident_repo = InMemoryIncidentRepo()
        evidence_repo = InMemoryEvidenceRepo()
        audit_repo = InMemoryAuditRepo()
        telemetry_repo = InMemoryTelemetryRepo()
        storage_repo = InMemoryStorageRepo()

    # Compose services
    evidence_service = EvidenceService(incident_repo, evidence_repo, audit_repo, telemetry_repo, storage_repo)

    # Store dependencies on app state for route-level injection
    app.state.deps = {
        "settings": settings,
        "incident_repo": incident_repo,
        "evidence_repo": evidence_repo,
        "audit_repo": audit_repo,
        "telemetry_repo": telemetry_repo,
        "storage_repo": storage_repo,
        "evidence_service": evidence_service,
    }

    # Include API router(s) after wiring
    from .api import incidents

    app.include_router(incidents.router, prefix="/api")

    return app


def get_deps(request: Request):
    # Request-scoped dependency to access wired dependencies
    return request.app.state.deps


def get_incident_repo(deps=Depends(get_deps)):
    return deps.get("incident_repo")


def get_evidence_repo(deps=Depends(get_deps)):
    return deps.get("evidence_repo")


def get_audit_repo(deps=Depends(get_deps)):
    return deps.get("audit_repo")


def get_telemetry_repo(deps=Depends(get_deps)):
    return deps.get("telemetry_repo")


def get_storage_repo(deps=Depends(get_deps)):
    return deps.get("storage_repo")


def get_evidence_service(deps=Depends(get_deps)):
    return deps.get("evidence_service")
