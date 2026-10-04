/**
 * Factory WHY - Core Type Definitions & Data Contracts
 * Designed to mirror the FastAPI / Pydantic schema in the architecture blueprint.
 */

export type TrustState = 
  | 'Observed'      // Directly retrieved physical fact
  | 'Supported'     // Model inference strongly backed by evidence
  | 'Likely'        // Current leading explanation
  | 'Competing'     // Plausible alternative explanation
  | 'Unresolved'    // Insufficient evidence, requires more investigation
  | 'Contradicted'; // Conflicts with empirical evidence

export type MachineStatus = 'NOMINAL' | 'ABNORMAL' | 'CRITICAL' | 'MAINTENANCE_IN_PROGRESS' | 'RESTORED';

export interface AssetComponent {
  component_id: string;
  name: string;
  type: 'MOTOR' | 'BEARING' | 'SHAFT' | 'SENSOR_ARRAY';
  status: 'NOMINAL' | 'ABNORMAL' | 'INVESTIGATING';
  last_serviced: string;
  details: string;
  sensor_ids: string[];
}

export interface AssetContext {
  asset_id: string;
  name: string;
  type: string;
  model: string;
  line: string;
  facility: string;
  commissioned_date: string;
  status: MachineStatus;
  health_score: number;
  components: AssetComponent[];
}

export interface TelemetryPoint {
  timestamp: string;
  display_time: string;
  vibration: number;       // mm/s (nominal ~8.5 - 9.0)
  temperature: number;     // °C (nominal ~60 - 62)
  motor_current: number;   // A (nominal ~22.0 - 22.8)
  rpm: number;             // RPM (nominal ~3400)
  pressure: number;        // bar (nominal ~4.2)
  is_anomalous?: boolean;
}

export interface TelemetrySummary {
  vibration: { current: number; baseline: number; delta_pct: number; unit: string; status: 'CRITICAL' | 'WARNING' | 'NORMAL' };
  temperature: { current: number; baseline: number; delta_pct: number; unit: string; status: 'CRITICAL' | 'WARNING' | 'NORMAL' };
  motor_current: { current: number; baseline: number; delta_pct: number; unit: string; status: 'CRITICAL' | 'WARNING' | 'NORMAL' };
  rpm: { current: number; baseline: number; delta_pct: number; unit: string; status: 'CRITICAL' | 'WARNING' | 'NORMAL' };
  pressure: { current: number; baseline: number; delta_pct: number; unit: string; status: 'CRITICAL' | 'WARNING' | 'NORMAL' };
}

export interface EvidenceItem {
  evidence_id: string;
  incident_id: string;
  source: 'Telemetry stream' | 'Maintenance work order' | 'Service manual' | 'Prior incident' | 'Inspection image';
  source_icon: string;
  timestamp: string;
  asset: string;
  component: string;
  observation: string;
  provenance: string;
  status: 'Observed';
  confidence: 'High' | 'Medium' | 'Low';
  details?: string;
  image_url?: string;
  document_snippet?: string;
  raw_payload?: Record<string, any>;
}

export interface Hypothesis {
  hypothesis_id: string;
  title: string;
  description: string;
  status: TrustState;
  confidence: number; // 0.0 to 1.0
  inferred_mechanism: string;
  supporting_evidence_ids: string[];
  counter_evidence_ids: string[];
  missing_evidence: string[];
  next_discriminating_check: string | null;
  likelihood_rank: number;
}

export interface CriticFinding {
  critic_id: string;
  target_hypothesis_id: string;
  run_timestamp: string;
  contradictions: {
    point: string;
    conflicting_evidence_id: string;
    rationale: string;
  }[];
  ignored_evidence: {
    evidence_id: string;
    observation: string;
    significance: string;
  }[];
  falsification_condition: string;
  strongest_discriminating_check: string;
  recommendation_action: 'REVISE_CONFIDENCE' | 'REQUEST_MORE_EVIDENCE' | 'PROCEED_TO_SIMULATION';
  confidence_delta: number; // e.g. -0.05
}

