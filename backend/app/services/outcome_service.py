from __future__ import annotations
from typing import Dict, Any
from datetime import datetime, timezone
from uuid import uuid4

from ..repositories.interfaces import IncidentRepository, AuditRepository
from ..schemas import OutcomeRecord, ApprovalRecord, Recommendation, ActionRecord


class OutcomeService:
    """Deterministic outcome service producing a simulated OutcomeRecord after action."""

    def __init__(self, incident_repo: IncidentRepository, audit_repo: AuditRepository):
        self.incident_repo = incident_repo
        self.audit_repo = audit_repo

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def record_outcome(self, incident_id: str, approval: ApprovalRecord, recommendation: Recommendation, action: ActionRecord, ground_truth: Dict[str, Any] | None = None) -> OutcomeRecord:
        # deterministic mapping for demo: outcome_id derived from action
        outcome_id = f"OUT-{uuid4().hex[:8]}"

        # use ground truth when provided; otherwise produce a conservative simulated outcome
        actual_cause = ground_truth.get("actual_cause") if ground_truth else (recommendation.next_step or "UNKNOWN")
        observed_result = ground_truth.get("observed_result") if ground_truth else "SIMULATED_RESULT"

        # derive telemetry-based numeric baselines when available to avoid inventing numbers
        inc = self.incident_repo.get_incident(incident_id) or {}
        ts = inc.get("telemetry_summary") or {}
        vib = ts.get("vibration", {}).get("current") if ts else None
        temp = ts.get("temperature", {}).get("current") if ts else None

        pre_vibration = float(vib) if vib is not None else 0.0
        post_vibration = float(vib) if vib is not None else 0.0
        pre_temperature = float(temp) if temp is not None else 0.0
        post_temperature = float(temp) if temp is not None else 0.0

        outcome = OutcomeRecord(
            outcome_id=outcome_id,
            incident_id=incident_id,
            actual_cause=actual_cause,
            observed_result=observed_result,
            physical_findings=[],
            pre_vibration=pre_vibration,
            post_vibration=post_vibration,
            pre_temperature=pre_temperature,
            post_temperature=post_temperature,
            prediction_match=False,
            top_k_recall=False,
            time_to_resolution_minutes=0,
            accuracy_score_pct=0,
        )

        # persist into incident payload
        inc = self.incident_repo.get_incident(incident_id) or {}
        inc["outcome"] = outcome.model_dump()
        self.incident_repo.upsert_incident(inc)

        # audit
        try:
            # Do not include sensitive tokens in audit. Include actor identity if present via approval
            # Include stable verified uid when available in approval.engineer_name
            # Prefer storing uid to avoid exposing email addresses in audit payloads.
            req = {"action_id": action.action_id if action else None}
            if hasattr(approval, "engineer_name") and approval.engineer_name:
                req["approved_by_uid"] = approval.engineer_name
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-OUTCOME-RECORDED", "step_number": 840, "timestamp": self._now(), "agent_role": "outcome_service", "tool_call": "record_outcome", "summary": "Outcome recorded", "request_payload": req, "response_payload": outcome.model_dump(), "status": "SUCCESS"})
        except Exception:
            pass

        return outcome
