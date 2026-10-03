from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4

from ..repositories.interfaces import IncidentRepository, AuditRepository
from ..schemas import ApprovalRecord, Recommendation


class ApprovalError(Exception):
    pass


class ApprovalService:
    """Typed approval service for Phase 4B.

    Stores approvals in the incident repository by upserting the incident's
    approval field. For tests we operate against the in-memory incident repo.
    """

    VALID_DECISIONS = {"APPROVED", "REJECTED", "MORE_EVIDENCE_REQUESTED"}

    def __init__(self, incident_repo: IncidentRepository, audit_repo: AuditRepository):
        self.incident_repo = incident_repo
        self.audit_repo = audit_repo

    def _now(self) -> str:
        # timezone-aware UTC timestamp, preserve 'Z' suffix for compatibility
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def request_approval(self, incident_id: str, recommendation: Recommendation, actor: str, comment: str = "") -> ApprovalRecord:
        # Create a pending approval record and persist on incident
        approval_id = f"APP-{uuid4().hex[:8]}"
        ar = ApprovalRecord(
            approval_id=approval_id,
            incident_id=incident_id,
            recommendation_id=recommendation.recommendation_id,
            decision="PENDING",
            engineer_name=actor,
            engineer_role="",
            timestamp=self._now(),
            comment=comment,
            authorized_action=recommendation.action_type,
            signature_hash="UNVERIFIED",
        )

        # Persist into incident payload
        inc = self.incident_repo.get_incident(incident_id) or {}
        inc["approval"] = ar.model_dump()
        self.incident_repo.upsert_incident(inc)

        # audit
        try:
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-APPROVAL-REQUESTED", "step_number": 800, "timestamp": self._now(), "agent_role": "approval_service", "tool_call": "request_approval", "summary": "Approval requested", "request_payload": {"actor": actor, "recommendation_id": recommendation.recommendation_id}, "response_payload": {"approval_id": approval_id}, "status": "STARTED"})
        except Exception:
            pass

        return ar

    def decide(self, incident_id: str, approval_id: str, decision: str, actor: str, comment: str = "") -> ApprovalRecord:
        if decision not in self.VALID_DECISIONS:
            raise ApprovalError(f"Invalid decision: {decision}")

        inc = self.incident_repo.get_incident(incident_id)
        if not inc or "approval" not in inc:
            raise ApprovalError("No approval request found for incident")

        existing = inc["approval"]
        if existing.get("approval_id") != approval_id:
            raise ApprovalError("Approval ID mismatch")

        # enforce state machine: cannot decide final if already final
        if existing.get("decision") in ("APPROVED", "REJECTED", "MORE_EVIDENCE_REQUESTED"):
            raise ApprovalError("Approval already finalized")

        # apply decision
        existing["decision"] = decision
        existing["engineer_name"] = actor
        existing["timestamp"] = self._now()
        existing["comment"] = comment

        self.incident_repo.upsert_incident(inc)

        # audit
        event_id = "AUD-APPROVAL-APPROVED" if decision == "APPROVED" else ("AUD-APPROVAL-REJECTED" if decision == "REJECTED" else "AUD-APPROVAL-MORE-EVIDENCE")
        try:
            self.audit_repo.append_audit(incident_id, {"event_id": event_id, "step_number": 810, "timestamp": self._now(), "agent_role": "approval_service", "tool_call": "decide", "summary": f"Approval decision: {decision}", "request_payload": {"approval_id": approval_id, "actor": actor}, "response_payload": {"decision": decision}, "status": "SUCCESS"})
        except Exception:
            pass

        return ApprovalRecord.model_validate(existing)

    def get_approval(self, incident_id: str) -> Optional[ApprovalRecord]:
        inc = self.incident_repo.get_incident(incident_id)
        if not inc:
            return None
        if "approval" not in inc:
            return None
        try:
            return ApprovalRecord.model_validate(inc["approval"])
        except Exception:
            return None
