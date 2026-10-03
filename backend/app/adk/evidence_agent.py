from __future__ import annotations
from typing import Any, Dict, List

from google.adk.agents.llm_agent import LlmAgent
from google.adk.tools.function_tool import FunctionTool
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService

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
        # Use ADK FunctionTool(func=callable) so the tool declaration and argument
        # validation are generated automatically by ADK. We pass bound methods from
        # AllowlistedTools so FunctionTool can inspect the signature.
        self.func_tools = [
            FunctionTool(func=self.tools.get_asset_context),
            FunctionTool(func=self.tools.get_telemetry_window),
            FunctionTool(func=self.tools.get_maintenance_history),
            FunctionTool(func=self.tools.search_manual),
            FunctionTool(func=self.tools.get_prior_incidents),
            FunctionTool(func=self.tools.get_inspection_image),
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

    # ADK FunctionTool wraps the provided callable. No manual wrapper required.

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
                # Use provenance returned by telemetry points when available;
                # do not fabricate provenance URIs in production code. Tests
                # seed telemetry rows without provenance so we fall back to
                # an empty string which is acceptable to EvidenceRef.
                prov = getattr(p, "provenance", None) or ""
                ev = EvidenceRef(
                    evidence_id=f"TELEM-{asset_id or 'unknown'}-{p.timestamp}",
                    source="Telemetry",
                    timestamp=p.timestamp,
                    asset=asset_id or (state.asset_context.asset_id if state.asset_context else ""),
                    component="telemetry_aggregate",
                    observation=str({"vibration": p.vibration, "temperature": p.temperature, "motor_current": p.motor_current, "rpm": p.rpm, "pressure": p.pressure}),
                    provenance=prov,
                    status="Observed",
                    confidence="High",
                )
                # Avoid duplicate evidence ids
                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
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

        # Maintenance history
        try:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-MAINT-START",
                    step_number=3,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_maintenance_history",
                    summary="Maintenance history fetch start",
                    request_payload={"asset_id": asset_id},
                    response_payload={},
                    status="STARTED",
                )
            )
            maint = self.tools.get_maintenance_history({"asset_id": asset_id or ""})
            added = 0
            for w in maint.work_orders:
                # try to enrich with asset/component from evidence repo if present
                candidate = None
                try:
                    candidate = self.tools.evidence_repo.get_evidence(w.incident_id, w.evidence_id)
                except Exception:
                    candidate = None
                asset_field = (candidate.get("asset") if candidate else None) or (state.asset_context.asset_id if state.asset_context else "")
                component_field = (candidate.get("component") if candidate else None) or ""
                observation = w.document_snippet or w.observation or w.details or ""
                ev = EvidenceRef(
                    evidence_id=w.evidence_id,
                    source="Maintenance",
                    timestamp=w.timestamp,
                    asset=asset_field,
                    component=component_field,
                    observation=observation,
                    provenance=w.provenance or (candidate.get("provenance") if candidate else ""),
                    status="Observed",
                    confidence=w.confidence or (candidate.get("confidence") if candidate else ""),
                )
                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                    state.add_evidence(ev)
                    added += 1
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-MAINT-SUCCESS",
                    step_number=4,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_maintenance_history",
                    summary="Maintenance history fetched and normalized",
                    request_payload={"asset_id": asset_id},
                    response_payload={"count": added},
                    status="SUCCESS",
                )
            )
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-MAINT-MISSING",
                    step_number=4,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_maintenance_history",
                    summary="Maintenance history unavailable",
                    request_payload={"asset_id": asset_id},
                    response_payload={"error": str(ex)},
                    status="MISSING",
                )
            )

        # Search manuals (simple keyword-driven search)
        try:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-MANUAL-START",
                    step_number=5,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="search_manual",
                    summary="Manual search start",
                    request_payload={"asset_id": asset_id, "query": "spindle"},
                    response_payload={},
                    status="STARTED",
                )
            )
            manual = self.tools.search_manual({"query": "spindle", "asset_id": asset_id, "max_results": 5})
            added = 0
            for r in manual.results:
                candidate = None
                try:
                    candidate = self.tools.evidence_repo.get_evidence(r.incident_id, r.evidence_id)
                except Exception:
                    candidate = None
                timestamp_field = (candidate.get("timestamp") if candidate else None) or ""
                observation = (candidate.get("observation") if candidate else None) or (r.snippet or "")
                ev = EvidenceRef(
                    evidence_id=r.evidence_id,
                    source="ServiceManual",
                    timestamp=timestamp_field,
                    asset=(r.asset or (candidate.get("asset") if candidate else "")),
                    component=(r.component or (candidate.get("component") if candidate else "")),
                    observation=observation,
                    provenance=(r.provenance or (candidate.get("provenance") if candidate else "")),
                    status="Observed",
                    confidence=(r.confidence or (candidate.get("confidence") if candidate else "")),
                )
                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                    state.add_evidence(ev)
                    added += 1
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-MANUAL-SUCCESS",
                    step_number=6,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="search_manual",
                    summary="Manual search fetched and normalized",
                    request_payload={"asset_id": asset_id, "query": "spindle"},
                    response_payload={"count": added},
                    status="SUCCESS",
                )
            )
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-MANUAL-MISSING",
                    step_number=6,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="search_manual",
                    summary="Manual search unavailable",
                    request_payload={"asset_id": asset_id},
                    response_payload={"error": str(ex)},
                    status="MISSING",
                )
            )

        # Prior incidents (preserve summary semantics)
        try:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-PRIOR-START",
                    step_number=7,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_prior_incidents",
                    summary="Prior incidents fetch start",
                    request_payload={"asset_id": asset_id},
                    response_payload={},
                    status="STARTED",
                )
            )
            prior = self.tools.get_prior_incidents({"asset_id": asset_id, "limit": 5})
            added = 0
            for ps in prior.incidents:
                # gather underlying evidence ids if available
                related = []
                try:
                    evs = self.tools.evidence_service.list_evidence(ps.incident_id)
                    related = [e.evidence_id for e in evs]
                    # pick a representative timestamp if available
                    ts = evs[0].timestamp if evs and hasattr(evs[0], "timestamp") else ""
                except Exception:
                    ts = ""
                ev = EvidenceRef(
                    evidence_id=f"PRIOR-{ps.incident_id}",
                    source="PriorIncidentSummary",
                    timestamp=ts,
                    asset=asset_id or "",
                    component="",
                    observation=str(ps.telemetry_summary) if getattr(ps, "telemetry_summary", None) else "Prior incident summary",
                    provenance=f"incident://{ps.incident_id}",
                    status="Summary",
                    confidence="",
                )
                # attach related evidence ids as optional attribute if available
                try:
                    setattr(ev, "related_evidence_ids", related)
                except Exception:
                    pass
                if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                    state.add_evidence(ev)
                    added += 1
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-PRIOR-SUCCESS",
                    step_number=8,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_prior_incidents",
                    summary="Prior incidents fetched and summarized",
                    request_payload={"asset_id": asset_id},
                    response_payload={"count": added},
                    status="SUCCESS",
                )
            )
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-PRIOR-MISSING",
                    step_number=8,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_prior_incidents",
                    summary="Prior incidents unavailable",
                    request_payload={"asset_id": asset_id},
                    response_payload={"error": str(ex)},
                    status="MISSING",
                )
            )

        # Inspection image
        try:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-IMAGE-START",
                    step_number=9,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_inspection_image",
                    summary="Inspection image fetch start",
                    request_payload={"incident_id": state.incident_id},
                    response_payload={},
                    status="STARTED",
                )
            )
            img = self.tools.get_inspection_image({"incident_id": state.incident_id})
            # storage metadata may be attached
            ev = EvidenceRef(
                evidence_id=img.evidence_id,
                source="InspectionImage",
                timestamp=img.timestamp,
                asset=img.asset,
                component=img.component,
                observation=(getattr(img, "observation", "") or ""),
                provenance=img.provenance or "",
                status="Observed",
                confidence="",
            )
            # attempt to attach storage metadata onto the evidence ref if present
            if getattr(img, "storage_metadata", None):
                try:
                    setattr(ev, "storage_metadata", img.storage_metadata)
                except Exception:
                    pass
            if not any(e.evidence_id == ev.evidence_id for e in state.evidence):
                state.add_evidence(ev)
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-IMAGE-SUCCESS",
                    step_number=10,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_inspection_image",
                    summary="Inspection image fetched and normalized",
                    request_payload={"incident_id": state.incident_id},
                    response_payload={"evidence_id": img.evidence_id},
                    status="SUCCESS",
                )
            )
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-EVIDENCE-IMAGE-MISSING",
                    step_number=10,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="evidence_agent",
                    tool_call="get_inspection_image",
                    summary="Inspection image unavailable",
                    request_payload={"incident_id": state.incident_id},
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
