from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, conint, confloat


class AssetComponent(BaseModel):
    component_id: str
    name: str
    type: str
    status: str
    last_serviced: str
    details: str
    sensor_ids: List[str]


class AssetContext(BaseModel):
    asset_id: str
    name: str
    type: str
    model: str
    line: str
    facility: str
    commissioned_date: str
    status: str
    health_score: int
    components: List[AssetComponent]


class TelemetryPoint(BaseModel):
    timestamp: str
    display_time: str
    vibration: float
    temperature: float
    motor_current: float
    rpm: float
    pressure: float
    is_anomalous: Optional[bool] = False


class TelemetrySummaryChannel(BaseModel):
    current: float
    baseline: float
    delta_pct: float
    unit: str
    status: str


class TelemetrySummary(BaseModel):
    vibration: TelemetrySummaryChannel
    temperature: TelemetrySummaryChannel
    motor_current: TelemetrySummaryChannel
    rpm: TelemetrySummaryChannel
    pressure: TelemetrySummaryChannel


class EvidenceItem(BaseModel):
    evidence_id: str
    incident_id: str
    source: str
    source_icon: str
    timestamp: str
    asset: str
    component: str
    observation: str
    provenance: str
    # storage_location is the actual GCS location where the artifact was written by the seeder.
    # This is additive and optional; existing fixtures without this field remain valid.
    storage_location: Optional[str] = None
    status: str
    confidence: str
    details: Optional[str] = None
    image_url: Optional[str] = None
    document_snippet: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None


class Hypothesis(BaseModel):
    hypothesis_id: str
    title: str
    description: str
    status: str
    confidence: float
    inferred_mechanism: str
    supporting_evidence_ids: List[str]
    counter_evidence_ids: List[str]
    missing_evidence: List[str]
    next_discriminating_check: Optional[str] = None
    likelihood_rank: int


class CriticContradiction(BaseModel):
    point: str
    conflicting_evidence_id: str
    rationale: str


class CriticIgnoredEvidence(BaseModel):
    evidence_id: str
    observation: str
    significance: str


class CriticFinding(BaseModel):
    critic_id: str
    target_hypothesis_id: str
    run_timestamp: str
    contradictions: List[CriticContradiction]
    ignored_evidence: List[CriticIgnoredEvidence]
    falsification_condition: str
    strongest_discriminating_check: str
    recommendation_action: str
    confidence_delta: float


SimulationOptionType = str  # 'CONTINUE' | 'INSPECT' | 'REPAIR'


class SimulationParameters(BaseModel):
    inspection_delay_minutes: conint(ge=1, le=1440) = 25
    modeled_failure_exposure: confloat(ge=0.0, le=1.0) = 0.32
    intervention_effectiveness: confloat(ge=0.0, le=1.0) = 0.85
    downtime_minutes_if_repair: conint(ge=1, le=10000) = 180
    hourly_production_loss_usd: confloat(ge=0.0) = 1200.0
    emergency_repair_multiplier: confloat(ge=0.0) = 4.5
    assumptions_version: str = "sim-v1.4-deterministic"


class SimulationOptionResult(BaseModel):
    option: SimulationOptionType
    title: str
    description: str
    risk_indicator: str
    expected_delay_minutes: int
    relative_exposure: float
    uncertainty_reduction: float
    estimated_cost_usd: float
    recommended: bool
    tradeoff_summary: str
    calculation_trace: List[str]


class Recommendation(BaseModel):
    recommendation_id: str
    next_step: str
    target_component: str
    action_type: str
    urgency: str
    time_window: str
    rationale: str
    uncertainty_pct: float
    evidence_references: List[str]
    estimated_duration_minutes: int
    safety_protocol_code: str


class ApprovalRecord(BaseModel):
    approval_id: str
    incident_id: str
    recommendation_id: Optional[str] = None
    decision: str
    engineer_name: str
    engineer_role: str
    timestamp: str
    comment: str
    authorized_action: str
    signature_hash: str


class ActionRecord(BaseModel):
    action_id: str
    incident_id: str
    approval_id: str
    task_type: str
    task_number: str
    assigned_technician: str
    required_tools: List[str]
    status: str
    dispatched_at: Optional[str]
    target_component: str
    procedure_checklist: List[str]


class OutcomeRecord(BaseModel):
    outcome_id: str
    incident_id: str
    actual_cause: str
    observed_result: str
    physical_findings: List[str]
    pre_vibration: float
    post_vibration: float
    pre_temperature: float
    post_temperature: float
    prediction_match: bool
    top_k_recall: bool
    time_to_resolution_minutes: int
    accuracy_score_pct: int


class AuditEvent(BaseModel):
    event_id: str
    step_number: int
    timestamp: str
    agent_role: str
    tool_call: str
    summary: str
    request_payload: Dict[str, Any]
    response_payload: Dict[str, Any]
    status: str


class InvestigationCase(BaseModel):
    incident_id: str
    asset: AssetContext
    telemetry_summary: TelemetrySummary
    telemetry_series: List[TelemetryPoint]
    evidence: List[EvidenceItem]
    hypotheses: List[Hypothesis]
    critic_finding: CriticFinding
    simulation_params: SimulationParameters
    simulation_results: List[SimulationOptionResult]
    recommendation: Recommendation
    approval: ApprovalRecord
    action: Optional[ActionRecord]
    outcome: Optional[OutcomeRecord]
    audit_trail: List[AuditEvent]
