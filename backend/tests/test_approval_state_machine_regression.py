"""Regression tests for the 500-on-repeated-approval-decision bug.

Root cause: ApprovalService.decide() treated MORE_EVIDENCE_REQUESTED as a
terminal state identical to APPROVED/REJECTED, so any second Approve/
Reject/Request-Evidence click raised an uncaught ApprovalError, producing
an HTTP 500. Fixed by (a) only treating APPROVED/REJECTED as terminal in
the service layer, and (b) catching ApprovalError in the API route and
returning a safe 409 instead of ever allowing a 500.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.auth import AuthenticatedUser


@pytest.fixture(autouse=True)
def inject_fake_auth():
    prev = getattr(app.state, "auth_service", None)

    class FakeAuthService:
        def verify_token(self, id_token: str):
            if id_token == "tok-ok":
                return AuthenticatedUser(
                    uid="re1", email="re@example.com", display_name="Rel Eng",
                    email_verified=True, claims={"roles": ["reliability_engineer"]},
                )
            from backend.app.auth import InvalidTokenError
            raise InvalidTokenError("invalid")

    app.state.auth_service = FakeAuthService()
    try:
        yield
    finally:
        app.state.auth_service = prev


client = TestClient(app)
AUTH = {"Authorization": "Bearer tok-ok"}


def _get_recommendation():
    r = client.get("/api/incidents/INC-2026-0827")
    assert r.status_code == 200
    return r.json()["recommendation"]


def test_request_evidence_then_approve_succeeds_no_500():
    rec = _get_recommendation()

    r1 = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "PENDING", "comment": "start"},
    )
    assert r1.status_code == 200

    r2 = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "MORE_EVIDENCE_REQUESTED", "comment": "need more"},
    )
    assert r2.status_code == 200

    # This previously crashed with HTTP 500. Must now succeed.
    r3 = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "APPROVED", "comment": "approved after review"},
    )
    assert r3.status_code == 200
    assert r3.json()["decision"] == "APPROVED"


def test_second_decision_after_approved_returns_409_not_500():
    rec = _get_recommendation()

    client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "PENDING", "comment": "start"},
    )
    r_approve = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "APPROVED", "comment": "ok"},
    )
    assert r_approve.status_code == 200

    # Clicking Approve/Reject again after it's finalized must be a safe
    # 409 Conflict, never a 500.
    r_again = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "REJECTED", "comment": "oops"},
    )
    assert r_again.status_code == 409
    assert "already finalized" in r_again.json().get("detail", "").lower()


def test_full_approve_to_execute_action_flow_via_http():
    """End-to-end HTTP-level test for 'Complete Physical Inspection & Reveal
    Ground Truth': approve -> execute action -> outcome, through the real
    FastAPI routes (not just the service layer), matching exactly what the
    frontend's handleExecuteAction call does."""
    rec = _get_recommendation()

    r_pending = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "PENDING", "comment": "requesting sign-off"},
    )
    assert r_pending.status_code == 200
    approval_id = r_pending.json()["approval_id"]

    r_approve = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "APPROVED", "comment": "approved"},
    )
    assert r_approve.status_code == 200
    assert r_approve.json()["decision"] == "APPROVED"

    r_action = client.post(
        "/api/incidents/INC-2026-0827/actions", headers=AUTH,
        json={"recommendation": rec, "approval_id": approval_id},
    )
    assert r_action.status_code == 200, r_action.text
    body = r_action.json()
    assert "action" in body and "outcome" in body
    assert body["action"]["status"] in ("SIMULATED", "DISPATCHED", "COMPLETED")
    assert body["outcome"]["outcome_id"]

    # Ground-truth outcome must now be retrievable via GET too
    r_outcome = client.get("/api/incidents/INC-2026-0827/outcome")
    assert r_outcome.status_code == 200
    assert r_outcome.json()["outcome"]["outcome_id"] == body["outcome"]["outcome_id"]


def test_execute_action_without_approval_is_blocked_via_http():
    """NO APPROVAL -> NO ACTION, enforced at the real HTTP route."""
    rec = _get_recommendation()
    r_action = client.post(
        "/api/incidents/INC-2026-0827/actions", headers=AUTH,
        json={"recommendation": rec, "approval_id": "APP-FAKE-NOT-APPROVED"},
    )
    assert r_action.status_code == 403


def test_approve_directly_on_preseeded_pending_approval_backfills_recommendation_id():
    """Regression test for the REAL production bug found via live Firestore
    data: the demo fixture pre-seeds a PENDING approval directly (approval_id
    'APP-2026-0827-PENDING') WITHOUT a recommendation_id, bypassing
    request_approval() entirely. The actual frontend UI never sends a
    'PENDING' decision first for a brand-new incident — it goes straight to
    APPROVED/REJECTED/REQUEST_MORE_EVIDENCE on whatever approval record
    already exists. Previously, deciding directly against this pre-seeded
    record left recommendation_id permanently null, which silently blocked
    'Complete Physical Inspection & Reveal Ground Truth' on the frontend
    (its safety guard compares approval.recommendation_id to
    recommendation.recommendation_id) with NO network call and NO visible
    backend error — it just looked like the button did nothing.
    """
    rec = _get_recommendation()

    # Deterministically reproduce the pre-seeded condition regardless of
    # execution order/pollution from other tests in this shared in-memory
    # app instance: directly reset the incident's approval to the exact
    # broken shape the real fixture seeds (PENDING, no recommendation_id).
    inc_repo = app.state.deps["incident_repo"]
    inc = inc_repo.get_incident("INC-2026-0827")
    inc["approval"] = {
        "approval_id": "APP-2026-0827-PENDING",
        "incident_id": "INC-2026-0827",
        "decision": "PENDING",
        "engineer_name": "Akhil Anupoju",
        "engineer_role": "Senior Reliability & Diagnostics Engineer (Lead)",
        "timestamp": "2026-09-22T14:55:00Z",
        "comment": "",
        "authorized_action": "Inspect Spindle Coupling Alignment via Laser Tool LAK-40",
        "signature_hash": "UNVERIFIED_AWAITING_ENGINEER_CLICK",
        # recommendation_id intentionally absent — this is the exact bug condition.
    }
    inc.pop("action", None)
    inc.pop("outcome", None)
    inc_repo.upsert_incident(inc)

    r_before = client.get("/api/incidents/INC-2026-0827")
    assert r_before.json()["approval"].get("recommendation_id") in (None, "")

    # Go straight to APPROVED, exactly like the real "Approve Action" button
    # does for a brand-new incident — no PENDING call first.
    r_approve = client.post(
        "/api/incidents/INC-2026-0827/approve", headers=AUTH,
        json={"recommendation": rec, "decision": "APPROVED", "comment": "approved directly"},
    )
    assert r_approve.status_code == 200
    approval = r_approve.json()
    assert approval["decision"] == "APPROVED"
    # The core fix: recommendation_id must now be backfilled and match.
    assert approval["recommendation_id"] == rec["recommendation_id"]

    # And the action must now actually execute — this previously would have
    # been silently blocked client-side before ever reaching this endpoint.
    r_action = client.post(
        "/api/incidents/INC-2026-0827/actions", headers=AUTH,
        json={"recommendation": rec, "approval_id": approval["approval_id"]},
    )
    assert r_action.status_code == 200, r_action.text
    assert "outcome" in r_action.json()
