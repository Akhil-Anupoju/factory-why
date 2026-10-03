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

    # Dependency wiring based on runtime mode
    if settings.runtime_mode.upper() == "PRODUCTION":
        # Create cloud clients lazily here; in tests do not set runtime_mode=PRODUCTION
        try:
            from google.cloud import firestore as _firestore
            from google.cloud import bigquery as _bigquery
            from google.cloud import storage as _storage
        except Exception as e:
            raise RuntimeError(
                "Production mode requires google-cloud libraries. Install extras 'gcp' or the google-cloud packages."
            ) from e

        fs_client = _firestore.Client()
        bq_client = _bigquery.Client()
        storage_client = _storage.Client()

        incident_repo = FirestoreIncidentRepo(fs_client)
        evidence_repo = FirestoreEvidenceRepo(fs_client)
        audit_repo = FirestoreAuditRepo(fs_client)
        telemetry_repo = BigQueryTelemetryRepo(bq_client, dataset=settings.bigquery_dataset, table=settings.bigquery_table)
        storage_repo = GCSStorageRepo(storage_client, bucket_name=settings.gcs_bucket)
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
