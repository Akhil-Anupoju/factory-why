from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ValidationError
import inspect

from google.adk.agents.llm_agent import LlmAgent
from google.adk.tools.function_tool import FunctionTool
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService

from .state import InvestigationState, EvidenceRef, AuditEvent
from ..schemas import Hypothesis as SchemaHypothesis


class HypothesisModel(BaseModel):
    hypothesis_id: str
    description: str
    status: str
    confidence: float
    supporting_evidence_ids: List[str]
    counter_evidence_ids: List[str]
    missing_evidence: List[str]
    next_discriminating_check: Optional[str] = None


class WhyAgent:
    """ADK-backed WHY Agent using LlmAgent.

    The WhyAgent uses an LlmAgent with an output_schema to request structured
    hypotheses from the model. In tests we replace the model invocation with a
    deterministic fake response via dependency injection.
    """

    def __init__(self, model: str | None = "gemini-flash-latest") -> None:
        self.model = model
        # If no model is provided, skip creating ADK LlmAgent/Runner so tests can
        # instantiate WhyAgent without triggering ADK model validation or network
        # calls. The run() method will accept a model_runner_override in tests.
        if self.model is None:
            self.agent = None
            self.session_service = None
            self.runner = None
            return

        # Create a minimal LlmAgent configured to output a list of hypotheses
        instruction = (
            "You are a WHY Agent that generates 2-3 competing causal hypotheses. "
            "Always separate OBSERVED evidence (by evidence_id) from INFERRED reasoning. "
            "Return a JSON object: {\"hypotheses\": [ ... ]} where each hypothesis follows the schema: "
            "hypothesis_id, description, status (SUPPORTED|LIKELY|COMPETING|UNRESOLVED|CONTRADICTED), confidence (0.0-1.0), supporting_evidence_ids, counter_evidence_ids, missing_evidence, next_discriminating_check. "
        )

        # Use output_schema as a Pydantic model for validation in ADK
        # ADK will enforce structured output when provided with output_schema
        self.agent = LlmAgent(
            name="why_agent",
            model=self.model,
            instruction=instruction,
            output_schema={"type": "array"},  # placeholder; we will validate via Pydantic after run
        )

        self.session_service = InMemorySessionService()
        self.runner = Runner(app_name="factory-why", agent=self.agent, session_service=self.session_service)

    def _validate_and_parse(self, raw: Any, evidence_ids: List[str]) -> List[HypothesisModel]:
        """Validate and parse raw model output into HypothesisModel instances.

        Accepts either a list of hypothesis dicts or a dict with key 'hypotheses'.
        Enforces grounding (all referenced evidence IDs exist), allowed status
        values, and that the model returns between 2 and 3 hypotheses.
        """
        # normalize shape: accept {"hypotheses": [...]} or a bare list
        if isinstance(raw, dict) and "hypotheses" in raw:
            raw_list = raw["hypotheses"]
        elif isinstance(raw, list):
            raw_list = raw
        else:
            # Use a plain ValueError here. Constructing pydantic.ValidationError
            # with a simple message is incorrect (it expects line_errors) and
            # leads to a TypeError during exception construction. We still
            # re-raise real pydantic.ValidationError from model_validate below.
            raise ValueError(f"Unexpected model output shape: {type(raw)}")

        parsed: List[HypothesisModel] = []
        allowed_statuses = {"SUPPORTED", "LIKELY", "COMPETING", "UNRESOLVED", "CONTRADICTED"}

        for i, h in enumerate(raw_list or []):
            try:
                hyp = HypothesisModel.model_validate(h)
            except ValidationError:
                # re-raise clear validation errors coming from Pydantic
                raise

            # Normalize status and validate allowed values
            hyp_status = (hyp.status or "").upper()
            if hyp_status not in allowed_statuses:
                # Use ValueError for internal validation failures so the
                # exception can be stringified safely when auditing.
                raise ValueError(f"Unsupported hypothesis status: {hyp.status}")
            hyp.status = hyp_status

            # grounding validation: ensure supporting/counter ids are present in evidence bundle
            for eid in (hyp.supporting_evidence_ids or []) + (hyp.counter_evidence_ids or []):
                if eid and eid not in evidence_ids:
                    raise ValueError(f"Unknown evidence id referenced: {eid}")

            parsed.append(hyp)

        # Enforce 2-3 hypotheses constraint for Phase 3C
        if not (2 <= len(parsed) <= 3):
            raise ValueError(f"Model must return 2-3 hypotheses; got {len(parsed)}")

        return parsed

    def run(self, state: InvestigationState, model_runner_override: Optional[callable] = None) -> InvestigationState:
        # Record why reasoning start
        state.record_audit(
            AuditEvent(
                event_id="AUD-WHY-START",
                step_number=200,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="why_agent",
                tool_call="run",
                summary="WHY agent started",
                request_payload={"incident_id": state.incident_id},
                response_payload={},
                status="STARTED",
            )
        )

        # Build evidence bundle for model input (dict with incident_id, asset_context, evidence[])
        evidence_bundle = state.build_evidence_bundle()
        evidence_ids = [e.evidence_id for e in state.evidence]

        # call model (in tests this can be replaced by model_runner_override)
        if model_runner_override:
            # Be tolerant of two model_runner_override signatures used in
            # unit tests and live runner: some accept an `agent_role` kwarg,
            # others accept only positional args. Inspect the signature and
            # call accordingly to preserve backward compatibility.
            try:
                sig = inspect.signature(model_runner_override)
                if "agent_role" in sig.parameters:
                    raw_out = model_runner_override(state.incident_id, state.asset_context, evidence_bundle, agent_role="why_agent")
                else:
                    raw_out = model_runner_override(state.incident_id, state.asset_context, evidence_bundle)
            except (TypeError, ValueError):
                # If signature inspection fails, fallback to a best-effort call
                try:
                    raw_out = model_runner_override(state.incident_id, state.asset_context, evidence_bundle, agent_role="why_agent")
                except TypeError:
                    raw_out = model_runner_override(state.incident_id, state.asset_context, evidence_bundle)
        else:
            # In real ADK usage, we would run the agent runner to call the model.
            # For now, raise to avoid accidental network calls in unit tests.
            raise RuntimeError("Live model invocation is disabled in unit tests; provide model_runner_override for testing")

        # validate model output
        try:
            hyps = self._validate_and_parse(raw_out, evidence_ids)
        except Exception as ex:
            state.record_audit(
                AuditEvent(
                    event_id="AUD-WHY-VALIDATION-FAIL",
                    step_number=210,
                    timestamp="1970-01-01T00:00:00Z",
                    agent_role="why_agent",
                    tool_call="validate_output",
                    summary="WHY output validation failed",
                    request_payload={"raw_output": str(raw_out)[:1024]},
                    response_payload={"error": str(ex)},
                    status="FAILED",
                )
            )
            raise

        # integrate into state.hypotheses (convert HypothesisModel -> SchemaHypothesis if needed)
        for h in hyps:
            # Map to backend.schemas.Hypothesis shape where possible
            sh = SchemaHypothesis(
                hypothesis_id=h.hypothesis_id,
                title=(h.description[:80] if h.description else h.hypothesis_id),
                description=h.description,
                status=h.status,
                confidence=h.confidence,
                inferred_mechanism="",
                supporting_evidence_ids=h.supporting_evidence_ids,
                counter_evidence_ids=h.counter_evidence_ids,
                missing_evidence=h.missing_evidence,
                next_discriminating_check=h.next_discriminating_check or "",
                likelihood_rank=0,
            )
            state.hypotheses.append(sh)

        state.record_audit(
            AuditEvent(
                event_id="AUD-WHY-COMPLETE",
                step_number=299,
                timestamp="1970-01-01T00:00:00Z",
                agent_role="why_agent",
                tool_call="run",
                summary="WHY agent completed",
                request_payload={"incident_id": state.incident_id},
                response_payload={"hypotheses_count": len(hyps)},
                status="SUCCESS",
            )
        )

        return state
