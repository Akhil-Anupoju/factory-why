from __future__ import annotations
from typing import List, Dict, Any
from uuid import uuid4
from datetime import datetime

from ..simulation.simulator import calculate_deterministic_simulation
from ..schemas import SimulationParameters, SimulationOptionResult, Recommendation, AuditEvent
from ..services.evidence_service import EvidenceService
from ..repositories.interfaces import IncidentRepository, AuditRepository


class DecisionService:
    """Deterministic decision layer built on top of the simulator.

    Responsibilities:
    - run the deterministic simulator
    - create a typed Recommendation based on simulation results and a simple
      deterministic policy
    - record audit events via the provided AuditRepository
    """

    def __init__(self, incident_repo: IncidentRepository, evidence_service: EvidenceService, audit_repo: AuditRepository):
        self.incident_repo = incident_repo
        self.evidence_service = evidence_service
        self.audit_repo = audit_repo

    def _now(self) -> str:
        return datetime.utcnow().isoformat() + "Z"

    def _record_audit(self, incident_id: str, event_id: str, step_number: int, summary: str, request_payload: Dict[str, Any], response_payload: Dict[str, Any], status: str = "SUCCESS"):
        evt = AuditEvent(
            event_id=event_id,
            step_number=step_number,
            timestamp=self._now(),
            agent_role="decision_service",
            tool_call=event_id.lower(),
            summary=summary,
            request_payload=request_payload,
            response_payload=response_payload,
            status=status,
        )
        # append as dict to the audit repo
        try:
            self.audit_repo.append_audit(incident_id, evt.model_dump())
        except Exception:
            # best-effort: ignore audit failures to avoid breaking decision flow in tests
            pass

    def recommend(self, incident_id: str, params: SimulationParameters) -> Recommendation:
        # record simulation start
        self._record_audit(incident_id, "AUD-SIMULATION-START", 700, "Simulation starting", {"params": params.model_dump()}, {})

        try:
            results: List[SimulationOptionResult] = calculate_deterministic_simulation(params)
        except Exception as ex:
            self._record_audit(incident_id, "AUD-SIMULATION-FAIL", 770, "Simulation failed", {"params": params.model_dump()}, {"error": str(ex)}, status="FAILED")
            raise

        # record simulation complete with a small summary
        self._record_audit(incident_id, "AUD-SIMULATION-COMPLETE", 775, "Simulation complete", {"params": params.model_dump()}, {"options": [r.option for r in results]})

        # deterministic policy rules (simple and explicit):
        # - If modeled_failure_exposure is very low -> CONTINUE
        # - If modeled_failure_exposure is very high -> REPAIR
        # - Otherwise, prefer the simulator's recommended option if present; otherwise choose lowest estimated cost
        chosen: SimulationOptionResult | None = None
        if params.modeled_failure_exposure <= 0.05:
            chosen = next((r for r in results if r.option == "CONTINUE"), None)
        elif params.modeled_failure_exposure >= 0.9:
            chosen = next((r for r in results if r.option == "REPAIR"), None)
        else:
            chosen = next((r for r in results if r.recommended), None)
            if not chosen:
                chosen = min(results, key=lambda r: float(getattr(r, "estimated_cost_usd", float("inf"))))

        # build recommendation object using actual simulation numbers (do not invent values)
        incident = self.incident_repo.get_incident(incident_id) or {}
        asset = (incident.get("asset") or {}).get("asset_id") or ""

        # gather evidence references (ids) from evidence service
        try:
            evidence_items = self.evidence_service.list_evidence(incident_id)
            evidence_refs = [e.evidence_id for e in evidence_items][:5]
        except Exception:
            evidence_refs = []

        if not chosen:
            # defensive fallback
            chosen = results[0]

        next_step_map = {
            "CONTINUE": "CONTINUE_PRODUCTION",
            "INSPECT": "PERFORM_INSPECTION",
            "REPAIR": "SCHEDULE_REPAIR",
        }

        urgency_map = {
            "CONTINUE": "LOW",
            "INSPECT": "HIGH",
            "REPAIR": "IMMEDIATE",
        }

        rationale_parts = []
        if getattr(chosen, "calculation_trace", None):
            rationale_parts.extend(list(chosen.calculation_trace[:3]))
        rationale_parts.append(f"Estimated cost: ${chosen.estimated_cost_usd}")
        rationale_parts.append(f"Residual exposure: {chosen.relative_exposure}")

        rec = Recommendation(
            recommendation_id=f"REC-{uuid4().hex[:8]}",
            next_step=next_step_map.get(chosen.option, "UNKNOWN"),
            target_component=asset,
            action_type=chosen.option,
            urgency=urgency_map.get(chosen.option, "MEDIUM"),
            time_window=f"{chosen.expected_delay_minutes} minutes",
            rationale="; ".join(rationale_parts),
            uncertainty_pct=(chosen.uncertainty_reduction * 100) if getattr(chosen, "uncertainty_reduction", None) is not None else 0.0,
            evidence_references=evidence_refs,
            estimated_duration_minutes=int(chosen.expected_delay_minutes),
            safety_protocol_code="SP-DEFAULT",
        )

        # record recommendation audit
        self._record_audit(incident_id, "AUD-RECOMMENDATION-START", 780, "Recommendation starting", {"chosen_option": chosen.option}, {})
        self._record_audit(incident_id, "AUD-RECOMMENDATION-COMPLETE", 785, "Recommendation complete", {"recommendation_id": rec.recommendation_id}, rec.model_dump())

        return rec
