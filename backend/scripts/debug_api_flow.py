from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

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

    r = client.post("/api/incidents/INC-2026-0827/approve", json={"recommendation": rec, "actor": "eng-api", "decision": "PENDING"})
    print("PENDING ->", r.status_code, r.text)
    ar = r.json()
    approval_id = ar.get("approval_id")
    r2 = client.post("/api/incidents/INC-2026-0827/approve", json={"recommendation": rec, "actor": "eng-api", "decision": "APPROVED"})
    print("APPROVE ->", r2.status_code, r2.text)
    r3 = client.post("/api/incidents/INC-2026-0827/actions", json={"recommendation": rec, "approval_id": approval_id, "actor": "eng-api"})
    print("ACTION ->", r3.status_code, r3.text)

if __name__ == '__main__':
    run()
