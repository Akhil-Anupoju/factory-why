from __future__ import annotations
from typing import Any, Dict

from ..adk.state import InvestigationState, AuditEvent


class RootOrchestrator:
    """Root orchestrator that coordinates EvidenceAgent -> WHY Agent.

    Responsibilities:
    - run the EvidenceAgent to collect/normalize evidence into state
    - assemble an EvidenceBundle (state.build_evidence_bundle)
    - invoke the WHY Agent using a model_runner_override supplied via services
      to keep tests deterministic
    - record audit events for the orchestration lifecycle
    """

    def __init__(self, services: Dict[str, Any] | None = None):
        # services is a dict of adapters: incident_repo, evidence_service, telemetry_repo, storage_repo
        # Additionally may contain: 'tools' (AllowlistedTools), 'model_runner_override', 'model'
        self.services = services or {}

    def create_initial_state(self, incident_id: str) -> InvestigationState:
        # create a minimal initial state with incident_id
        state = InvestigationState(incident_id=incident_id)
        return state

    def run(self, state: InvestigationState) -> InvestigationState:
        # Record orchestrator start
        state.record_audit(
            AuditEvent(
                event_id="AUD-ADK-INIT",
                step_number=0,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="root_orchestrator",
                tool_call="root_orchestrator.run",
                summary="Root orchestrator invoked",
                request_payload={"incident_id": state.incident_id},
                response_payload={},
                status="STARTED",
            )
        )

        # Prepare allowlisted tools either from provided services or create minimal in-memory ones
        tools = self.services.get("tools")
        if tools is None:
            # lazy import to avoid heavy test-time imports at module import
            from ..tools.tool_impl import AllowlistedTools
            from ..repositories.in_memory import (
                InMemoryIncidentRepo,
                InMemoryEvidenceRepo,
                InMemoryAuditRepo,
                InMemoryTelemetryRepo,
                InMemoryStorageRepo,
            )
            from ..services.evidence_service import EvidenceService

            inc = InMemoryIncidentRepo()
            ev = InMemoryEvidenceRepo()
            au = InMemoryAuditRepo()
            te = InMemoryTelemetryRepo()
            st = InMemoryStorageRepo()
            svc = EvidenceService(inc, ev, au, te, st)
            tools = AllowlistedTools(inc, ev, te, st, svc)

        # Run Evidence Agent
        from .evidence_agent import EvidenceAgent

        evidence_agent = EvidenceAgent(tools=tools, model=self.services.get("model", "local-fake"))
        state = evidence_agent.run(state)

        # Evidence bundle ready
        bundle = state.build_evidence_bundle()
        state.record_audit(
            AuditEvent(
                event_id="AUD-EVIDENCE-BUNDLE",
                step_number=100,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="root_orchestrator",
                tool_call="build_evidence_bundle",
                summary="Evidence bundle assembled",
                request_payload={"incident_id": state.incident_id},
                response_payload={"evidence_count": len(bundle.get("evidence", []))},
                status="SUCCESS",
            )
        )

        # Run WHY Agent if a model runner override is supplied
        from .why_agent import WhyAgent

        model_runner = self.services.get("model_runner_override")
        why_agent = WhyAgent(model=self.services.get("model"))
        if model_runner:
            try:
                state = why_agent.run(state, model_runner_override=model_runner)
            except Exception as ex:
                state.record_audit(
                    AuditEvent(
                        event_id="AUD-WHY-FAIL",
                        step_number=299,
                        timestamp="1970-01-01T00:00:00Z",
                        agent_role="root_orchestrator",
                        tool_call="why.run",
                        summary="WHY agent failed",
                        request_payload={"incident_id": state.incident_id},
                        response_payload={"error": str(ex)},
                        status="FAILED",
                    )
                )
        else:
            # Record that WHY was intentionally skipped to avoid live model calls
            state.record_audit(
                AuditEvent(
                    event_id="AUD-WHY-SKIPPED",
                    step_number=298,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="root_orchestrator",
                    tool_call="why.run",
                    summary="WHY agent skipped (no model_runner_override provided)",
                    request_payload={"incident_id": state.incident_id},
                    response_payload={},
                    status="SKIPPED",
                )
            )

        # Completion
        state.record_audit(
            AuditEvent(
                event_id="AUD-ADK-COMPLETE",
                step_number=999,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="root_orchestrator",
                tool_call="root_orchestrator.run",
                summary="Root orchestrator completed",
                request_payload={"incident_id": state.incident_id},
                response_payload={"evidence_count": len(state.evidence), "hypotheses": len(state.hypotheses)},
                status="SUCCESS",
            )
        )

        return state
