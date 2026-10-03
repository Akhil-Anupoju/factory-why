from __future__ import annotations
from typing import Any, Dict, List
try:
    from google.adk.agents.llm_agent import LlmAgent
    from google.adk.tools.function_tool import FunctionTool
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
except Exception:
    # Provide lightweight local shims so tests run without installing ADK.
    class FunctionTool:
        def __init__(self, name: str, description: str = "", execute=None, parameters=None):
            self.name = name
            self.description = description
            self.execute = execute

    class LlmAgent:
        def __init__(self, model: str = "local", name: str | None = None, instruction: str | None = None, tools: list | None = None, **kwargs):
            self.model = model
            self.name = name
            self.instruction = instruction
            self.tools = tools or []

    class InMemorySessionService:
        def __init__(self, *args, **kwargs):
            pass

    class Runner:
        def __init__(self, agent: LlmAgent, app_name: str, session_service: InMemorySessionService, *args, **kwargs):
            self.agent = agent
            self.app_name = app_name
            self.session_service = session_service

from ..tools.tool_impl import (
    AllowlistedTools,
)
from ..adk.state import InvestigationState, EvidenceRef, AuditEvent, AssetContext


class EvidenceAgent:
    """Wraps an ADK LlmAgent that is restricted to calling allowlisted tools

    For Phase 3B this agent is read-only: it queries the allowlisted tools,
    normalizes the responses, and writes EvidenceRef objects into the
    InvestigationState. The agent's LLM is mocked in tests; in production it
    will be configured via ModelConfig boundary.
    """

    def __init__(self, tools: AllowlistedTools, model: str = "local-fake") -> None:
        self.tools = tools
        # Wrap the thin tool functions as FunctionTool instances the ADK agent can call.
        # FunctionTool expects an execute(fn) callable signature.
        self.func_tools = [
            FunctionTool(name="get_asset_context", description="Get asset context", execute=self._wrap(self.tools.get_asset_context)),
            FunctionTool(name="get_telemetry_window", description="Get telemetry window", execute=self._wrap(self.tools.get_telemetry_window)),
            FunctionTool(name="get_maintenance_history", description="Get maintenance history", execute=self._wrap(self.tools.get_maintenance_history)),
            FunctionTool(name="search_manual", description="Search maintenance manual", execute=self._wrap(self.tools.search_manual)),
            FunctionTool(name="get_prior_incidents", description="Get prior incidents", execute=self._wrap(self.tools.get_prior_incidents)),
            FunctionTool(name="get_inspection_image", description="Get inspection image", execute=self._wrap(self.tools.get_inspection_image)),
        ]

        # Create a minimal LlmAgent; instruction constrains it to only call the provided tools
        instr = """
        You are an evidence collection assistant. Given an incident_id and asset context,
        call only the provided allowlisted tools to collect observed evidence. Do not invent
        telemetry, maintenance records, documents, images, or provenance. If a source is
        unavailable, represent it explicitly with an error or empty result.
        Output a JSON object with a single key `evidence_bundle` which is a list of evidence
        items using the EvidenceRef contract: evidence_id, source, timestamp, asset, component,
        observation, provenance, status, confidence.
        """

        # LlmAgent is not actually invoked for deterministic tests; we keep the shape to
        # follow ADK patterns and to allow swapping in a real model later.
        self.agent = LlmAgent(model=model, name="evidence_agent", instruction=instr, tools=self.func_tools)

        # Runner/session for execution
        self.session_service = InMemorySessionService()
        self.runner = Runner(agent=self.agent, app_name="factory-why", session_service=self.session_service)

    def _wrap(self, fn):
        # Adapter to match FunctionTool.execute signature
        def _exec(ctx, args: Dict[str, Any]):
            return fn(args)

        return _exec

    def run(self, state: InvestigationState) -> InvestigationState:
        # For Phase 3B we do not actually call the LLM in tests; instead we deterministically
        # call the allowlisted tools from business logic to fetch evidence. This keeps the
        # agent read-only and auditable.
        # Record workflow start audit
        state.record_audit(
            AuditEvent(
                event_id="AUD-EVIDENCE-START",
                step_number=0,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="evidence_agent",
                tool_call="run",
                summary="Evidence agent started",
                request_payload={"incident_id": state.incident_id},
                response_payload={},
                status="STARTED",
            )
        )

        # Determine asset context via tool. If not provided in state, try to fetch from incident repo.
        asset_id = None
        if state.asset_context and getattr(state.asset_context, "asset_id", None):
            asset_id = state.asset_context.asset_id
        else:
            # best-effort: try to derive asset from incident repository exposed on tools
            try:
                inc = self.tools.incident_repo.get_incident(state.incident_id)
                asset_id = (inc or {}).get("asset", {}).get("asset_id")
            except Exception:
                asset_id = None

        if asset_id:
            try:
                ac = self.tools.get_asset_context({"asset_id": asset_id})
                # populate ADK AssetContext on state
                state.asset_context = AssetContext(asset_id=ac.asset_id, name=ac.name, model=ac.model, line=ac.line, facility=ac.facility)
                # record success
                state.record_audit(
                    AuditEvent(
                        event_id="AUD-EVIDENCE-ASSET-FOUND",
                        step_number=1,
                        timestamp="1970-01-01T00:00:00Z",
                        agent_role="evidence_agent",
                        tool_call="get_asset_context",
                        summary="Asset context found",
                        request_payload={"asset_id": asset_id},
                        response_payload={"asset_id": ac.asset_id},
                        status="SUCCESS",
                    )
                )
            except Exception as ex:
                # record missing asset context
                state.record_audit(
                    AuditEvent(
                        event_id="AUD-EVIDENCE-ASSET-MISSING",
                        step_number=1,
                        timestamp="1970-01-01T00:00:00Z",
                        agent_role="evidence_agent",
                        tool_call="get_asset_context",
                        summary="Asset context unavailable",
                        request_payload={"asset_id": asset_id},
                        response_payload={"error": str(ex)},
                        status="MISSING",
                    )
                )
        else:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-ASSET-MISSING",
                    step_number=1,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_asset_context",
                    summary="Asset context unavailable (no asset_id found)",
                    request_payload={"incident_id": state.incident_id},
                    response_payload={},
                    status="MISSING",
                )
            )

        # Fetch telemetry (best-effort)
        try:
            telem = self.tools.get_telemetry_window({"asset_id": state.asset_context.asset_id if state.asset_context else ""})
            # Normalize telemetry points into EvidenceRef entries
            for p in telem.points:
                # normalize telemetry into EvidenceRef while preserving observed status
                ev = EvidenceRef(
                    evidence_id=f"TELEM-{asset_id or 'unknown'}-{p.timestamp}",
                    source="Telemetry",
                    timestamp=p.timestamp,
                    asset=asset_id or (state.asset_context.asset_id if state.asset_context else ""),
                    component="telemetry_aggregate",
                    observation=str({"vibration": p.vibration, "temperature": p.temperature, "motor_current": p.motor_current, "rpm": p.rpm, "pressure": p.pressure}),
                    provenance="telemetry://in-memory",
                    status="Observed",
                    confidence="High",
                )
                state.add_evidence(ev)
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-TELEMETRY",
                    step_number=2,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_telemetry_window",
                    summary="Telemetry fetched and normalized",
                    request_payload={"asset_id": state.asset_context.asset_id if state.asset_context else None},
                    response_payload={"count": len(telem.points)},
                    status="SUCCESS",
                )
            )
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-TELEMETRY-MISSING",
                    step_number=2,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_telemetry_window",
                    summary="Telemetry unavailable",
                    request_payload={"asset_id": state.asset_context.asset_id if state.asset_context else None},
                    response_payload={"error": str(ex)},
                    status="MISSING",
                )
            )

        # For Phase 3B we stop here — Evidence Agent collects observable evidence and records audits.
        state.record_audit(
            AuditEvent(
                event_id="AUD-EVIDENCE-COMPLETE",
                step_number=99,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="evidence_agent",
                tool_call="run",
                summary="Evidence agent completed",
                request_payload={"incident_id": state.incident_id},
                response_payload={"evidence_count": len(state.evidence)},
                status="SUCCESS",
            )
        )
        return state
