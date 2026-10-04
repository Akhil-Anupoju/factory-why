import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.auth import InvalidTokenError, ExpiredTokenError


class FakeAuthService:
    def __init__(self, mapping=None):
        self.mapping = mapping or {}

    def verify_token(self, id_token: str):
        if id_token not in self.mapping:
            raise InvalidTokenError("invalid token")
        val = self.mapping[id_token]
        if isinstance(val, Exception):
            raise val
        return val


@pytest.fixture(autouse=True)
def inject_fake_auth(monkeypatch):
    # Patch the FirebaseVerifier.verify_id_token function so AuthService will
    # use the fake mapping during token verification. This avoids replacing
    # the app.state.auth_service and interfering with other tests' fixtures.
    mapping = {
        "tok-ok": {"uid": "re1", "email": "re@example.com", "name": "Rel Eng", "roles": ["reliability_engineer"]},
        "badtok": InvalidTokenError("bad"),
        "expiredtok": ExpiredTokenError("expired"),
    }

    def fake_verify(self, id_token: str):
        if id_token not in mapping:
            raise InvalidTokenError("invalid token")
        val = mapping[id_token]
        if isinstance(val, Exception):
            raise val
        return val

    monkeypatch.setattr('backend.app.auth.FirebaseVerifier.verify_id_token', fake_verify)
    yield


client = TestClient(app)


def make_token_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_missing_authorization_blocks():
    r = client.get("/api/incidents/INC-2026-0827/stream")
    assert r.status_code == 401


def test_malformed_authorization_blocks():
    r = client.get("/api/incidents/INC-2026-0827/stream", headers={"Authorization": "NotBearer tok"})
    assert r.status_code == 401


def test_invalid_token_blocks():
    r = client.get("/api/incidents/INC-2026-0827/stream", headers=make_token_header("badtok"))
    assert r.status_code == 401


def test_expired_token_blocks():
    r = client.get("/api/incidents/INC-2026-0827/stream", headers=make_token_header("expiredtok"))
    assert r.status_code == 401


def test_valid_token_streams():
    r = client.get("/api/incidents/INC-2026-0827/stream", headers=make_token_header("tok-ok"))
    assert r.status_code == 200
    text = r.content.decode("utf-8")
    assert "event: retrieving_telemetry" in text
    assert "event: awaiting_approval" in text
