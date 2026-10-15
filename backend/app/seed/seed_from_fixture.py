from __future__ import annotations
import json
from pathlib import Path
from ..repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo
from ..repositories.interfaces import IncidentRepository, EvidenceRepository, AuditRepository


def seed_from_fixture(incident_repo: IncidentRepository, evidence_repo: EvidenceRepository, audit_repo: AuditRepository, fixture_path: Path | str = "backend/fixtures/cnc04-primary.json"):
    p = Path(fixture_path)
    if not p.exists():
        raise FileNotFoundError(p)
    data = json.loads(p.read_text())
    incident_repo.upsert_incident(data)
    for e in data.get("evidence", []):
        evidence_repo.upsert_evidence(data["incident_id"], e)
    for a in data.get("audit_trail", []):
        audit_repo.append_audit(data["incident_id"], a)


def seed_incident_fixtures(
    incident_repo: IncidentRepository,
    evidence_repo: EvidenceRepository,
    audit_repo: AuditRepository,
    fixture_paths: list[Path | str] | None = None,
) -> list[str]:
    """Seed all standard fresh-test incident fixtures into the repositories."""
    paths = fixture_paths or [
        "backend/fixtures/cnc04-primary.json",
    ]
    seeded = []
    for fixture_path in paths:
        p = Path(fixture_path)
        if not p.exists():
            raise FileNotFoundError(p)
        data = json.loads(p.read_text())
        incident_id = data["incident_id"]
        incident_repo.upsert_incident(data)
        for evidence in data.get("evidence", []):
            evidence_repo.upsert_evidence(incident_id, evidence)
        for event in data.get("audit_trail", []):
            audit_repo.append_audit(incident_id, event)
        seeded.append(incident_id)
    return seeded
