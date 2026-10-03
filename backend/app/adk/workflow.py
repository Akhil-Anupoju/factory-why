from __future__ import annotations
from typing import Any, Dict
from ..adk.state import InvestigationState


class RootOrchestrator:
    """A placeholder ADK root orchestrator/workflow.

    This establishes the execution boundary, accepts an InvestigationState
    and performs no live model reasoning. It is intentionally minimal so the
    specialist agents can be added later.
    """

    def __init__(self, services: Dict[str, Any] | None = None):
        # services is a dict of adapters: incident_repo, evidence_service, telemetry_repo, storage_repo
        self.services = services or {}

    def create_initial_state(self, incident_id: str) -> InvestigationState:
        # create a minimal initial state with incident_id
        state = InvestigationState(incident_id=incident_id)
        return state

    def run(self, state: InvestigationState) -> InvestigationState:
        # This function is the execution entrypoint for the ADK workflow.
        # For Phase 3A we simply record an audit event and return the state
        # unchanged to show the boundary.
        from ..adk.state import AuditEvent

        evt = AuditEvent(
            event_id="AUD-ADK-INIT",
            step_number=0,
            timestamp="1970-01-01T00:00:00Z",
            agent_role="root_orchestrator",
            tool_call="root_orchestrator.run",
            summary="Root orchestrator invoked (placeholder)",
            request_payload={"incident_id": state.incident_id},
            response_payload={},
            status="SUCCESS",
        )
        state.record_audit(evt)
        return state
