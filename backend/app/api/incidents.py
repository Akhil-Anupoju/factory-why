from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any
import json
import time

from ..repositories.fixtures import get_primary_scenario
from ..schemas import InvestigationCase, SimulationParameters, SimulationOptionResult, CriticFinding
from ..simulation.simulator import calculate_deterministic_simulation

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    data = get_primary_scenario()
    if not data or data.get("incident_id") != incident_id:
        raise HTTPException(status_code=404, detail="incident not found")
    # Return the fixture as-is for this slice
    return JSONResponse(content=data)


@router.get("/incidents/{incident_id}/audit")
def get_audit(incident_id: str):
    data = get_primary_scenario()
    if not data or data.get("incident_id") != incident_id:
        raise HTTPException(status_code=404, detail="incident not found")
    return JSONResponse(content={"audit": data.get("audit_trail", [])})


def _sse_event(name: str, payload: Dict[str, Any]):
    return f"event: {name}\ndata: {json.dumps(payload)}\n\n"


@router.get("/incidents/{incident_id}/stream")
def stream_incident(incident_id: str):
    data = get_primary_scenario()
    if not data or data.get("incident_id") != incident_id:
        raise HTTPException(status_code=404, detail="incident not found")

    def event_stream():
        steps = [
            ("retrieving_telemetry", {"step": 1}),
            ("checking_maintenance", {"step": 2}),
            ("generating_hypotheses", {"step": 3}),
            ("critiquing_leader", {"step": 4}),
            ("running_simulation", {"step": 5}),
            ("awaiting_approval", {"step": 6}),
        ]
        for name, payload in steps:
            yield _sse_event(name, payload)
            time.sleep(0.05)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/incidents/{incident_id}/simulate")
def post_simulate(incident_id: str, params: SimulationParameters):
    data = get_primary_scenario()
    if not data or data.get("incident_id") != incident_id:
        raise HTTPException(status_code=404, detail="incident not found")
    results = calculate_deterministic_simulation(params)
    # Pydantic v2: serialize using model_dump()
    return JSONResponse(content=[r.model_dump() for r in results])


@router.post("/incidents/{incident_id}/challenge")
def post_challenge(incident_id: str, body: Dict[str, Any]):
    data = get_primary_scenario()
    if not data or data.get("incident_id") != incident_id:
        raise HTTPException(status_code=404, detail="incident not found")
    # Return a fixture-shaped CriticFinding minimal response
    cf = {
        "critic_id": "CRITIC-2026-001",
        "target_hypothesis_id": "HYP-01",
        "run_timestamp": "2026-09-22T14:52:10Z",
        "contradictions": [
            {"point": "Sensor fault contradicted by physics", "conflicting_evidence_id": "EV-1041", "rationale": "Multi-channel lockstep"}
        ],
        "ignored_evidence": [],
        "falsification_condition": "Dial runout < 0.02 mm",
        "strongest_discriminating_check": "Dial indicator or laser runout measurement",
        "recommendation_action": "PROCEED_TO_SIMULATION",
        "confidence_delta": -0.03,
    }
    return JSONResponse(content=cf)
