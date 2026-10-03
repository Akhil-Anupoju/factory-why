from fastapi.testclient import TestClient
import pytest
from backend.app.main import app
from backend.app.schemas import Recommendation


CLIENT = TestClient(app)


@pytest.fixture(autouse=True)
def patch_auth(monkeypatch):
    # provide a default verified token for legacy Phase 4B API tests
    decoded = {"uid": "re-test", "email": "re@example.com", "name": "RE Test", "email_verified": True, "roles": ["reliability_engineer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    yield


def make_token_header(token: str = "tok-test") -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_recommendation():
    # minimal recommendation matching fixture target
    return {
        "recommendation_id": "REC-TEST-1",
        "next_step": "PERFORM_INSPECTION",
        "target_component": "Bearing-B04",
        "action_type": "INSPECT",
        "urgency": "HIGH",
        "time_window": "30 minutes",
        "rationale": "Test rec",
        "uncertainty_pct": 10.0,
        "evidence_references": [],
        "estimated_duration_minutes": 25,
        "safety_protocol_code": "SP-TEST",
    }


def test_post_approve_then_action_allows():
    rec = make_recommendation()
    # request approval
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "PENDING"})
    assert r.status_code == 200
    ar = r.json()
    approval_id = ar.get("approval_id")
    # decide approve
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "APPROVED"})
    assert r2.status_code == 200
    # execute action using returned approval id
    r3 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": approval_id})
    assert r3.status_code == 200
    payload = r3.json()
    assert "action" in payload and "outcome" in payload


def test_post_reject_blocks_action():
    rec = make_recommendation()
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "PENDING"})
    assert r.status_code == 200
    ar = r.json()
    approval_id = ar.get("approval_id")
    # reject
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "REJECTED"})
    assert r2.status_code == 200
    # action should be blocked
    r3 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": approval_id})
    assert r3.status_code == 403


def test_post_more_evidence_blocks_action():
    rec = make_recommendation()
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "PENDING"})
    ar = r.json()
    approval_id = ar.get("approval_id")
    # more evidence
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "MORE_EVIDENCE_REQUESTED"})
    assert r2.status_code == 200
    r3 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": approval_id})
    assert r3.status_code == 403


def test_no_approval_blocks_action():
    rec = make_recommendation()
    # call actions without approval
    r = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": "NO-APP"})
    assert r.status_code == 403


def test_wrong_ids_blocked():
    rec = make_recommendation()
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "PENDING"})
    ar = r.json()
    approval_id = ar.get("approval_id")
    # approve
    CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "APPROVED"})
    # wrong incident id
    r2 = CLIENT.post("/api/incidents/INC-OTHER/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": approval_id})
    assert r2.status_code == 404 or r2.status_code == 403
    # wrong approval id
    r3 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": "BAD-APP"})
    assert r3.status_code == 403


def test_approved_action_has_outcome():
    rec = make_recommendation()
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "PENDING"})
    ar = r.json()
    approval_id = ar.get("approval_id")
    CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=make_token_header(), json={"recommendation": rec, "decision": "APPROVED"})
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=make_token_header(), json={"recommendation": rec, "approval_id": approval_id})
    assert r2.status_code == 200
    # fetch outcome stored in app repo through direct endpoint
    # current GET /outcome returns fixture-based outcome; however, action stored in repo is used
    # Instead, verify action/outcome returned in response
    payload = r2.json()
    assert payload.get("outcome") is not None
