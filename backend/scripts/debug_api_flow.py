from fastapi.testclient import TestClient
import os

# Import the ASGI app via module path so this script can be executed as
# `python -m backend.scripts.debug_api_flow` from the repo root.
from backend.app.main import app

client = TestClient(app)

def auth_header_from_env():
    """Return Authorization header when AUTH_TOKEN (or AUTH_BEARER) env var set.

    For production-like testing provide a real Firebase ID token via the
    AUTH_TOKEN environment variable. This script will not fabricate tokens
    or enable development-only verifiers.
    """
    token = os.environ.get("AUTH_TOKEN") or os.environ.get("AUTH_BEARER")
    if token and token.strip():
        return {"Authorization": f"Bearer {token.strip()}"}
    return {}

def run():
    rec = {
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

    r = client.post("/api/incidents/INC-2026-0827/approve", json={"recommendation": rec, "actor": "eng-api", "decision": "PENDING"}, headers=auth_header_from_env())
    print("PENDING ->", r.status_code, r.text)
    ar = r.json()
    approval_id = ar.get("approval_id")
    r2 = client.post("/api/incidents/INC-2026-0827/approve", json={"recommendation": rec, "actor": "eng-api", "decision": "APPROVED"}, headers=auth_header_from_env())
    print("APPROVE ->", r2.status_code, r2.text)
    r3 = client.post("/api/incidents/INC-2026-0827/actions", json={"recommendation": rec, "approval_id": approval_id, "actor": "eng-api"}, headers=auth_header_from_env())
    print("ACTION ->", r3.status_code, r3.text)

if __name__ == '__main__':
    run()
