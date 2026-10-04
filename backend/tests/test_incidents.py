
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.auth import InvalidTokenError


@pytest.fixture(autouse=True)
def inject_fake_auth():
    prev = getattr(app.state, 'auth_service', None)

    class FakeAuthService:
        def verify_token(self, id_token: str):
            if id_token == "tok-ok":
                return {"uid": "re1", "email": "re@example.com", "name": "Rel Eng", "roles": ["reliability_engineer"]}
            raise InvalidTokenError("invalid")

    app.state.auth_service = FakeAuthService()
    try:
        yield
    finally:
        app.state.auth_service = prev


client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_get_incident_found():
    r = client.get("/api/incidents/INC-2026-0827")
    assert r.status_code == 200
    data = r.json()
    assert data.get("incident_id") == "INC-2026-0827"
    # ensure key sections present in fixture
    assert "telemetry_summary" in data
    assert "simulation_params" in data
    assert "evidence" in data and isinstance(data.get("evidence"), list)


def test_get_incident_missing():
    r = client.get("/api/incidents/NOPE")
    assert r.status_code == 404


def test_simulate_endpoint():
    body = {"inspection_delay_minutes": 25}
    r = client.post("/api/incidents/INC-2026-0827/simulate", json=body)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    # expect three simulation options
    assert [o.get("option") for o in arr] == ["CONTINUE", "INSPECT", "REPAIR"]


def test_challenge_endpoint():
    r = client.post("/api/incidents/INC-2026-0827/challenge", json={})
    assert r.status_code == 200
    payload = r.json()
    assert payload.get("critic_id") == "CRITIC-2026-001"


def test_stream_sse():
    r = client.get("/api/incidents/INC-2026-0827/stream", headers={"Authorization": "Bearer tok-ok"})
    assert r.status_code == 200
    # content-type should be event-stream
    assert r.headers.get("content-type", "").startswith("text/event-stream")
    text = r.content.decode("utf-8")
    # ensure event names in correct order
    assert "event: retrieving_telemetry" in text
    assert "event: checking_maintenance" in text
    assert "event: running_simulation" in text
