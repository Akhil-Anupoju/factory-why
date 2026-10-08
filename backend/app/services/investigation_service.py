from __future__ import annotations
"""Live investigation service — wires the real Google ADK pipeline
(EvidenceAgent -> WHY Agent -> Critic Agent -> [targeted retrieval] ->
revised WHY, exactly once) into a callable usable from API routes.

This is the ONLY place that should trigger a live Gemini/Vertex AI call.
It reuses the existing, already-tested ADK agent/orchestrator code in
backend/app/adk/* — it does not reimplement model logic.

Design decision (documented, not hidden):
- GET /api/incidents/{id} continues to serve the last-persisted
  investigation state (fast, deterministic, safe for demo/browsing).
- This service is invoked explicitly (via POST .../challenge, mapped to
  the existing "Challenge AI" UI action) to run a real, live ADK+Gemini
  pass and persist the result. This avoids making every page load
  nondeterministic/slow/costly while still providing genuine live AI
  reasoning on demand, matching the documented RootOrchestrator contract
  (bounded: at most one targeted retrieval + one revised WHY pass).
"""
import datetime
import logging
from typing import Any, Dict, List, Optional

from ..adk.state import InvestigationState, AssetContext as AdkAssetContext
from ..adk.workflow import RootOrchestrator
from ..adk.runner import ADKRunner
from ..adk.model_config import ModelConfigLoader
from ..tools.tool_impl import AllowlistedTools
from ..services.evidence_service import EvidenceService
from .. import schemas

logger = logging.getLogger(__name__)


class LiveInvestigationError(RuntimeError):
    """Raised when the live ADK/Gemini pipeline cannot complete.

    Callers (API routes) should map this to a safe 502/503 response and
    must NOT fall back to fabricated data in CLOUD/PRODUCTION runtime.
    """


def _map_hypothesis(h: Any, rank: int) -> Dict[str, Any]:
    """WhyAgent already appends backend.schemas.Hypothesis-shaped objects
    onto state.hypotheses (see why_agent.py). Normalize defensively in case
    an adk.state.Hypothesis (narrower shape) ends up there instead.
    """
    if hasattr(h, "title") and hasattr(h, "inferred_mechanism") and hasattr(h, "likelihood_rank"):
        d = h.model_dump()
        # WhyAgent always emits likelihood_rank=0 (see why_agent.py); the
        # orchestrator does not rank hypotheses, so this service assigns
        # rank by output order (model lists leading hypothesis first).
        d["likelihood_rank"] = rank
        return d
    # Narrow adk.state.Hypothesis fallback mapping
    return {
        "hypothesis_id": h.hypothesis_id,
        "title": (h.title or h.description or h.hypothesis_id)[:80],
        "description": h.description or "",
        "status": (h.status or "UNRESOLVED").upper(),
        "confidence": h.confidence if h.confidence is not None else 0.0,
        "inferred_mechanism": "",
        "supporting_evidence_ids": h.supporting_evidence_ids or [],
        "counter_evidence_ids": h.counter_evidence_ids or [],
        "missing_evidence": h.missing_evidence or [],
        "next_discriminating_check": None,
        "likelihood_rank": rank,
    }


