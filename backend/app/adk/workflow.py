from __future__ import annotations
from typing import Any, Dict
import copy

from ..adk.state import InvestigationState, AuditEvent, EvidenceRef, AssetContext


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
        from .critic_agent import CriticAgent

        model_runner = self.services.get("model_runner_override")
        why_agent = WhyAgent(model=self.services.get("model"))
        # track passes (0 initial WHY, 1 revised WHY)
        state.record_audit(
            AuditEvent(
                event_id="AUD-LOOP-START",
                step_number= -1,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="root_orchestrator",
                tool_call="workflow",
                summary="Investigation loop starting",
                request_payload={"incident_id": state.incident_id},
                response_payload={},
                status="STARTED",
            )
        )

        # pass 0: initial WHY
        if model_runner:
            # If hypotheses already present (e.g., caller ran initial WHY), skip re-running to avoid duplication.
            if state.hypotheses:
                state.record_audit(
                    AuditEvent(
                        event_id="AUD-WHY-SKIPPED",
                        step_number=298,
                        timestamp="1970-01-01T00:00:00Z",
                        agent_role="root_orchestrator",
                        tool_call="why.run",
                        summary="WHY agent skipped (already present)",
                        request_payload={"incident_id": state.incident_id, "hypotheses_present": len(state.hypotheses)},
                        response_payload={},
                        status="SKIPPED",
                    )
                )
            else:
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

            # Run Critic on leading hypothesis if any hypotheses present. Prefer
            # an existing CriticFinding already present on state (caller may have
            # executed critic.run earlier in tests); otherwise invoke Critic.
            cf = None
            if state.hypotheses:
                leading = state.hypotheses[0].hypothesis_id
                if state.critic_findings:
                    cf = state.critic_findings[-1]
                else:
                    critic = CriticAgent(model=self.services.get("model"))
                    try:
                        cf = critic.run(state, leading_hypothesis_id=leading, model_runner_override=model_runner)
                    except Exception:
                        # validation/audit already recorded by CriticAgent
                        cf = None

                # If critic requested more evidence, perform ONE targeted retrieval pass
                if cf and getattr(cf, "request_more_evidence", None):
                    state.record_audit(
                        AuditEvent(
                            event_id="AUD-TARGETED-EVIDENCE-REQUEST",
                            step_number=500,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="root_orchestrator",
                            tool_call="targeted_retrieval",
                            summary="Targeted evidence requested by Critic",
                            request_payload={"request": cf.request_more_evidence},
                            response_payload={},
                            status="STARTED",
                        )
                    )

                    # Execute the requested allowlisted tool once
                    req = cf.request_more_evidence
                    tool_name = req.get("tool")
                    params = req.get("params") or {}
                    state.record_audit(
                        AuditEvent(
                            event_id="AUD-TARGETED-EVIDENCE-START",
                            step_number=510,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="root_orchestrator",
                            tool_call=tool_name,
                            summary="Targeted evidence retrieval start",
                            request_payload={"params": params},
                            response_payload={},
                            status="STARTED",
                        )
                    )

                    # Map tool_name to actual call on tools; only allow the six
                    try:
                        if tool_name not in {"get_asset_context", "get_telemetry_window", "get_maintenance_history", "search_manual", "get_prior_incidents", "get_inspection_image"}:
                            raise RuntimeError(f"Requested tool {tool_name} not allowed")

                        tool_callable = getattr(tools, tool_name)
                        new_resp = tool_callable(params)

                        # Normalize and add to state similarly to EvidenceAgent routines
                        # Reuse logic by calling EvidenceAgent.run's normalization? Simpler: create EvidenceRef entries conservatively.
                        if tool_name == "get_inspection_image":
                            # new_resp is an InspectionImageResponse; convert to EvidenceRef
                            ev = EvidenceRef(
                                evidence_id=new_resp.evidence_id,
                                source="InspectionImage",
                                timestamp=new_resp.timestamp,
                                asset=new_resp.asset,
                                component=new_resp.component,
                                observation=getattr(new_resp, "observation", "") or "",
                                provenance=new_resp.provenance or "",
                                status="Observed",
                                confidence="",
                            )
                            # attach storage metadata if present
                            if getattr(new_resp, "storage_metadata", None):
                                try:
                                    setattr(ev, "storage_metadata", new_resp.storage_metadata)
                                except Exception:
                                    pass
                            if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                                state.add_evidence(ev)
                        elif tool_name == "get_telemetry_window":
                            for p in new_resp.points:
                                prov = getattr(p, "provenance", None) or ""
                                ev = EvidenceRef(
                                    evidence_id=f"TELEM-{state.incident_id}-{p.timestamp}",
                                    source="Telemetry",
                                    timestamp=p.timestamp,
                                    asset=params.get("asset_id", state.asset_context.asset_id if state.asset_context else ""),
                                    component="telemetry_aggregate",
                                    observation=str({"vibration": p.vibration, "temperature": p.temperature, "motor_current": p.motor_current, "rpm": p.rpm, "pressure": p.pressure}),
                                    provenance=prov,
                                    status="Observed",
                                    confidence="High",
                                )
                                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                                    state.add_evidence(ev)
                        elif tool_name == "get_maintenance_history":
                            for w in new_resp.work_orders:
                                ev = EvidenceRef(
                                    evidence_id=w.evidence_id,
                                    source="Maintenance",
                                    timestamp=w.timestamp,
                                    asset=w.incident_id or "",
                                    component="",
                                    observation=w.document_snippet or w.observation or w.details or "",
                                    provenance=w.provenance or "",
                                    status="Observed",
                                    confidence=w.confidence or "",
                                )
                                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                                    state.add_evidence(ev)
                        elif tool_name == "search_manual":
                            for r in new_resp.results:
                                ev = EvidenceRef(
                                    evidence_id=r.evidence_id,
                                    source="ServiceManual",
                                    timestamp="",
                                    asset=r.asset,
                                    component=r.component,
                                    observation=r.snippet or "",
                                    provenance=r.provenance or "",
                                    status="Observed",
                                    confidence=r.confidence or "",
                                )
                                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                                    state.add_evidence(ev)
                        elif tool_name == "get_prior_incidents":
                            for ps in new_resp.incidents:
                                ev = EvidenceRef(
                                    evidence_id=f"PRIOR-{ps.incident_id}",
                                    source="PriorIncidentSummary",
                                    timestamp="",
                                    asset=params.get("asset_id", ""),
                                    component="",
                                    observation=str(ps.telemetry_summary) if getattr(ps, "telemetry_summary", None) else "Prior incident summary",
                                    provenance=f"incident://{ps.incident_id}",
                                    status="Summary",
                                    confidence="",
                                )
                                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                                    state.add_evidence(ev)
                        elif tool_name == "get_asset_context":
                            ac = new_resp
                            # if asset context changed, do not mutate logically observed evidence; only set asset_context if previously missing
                            if not state.asset_context:
                                state.asset_context = AssetContext(asset_id=ac.asset_id, name=ac.name, model=ac.model, line=ac.line, facility=ac.facility)

                        state.record_audit(
                            AuditEvent(
                                event_id="AUD-TARGETED-EVIDENCE-COMPLETE",
                                step_number=520,
                                timestamp="1970-01-01T00:00:00Z",
                                agent_role="root_orchestrator",
                                tool_call=tool_name,
                                summary="Targeted evidence retrieval complete",
                                request_payload={"params": params},
                                response_payload={"added_count": len(state.evidence)},
                                status="SUCCESS",
                            )
                        )
                    except Exception as ex:
                        state.record_audit(
                            AuditEvent(
                                event_id="AUD-TARGETED-EVIDENCE-MISSING",
                                step_number=530,
                                timestamp="1970-01-01T00:00:00Z",
                                agent_role="root_orchestrator",
                                tool_call=tool_name,
                                summary="Targeted evidence retrieval failed or missing",
                                request_payload={"params": params},
                                response_payload={"error": str(ex)},
                                status="MISSING",
                            )
                        )

                    # After targeted retrieval, run revised WHY exactly once (pass 1)
                    state.record_audit(
                        AuditEvent(
                            event_id="AUD-REVISED-WHY-START",
                            step_number=600,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="root_orchestrator",
                            tool_call="revised_why",
                            summary="Revised WHY pass starting",
                            request_payload={"incident_id": state.incident_id, "pass": 1},
                            response_payload={},
                            status="STARTED",
                        )
                    )

                    try:
                        # Backup current hypotheses in case revised WHY validation fails
                        prev_hypotheses = copy.deepcopy(state.hypotheses)

                        # Clear existing hypotheses before running revised WHY so the revised
                        # output replaces prior hypotheses rather than appending.
                        state.hypotheses = []

                        state = why_agent.run(state, model_runner_override=model_runner)

                        state.record_audit(
                            AuditEvent(
                                event_id="AUD-REVISED-WHY-COMPLETE",
                                step_number=699,
                                timestamp="1970-01-01T00:00:00Z",
                                agent_role="root_orchestrator",
                                tool_call="revised_why",
                                summary="Revised WHY pass complete",
                                request_payload={"incident_id": state.incident_id, "pass": 1},
                                response_payload={"hypotheses": len(state.hypotheses)},
                                status="SUCCESS",
                            )
                        )
                    except Exception as ex:
                        # restore prior hypotheses to avoid leaving state in partially-updated form
                        state.hypotheses = prev_hypotheses
                        state.record_audit(
                            AuditEvent(
                                event_id="AUD-REVISED-WHY-FAIL",
                                step_number=699,
                                timestamp="1970-01-01T00:00:00Z",
                                agent_role="root_orchestrator",
                                tool_call="revised_why",
                                summary="Revised WHY failed; restored previous hypotheses",
                                request_payload={"incident_id": state.incident_id, "pass": 1},
                                response_payload={"error": str(ex)},
                                status="FAILED",
                            )
                        )

                    # Loop stop audit
                    state.record_audit(
                        AuditEvent(
                            event_id="AUD-LOOP-STOP",
                            step_number=999,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="root_orchestrator",
                            tool_call="workflow",
                            summary="Investigation loop completed (bounded)",
                            request_payload={"incident_id": state.incident_id, "passes": 1},
                            response_payload={"evidence_count": len(state.evidence), "hypotheses": len(state.hypotheses)},
                            status="COMPLETE",
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
