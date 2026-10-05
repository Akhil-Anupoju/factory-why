from __future__ import annotations
from typing import Dict, Any
import os
import json
import logging

from .model_config import ModelConfigLoader
from .state import AuditEvent

logger = logging.getLogger(__name__)


class ADKRunner:
    """Minimal runner that will be used by tests to boot the ADK boundary.

    It does not contact any model provider. It exposes a `run_workflow` API
    accepting a RootOrchestrator and an InvestigationState.
    """

    def __init__(self, services: Dict[str, Any] | None = None):
        self.services = services or {}
        self.model_config = ModelConfigLoader.load_from_env()

    def run_workflow(self, orchestrator, state):
        """Prepare an optional live model runner (opt-in) and execute the
        provided orchestrator against the given InvestigationState.

        Behavior:
        - If FACTORY_WHY_LIVE_MODEL_TESTS is truthy AND the configured
          model provider is `vertex_ai`, attach a `model_runner_override`
          into the orchestrator.services so Why/Critic agents may call the
          live model. The actual model call is performed lazily inside the
          override and will only run when the orchestrator invokes WHY/CRITIC.
        - Otherwise leave orchestrator.services unchanged so the orchestrator
          will skip live model calls (existing default behavior).
        """

        live_flag = os.getenv("FACTORY_WHY_LIVE_MODEL_TESTS", "0")
        enabled = live_flag not in ("", "0", "false", "False", "no", "None")

        # Only enable live Vertex tests when explicitly requested
        if enabled and (self.model_config.provider or "").lower() == "vertex_ai":
            # record configured model metadata into the investigation audit
            try:
                state.record_audit(
                    AuditEvent(
                        event_id="AUD-MODEL-CONFIG",
                        step_number=1,
                        timestamp="1970-01-01T00:00:00Z",
                        agent_role="adk_runner",
                        tool_call="configure_model",
                        summary="Live model configured (opt-in)",
                        request_payload={
                            "provider": self.model_config.provider,
                            "model": self.model_config.model_name,
                            "max_tokens": self.model_config.max_tokens,
                            "temperature": self.model_config.temperature,
                        },
                        response_payload={},
                        status="CONFIGURED",
                    )
                )
            except Exception:
                # audit best-effort; do not fail workflow on audit write error
                logger.exception("failed to record model-config audit event")

            # Build a model runner override that will instantiate a minimal
            # LlmAgent/Runner and synchronously execute the model. Keep imports
            # local to avoid heavy startup cost when not used.
            def model_runner(incident_id, asset_context, evidence_bundle):
                # Compose a compact user message for the model using the
                # supplied evidence bundle. The agents (Why/Critic) perform
                # strict post-run validation so the model text may be JSON or
                # plain text; we attempt to parse JSON where possible.
                try:
                    from google.adk.agents.llm_agent import LlmAgent
                    from google.adk.runners import Runner
                    from google.adk.sessions.in_memory_session_service import InMemorySessionService
                except Exception as e:
                    logger.exception("failed to import ADK runtime for live model")
                    raise RuntimeError("ADK runtime unavailable for live model") from e

                user_msg = (
                    f"Incident: {incident_id}\n"
                    f"AssetContext: {json.dumps(asset_context) if asset_context else '{}'}\n"
                    f"Evidence: {json.dumps(evidence_bundle)}\n"
                    "Respond with the structured JSON required by the calling agent."
                )

                # Create a transient LlmAgent/Runner for this single call. We
                # pass the configured model name and rely on ADC for auth.
                agent = LlmAgent(name="factory-why-live", model=self.model_config.model_name, instruction=user_msg, output_schema={})
                runner = Runner(app_name="factory-why", agent=agent, session_service=InMemorySessionService())

                # run_debug returns a list of Events; find the most-recent output
                events = runner.run_debug(user_messages=[user_msg], user_id="factory-why", session_id="live-run", quiet=True)
                raw_out = None
                for ev in reversed(events):
                    out = getattr(ev, "output", None)
                    if out is not None:
                        raw_out = out
                        break

                # If model returned a string, attempt JSON parse, else return as-is
                if isinstance(raw_out, str):
                    try:
                        return json.loads(raw_out)
                    except Exception:
                        return raw_out
                return raw_out

            # Attach override and model name into orchestrator services for use by RootOrchestrator
            orchestrator.services["model_runner_override"] = model_runner
            orchestrator.services["model"] = self.model_config.model_name

        # Execute the orchestrator (existing behavior unchanged when not enabled)
        return orchestrator.run(state)