def _map_critic_finding(cf: Any, now_iso: str, evidence_by_id: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Map adk.state.CriticFinding -> backend.schemas.CriticFinding shape."""
    evidence_by_id = evidence_by_id or {}
    contradictions = []
    for c in cf.contradictions or []:
        if isinstance(c, dict):
            ce_ids = c.get("conflicting_evidence_ids") or c.get("conflicting_evidence_id")
            if isinstance(ce_ids, list):
                ce_id = ce_ids[0] if ce_ids else ""
            else:
                ce_id = ce_ids or ""
            contradictions.append({
                "point": c.get("point", ""),
                "conflicting_evidence_id": ce_id,
                "rationale": c.get("rationale", ""),
            })

    ignored_evidence = []
    for ie in cf.ignored_evidence or []:
        eid = ie.get("evidence_id") if isinstance(ie, dict) else None
        if eid:
            ev_ref = evidence_by_id.get(eid)
            observation = (ev_ref.observation if ev_ref else None) or "Evidence item present in bundle but not addressed by the critic's analysis."
            ignored_evidence.append({
                "evidence_id": eid,
                "observation": observation,
                "significance": (ie.get("significance") if isinstance(ie, dict) else "") or "Flagged by Critic as potentially overlooked by the leading hypothesis.",
            })

    if cf.request_more_evidence:
        recommendation_action = "REQUEST_MORE_EVIDENCE"
    elif cf.confidence_revision is not None and cf.confidence_revision < 0:
        recommendation_action = "REVISE_CONFIDENCE"
    else:
        recommendation_action = "PROCEED_TO_SIMULATION"

    return {
        "critic_id": cf.critic_id,
        "target_hypothesis_id": cf.target_hypothesis_id or "",
        "run_timestamp": now_iso,
        "contradictions": contradictions,
        "ignored_evidence": ignored_evidence,
        "falsification_condition": cf.falsification_condition or "",
        "strongest_discriminating_check": cf.most_discriminating_missing_evidence or "",
        "recommendation_action": recommendation_action,
        "confidence_delta": cf.confidence_revision or 0.0,
    }


def run_live_critic_challenge(
    incident_id: str,
    incident_repo: Any,
    evidence_repo: Any,
    audit_repo: Any,
    telemetry_repo: Any,
    storage_repo: Any,
) -> Dict[str, Any]:
    """Run the real ADK pipeline (Evidence -> WHY -> Critic -> [targeted
    retrieval] -> revised WHY, bounded to one extra pass) against live
    repository-backed evidence, using Gemini/Vertex AI via the already-built
    ADKRunner live-model path. Persists the resulting hypotheses, critic
    finding, and audit events back to the incident repository.

    Raises LiveInvestigationError on any failure — callers must surface
    this as an explicit error, never a silent fallback to fixture data.
    """
    model_config = ModelConfigLoader.load_from_env()
    if (model_config.provider or "").lower() != "vertex_ai":
        raise LiveInvestigationError(
            f"ADK_MODEL_PROVIDER is '{model_config.provider}', expected 'vertex_ai'. "
            "Set ADK_MODEL_PROVIDER=vertex_ai and ADK_MODEL_NAME to enable live reasoning."
        )

    incident = incident_repo.get_incident(incident_id)
    if not incident:
        raise LiveInvestigationError(f"incident not found: {incident_id}")

    state = InvestigationState(incident_id=incident_id)
    asset = incident.get("asset") or {}
    if asset.get("asset_id"):
        state.asset_context = AdkAssetContext(
            asset_id=asset.get("asset_id"),
            name=asset.get("name"),
            model=asset.get("model"),
            line=asset.get("line"),
            facility=asset.get("facility"),
        )

    evidence_service = EvidenceService(incident_repo, evidence_repo, audit_repo, telemetry_repo, storage_repo)
    tools = AllowlistedTools(incident_repo, evidence_repo, telemetry_repo, storage_repo, evidence_service)

    orchestrator = RootOrchestrator(services={"tools": tools, "model": model_config.model_name})
    runner = ADKRunner(services={})

    try:
        result_state = runner.run_workflow(orchestrator, state, force_live=True)
    except Exception as ex:  # noqa: BLE001 - surface as a safe, typed error
        logger.exception("Live ADK investigation failed for incident %s", incident_id)
        raise LiveInvestigationError(f"Live investigation pipeline failed: {ex.__class__.__name__}: {ex}") from ex

    if not result_state.hypotheses:
        raise LiveInvestigationError("Live WHY agent produced no hypotheses (see audit trail for failure reason)")
    if not result_state.critic_findings:
        raise LiveInvestigationError("Live Critic agent produced no finding (see audit trail for failure reason)")

    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    hypotheses = [_map_hypothesis(h, i + 1) for i, h in enumerate(result_state.hypotheses)]
    evidence_by_id = {e.evidence_id: e for e in result_state.evidence}
    critic_dict = _map_critic_finding(result_state.critic_findings[-1], now_iso, evidence_by_id)

    # Validate against the public API contract before persisting/returning.
    validated_hyps = [schemas.Hypothesis.model_validate(h).model_dump() for h in hypotheses]
    validated_critic = schemas.CriticFinding.model_validate(critic_dict).model_dump()

    # Persist: update incident doc (hypotheses, critic_finding) and append
    # audit events + any newly retrieved evidence to their repos.
    updated_incident = {**incident, "hypotheses": validated_hyps, "critic_finding": validated_critic}
    incident_repo.upsert_incident(updated_incident)

    for ev in result_state.evidence:
        existing = evidence_repo.get_evidence(incident_id, ev.evidence_id)
        if not existing:
            try:
                evidence_repo.upsert_evidence(incident_id, {
                    "evidence_id": ev.evidence_id,
                    "incident_id": incident_id,
                    "source": ev.source,
                    "source_icon": "Sparkles",
                    "timestamp": ev.timestamp,
                    "asset": ev.asset,
                    "component": ev.component,
                    "observation": ev.observation,
                    "provenance": ev.provenance or "",
                    "status": "Observed",
                    "confidence": ev.confidence or "Medium",
                })
            except Exception:
                logger.exception("failed to persist targeted-retrieval evidence %s", ev.evidence_id)

    for i, evt in enumerate(result_state.audit_events):
        try:
            audit_repo.append_audit(incident_id, {
                "event_id": evt.event_id,
                "step_number": 700 + i,
                "timestamp": now_iso,
                "agent_role": _map_agent_role(evt.agent_role),
                "tool_call": evt.tool_call,
                "summary": evt.summary,
                "request_payload": _safe_payload(evt.request_payload),
                "response_payload": _safe_payload(evt.response_payload),
                "status": _map_audit_status(evt.status),
            })
        except Exception:
            logger.exception("failed to persist audit event %s", evt.event_id)

    return {"hypotheses": validated_hyps, "critic_finding": validated_critic, "evidence_added": len(result_state.evidence)}


def _map_agent_role(role: str) -> str:
    mapping = {
        "root_orchestrator": "Root Orchestrator",
        "evidence_agent": "Evidence Agent",
        "why_agent": "WHY Agent",
        "critic_agent": "Critic Agent",
        "adk_runner": "Root Orchestrator",
    }
    return mapping.get(role, "Root Orchestrator")


def _map_audit_status(status: str) -> str:
    return status if status in ("SUCCESS", "WARNING", "PENDING", "REJECTED") else ("WARNING" if status in ("FAILED", "MISSING") else "SUCCESS")


def _safe_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Strip anything that looks like it could carry sensitive content
    before persisting as audit metadata. Defensive only — the ADK runner
    already avoids logging tokens/secrets."""
    if not isinstance(payload, dict):
        return {}
    forbidden = {"authorization", "token", "private_key", "secret", "api_key"}
    return {k: v for k, v in payload.items() if k.lower() not in forbidden}