export type SimulationOptionType = 'CONTINUE' | 'INSPECT' | 'REPAIR';

export interface SimulationParameters {
  inspection_delay_minutes: number;
  modeled_failure_exposure: number;
  intervention_effectiveness: number;
  downtime_minutes_if_repair: number;
  hourly_production_loss_usd: number;
  emergency_repair_multiplier: number;
  assumptions_version: string;
}

export interface SimulationOptionResult {
  option: SimulationOptionType;
  title: string;
  description: string;
  risk_indicator: 'HIGH' | 'LOW' | 'CONTROLLED';
  expected_delay_minutes: number;
  relative_exposure: number; // 0.0 to 1.0
  uncertainty_reduction: number; // e.g. 0.85 (85%)
  estimated_cost_usd: number;
  recommended: boolean;
  tradeoff_summary: string;
  calculation_trace: string[];
}

// Server-Sent Events (SSE) - lightweight event contracts used by the frontend
export type SseEventName =
  | 'retrieving_telemetry'
  | 'checking_maintenance'
  | 'generating_hypotheses'
  | 'critiquing_leader'
  | 'running_simulation'
  | 'awaiting_approval';

export interface SseEventPayload {
  step?: number;
  [key: string]: any;
}

export interface SseNamedEvent {
  name: SseEventName;
  payload?: SseEventPayload;
}

export interface Recommendation {
  recommendation_id: string;
  next_step: string;
  target_component: string;
  action_type: string;
  urgency: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  time_window: string;
  rationale: string;
  uncertainty_pct: number;
  evidence_references: string[];
  estimated_duration_minutes: number;
  safety_protocol_code: string;
}

export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_EVIDENCE' | 'CHALLENGE';

export interface ApprovalRecord {
  approval_id: string;
  incident_id: string;
  decision: ApprovalDecision;
  engineer_name: string;
  engineer_role: string;
  timestamp: string;
  comment: string;
  authorized_action: string;
  signature_hash: string;
}

export interface ActionRecord {
  action_id: string;
  incident_id: string;
  approval_id: string;
  task_type: string;
  task_number: string;
  assigned_technician: string;
  required_tools: string[];
  status: 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  dispatched_at: string;
  target_component: string;
  procedure_checklist: string[];
}

export interface OutcomeRecord {
  outcome_id: string;
  incident_id: string;
  actual_cause: string;
  observed_result: string;
  physical_findings: string[];
  pre_vibration: number;
  post_vibration: number;
  pre_temperature: number;
  post_temperature: number;
  prediction_match: boolean;
  top_k_recall: boolean;
  time_to_resolution_minutes: number;
  accuracy_score_pct: number;
}

export interface AuditEvent {
  event_id: string;
  step_number: number;
  timestamp: string;
  agent_role: 'Root Orchestrator' | 'Evidence Agent' | 'WHY Agent' | 'Critic Agent' | 'Simulation Agent' | 'Recommendation Agent' | 'Action Agent' | 'Human Engineer';
  tool_call: string;
  summary: string;
  request_payload: Record<string, any>;
  response_payload: Record<string, any>;
  status: 'SUCCESS' | 'WARNING' | 'PENDING' | 'REJECTED';
}

export interface InvestigationCase {
  incident_id: string;
  asset: AssetContext;
  telemetry_summary: TelemetrySummary;
  telemetry_series: TelemetryPoint[];
  evidence: EvidenceItem[];
  hypotheses: Hypothesis[];
  critic_finding: CriticFinding;
  simulation_params: SimulationParameters;
  simulation_results: SimulationOptionResult[];
  recommendation: Recommendation;
  approval: ApprovalRecord;
  action: ActionRecord | null;
  outcome: OutcomeRecord | null;
  audit_trail: AuditEvent[];
}
