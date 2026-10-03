from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ValidationError

from google.adk.agents.llm_agent import LlmAgent
from google.adk.tools.function_tool import FunctionTool
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService

from .state import InvestigationState, AuditEvent
from ..adk.state import CriticFinding as StateCriticFinding


class CriticOutputModel(BaseModel):
    critic_id: str
    target_hypothesis_id: Optional[str]
    contradictions: List[Dict[str, Any]] = []
    ignored_evidence_ids: List[str] = []
    falsification_check: Optional[str] = None
    most_discriminating_missing_evidence: Optional[str] = None
    confidence_revision: Optional[float] = None
    # request_more_evidence: optional dict with tool and params, e.g. {"tool": "get_inspection_image", "params": {"incident_id": "INC-..."}}
    request_more_evidence: Optional[Dict[str, Any]] = None


class CriticAgent:
    """ADK-backed Critic Agent.

    In tests model_runner_override must be supplied. In production a real
    LlmAgent may be configured via model string.
    """

    ALLOWED_TOOLS = {
        "get_asset_context",
        "get_telemetry_window",
        "get_maintenance_history",
        "search_manual",
        "get_prior_incidents",
        "get_inspection_image",
    }

    def __init__(self, model: str | None = "gemini-flash-latest") -> None:
        self.model = model
        if self.model is None:
            self.agent = None
            self.session_service = None
            self.runner = None
            return

        instruction = (
            "You are a Critic Agent. Review the leading hypothesis against the supplied evidence bundle. "
            "Return a JSON object matching the CriticOutputModel: critic_id, target_hypothesis_id, contradictions (list of {point, conflicting_evidence_ids, rationale}), "
            "ignored_evidence_ids (list), falsification_check (string), most_discriminating_missing_evidence (string), confidence_revision (float), request_more_evidence (optional dict: {tool, params})."
        )

        self.agent = LlmAgent(name="critic_agent", model=self.model, instruction=instruction, output_schema={"type": "object"})
        self.session_service = InMemorySessionService()
        self.runner = Runner(agent=self.agent, app_name="factory-why", session_service=self.session_service)

    def _validate_and_parse(self, raw: Any, evidence_ids: List[str]) -> CriticFinding:
        # Accept dict-like raw output
        if not isinstance(raw, dict):
            raise ValidationError(f"Unexpected Critic output shape: {type(raw)}")

        try:
            parsed = CriticOutputModel.model_validate(raw)
        except ValidationError:
            raise

        # Grounding validation: any evidence ids referenced must exist
        refs = []
        for c in parsed.contradictions or []:
            # contradictions may include conflicting_evidence_ids
            if isinstance(c, dict):
                ce = c.get("conflicting_evidence_ids") or []
                refs.extend([e for e in ce if e])

        refs.extend(parsed.ignored_evidence_ids or [])

        for eid in refs:
            if eid and eid not in evidence_ids:
                raise ValidationError(f"Unknown evidence id referenced in critic: {eid}")

        # Validate requested tool if present
        if parsed.request_more_evidence:
            tool = parsed.request_more_evidence.get("tool")
            if tool not in self.ALLOWED_TOOLS:
                raise ValidationError(f"Requested tool '{tool}' is not an allowlisted tool")

        # Map CriticOutputModel -> CriticFinding (adk.state model)
        cf = StateCriticFinding(
            critic_id=parsed.critic_id,
            target_hypothesis_id=parsed.target_hypothesis_id,
            contradictions=parsed.contradictions or [],
            ignored_evidence=[{"evidence_id": eid} for eid in (parsed.ignored_evidence_ids or [])],
            falsification_condition=parsed.falsification_check or "",
            most_discriminating_missing_evidence=parsed.most_discriminating_missing_evidence or "",
            confidence_revision=parsed.confidence_revision,
            request_more_evidence=parsed.request_more_evidence,
        )
        return cf

    def run(self, state: InvestigationState, leading_hypothesis_id: Optional[str] = None, model_runner_override: Optional[callable] = None) -> CriticFinding:
        # record critic start
        state.record_audit(
            AuditEvent(
                event_id="AUD-CRITIC-START",
                step_number=400,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="critic_agent",
                tool_call="run",
                summary="Critic agent started",
                request_payload={"incident_id": state.incident_id, "leading_hypothesis_id": leading_hypothesis_id},
                response_payload={},
                status="STARTED",
            )
        )

        evidence_bundle = state.build_evidence_bundle()
        evidence_ids = [e.evidence_id for e in state.evidence]

        if model_runner_override:
            raw_out = model_runner_override(state.incident_id, state.asset_context, evidence_bundle)
        else:
            raise RuntimeError("Live Critic model invocation disabled in tests; provide model_runner_override")

        try:
            cf = self._validate_and_parse(raw_out, evidence_ids)
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-CRITIC-VALIDATION-FAIL",
                    step_number=410,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="critic_agent",
                    tool_call="validate_output",
                    summary="Critic output validation failed",
                    request_payload={"raw_output": str(raw_out)[:1024]},
                    response_payload={"error": str(ex)},
                    status="FAILED",
                )
            )
            raise

        # append to state critic_findings
        state.critic_findings.append(cf)

        state.record_audit(
            AuditEvent(
                event_id="AUD-CRITIC-COMPLETE",
                step_number=499,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="critic_agent",
                tool_call="run",
                summary="Critic agent completed",
                request_payload={"incident_id": state.incident_id},
                response_payload={"critic_id": cf.critic_id},
                status="SUCCESS",
            )
        )

        return cf
