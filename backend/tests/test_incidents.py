
import copy
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


def test_cors_allows_local_frontend_preflight():
    response = client.options(
        "/api/incidents",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


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


def test_list_incidents_includes_fresh_test_cases():
    response = client.get("/api/incidents")
    assert response.status_code == 200
    incidents = {incident["incident_id"]: incident for incident in response.json()}
    # The resolved reference case remains available by direct incident URL,
    # but is intentionally excluded from the active-work selector.
    assert "INC-2026-0827" not in incidents
    assert {"INC-2026-1001", "INC-2026-0902", "INC-2026-0915", "INC-2026-0928"} <= set(incidents)
    assert incidents["INC-2026-1001"]["title"] == "CNC-04 Spindle Bearing Misalignment — Fresh Test 1001"
    assert incidents["INC-2026-0902"]["title"] == "Lubrication Pressure Loss"


def test_list_incidents_hides_resolved_cases():
    repo = app.state.deps["incident_repo"]
    original = copy.deepcopy(repo.get_incident("INC-2026-0902"))
    try:
        resolved = {**original, "outcome": {"outcome_id": "OUT-TEST", "actual_cause": "fixture test"}}
        repo.upsert_incident(resolved)
        response = client.get("/api/incidents")
        assert response.status_code == 200
        assert "INC-2026-0902" not in {item["incident_id"] for item in response.json()}

        approved = {**original, "outcome": None, "approval": {**original["approval"], "decision": "APPROVED"}}
        repo.upsert_incident(approved)
        response = client.get("/api/incidents")
        assert response.status_code == 200
        assert "INC-2026-0902" in {item["incident_id"] for item in response.json()}

        rejected = {**original, "outcome": None, "approval": {**original["approval"], "decision": "REJECTED"}}
        repo.upsert_incident(rejected)
        response = client.get("/api/incidents")
        assert response.status_code == 200
        assert "INC-2026-0902" not in {item["incident_id"] for item in response.json()}

        in_progress = {**original, "outcome": None, "approval": {**original["approval"], "decision": "MORE_EVIDENCE_REQUESTED"}}
        repo.upsert_incident(in_progress)
        response = client.get("/api/incidents")
        assert response.status_code == 200
        assert "INC-2026-0902" in {item["incident_id"] for item in response.json()}
    finally:
        repo.upsert_incident(original)


def test_list_incidents_hides_incomplete_legacy_records():
    repo = app.state.deps["incident_repo"]
    repo.upsert_incident({"incident_id": "INTEGRATION-TEST-INCIDENT", "asset": {"asset_id": "CNC-04"}})
    try:
        response = client.get("/api/incidents")
        assert response.status_code == 200
        assert "INTEGRATION-TEST-INCIDENT" not in {item["incident_id"] for item in response.json()}
    finally:
        repo._data.pop("INTEGRATION-TEST-INCIDENT", None)


def test_simulate_endpoint():
    body = {"inspection_delay_minutes": 25}
    r = client.post("/api/incidents/INC-2026-0827/simulate", json=body)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    # expect three simulation options
    assert [o.get("option") for o in arr] == ["CONTINUE", "INSPECT", "REPAIR"]


def test_challenge_endpoint_requires_auth():
    r = client.post("/api/incidents/INC-2026-0827/challenge", json={})
    assert r.status_code == 401


def test_challenge_endpoint_live_model_required():
    # This endpoint now triggers the REAL ADK + Gemini/Vertex AI pipeline
    # (RootOrchestrator: Evidence -> WHY -> Critic -> targeted retrieval ->
    # revised WHY). In the default test/local environment ADK_MODEL_PROVIDER
    # is not "vertex_ai", so the live pipeline must fail explicitly rather
    # than silently returning fabricated data (no fake-auth, no demo
    # fallback in CLOUD/PRODUCTION).
    r = client.post(
        "/api/incidents/INC-2026-0827/challenge",
        json={},
        headers={"Authorization": "Bearer tok-ok"},
    )
    assert r.status_code == 502
    assert "Live investigation unavailable" in r.json().get("detail", "")


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
