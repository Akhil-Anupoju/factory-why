from __future__ import annotations
from typing import Dict, Any
import os
import json
import logging
import asyncio
import inspect

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
            def model_runner(incident_id, asset_context, evidence_bundle, *, agent_role: str = "why_agent"):
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

                # Build a templated prompt per agent role using the new prompts module
                from . import prompts

                incident_ctx = incident_id if not asset_context else asset_context
                evidence_list = evidence_bundle.get("evidence", []) if isinstance(evidence_bundle, dict) else []
                if agent_role == "why_agent":
                    user_msg = prompts.render_why_prompt(incident_ctx, evidence_list)
                    prompt_hash = prompts.compute_prompt_hash(prompts.WHY_PROMPT_TEMPLATE)
                    schema_version = prompts.WHY_SCHEMA_VERSION
                else:
                    user_msg = prompts.render_critic_prompt(incident_ctx, evidence_list)
                    prompt_hash = prompts.compute_prompt_hash(prompts.CRITIC_PROMPT_TEMPLATE)
                    schema_version = prompts.CRITIC_SCHEMA_VERSION

                # record minimal audit metadata for prompt used
                try:
                    state.record_audit(
                        AuditEvent(
                            event_id=f"AUD-MODEL-PROMPT-{agent_role.upper()}",
                            step_number=5,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="adk_runner",
                            tool_call="prepare_prompt",
                            summary=f"Prepared prompt for {agent_role}",
                            request_payload={"prompt_hash": prompt_hash, "schema": schema_version},
                            response_payload={},
                            status="READY",
                        )
                    )
                except Exception:
                    logger.exception("failed to record model prompt audit event")

                # Additional safe diagnostics: record types and sizes to help debug
                try:
                    meta = {
                        "incident_ctx_type": type(incident_ctx).__name__,
                        "has_model_dump": bool(getattr(incident_ctx, "model_dump", None)),
                        "evidence_count": len(evidence_list) if hasattr(evidence_list, '__len__') else None,
                        "user_msg_length": len(user_msg) if isinstance(user_msg, str) else None,
                    }
                    state.record_audit(
                        AuditEvent(
                            event_id=f"AUD-MODEL-PROMPT-META-{agent_role.upper()}",
                            step_number=5,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="adk_runner",
                            tool_call="prepare_prompt_meta",
                            summary=f"Prompt meta for {agent_role}",
                            request_payload={"prompt_hash": prompt_hash},
                            response_payload=meta,
                            status="META",
                        )
                    )
                except Exception:
                    logger.exception("failed to record model prompt meta audit event")

                # Create a transient LlmAgent/Runner for this single call. We
                # pass the configured model name and rely on ADC for auth.
                # Ensure the agent name is a valid Python identifier (ADK requires this).
                safe_agent_name = f"factory_why_{agent_role}".replace("-", "_")
                agent = LlmAgent(name=safe_agent_name, model=self.model_config.model_name, instruction=user_msg, output_schema={})
                runner = Runner(app_name="factory-why", agent=agent, session_service=InMemorySessionService())

                # run_debug returns a list of Events; it may be awaitable in some
                # ADK versions. Support both synchronous and coroutine returns.
                maybe_events = runner.run_debug(user_messages=[user_msg], user_id="factory-why", session_id="live-run", quiet=True)
                events = None
                await_error = None
                if inspect.isawaitable(maybe_events):
                    try:
                        events = asyncio.run(maybe_events)
                    except Exception as e:
                        # Attempt run_until_complete as a fallback
                        try:
                            loop = asyncio.get_event_loop()
                            events = loop.run_until_complete(maybe_events)
                        except Exception as e2:
                            await_error = f"await-failed: {e}; {e2}"
                            events = []
                else:
                    events = maybe_events or []

                # Extract most recent non-empty output from events
                raw_out = None
                try:
                    rev = list(reversed(events)) if hasattr(events, "__iter__") else []
                    for ev in rev:
                        # ADK Event shape may store content under 'output' or 'content'
                        out = getattr(ev, "output", None)
                        if out is None:
                            # ADK sometimes uses 'content' or 'value'
                            out = getattr(ev, "content", None) or getattr(ev, "value", None)
                        if out is not None:
                            raw_out = out
                            break
                except Exception as e:
                    # record minimal await error
                    raw_out = None
                    await_error = str(e)

                # Validate and parse returned text safely - do not log full response
                safe_meta = {
                    "provider": self.model_config.provider,
                    "model": self.model_config.model_name,
                    "prompt_hash": prompt_hash,
                }

                # Normalize raw_out into a text candidate where possible. Some
                # ADK/genai runtime versions return a google.genai.types.Content
                # object (pydantic model) rather than a plain string. Attempt to
                # extract textual parts (and function call arguments) before
                # trying to JSON-parse. Keep diagnostics small and do not log the
                # full response.
                parsed = None
                parse_exception = None
                json_parse_succeeded = False

                def _strip_code_fences(t: str) -> str:
                    # If model wrapped JSON in triple-backtick fences, extract inner content
                    if not isinstance(t, str):
                        return t
                    if "```" in t:
                        try:
                            first = t.find("```")
                            second = t.find("```", first + 3)
                            if second != -1:
                                inner = t[first + 3 : second]
                                # drop a leading language tag like 'json' on the first line
                                if "\n" in inner:
                                    firstline, rest = inner.split("\n", 1)
                                    if firstline.strip().lower() == "json":
                                        return rest.strip()
                                return inner.strip()
                        except Exception:
                            return t
                    return t

                extracted_text = None
                try:
                    # Plain string case
                    if isinstance(raw_out, str):
                        extracted_text = raw_out
                    else:
                        # If a pydantic model with model_dump, try to extract parts
                        if hasattr(raw_out, "model_dump"):
                            try:
                                md = raw_out.model_dump()
                            except Exception:
                                md = None
                        else:
                            md = None

                        if isinstance(md, dict) and md.get("parts"):
                            parts = md.get("parts") or []
                            texts = []
                            for p in parts:
                                if isinstance(p, dict):
                                    # common fields: 'text', 'function_call' (with 'arguments')
                                    if p.get("text"):
                                        texts.append(p.get("text"))
                                    elif p.get("function_call") and isinstance(p.get("function_call"), dict):
                                        fc = p.get("function_call")
                                        args = fc.get("arguments") or fc.get("args")
                                        if isinstance(args, str):
                                            texts.append(args)
                                        else:
                                            try:
                                                texts.append(json.dumps(args))
                                            except Exception:
                                                pass
                                else:
                                    # p may be a pydantic Part model
                                    text_field = getattr(p, "text", None)
                                    if text_field:
                                        texts.append(text_field)
                                    else:
                                        fc = getattr(p, "function_call", None) or getattr(p, "functionCall", None)
                                        if fc is not None:
                                            args = getattr(fc, "arguments", None) or getattr(fc, "args", None)
                                            if isinstance(args, str):
                                                texts.append(args)
                                            else:
                                                try:
                                                    texts.append(json.dumps(args))
                                                except Exception:
                                                    pass

                            if texts:
                                extracted_text = "\n".join([t for t in texts if t])
                        # If we didn't get text above, as a last resort, attempt to
                        # call model_dump_json to get a string representation.
                        if extracted_text is None:
                            if hasattr(raw_out, "model_dump_json"):
                                try:
                                    extracted_text = raw_out.model_dump_json()
                                except Exception:
                                    extracted_text = None
                            else:
                                # fallback to str()
                                extracted_text = str(raw_out)
                except Exception as e:
                    # keep parse_exception small and non-sensitive
                    extracted_text = None
                    parse_exception = str(e)[:400]

                # If we have extracted a text candidate, strip code fences and
                # attempt to JSON-parse. Otherwise, fall back to returning the
                # raw object for downstream validation to catch.
                if isinstance(extracted_text, str):
                    extracted_text = _strip_code_fences(extracted_text)
                    try:
                        parsed = json.loads(extracted_text)
                        json_parse_succeeded = True
                    except Exception as e:
                        parse_exception = str(e)[:400]
                        parsed = extracted_text
                        json_parse_succeeded = False
                else:
                    parsed = raw_out
                    json_parse_succeeded = isinstance(parsed, (dict, list))

                # build diagnostics (safe) for auditing
                try:
                    top_level_type = type(parsed).__name__ if parsed is not None else None
                    top_level_keys = list(parsed.keys())[:20] if isinstance(parsed, dict) else None
                    list_length = len(parsed) if isinstance(parsed, list) else None
                    snippet = None
                    if isinstance(raw_out, str):
                        snippet_raw = raw_out[:200]
                        # redact obvious sensitive tokens
                        for forbidden in ("Authorization", "authorization", "token", "private_key", "secret"):
                            snippet_raw = snippet_raw.replace(forbidden, "[REDACTED]")
                        snippet = snippet_raw

                    model_diag = {
                        "response_type": type(raw_out).__name__,
                        "has_text": isinstance(raw_out, str),
                        "text_length": len(raw_out) if isinstance(raw_out, str) else None,
                        "json_parse_attempted": isinstance(raw_out, str),
                        "json_parse_succeeded": json_parse_succeeded,
                        "top_level_type": top_level_type,
                        "top_level_keys": top_level_keys,
                        "list_length": list_length,
                        "first_200_chars": snippet,
                        "parse_exception": parse_exception,
                        "await_error": await_error,
                    }

                    state.record_audit(
                        AuditEvent(
                            event_id=f"AUD-MODEL-DIAG-{agent_role.upper()}",
                            step_number=7,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="adk_runner",
                            tool_call="model_diagnostics",
                            summary="Model response diagnostics (opt-in)",
                            request_payload={"prompt_hash": prompt_hash, "schema": schema_version},
                            response_payload=model_diag,
                            status="DIAG",
                        )
                    )
                except Exception:
                    logger.exception("failed to record model diagnostics")

                # attach safe metadata to state audit
                try:
                    state.record_audit(
                        AuditEvent(
                            event_id=f"AUD-MODEL-RESPONSE-{agent_role.upper()}",
                            step_number=6,
                            timestamp="1970-01-01T00:00:00Z",
                            agent_role="adk_runner",
                            tool_call="model_call",
                            summary="Model returned response (validation pending)",
                            request_payload={"prompt_hash": prompt_hash, "schema": schema_version},
                            response_payload={"validation_status": "RECEIVED"},
                            status="RECEIVED",
                        )
                    )
                except Exception:
                    logger.exception("failed to record model response audit")

                return parsed

            # Attach override and model name into orchestrator services for use by RootOrchestrator
            orchestrator.services["model_runner_override"] = model_runner
            orchestrator.services["model"] = self.model_config.model_name

        # Execute the orchestrator (existing behavior unchanged when not enabled)
        return orchestrator.run(state)
