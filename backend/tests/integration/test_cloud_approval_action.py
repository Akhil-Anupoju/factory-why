import os
import time
import pytest
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.app_factory import create_app
from backend.app.auth import AuthService, FirebaseVerifier
from backend.app.repositories.cloud_repo_factory import create_cloud_repos


pytestmark = pytest.mark.skipif(
    not os.getenv("FACTORY_WHY_CLOUD_APPROVAL_TEST"),
    reason="Cloud approval/action integration test is opt-in. Set FACTORY_WHY_CLOUD_APPROVAL_TEST=1 and provide FIREBASE_ID_TOKEN to run",
)


def _make_rec():
    # Minimal recommendation shape acceptable to the API
    ts = int(time.time())
    return {
        "recommendation_id": f"REC-CLOUD-{ts}",
        "action_type": "INSPECT",
        "estimated_duration_minutes": 25,
        "time_window": "25 minutes",
        "rationale": "Integration test: deterministic inspect",
        "evidence_references": [],
    }


def test_cloud_approval_action_flow():
    # Require explicit FIREBASE token for authenticated run
    token = os.getenv("FIREBASE_ID_TOKEN")
    if not token:
        pytest.skip("FIREBASE_ID_TOKEN not provided; cannot run authenticated cloud test")

    # Ensure SETTINGS indicate cloud mode
    settings = get_settings()
    if settings.runtime_mode.upper() not in ("CLOUD", "PRODUCTION"):
        pytest.skip("RUNTIME_MODE not set to CLOUD/PRODUCTION; skipping cloud-backed integration test")

    # Build app with cloud repositories wired (create_app will initialize cloud repos in CLOUD mode)
    app = create_app(settings)
    # attach real auth service (FirebaseVerifier) which will verify the provided token
    app.state.auth_service = AuthService(FirebaseVerifier())

    client = TestClient(app)

    incident_id = "INC-2026-0827"
    rec = _make_rec()

    headers = {"Authorization": f"Bearer {token}"}

    # 1) request approval (PENDING)
    r = client.post(f"/api/incidents/{incident_id}/approve", headers=headers, json={"recommendation": rec, "decision": "PENDING", "comment": "Integration test request"})
    assert r.status_code == 200, f"approval request failed: {r.status_code} {r.text}"
    appr = r.json()
    approval_id = appr.get("approval_id")
    assert approval_id

    # Allow short propagation time for cloud writes
    time.sleep(1)

    # Validate persisted approval via independent cloud repo client
    inc_repo, ev_repo, au_repo, te_repo, st_repo = create_cloud_repos(settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket)
    inc = inc_repo.get_incident(incident_id)
    assert inc and "approval" in inc, "approval not persisted in incident doc"
    stored = inc["approval"]
    # Stored recommendation id should match
    try:
        rec_id = stored.get("recommendation_id")
    except Exception:
        rec_id = stored["recommendation_id"] if "recommendation_id" in stored else None
    assert rec_id == rec["recommendation_id"]

    # 2) decide approve (APPROVED)
    r2 = client.post(f"/api/incidents/{incident_id}/approve", headers=headers, json={"recommendation": rec, "decision": "APPROVED", "comment": "Integration test approve"})
    assert r2.status_code == 200, f"approval decide failed: {r2.status_code} {r2.text}"
    decided = r2.json()
    assert decided.get("decision") == "APPROVED"

    time.sleep(1)
    inc = inc_repo.get_incident(incident_id)
    assert inc and "approval" in inc and inc["approval"].get("decision") == "APPROVED"

    # 3) POST actions using persisted approval (server will re-validate persisted approval)
    r3 = client.post(f"/api/incidents/{incident_id}/actions", headers=headers, json={"recommendation": rec, "approval_id": approval_id})
    assert r3.status_code == 200, f"action call failed: {r3.status_code} {r3.text}"
    body = r3.json()
    assert body.get("action") and body.get("outcome")
    assert body["action"].get("status") == "SIMULATED"

    # Verify cloud audit contains expected events
    # Allow time then read audit collection
    time.sleep(1)
    audits = au_repo.list_audit(incident_id)
    ids = [a.get("event_id") for a in audits]
    for required in [
        "AUD-APPROVAL-REQUESTED",
        "AUD-APPROVAL-APPROVED",
        "AUD-ACTION-SIMULATION-START",
        "AUD-ACTION-SIMULATION-COMPLETE",
        "AUD-OUTCOME-RECORDED",
    ]:
        assert required in ids, f"Cloud audit missing {required}"

    # Negative safety checks (basic): wrong approval id -> blocked
    r_bad = client.post(f"/api/incidents/{incident_id}/actions", headers=headers, json={"recommendation": rec, "approval_id": "NOPE"})
    assert r_bad.status_code == 403

    # Repeated action request is permitted (simulated / idempotent check): call actions again with same approval -> 200
    r_dup = client.post(f"/api/incidents/{incident_id}/actions", headers=headers, json={"recommendation": rec, "approval_id": approval_id})
    assert r_dup.status_code == 200
