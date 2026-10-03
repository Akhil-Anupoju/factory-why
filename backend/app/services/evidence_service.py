from __future__ import annotations
from typing import List, Dict, Any
from ..repositories.interfaces import IncidentRepository, EvidenceRepository, AuditRepository, TelemetryRepository, StorageRepository
from ..schemas import EvidenceItem


class EvidenceValidationError(RuntimeError):
    pass


class EvidenceService:
    def __init__(
        self,
        incident_repo: IncidentRepository,
        evidence_repo: EvidenceRepository,
        audit_repo: AuditRepository,
        telemetry_repo: TelemetryRepository,
        storage_repo: StorageRepository,
    ):
        self.incident_repo = incident_repo
        self.evidence_repo = evidence_repo
        self.audit_repo = audit_repo
        self.telemetry_repo = telemetry_repo
        self.storage_repo = storage_repo

    def get_incident(self, incident_id: str) -> Dict[str, Any]:
        inc = self.incident_repo.get_incident(incident_id)
        return inc

    def list_evidence(self, incident_id: str) -> List[EvidenceItem]:
        # Assemble evidence from evidence repo + telemetry and validate with Pydantic
        raw_ev = list(self.evidence_repo.list_evidence(incident_id))
        validated: List[EvidenceItem] = []
        for e in raw_ev:
            # Reject inferred/generated evidence marked by a flag 'inferred' == True
            if e.get("inferred"):
                continue
            try:
                validated.append(EvidenceItem.model_validate(e))
            except Exception as ex:
                raise EvidenceValidationError(f"Malformed evidence item: {ex}")

        # fetch telemetry for the incident asset if present
        if inc := self.incident_repo.get_incident(incident_id):
            asset_id = inc.get("asset", {}).get("asset_id")
            if asset_id:
                telemetry_rows = self.telemetry_repo.query_telemetry(asset_id)
                # normalize telemetry to EvidenceItem and validate
                for i, row in enumerate(telemetry_rows):
                    raw = {
                        "evidence_id": f"TELEM-{i}",
                        "incident_id": incident_id,
                        "source": "Telemetry stream",
                        "source_icon": "Activity",
                        "timestamp": row.get("timestamp"),
                        "asset": asset_id,
                        "component": row.get("sensor_id"),
                        "observation": str(row.get("value")),
                        "provenance": f"bigquery://{row.get('scenario_id')}",
                        "status": "Observed",
                        "confidence": "High",
                        "raw_payload": row,
                    }
                    try:
                        validated.append(EvidenceItem.model_validate(raw))
                    except Exception as ex:
                        raise EvidenceValidationError(f"Malformed telemetry-derived evidence item: {ex}")
        return validated

    def get_audit_trail(self, incident_id: str) -> List[Dict[str, Any]]:
        return self.audit_repo.list_audit(incident_id)
