from __future__ import annotations
from typing import Dict, Any, List, Optional
from .interfaces import IncidentRepository, EvidenceRepository, AuditRepository, TelemetryRepository, StorageRepository


class InMemoryIncidentRepo(IncidentRepository):
    def __init__(self):
        self._data: Dict[str, Dict[str, Any]] = {}

    def get_incident(self, incident_id: str) -> Optional[Dict[str, Any]]:
        return self._data.get(incident_id)

    def upsert_incident(self, incident: Dict[str, Any]) -> None:
        self._data[incident["incident_id"]] = incident

    def list_incidents(self) -> List[Dict[str, Any]]:
        return list(self._data.values())


class InMemoryEvidenceRepo(EvidenceRepository):
    def __init__(self):
        # structure: {incident_id: {evidence_id: evidence_obj}}
        self._store: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def list_evidence(self, incident_id: str) -> List[Dict[str, Any]]:
        return list(self._store.get(incident_id, {}).values())

    def get_evidence(self, incident_id: str, evidence_id: str) -> Optional[Dict[str, Any]]:
        return self._store.get(incident_id, {}).get(evidence_id)

    def upsert_evidence(self, incident_id: str, evidence: Dict[str, Any]) -> None:
        self._store.setdefault(incident_id, {})[evidence["evidence_id"]] = evidence


class InMemoryAuditRepo(AuditRepository):
    def __init__(self):
        self._store: Dict[str, List[Dict[str, Any]]] = {}

    def list_audit(self, incident_id: str) -> List[Dict[str, Any]]:
        return list(self._store.get(incident_id, []))

    def append_audit(self, incident_id: str, event: Dict[str, Any]) -> None:
        self._store.setdefault(incident_id, []).append(event)


class InMemoryTelemetryRepo(TelemetryRepository):
    def __init__(self):
        self._rows: List[Dict[str, Any]] = []

    def seed_rows(self, rows: List[Dict[str, Any]]):
        self._rows.extend(rows)

    def query_telemetry(self, asset_id: str, start_timestamp: str = None, end_timestamp: str = None) -> List[Dict[str, Any]]:
        return [r for r in self._rows if r.get("asset_id") == asset_id]


class InMemoryStorageRepo(StorageRepository):
    def __init__(self):
        # map path -> metadata
        self._meta: Dict[str, Dict[str, Any]] = {}

    def put_metadata(self, path: str, meta: Dict[str, Any]):
        self._meta[path] = meta

    def get_metadata(self, path: str) -> Optional[Dict[str, Any]]:
        return self._meta.get(path)

    def list_objects(self, prefix: str) -> List[Dict[str, Any]]:
        return [m for p, m in self._meta.items() if p.startswith(prefix)]
