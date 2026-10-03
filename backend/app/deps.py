from __future__ import annotations
from fastapi import Request
from typing import Dict

from .repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo, InMemoryTelemetryRepo, InMemoryStorageRepo
from .repositories.interfaces import IncidentRepository, EvidenceRepository, AuditRepository, TelemetryRepository, StorageRepository


def get_incident_repo(request: Request) -> IncidentRepository:
    return request.app.state.repos["inc_repo"]


def get_evidence_repo(request: Request) -> EvidenceRepository:
    return request.app.state.repos["ev_repo"]


def get_audit_repo(request: Request) -> AuditRepository:
    return request.app.state.repos["au_repo"]


def get_telemetry_repo(request: Request) -> TelemetryRepository:
    return request.app.state.repos["te_repo"]


def get_storage_repo(request: Request) -> StorageRepository:
    return request.app.state.repos["st_repo"]


def get_auth_service(request: Request):
    """Return the application-scoped AuthService instance.

    Tests may replace `app.state.auth_service` with a fake implementation.
    """
    return request.app.state.auth_service
