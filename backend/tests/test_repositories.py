from backend.app.repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo, InMemoryTelemetryRepo, InMemoryStorageRepo
from backend.app.seed.seed_from_fixture import seed_from_fixture
import pytest
from pathlib import Path


def test_in_memory_seed_and_query(tmp_path):
    inc_repo = InMemoryIncidentRepo()
    ev_repo = InMemoryEvidenceRepo()
    audit_repo = InMemoryAuditRepo()
    telem_repo = InMemoryTelemetryRepo()
    stor_repo = InMemoryStorageRepo()

    # seed using real fixture from repo
    seed_from_fixture(inc_repo, ev_repo, audit_repo, fixture_path=Path("backend/fixtures/cnc04-primary.json"))

    inc = inc_repo.get_incident("INC-2026-0827")
    assert inc is not None and inc.get("incident_id") == "INC-2026-0827"

    evs = ev_repo.list_evidence("INC-2026-0827")
    assert isinstance(evs, list) and len(evs) >= 1

    audits = audit_repo.list_audit("INC-2026-0827")
    assert isinstance(audits, list)

    # storage repo put/get metadata
    stor_repo.put_metadata("manuals/dmg.pdf", {"name":"manuals/dmg.pdf","size":1234})
    meta = stor_repo.get_metadata("manuals/dmg.pdf")
    assert meta and meta.get("size") == 1234


def test_seed_does_not_create_cloud_clients():
    # create app in local mode and ensure no cloud clients are constructed
    from backend.app.app_factory import create_app
    from backend.app.config import Settings

    app = create_app(Settings(runtime_mode="LOCAL"))
    deps = app.state.deps
    # check none of the repos are instances of cloud client wrappers
    assert deps["incident_repo"].__class__.__name__.startswith("InMemory")
    assert deps["telemetry_repo"].__class__.__name__.startswith("InMemory")
