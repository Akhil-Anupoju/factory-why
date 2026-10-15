from __future__ import annotations
from typing import Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
from math import isfinite

from ..repositories.interfaces import IncidentRepository, AuditRepository
from ..schemas import OutcomeRecord, ApprovalRecord, Recommendation, ActionRecord


class OutcomeService:
    """Deterministic outcome service producing a simulated OutcomeRecord after action."""

    def __init__(self, incident_repo: IncidentRepository, audit_repo: AuditRepository):
        self.incident_repo = incident_repo
        self.audit_repo = audit_repo

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def record_outcome(self, incident_id: str, approval: ApprovalRecord, recommendation: Recommendation, action: ActionRecord, ground_truth: Dict[str, Any] | None = None) -> OutcomeRecord:
        # Outcomes produced by this service are simulations, not physical
        # measurements. Project partial recovery from anomaly size, the
        # recommendation's modeled effectiveness, confidence, and evidence grounding.
        outcome_id = f"OUT-{uuid4().hex[:8]}"
        inc = self.incident_repo.get_incident(incident_id) or {}
        ts = inc.get("telemetry_summary") or {}
        vibration = ts.get("vibration") or {}
        temperature = ts.get("temperature") or {}
        pre_vibration = float(vibration.get("current", 0.0))
        pre_temperature = float(temperature.get("current", 0.0))
        hypotheses = sorted(inc.get("hypotheses") or [], key=lambda item: item.get("likelihood_rank", 999))
        leading = hypotheses[0] if hypotheses else {}
        actual_cause = (ground_truth or {}).get("actual_cause") or leading.get("title") or "No ranked cause was available"
        evidence_ids = set(leading.get("supporting_evidence_ids") or [])
        recommendation_evidence = set(recommendation.evidence_references or [])
        grounding = len(evidence_ids.intersection(recommendation_evidence)) / len(evidence_ids) if evidence_ids else 0.0
        params = inc.get("simulation_params") or {}
        inspect_option = next((item for item in inc.get("simulation_results", []) if item.get("option") == "INSPECT"), {})
        effectiveness = float(
            inspect_option.get("uncertainty_reduction")
            or params.get("intervention_effectiveness")
            or 0.5
        )
        confidence = float(leading.get("confidence", 0.0))
        # Effective recovery is bounded below full restoration: a diagnostic
        # inspection informs/mitigates risk, but cannot claim a perfect repair.
        recovery_fraction = max(0.0, min(0.9, effectiveness * (0.5 + 0.5 * confidence) * grounding))

        def project_toward_baseline(metric: Dict[str, Any], current: float) -> float:
            baseline = float(metric.get("baseline", current))
            projected = current + (baseline - current) * recovery_fraction
            return round(projected, 2) if isfinite(projected) else current

        post_vibration = project_toward_baseline(vibration, pre_vibration)
        post_temperature = project_toward_baseline(temperature, pre_temperature)
        grounded = grounding > 0
        # Without observed ground truth, a prototype simulation cannot mark a
        # cause as matched/mismatched. Keep evaluation explicitly unverified.
        prediction_match = None
        top_k_recall = None
        accuracy_score = None
        if ground_truth and ground_truth.get("actual_cause"):
            truth = str(ground_truth["actual_cause"]).casefold().replace("_", " ")
            predicted = str(leading.get("title") or "").casefold().replace("_", " ")
            prediction_match = predicted in truth or truth in predicted
            top_k_recall = prediction_match
            accuracy_score = 100 if prediction_match else 0

        findings = [
            "Prototype projection only; no physical inspection or post-action sensor readings were collected.",
            f"Projected vibration: {pre_vibration:g} → {post_vibration:g} mm/s RMS, based on {recovery_fraction:.0%} modeled recovery toward baseline {vibration.get('baseline', pre_vibration)}.",
            f"Projected temperature: {pre_temperature:g} → {post_temperature:g} °C, based on {recovery_fraction:.0%} modeled recovery toward baseline {temperature.get('baseline', pre_temperature)}.",
            f"Recovery estimate uses intervention effectiveness {effectiveness:.0%}, leading-hypothesis confidence {confidence:.0%}, and evidence grounding {grounding:.0%}.",
        ]
        observed_result = (ground_truth or {}).get("observed_result") or (
            f"Prototype projection: inspection is modeled at {recovery_fraction:.0%} recovery toward the recorded signal baselines. Physical outcome and prediction match remain unverified."
        )

        outcome = OutcomeRecord(
            outcome_id=outcome_id,
            incident_id=incident_id,
            is_simulated=True,
            modeled_recovery_pct=round(recovery_fraction * 100, 1),
            actual_cause=actual_cause,
            observed_result=observed_result,
            physical_findings=(ground_truth or {}).get("physical_findings") or findings,
            pre_vibration=pre_vibration,
            post_vibration=post_vibration,
            pre_temperature=pre_temperature,
            post_temperature=post_temperature,
            prediction_match=prediction_match,
            top_k_recall=top_k_recall,
            time_to_resolution_minutes=max(int(recommendation.estimated_duration_minutes or 0), 1),
            accuracy_score_pct=accuracy_score,
        )

        # persist into incident payload
        inc = self.incident_repo.get_incident(incident_id) or {}
        inc["outcome"] = outcome.model_dump()
        self.incident_repo.upsert_incident(inc)

        # audit
        try:
            # Do not include sensitive tokens in audit. Include actor identity if present via approval
            # Include stable verified uid when available in approval.engineer_name
            # Prefer storing uid to avoid exposing email addresses in audit payloads.
            req = {"action_id": action.action_id if action else None}
            if hasattr(approval, "engineer_name") and approval.engineer_name:
                req["approved_by_uid"] = approval.engineer_name
            self.audit_repo.append_audit(incident_id, {"event_id": "AUD-OUTCOME-RECORDED", "step_number": 840, "timestamp": self._now(), "agent_role": "outcome_service", "tool_call": "record_outcome", "summary": "Outcome recorded", "request_payload": req, "response_payload": outcome.model_dump(), "status": "SUCCESS"})
        except Exception:
            pass

        return outcome
