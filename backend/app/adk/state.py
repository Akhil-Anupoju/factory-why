from __future__ import annotations
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, ValidationError


class AssetContext(BaseModel):
    asset_id: str
    name: Optional[str]
    model: Optional[str]
    line: Optional[str]
    facility: Optional[str]


class EvidenceRef(BaseModel):
    evidence_id: str
    source: str
    timestamp: str
    asset: str
    component: str
    observation: str
    provenance: Optional[str] = None
    status: Optional[str] = None
    confidence: Optional[str] = None


class Hypothesis(BaseModel):
    hypothesis_id: str
    title: Optional[str]
    description: Optional[str]
    status: Optional[str]
    confidence: Optional[float]
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    counter_evidence_ids: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)


class CriticFinding(BaseModel):
    critic_id: str
    target_hypothesis_id: Optional[str]
    contradictions: List[Dict[str, Any]] = Field(default_factory=list)
    ignored_evidence: List[Dict[str, Any]] = Field(default_factory=list)
    falsification_condition: Optional[str] = None
    # Single-most discriminating missing evidence descriptor
    most_discriminating_missing_evidence: Optional[str] = None
    # numeric revision suggested for leading hypothesis confidence
    confidence_revision: Optional[float] = None
    # optional request_more_evidence shape: {"tool": "get_inspection_image", "params": {...}}
    request_more_evidence: Optional[Dict[str, Any]] = None


class SimulationResult(BaseModel):
    option: str
    expected_delay_minutes: Optional[int]
    estimated_cost_usd: Optional[float]
    relative_exposure: Optional[float]
    uncertainty_reduction: Optional[float]
    calculation_trace: List[str] = Field(default_factory=list)


class Recommendation(BaseModel):
    recommendation_id: Optional[str]
    next_step: Optional[str]
    target_component: Optional[str]
    action_type: Optional[str]
    urgency: Optional[str]
    rationale: Optional[str]


class ApprovalRecord(BaseModel):
    approval_id: Optional[str]
    decision: Optional[str]
    engineer_name: Optional[str]
    timestamp: Optional[str]


class ActionRecord(BaseModel):
    action_id: Optional[str]
    incident_id: Optional[str]
    status: Optional[str]


class OutcomeRecord(BaseModel):
    outcome_id: Optional[str]
    actual_cause: Optional[str]
    observed_result: Optional[str]


class AuditEvent(BaseModel):
    event_id: str
    step_number: int
    timestamp: str
    agent_role: str
    tool_call: str
    summary: str
    request_payload: Dict[str, Any] = Field(default_factory=dict)
    response_payload: Dict[str, Any] = Field(default_factory=dict)
    status: str = "SUCCESS"


class InvestigationState(BaseModel):
    incident_id: str
    asset_context: Optional[AssetContext] = None
    evidence: List[EvidenceRef] = Field(default_factory=list)
    hypotheses: List[Hypothesis] = Field(default_factory=list)
    critic_findings: List[CriticFinding] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    simulation_results: List[SimulationResult] = Field(default_factory=list)
    recommendation: Optional[Recommendation] = None
    approval: Optional[ApprovalRecord] = None
    action: Optional[ActionRecord] = None
    outcome: Optional[OutcomeRecord] = None
    audit_events: List[AuditEvent] = Field(default_factory=list)

    def add_evidence(self, ev: Union[EvidenceRef, Dict[str, Any]]):
        """Add evidence to the state.

        Accepts an EvidenceRef instance or a dict that will be validated into
        an EvidenceRef. Raises ValidationError for invalid input types/values.
        """
        if isinstance(ev, EvidenceRef):
            self.evidence.append(ev)
            return
        if isinstance(ev, dict):
            try:
                ev_obj = EvidenceRef.model_validate(ev)
            except ValidationError:
                # re-raise to allow tests to assert ValidationError
                raise
            self.evidence.append(ev_obj)
            return
        raise TypeError("evidence must be EvidenceRef or dict")

    def record_audit(self, evt: Union[AuditEvent, Dict[str, Any]]):
        if isinstance(evt, AuditEvent):
            self.audit_events.append(evt)
            return
        if isinstance(evt, dict):
            try:
                ev_obj = AuditEvent.model_validate(evt)
            except ValidationError:
                raise
            self.audit_events.append(ev_obj)
            return
        raise TypeError("audit event must be AuditEvent or dict")

    def build_evidence_bundle(self) -> Dict[str, Any]:
        """Construct a serializable evidence bundle for downstream agents.

        Returns a dict with incident_id, optional asset_context, and a list of
        evidence items serialized to plain dicts.
        """
        return {
            "incident_id": self.incident_id,
            "asset_context": self.asset_context.model_dump() if self.asset_context else None,
            "evidence": [e.model_dump() for e in self.evidence],
        }


class EvidenceBundle(BaseModel):
    incident_id: str
    asset_context: Optional[AssetContext] = None
    evidence: List[EvidenceRef] = Field(default_factory=list)
