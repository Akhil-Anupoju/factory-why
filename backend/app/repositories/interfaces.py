from __future__ import annotations
from typing import Protocol, List, Dict, Any, Optional


class IncidentRepository(Protocol):
    def get_incident(self, incident_id: str) -> Optional[Dict[str, Any]]:
        ...

    def upsert_incident(self, incident: Dict[str, Any]) -> None:
        ...

    def list_incidents(self) -> List[Dict[str, Any]]:
        ...


class EvidenceRepository(Protocol):
    def list_evidence(self, incident_id: str) -> List[Dict[str, Any]]:
        ...

    def get_evidence(self, incident_id: str, evidence_id: str) -> Optional[Dict[str, Any]]:
        ...

    def upsert_evidence(self, incident_id: str, evidence: Dict[str, Any]) -> None:
        ...


class AuditRepository(Protocol):
    def list_audit(self, incident_id: str) -> List[Dict[str, Any]]:
        ...

    def append_audit(self, incident_id: str, event: Dict[str, Any]) -> None:
        ...


class TelemetryRepository(Protocol):
    def query_telemetry(self, asset_id: str, start_timestamp: str = None, end_timestamp: str = None) -> List[Dict[str, Any]]:
        ...


class StorageRepository(Protocol):
    def get_metadata(self, path: str) -> Optional[Dict[str, Any]]:
        ...

    def list_objects(self, prefix: str) -> List[Dict[str, Any]]:
        ...
