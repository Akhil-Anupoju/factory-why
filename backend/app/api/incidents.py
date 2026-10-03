from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any
import json
import time

from ..repositories.fixtures import get_primary_scenario
from ..seed.seed_from_fixture import seed_from_fixture
from ..schemas import ApprovalRecord
from ..schemas import InvestigationCase, SimulationParameters, SimulationOptionResult, CriticFinding
from ..simulation.simulator import calculate_deterministic_simulation
from ..services.decision_service import DecisionService
from ..services.approval_service import ApprovalService
from ..services.simulated_action_service import SimulatedActionService
from ..services.outcome_service import OutcomeService
from ..repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo, InMemoryTelemetryRepo, InMemoryStorageRepo
from ..deps import get_incident_repo, get_evidence_repo, get_audit_repo, get_telemetry_repo, get_storage_repo
from fastapi import Depends
from fastapi import Depends, Request
from fastapi import HTTPException as FastHTTPException
from typing import Optional
from ..services.evidence_service import EvidenceService

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


@router.post("/incidents/{incident_id}/approve")
def post_approve(incident_id: str, body: Dict[str, Any], request: Request):
    # body must include: recommendation (dict), actor (str)
    rec = body.get("recommendation")
    actor = body.get("actor")
    decision = body.get("decision")
    comment = body.get("comment", "")
    if not rec or not actor or not decision:
        raise HTTPException(status_code=400, detail="recommendation, actor, and decision required")

    # resolve repos / services from app state
    inc_repo = get_incident_repo(request)
    ev_repo = get_evidence_repo(request)
    au_repo = get_audit_repo(request)
    te_repo = get_telemetry_repo(request)
    st_repo = get_storage_repo(request)
    from ..schemas import Recommendation as RecSchema
    recommendation = RecSchema.model_validate(rec)
    # repos are app-scoped and were seeded at app startup; no per-request seeding
    ev_svc = EvidenceService(inc_repo, ev_repo, au_repo, te_repo, st_repo)

    approval_svc = ApprovalService(inc_repo, au_repo)
    if decision == "PENDING":
        ar = approval_svc.request_approval(incident_id, recommendation, actor, comment)
        return JSONResponse(content=ar.model_dump())
    else:
        # locate existing approval for this incident and decide it
        existing = approval_svc.get_approval(incident_id)
        if not existing:
            raise HTTPException(status_code=404, detail="No approval request found to decide")
        # extract approval_id whether stored as dict or model
        try:
            existing_id = existing["approval_id"] if isinstance(existing, dict) else existing.approval_id
        except Exception:
            raise HTTPException(status_code=400, detail="Malformed approval record")
        approved = approval_svc.decide(incident_id, existing_id, decision, actor, comment)
        return JSONResponse(content=approved.model_dump())


@router.post("/incidents/{incident_id}/actions")
def post_action(incident_id: str, body: Dict[str, Any], request: Request):
    # body: recommendation (dict), approval_id, actor
    rec = body.get("recommendation")
    approval_id = body.get("approval_id")
    actor = body.get("actor")
    if not rec or not approval_id or not actor:
        raise HTTPException(status_code=400, detail="recommendation, approval_id, and actor required")

    # resolve shared app-scoped repos
    inc_repo = get_incident_repo(request)
    ev_repo = get_evidence_repo(request)
    au_repo = get_audit_repo(request)
    te_repo = get_telemetry_repo(request)
    st_repo = get_storage_repo(request)

    # repos are app-scoped and were seeded at app startup; no per-request seeding

    approval_svc = ApprovalService(inc_repo, au_repo)
    approval = approval_svc.get_approval(incident_id)
    # approval_svc.get_approval may return ApprovalRecord or dict
    if not approval:
        raise HTTPException(status_code=403, detail="Invalid or missing approval")
    try:
        stored_id = approval["approval_id"] if isinstance(approval, dict) else approval.approval_id
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed approval record")
    if stored_id != approval_id:
        raise HTTPException(status_code=403, detail="Invalid or missing approval")

    # ensure approval finalized as APPROVED
    try:
        ar = ApprovalRecord.model_validate(approval)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed approval record")

    if ar.decision != "APPROVED":
        raise HTTPException(status_code=403, detail="Approval not approved; action blocked")

    from ..schemas import Recommendation as RecSchema
    recommendation = RecSchema.model_validate(rec)

    action_svc = SimulatedActionService(inc_repo, au_repo)
    try:
        action = action_svc.execute(incident_id, recommendation, ar)
    except Exception as ex:
        raise HTTPException(status_code=403, detail=str(ex))

    # generate outcome
    outcome_svc = OutcomeService(inc_repo, au_repo)
    outcome = outcome_svc.record_outcome(incident_id, ar, recommendation, action)

    return JSONResponse(content={"action": action.model_dump(), "outcome": outcome.model_dump()})


@router.get("/incidents/{incident_id}/outcome")
def get_outcome(incident_id: str):
    data = get_primary_scenario()
    if not data or data.get("incident_id") != incident_id:
        raise HTTPException(status_code=404, detail="incident not found")
    return JSONResponse(content={"outcome": data.get("outcome")})


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
