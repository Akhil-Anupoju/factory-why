from __future__ import annotations
import json
from pathlib import Path
from ..repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo


def seed_from_fixture(incident_repo: InMemoryIncidentRepo, evidence_repo: InMemoryEvidenceRepo, audit_repo: InMemoryAuditRepo, fixture_path: Path | str = "backend/fixtures/cnc04-primary.json"):
    p = Path(fixture_path)
    if not p.exists():
        raise FileNotFoundError(p)
    data = json.loads(p.read_text())
    incident_repo.upsert_incident(data)
    for e in data.get("evidence", []):
        evidence_repo.upsert_evidence(data["incident_id"], e)
    for a in data.get("audit_trail", []):
        audit_repo.append_audit(data["incident_id"], a)
