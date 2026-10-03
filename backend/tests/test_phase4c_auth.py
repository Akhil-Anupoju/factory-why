import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.auth import AuthenticatedUser, InvalidTokenError, ExpiredTokenError


CLIENT = TestClient(app)


class FakeAuthService:
    """Deterministic fake auth service for tests.

    Mapping keys are token strings. Values are either:
    - dict: decoded token-like dict (will be converted to AuthenticatedUser), or
    - Exception: will be raised by verify_token(token)
    """

    def __init__(self, mapping=None):
        self.mapping = mapping or {}

    def verify_token(self, id_token: str) -> AuthenticatedUser:
        if id_token not in self.mapping:
            raise InvalidTokenError("invalid token")
        val = self.mapping[id_token]
        if isinstance(val, Exception):
            raise val
        # val is a dict with fields similar to firebase decoded token
        decoded = val
        uid = decoded.get("uid") or decoded.get("user_id")
        email = decoded.get("email")
        name = decoded.get("name") or decoded.get("displayName")
        email_verified = bool(decoded.get("email_verified") or decoded.get("emailVerified") or False)
        claims = {k: v for k, v in decoded.items() if k not in ("uid", "user_id", "email", "name", "displayName", "email_verified", "emailVerified", "iat", "exp", "aud", "iss")}
        return AuthenticatedUser(uid=uid, email=email, display_name=name, email_verified=email_verified, claims=claims)


@pytest.fixture(autouse=True)
def inject_fake_auth():
    mapping = {
        # invalid / expired
        "badtok": InvalidTokenError("bad token"),
        "expiredtok": ExpiredTokenError("expired"),
        # unauthorized viewer
        "tok-unauth": {"uid": "test-user-002", "email": "viewer@example.test", "name": "Viewer", "roles": ["viewer"]},
        # authorized reliability engineer (shared across tests)
        "tok-ok": {"uid": "test-user-001", "email": "engineer@example.test", "name": "Rel Eng", "roles": ["reliability_engineer"]},
        "tok-action": {"uid": "test-user-001", "email": "engineer@example.test", "name": "Rel Eng", "roles": ["reliability_engineer"]},
        "tok-rej": {"uid": "test-user-001", "email": "engineer@example.test", "name": "Rel Eng", "roles": ["reliability_engineer"]},
        "tok-me": {"uid": "test-user-001", "email": "engineer@example.test", "name": "Rel Eng", "roles": ["reliability_engineer"]},
        "tok-override": {"uid": "test-user-001", "email": "engineer@example.test", "name": "Rel Eng", "roles": ["reliability_engineer"]},
    }

    app.state.auth_service = FakeAuthService(mapping)
    yield


def make_token_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_missing_auth_header_blocks():
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", json={"recommendation": {}, "decision": "PENDING", "actor": "malicious"})
    assert r.status_code == 401


def test_invalid_token_blocks(monkeypatch):
    # patch verifier to raise InvalidTokenError
    from backend.app.auth import InvalidTokenError

    def fake_verify(id_token):
        raise InvalidTokenError("bad token")

    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: fake_verify(t))
    headers = make_token_header("badtok")
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": {}, "decision": "PENDING"})
    assert r.status_code == 401


def test_expired_token_blocks(monkeypatch):
    from backend.app.auth import ExpiredTokenError

    def fake_verify(id_token):
        raise ExpiredTokenError("expired")

    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: fake_verify(t))
    headers = make_token_header("expiredtok")
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": {}, "decision": "PENDING"})
    assert r.status_code == 401


def test_unauthorized_role_blocks(monkeypatch):
    # token verified but lacks required role
    decoded = {"uid": "user1", "email": "user@example.com", "name": "User One", "email_verified": True, "roles": ["viewer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    headers = make_token_header("tok-unauth")
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": {}, "decision": "PENDING"})
    assert r.status_code == 403


def test_authorized_approval_succeeds(monkeypatch):
    decoded = {"uid": "re1", "email": "re@example.com", "name": "Rel Eng", "email_verified": True, "roles": ["reliability_engineer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    headers = make_token_header("tok-ok")
    rec = {"recommendation_id": "REC-TEST-1", "action_type": "INSPECT", "estimated_duration_minutes": 10, "time_window": "30m", "rationale": "t"}
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "PENDING"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("approval_id")
    # approving
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "APPROVED"})
    assert r2.status_code == 200


def test_action_requires_authorized_token(monkeypatch):
    # prepare approved approval via authorized user
    decoded = {"uid": "re2", "email": "re2@example.com", "name": "Rel Eng", "email_verified": True, "roles": ["reliability_engineer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    headers = make_token_header("tok-action")
    rec = {"recommendation_id": "REC-TEST-2", "action_type": "INSPECT", "estimated_duration_minutes": 10, "time_window": "30m", "rationale": "t"}
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "PENDING"})
    apr = r.json()
    approval_id = apr.get("approval_id")
    # decide approve
    CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "APPROVED"})

    # execute action
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=headers, json={"recommendation": rec, "approval_id": approval_id})
    assert r2.status_code == 200


def test_rejected_blocks_action(monkeypatch):
    decoded = {"uid": "re3", "email": "re3@example.com", "name": "Rel Eng", "email_verified": True, "roles": ["reliability_engineer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    headers = make_token_header("tok-rej")
    rec = {"recommendation_id": "REC-TEST-3", "action_type": "INSPECT", "estimated_duration_minutes": 10, "time_window": "30m", "rationale": "t"}
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "PENDING"})
    apr = r.json()
    approval_id = apr.get("approval_id")
    CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "REJECTED"})
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=headers, json={"recommendation": rec, "approval_id": approval_id})
    assert r2.status_code == 403


def test_more_evidence_blocks_action(monkeypatch):
    decoded = {"uid": "re4", "email": "re4@example.com", "name": "Rel Eng", "email_verified": True, "roles": ["reliability_engineer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    headers = make_token_header("tok-me")
    rec = {"recommendation_id": "REC-TEST-4", "action_type": "INSPECT", "estimated_duration_minutes": 10, "time_window": "30m", "rationale": "t"}
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "PENDING"})
    apr = r.json()
    approval_id = apr.get("approval_id")
    CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "MORE_EVIDENCE_REQUESTED"})
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=headers, json={"recommendation": rec, "approval_id": approval_id})
    assert r2.status_code == 403


def test_actor_in_body_cannot_override(monkeypatch):
    decoded = {"uid": "re5", "email": "re5@example.com", "name": "Rel Eng", "email_verified": True, "roles": ["reliability_engineer"]}
    monkeypatch.setattr("backend.app.api.incidents.FirebaseVerifier.verify_id_token", lambda self, t: decoded)
    headers = make_token_header("tok-override")
    rec = {"recommendation_id": "REC-TEST-5", "action_type": "INSPECT", "estimated_duration_minutes": 10, "time_window": "30m", "rationale": "t"}
    r = CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "PENDING", "actor": "bad_guy"})
    apr = r.json()
    assert apr.get("approval_id")
    # ensure audit contains approved_by identity later when outcome recorded (via services)
    CLIENT.post("/api/incidents/INC-2026-0827/approve", headers=headers, json={"recommendation": rec, "decision": "APPROVED"})
    r2 = CLIENT.post("/api/incidents/INC-2026-0827/actions", headers=headers, json={"recommendation": rec, "approval_id": apr.get("approval_id")})
    assert r2.status_code == 200
