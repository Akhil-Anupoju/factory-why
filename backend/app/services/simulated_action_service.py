from __future__ import annotations
from typing import Dict, Any
from datetime import datetime, timezone
from uuid import uuid4

from ..repositories.interfaces import IncidentRepository, AuditRepository
from ..schemas import ActionRecord, ApprovalRecord, Recommendation, OutcomeRecord


class ActionError(Exception):
    pass


class SimulatedActionService:
    """Execute simulated actions only when provided a valid APPROVED approval.

    Produces an ActionRecord that is clearly marked as SIMULATED and records
    audit events. No external side effects are performed.
    """

    def __init__(self, incident_repo: IncidentRepository, audit_repo: AuditRepository):
        self.incident_repo = incident_repo
        self.audit_repo = audit_repo

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def _record_audit(self, incident_id: str, event_id: str, payload: Dict[str, Any]):
        try:
            self.audit_repo.append_audit(incident_id, {"event_id": event_id, "step_number": 820, "timestamp": self._now(), "agent_role": "simulated_action_service", "tool_call": event_id.lower(), "summary": event_id.replace("AUD-", ""), "request_payload": payload, "response_payload": {}, "status": "STARTED"})
        except Exception:
            pass

    def execute(self, incident_id: str, recommendation: Recommendation, approval: ApprovalRecord) -> ActionRecord:
        # Detect simple tampering: if the provided approval object does not
        # reference the same incident we were called with, block immediately.
        if getattr(approval, "incident_id", None) != incident_id:
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-ACTION-BLOCKED", "step_number": 821, "timestamp": self._now(), "agent_role": "simulated_action_service", "tool_call": "execute", "summary": "Action blocked due to approval incident mismatch (possible tampering)", "request_payload": {"provided_incident_id": getattr(approval, "incident_id", None)}, "response_payload": {}, "status": "BLOCKED"})
            raise ActionError("Provided approval does not belong to this incident; action blocked")

        # Prefer freshest approval state persisted on the incident repo if available.
        try:
            inc = self.incident_repo.get_incident(incident_id) or {}
            stored = inc.get("approval")
            if stored and getattr(approval, "approval_id", None) and stored.get("approval_id") == approval.approval_id:
                # refresh approval record from the persisted incident
                approval = ApprovalRecord.model_validate(stored)
        except Exception:
            # ignore refresh failures and fall back to provided approval
            pass

        # guard: approval must be APPROVED and match incident and recommendation
        if approval.decision != "APPROVED":
            # record blocked action
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-ACTION-BLOCKED", "step_number": 821, "timestamp": self._now(), "agent_role": "simulated_action_service", "tool_call": "execute", "summary": "Action blocked due to approval state", "request_payload": {"approval_decision": approval.decision}, "response_payload": {}, "status": "BLOCKED"})
            raise ActionError("Approval is not APPROVED; action blocked")

        if approval.incident_id != incident_id:
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-ACTION-BLOCKED", "step_number": 822, "timestamp": self._now(), "agent_role": "simulated_action_service", "tool_call": "execute", "summary": "Action blocked due to incident mismatch", "request_payload": {"approval_incident_id": approval.incident_id}, "response_payload": {}, "status": "BLOCKED"})
            raise ActionError("Approval does not belong to this incident")

        if approval.recommendation_id != recommendation.recommendation_id:
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-ACTION-BLOCKED", "step_number": 823, "timestamp": self._now(), "agent_role": "simulated_action_service", "tool_call": "execute", "summary": "Action blocked due to recommendation mismatch", "request_payload": {"approval_recommendation_id": approval.recommendation_id}, "response_payload": {}, "status": "BLOCKED"})
            raise ActionError("Approval does not match recommendation")

        # record start - include verified actor if present in approval metadata
        self._record_audit(incident_id, "AUD-ACTION-SIMULATION-START", {"recommendation_id": recommendation.recommendation_id, "approval_id": approval.approval_id})

        # produce simulated action record with required typed fields
        task_num = f"TASK-{uuid4().hex[:6]}"
        assigned = approval.engineer_name or "SIMULATED_TECH"
        # choose required tools and checklist based on recommendation.action_type
        atype = (recommendation.action_type or "").upper()
        if atype == "INSPECT" or "INSPECT" in atype:
            tools = ["Laser-Runout-Tool", "Dial-Indicator"]
            checklist = ["Lockout/tagout", "Remove housing cover", "Measure runout", "Record readings"]
        elif atype == "REPAIR" or "REPAIR" in atype:
            tools = ["Bearing-Kit", "Hydraulic-Press", "Torque-Wrench"]
            checklist = ["Lockout/tagout", "Disassemble spindle", "Replace bearing", "Reassemble & test"]
        else:
            tools = []
            checklist = ["Monitor production run", "Record observations"]

        action = ActionRecord(
            action_id=f"ACT-{uuid4().hex[:8]}",
            incident_id=incident_id,
            approval_id=approval.approval_id,
            task_type=(recommendation.action_type or recommendation.next_step or "SIMULATED_TASK"),
            task_number=task_num,
            assigned_technician=assigned,
            required_tools=tools,
            status="SIMULATED",
            dispatched_at=self._now(),
            target_component=(recommendation.target_component or ""),
            procedure_checklist=checklist,
        )

        # persist into incident payload
        inc = self.incident_repo.get_incident(incident_id) or {}
        inc["action"] = action.model_dump()
        self.incident_repo.upsert_incident(inc)

        # record complete
        try:
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-ACTION-SIMULATION-COMPLETE", "step_number": 829, "timestamp": self._now(), "agent_role": "simulated_action_service", "tool_call": "execute", "summary": "Action simulation complete", "request_payload": {"action_id": action.action_id}, "response_payload": action.model_dump(), "status": "SUCCESS"})
        except Exception:
            pass

        return action
