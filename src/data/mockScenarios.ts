import { InvestigationCase, SimulationParameters, SimulationOptionResult } from '../types';

export const DEFAULT_SIMULATION_PARAMS: SimulationParameters = {
  inspection_delay_minutes: 25,
  modeled_failure_exposure: 0.32,
  intervention_effectiveness: 0.85,
  downtime_minutes_if_repair: 180,
  hourly_production_loss_usd: 1200,
  emergency_repair_multiplier: 4.5,
  assumptions_version: 'sim-v1.4-deterministic',
};

export function calculateDeterministicSimulation(params: SimulationParameters): SimulationOptionResult[] {
  const hourlyRate = params.hourly_production_loss_usd;
  
  // Option 1: Continue
  const continueDelay = 0;
  const continueCost = Math.round(hourlyRate * 3.5 * params.emergency_repair_multiplier * params.modeled_failure_exposure * 10) / 10 + 18000;
  const continueTrace = [
    `Modeled unmitigated failure exposure: ${(params.modeled_failure_exposure * 100).toFixed(0)}%`,
    `Spindle seizure probability window: 14h - 28h continuous operation`,
    `Estimated unmitigated failure loss: $${continueCost.toLocaleString()} (tool wreck + emergency line stop)`,
    `Uncertainty reduction: 0% (no diagnostic executed)`
  ];

  // Option 2: Inspect
  const inspectDelay = params.inspection_delay_minutes;
  const inspectLoss = Math.round((inspectDelay / 60) * hourlyRate);
  const inspectToolCost = 250;
  const inspectTotal = inspectLoss + inspectToolCost;
  const inspectResidualExposure = Math.round((1 - params.intervention_effectiveness) * params.modeled_failure_exposure * 100) / 100;
  const inspectTrace = [
    `Controlled diagnostic pause: ${inspectDelay} minutes`,
    `Production idle loss: $${inspectLoss} (${inspectDelay}m @ $${hourlyRate}/hr)`,
    `Tooling & calibration fee: $${inspectToolCost}`,
    `Uncertainty reduction: ${(params.intervention_effectiveness * 100).toFixed(0)}%`,
    `Residual failure exposure: ${(inspectResidualExposure * 100).toFixed(1)}%`
  ];

  // Option 3: Full Premature Repair / Replacement
  const repairDelay = params.downtime_minutes_if_repair;
  const repairLoss = Math.round((repairDelay / 60) * hourlyRate);
  const repairParts = 2600;
  const repairTotal = repairLoss + repairParts;
  const repairTrace = [
    `Full spindle disassembly & bearing swap: ${repairDelay} minutes`,
    `Production loss: $${repairLoss} (${repairDelay}m @ $${hourlyRate}/hr)`,
    `New bearing assembly & consumable kit: $${repairParts}`,
    `Premature replacement waste: High (bearing replaced only 4 days ago)`,
    `Residual failure exposure: 2.0%`
  ];

  return [
    {
      option: 'CONTINUE',
      title: 'Continue Production Run',
      description: 'Run machine without inspection to finish batch #4881. Defer intervention to scheduled weekend maintenance.',
      risk_indicator: 'HIGH',
      expected_delay_minutes: continueDelay,
      relative_exposure: 1.0,
      uncertainty_reduction: 0.0,
      estimated_cost_usd: continueCost,
      recommended: false,
      tradeoff_summary: 'Saves immediate 25m downtime but risks catastrophic spindle seizure ($30k+ total loss).',
      calculation_trace: continueTrace
    },
    {
      option: 'INSPECT',
      title: 'Targeted Alignment Inspection',
      description: 'Perform laser runout check on Bearing-B04 and coupling. Loosen housing bolts and shim if required.',
      risk_indicator: 'CONTROLLED',
      expected_delay_minutes: inspectDelay,
      relative_exposure: inspectResidualExposure,
      uncertainty_reduction: params.intervention_effectiveness,
      estimated_cost_usd: inspectTotal,
      recommended: true,
      tradeoff_summary: 'Optimal tradeoff: 25 min controlled delay resolves 85% uncertainty with minimal production interruption.',
      calculation_trace: inspectTrace
    },
    {
      option: 'REPAIR',
      title: 'Full Spindle Bearing Re-Replacement',
      description: 'Execute full spindle overhaul, replace Bearing-B04, and re-machine sleeve seating collar.',
      risk_indicator: 'LOW',
      expected_delay_minutes: repairDelay,
      relative_exposure: 0.02,
      uncertainty_reduction: 0.98,
      estimated_cost_usd: repairTotal,
      recommended: false,
      tradeoff_summary: 'Guaranteed fix but incurs 180 min excessive downtime and wastes an expensive 4-day-old precision bearing.',
      calculation_trace: repairTrace
    }
  ];
}

// 24-point time series data showing clear shift at 14:18 UTC (Point 18)
const generateTelemetrySeries = (): InvestigationCase['telemetry_series'] => [
  { timestamp: '2026-09-22T08:00:00Z', display_time: '08:00', vibration: 8.65, temperature: 60.8, motor_current: 22.4, rpm: 3400, pressure: 4.2 },
  { timestamp: '2026-09-22T09:00:00Z', display_time: '09:00', vibration: 8.70, temperature: 61.1, motor_current: 22.3, rpm: 3402, pressure: 4.2 },
  { timestamp: '2026-09-22T10:00:00Z', display_time: '10:00', vibration: 8.68, temperature: 61.3, motor_current: 22.5, rpm: 3398, pressure: 4.2 },
  { timestamp: '2026-09-22T11:00:00Z', display_time: '11:00', vibration: 8.74, temperature: 61.5, motor_current: 22.4, rpm: 3400, pressure: 4.2 },
  { timestamp: '2026-09-22T12:00:00Z', display_time: '12:00', vibration: 8.72, temperature: 61.2, motor_current: 22.6, rpm: 3401, pressure: 4.2 },
  { timestamp: '2026-09-22T13:00:00Z', display_time: '13:00', vibration: 8.76, temperature: 61.4, motor_current: 22.5, rpm: 3399, pressure: 4.2 },
  { timestamp: '2026-09-22T14:00:00Z', display_time: '14:00', vibration: 8.75, temperature: 61.4, motor_current: 22.5, rpm: 3400, pressure: 4.2 },
  // Step anomaly onset at 14:18
  { timestamp: '2026-09-22T14:18:00Z', display_time: '14:18', vibration: 12.38, temperature: 65.1, motor_current: 23.9, rpm: 3400, pressure: 4.2, is_anomalous: true },
  { timestamp: '2026-09-22T14:30:00Z', display_time: '14:30', vibration: 12.42, temperature: 67.4, motor_current: 24.2, rpm: 3401, pressure: 4.2, is_anomalous: true },
  { timestamp: '2026-09-22T15:00:00Z', display_time: '15:00', vibration: 12.40, temperature: 68.0, motor_current: 24.3, rpm: 3400, pressure: 4.2, is_anomalous: true },
  { timestamp: '2026-09-22T15:30:00Z', display_time: '15:30', vibration: 12.45, temperature: 68.2, motor_current: 24.3, rpm: 3399, pressure: 4.2, is_anomalous: true },
  { timestamp: '2026-09-22T16:00:00Z', display_time: '16:00', vibration: 12.42, temperature: 68.2, motor_current: 24.3, rpm: 3400, pressure: 4.2, is_anomalous: true }
];

export const PRIMARY_SCENARIO_CNC04: InvestigationCase = {
  incident_id: 'INC-2026-0827',
  asset: {
    asset_id: 'CNC-04',
    name: 'CNC-04 5-Axis Precision Machining Center',
    type: 'High-Precision Milling Center',
    model: 'DMG Mori NVX 5080 II',
    line: 'Line B (Aerospace Impeller Cell)',
    facility: 'Plant 2 - Precision Machining Bay',
    commissioned_date: '2023-04-12',
    status: 'ABNORMAL',
    health_score: 64,
    components: [
      {
        component_id: 'MOTOR-M01',
        name: 'Spindle Drive Motor',
        type: 'MOTOR',
        status: 'ABNORMAL',
        last_serviced: '2026-07-15',
        details: '18.5 kW 3-Phase AC Synchronous Motor. Motor current elevated +8% (24.3A vs 22.5A baseline).',
        sensor_ids: ['CURR-M01', 'RPM-S01']
      },
      {
        component_id: 'BEARING-B04',
        name: 'Spindle Front Bearing (Bearing-B04)',
        type: 'BEARING',
        status: 'ABNORMAL',
        last_serviced: '2026-09-18 (4 days ago)',
        details: 'Double-row cylindrical roller bearing (SKF NN 3016 K/SP). Replaced 4 days ago under WO #8841. Vibration elevated +42%, temp +11%.',
        sensor_ids: ['VIB-B04', 'TEMP-B04']
      },
      {
        component_id: 'SHAFT-S01',
        name: 'Spindle Transmission Shaft & Coupler',
        type: 'SHAFT',
        status: 'INVESTIGATING',
        last_serviced: '2026-05-10',
        details: 'Precision balanced carbon-steel shaft. Flexible disc coupling. Potential angular runout focus.',
        sensor_ids: ['RPM-S01']
      },
      {
        component_id: 'SENSORS-SYS',
        name: 'Diagnostic Sensor Array',
        type: 'SENSOR_ARRAY',
        status: 'NOMINAL',
        last_serviced: '2026-08-01',
        details: 'VIB-B04 (Tri-axial IEPE), TEMP-B04 (PT100 RTD), CURR-M01 (Hall-effect CT), PRESS-HYD01 (Piezoelectric).',
        sensor_ids: ['VIB-B04', 'TEMP-B04', 'CURR-M01', 'RPM-S01', 'PRESS-HYD01']
      }
    ]
  },
  telemetry_summary: {
    vibration: { current: 12.42, baseline: 8.75, delta_pct: 41.94, unit: 'mm/s RMS', status: 'CRITICAL' },
    temperature: { current: 68.2, baseline: 61.4, delta_pct: 11.07, unit: '°C', status: 'WARNING' },
    motor_current: { current: 24.3, baseline: 22.5, delta_pct: 8.0, unit: 'A', status: 'WARNING' },
    rpm: { current: 3400, baseline: 3400, delta_pct: 0.0, unit: 'RPM', status: 'NORMAL' },
    pressure: { current: 4.2, baseline: 4.2, delta_pct: 0.0, unit: 'bar', status: 'NORMAL' }
  },
  telemetry_series: generateTelemetrySeries(),
  evidence: [
    {
      evidence_id: 'EV-1041',
      incident_id: 'INC-2026-0827',
      source: 'Telemetry stream',
      source_icon: 'Activity',
      timestamp: '2026-09-22T14:18:00Z',
      asset: 'CNC-04',
      component: 'Bearing-B04 / Motor-M01',
      observation: 'Multi-channel lockstep shift: Vibration +42% (8.75 -> 12.42 mm/s), Temperature +11% (61.4 -> 68.2°C), and Motor current +8% (22.5 -> 24.3 A) shifted simultaneously at 14:18 UTC. RPM (3400) and hydraulic pressure (4.2 bar) remained invariant.',
      provenance: 'bigquery://telemetry_raw/sensors/CNC-04/partition_20260922',
      status: 'Observed',
      confidence: 'High',
      details: 'Signal coherence analysis: Correlation coefficient r=0.984 between vibration and motor current surge. This excludes isolated sensor failure.',
      raw_payload: {
        sensors: ['VIB-B04', 'TEMP-B04', 'CURR-M01', 'RPM-S01', 'PRESS-HYD01'],
        sampling_rate_hz: 1000,
        quality: 'GOOD_CERTIFIED',
        spectral_dominant_peak: '1X (56.6 Hz) + 2X (113.2 Hz) harmonic'
      }
    },
    {
      evidence_id: 'EV-1042',
      incident_id: 'INC-2026-0827',
      source: 'Maintenance work order',
      source_icon: 'Wrench',
      timestamp: '2026-09-18T10:30:00Z',
      asset: 'CNC-04',
      component: 'Bearing-B04',
      observation: 'Bearing replaced four days before anomaly under Scheduled Preventive WO #8841. Replaced with OEM SKF NN 3016 K/SP. Technician notes: "Housing collar fit unusually snug during hydraulic press insertion; shim spacer reused without laser clocking."',
      provenance: 'cmms://work-orders/8841/signoff_shift_b',
      status: 'Observed',
      confidence: 'High',
      details: 'Signed by Lead Mech Tech D. Miller (Badge #M-441). Elapsed operating hours since install: 96.2 hrs.',
      document_snippet: 'WORK ORDER #8841 SIGN-OFF:\n- Task: Front spindle cylindrical bearing replacement\n- Part: SKF NN 3016 K/SP\n- Tech Comments: "Collar seating tight on taper. Reused previous retaining locknut and existing shims. Manual dial clocking deferred due to rush batch schedule."\n- Status: COMPLETED'
    },
    {
      evidence_id: 'EV-1043',
      incident_id: 'INC-2026-0827',
      source: 'Service manual',
      source_icon: 'FileText',
      timestamp: '2024-01-15T00:00:00Z',
      asset: 'CNC-04',
      component: 'Bearing-B04 / Shaft-Coupler',
      observation: 'Service Manual Sec 4.2.4 "Coupling & Angular Alignment": Maximum allowable radial runout is 0.02 mm; angular deviation > 0.05 mm causes elevated 1X rotational vibration, friction-induced thermal accumulation in outer raceway, and parasitic counter-torque reflected in motor current.',
      provenance: 'gcs://factory-manuals/dmg_mori_nvx5080_sec4_spindle.pdf#page=42',
      status: 'Observed',
      confidence: 'High',
      details: 'Tolerance limit table: Grade P4 spindle runout must remain <= 0.015 mm under cold setup and <= 0.025 mm dynamic.',
      document_snippet: 'SECTION 4.2.4 - SPINDLE BEARING ALIGNMENT & TORQUE TOLERANCES:\n"Failure to establish axial parallelism within 0.02 mm will generate secondary harmonic vibration (1X/2X) and progressive heat generation. When bearing is forced into a misaligned sleeve, parasitic drag increases drive current by 5-12%."'
    },
    {
      evidence_id: 'EV-1044',
      incident_id: 'INC-2026-0827',
      source: 'Prior incident',
      source_icon: 'ShieldAlert',
      timestamp: '2025-06-11T09:15:00Z',
      asset: 'CNC-02',
      component: 'Bearing-B02',
      observation: 'Historical incident INC-419: CNC-02 exhibited identical signature (Vibration +39%, Temp +14%, Motor current +7%) 5 days post-bearing replacement. Root cause confirmed during teardown as 0.12 mm angular tilt due to uneven locknut seating torque.',
      provenance: 'firestore://historical_incidents/INC-419_resolved',
      status: 'Observed',
      confidence: 'High',
      details: 'Corrective action taken in INC-419: 0.04 mm shim readjustment and torque equalization to 85 Nm resolved anomaly immediately without replacing the bearing.',
      raw_payload: {
        similarity_score: 0.94,
        confirmed_root_cause: 'BEARING_ANGULAR_MISALIGNMENT',
        downtime_with_inspection: '35 minutes',
        saved_costs_usd: 14200
      }
    },
    {
      evidence_id: 'EV-1045',
      incident_id: 'INC-2026-0827',
      source: 'Inspection image',
      source_icon: 'Image',
      timestamp: '2026-09-22T14:45:00Z',
      asset: 'CNC-04',
      component: 'Bearing-B04 Housing',
      observation: 'Optical & infrared thermal camera capture: Spindle nose housing shows pristine grease seal with zero oil leak or contamination. FLIR thermal gradient reveals localized hotspot concentrated at the outer bearing raceway (68.4°C vs 52.1°C housing ambient), consistent with asymmetric preload friction.',
      provenance: 'gcs://factory-artifacts/incidents/INC-2026-0827/inspection_ir_optical_b04.jpg',
      status: 'Observed',
      confidence: 'High',
      image_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"><rect width="480" height="280" fill="%230f172a"/><circle cx="240" cy="140" r="90" fill="none" stroke="%2338bdf8" stroke-width="6"/><circle cx="240" cy="140" r="60" fill="%231e293b" stroke="%23f97316" stroke-width="4"/><ellipse cx="244" cy="136" rx="42" ry="38" fill="none" stroke="%23ef4444" stroke-width="3" stroke-dasharray="4 2"/><circle cx="256" cy="124" r="26" fill="%23ef4444" opacity="0.35"/><circle cx="256" cy="124" r="14" fill="%23fbbf24" opacity="0.5"/><text x="20" y="32" fill="%2394a3b8" font-family="monospace" font-size="12">FLIR T865 THERMAL CAPTURE - CNC-04 BEARING-B04</text><text x="20" y="52" fill="%23ef4444" font-family="monospace" font-size="13" font-weight="bold">HOTSPOT: 68.4°C [OUTER RACEWAY TILT]</text><text x="20" y="260" fill="%2338bdf8" font-family="monospace" font-size="11">OPTICAL SEAL INTEGRITY: 100% INTACT // NO LEAKAGE</text><path d="M 240 70 L 240 50 M 240 210 L 240 230 M 170 140 L 150 140 M 310 140 L 330 140" stroke="%2364748b" stroke-width="2"/></svg>',
      details: 'Thermal delta delta_T = +16.3°C above ambient baseline. No particulate residue or labyrinth seal damage.'
    }
  ],
  hypotheses: [
    {
      hypothesis_id: 'HYP-01',
      title: 'Bearing Misalignment & Asymmetric Preload',
      description: 'The newly installed Bearing-B04 has angular or radial runout exceeding 0.05 mm, caused by uneven seating collar torque or unclocked reused shim spacers during the recent maintenance replacement (WO #8841).',
      status: 'Likely',
      confidence: 0.82,
      inferred_mechanism: 'Mechanical angular tilt induces cyclic contact stress on rolling elements at 1X rotational frequency, driving friction heating (+11%) and parasitic counter-torque (+8% motor current) simultaneously.',
      supporting_evidence_ids: ['EV-1041', 'EV-1042', 'EV-1043', 'EV-1044', 'EV-1045'],
      counter_evidence_ids: [],
      missing_evidence: ['Direct physical dial indicator / laser alignment runout reading on spindle shaft coupling'],
      next_discriminating_check: 'Perform 25-minute Dial Indicator Radial Runout Test (Threshold: > 0.02 mm confirms misalignment).',
      likelihood_rank: 1
    },
    {
      hypothesis_id: 'HYP-02',
      title: 'Lubricant Starvation or Viscosity Breakdown',
      description: 'Insufficient high-speed spindle grease (Kluber Isoflex NBU 15) or inadequate fill volume during the recent bearing installation causing metal-on-metal friction and thermal rise.',
      status: 'Competing',
      confidence: 0.38,
      inferred_mechanism: 'Boundary lubrication breakdown generates friction and heat, which could explain temperature rise and modest current increase.',
      supporting_evidence_ids: ['EV-1041'],
      counter_evidence_ids: ['EV-1045'],
      missing_evidence: ['Grease sample spectrographic viscosity analysis', 'Acoustic emission high-frequency demodulation peak'],
      next_discriminating_check: 'Inspect optical inspection capture EV-1045 (seal pristine, no venting) and check acoustic emission > 20 kHz.',
      likelihood_rank: 2
    },
    {
      hypothesis_id: 'HYP-03',
      title: 'Sensor Malfunction / Accelerometer Cable Noise',
      description: 'Defective VIB-B04 IEPE accelerometer, loose mounting stud, or electrical ground loop noise inducing false vibration spikes.',
      status: 'Contradicted',
      confidence: 0.12,
      inferred_mechanism: 'Instrument sensor failure or signal path interference causing erroneous spike.',
      supporting_evidence_ids: [],
      counter_evidence_ids: ['EV-1041', 'EV-1045'],
      missing_evidence: ['Sensor channel loop-check with portable calibrator'],
      next_discriminating_check: 'Contradicted by multi-channel synchronicity: an accelerometer fault cannot cause motor current (+8%) and thermal rise (+11%) in independent physical channels.',
      likelihood_rank: 3
    }
  ],
  critic_finding: {
    critic_id: 'CRITIC-2026-001',
    target_hypothesis_id: 'HYP-01',
    run_timestamp: '2026-09-22T14:52:10Z',
    contradictions: [
      {
        point: 'Sensor fault hypothesis (HYP-03) is directly contradicted by physics.',
        conflicting_evidence_id: 'EV-1041',
        rationale: 'Telemetry confirms three electrically independent sensor channels (piezoelectric accelerometer VIB-B04, PT100 RTD TEMP-B04, and Hall-effect CT CURR-M01) shifted in exact lockstep (r=0.984). A sensor fault cannot manipulate external motor current and thermal thermodynamics.'
      },
      {
        point: 'Lubrication failure hypothesis (HYP-02) is weakened by visual inspection.',
        conflicting_evidence_id: 'EV-1045',
        rationale: 'Thermal imaging shows concentrated localized hotspot rather than uniform race heating, and optical seal shows zero grease expulsion or charring.'
      }
    ],
    ignored_evidence: [
      {
        evidence_id: 'EV-1042',
        observation: 'Technician explicit comment: "Housing collar fit unusually snug during press; shim spacer reused without laser clocking."',
        significance: 'Provides direct causal provenance linking the installation procedure directly to mechanical collar skew.'
      }
    ],
    falsification_condition: 'What would prove Bearing Misalignment wrong? If a precision dial indicator or laser alignment check on the shaft coupling measures total radial runout LESS than 0.02 mm, the misalignment hypothesis is definitively FALSIFIED.',
    strongest_discriminating_check: 'Dial indicator / laser shaft runout measurement (< 0.02 mm falsifies; > 0.05 mm confirms). Execution time: 25 minutes.',
    recommendation_action: 'PROCEED_TO_SIMULATION',
    confidence_delta: -0.03
  },
  simulation_params: DEFAULT_SIMULATION_PARAMS,
  simulation_results: calculateDeterministicSimulation(DEFAULT_SIMULATION_PARAMS),
  recommendation: {
    recommendation_id: 'REC-2026-0827-01',
    next_step: 'Execute Controlled Dial Indicator & Laser Runout Inspection on Spindle Coupling',
    target_component: 'Bearing-B04 / Shaft Coupling',
    action_type: 'NON_DESTRUCTIVE_DIAGNOSTIC_INSPECTION',
    urgency: 'HIGH',
    time_window: 'Within next 30 minutes (before continuous cycle thermal runout)',
    rationale: 'Deterministic modeling shows inspecting now costs only $550 in downtime while reducing 85% uncertainty and eliminating a $34,200 spindle seizure risk. Supported by lockstep telemetry [EV-1041], recent replacement provenance [EV-1042], OEM tolerance specifications [EV-1043], and historical precedent [EV-1044].',
    uncertainty_pct: 15,
    evidence_references: ['EV-1041', 'EV-1042', 'EV-1043', 'EV-1044', 'EV-1045'],
    estimated_duration_minutes: 25,
    safety_protocol_code: 'ISO-10816-3 / OSHA-LOTO-SPINDLE-4'
  },
  approval: {
    approval_id: 'APP-2026-0827-PENDING',
    incident_id: 'INC-2026-0827',
    decision: 'PENDING',
    engineer_name: 'Akhil Anupoju',
    engineer_role: 'Senior Reliability & Diagnostics Engineer (Lead)',
    timestamp: '2026-09-22T14:55:00Z',
    comment: '',
    authorized_action: 'Inspect Spindle Coupling Alignment via Laser Tool LAK-40',
    signature_hash: 'UNVERIFIED_AWAITING_ENGINEER_CLICK'
  },
  action: null,
  outcome: null,
  audit_trail: [
    {
      event_id: 'AUD-001',
      step_number: 1,
      timestamp: '2026-09-22T14:18:05Z',
      agent_role: 'Root Orchestrator',
      tool_call: 'get_asset_context',
      summary: 'Trigger received: Vibration alert threshold exceeded (+42%). Orchestrator initiated investigation workflow.',
      request_payload: { asset_id: 'CNC-04', trigger_sensor: 'VIB-B04', trigger_value: '12.38 mm/s' },
      response_payload: { asset_name: 'CNC-04 5-Axis Milling Center', line: 'Line B', status: 'ABNORMAL' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-002',
      step_number: 2,
      timestamp: '2026-09-22T14:18:12Z',
      agent_role: 'Evidence Agent',
      tool_call: 'get_telemetry_window',
      summary: 'Retrieved 24-hr multi-sensor telemetry window. Detected simultaneous drift in vibration (+42%), temp (+11%), and motor current (+8%).',
      request_payload: { asset_id: 'CNC-04', time_window: '24h', sensors: ['VIB-B04', 'TEMP-B04', 'CURR-M01', 'RPM-S01', 'PRESS-HYD01'] },
      response_payload: { points_retrieved: 24, anomaly_step_detected_at: '2026-09-22T14:18:00Z', evidence_id: 'EV-1041' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-003',
      step_number: 3,
      timestamp: '2026-09-22T14:18:30Z',
      agent_role: 'Evidence Agent',
      tool_call: 'get_maintenance_history',
      summary: 'Retrieved CMMS records for CNC-04. Surfaced work order #8841: Spindle bearing Bearing-B04 replaced 4 days prior.',
      request_payload: { asset_id: 'CNC-04', lookback_days: 30 },
      response_payload: { work_orders: 1, recent_replacement: 'Bearing-B04 (4 days ago)', evidence_id: 'EV-1042' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-004',
      step_number: 4,
      timestamp: '2026-09-22T14:18:45Z',
      agent_role: 'Evidence Agent',
      tool_call: 'search_manual',
      summary: 'Queried OEM service documentation for NVX 5080 II spindle tolerances. Retrieved Section 4.2 runout specifications.',
      request_payload: { query: 'spindle bearing alignment runout vibration tolerance', manual_id: 'DMG-NVX-5080' },
      response_payload: { matches: 1, section: '4.2.4', max_allowable_runout_mm: 0.02, evidence_id: 'EV-1043' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-005',
      step_number: 5,
      timestamp: '2026-09-22T14:19:10Z',
      agent_role: 'Evidence Agent',
      tool_call: 'get_prior_incidents',
      summary: 'Queried historical database for similar multi-channel anomaly vectors. Found INC-419 (CNC-02, 94% signal similarity).',
      request_payload: { similarity_vector: [0.42, 0.11, 0.08, 0.0, 0.0], asset_family: '5-axis-cnc' },
      response_payload: { match_incident: 'INC-419', similarity: 0.94, root_cause: 'BEARING_ANGULAR_MISALIGNMENT', evidence_id: 'EV-1044' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-006',
      step_number: 6,
      timestamp: '2026-09-22T14:19:35Z',
      agent_role: 'Evidence Agent',
      tool_call: 'get_inspection_image',
      summary: 'Retrieved optical and FLIR thermal capture for Bearing-B04 housing. Localized thermal hotspot (68.4°C) verified.',
      request_payload: { incident_id: 'INC-2026-0827', camera_id: 'FLIR-T865-BAY2' },
      response_payload: { image_format: 'IR_OPTICAL_FUSED', hotspot_celsius: 68.4, evidence_id: 'EV-1045' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-007',
      step_number: 7,
      timestamp: '2026-09-22T14:20:02Z',
      agent_role: 'WHY Agent',
      tool_call: 'generate_competing_hypotheses',
      summary: 'Generated 3 competing hypotheses with explicit evidence provenance: (1) Bearing Misalignment, (2) Lubrication Issue, (3) Sensor Fault.',
      request_payload: { evidence_ids: ['EV-1041', 'EV-1042', 'EV-1043', 'EV-1044', 'EV-1045'] },
      response_payload: { hypotheses_count: 3, leader: 'HYP-01 (Confidence 0.82)', status: 'LIKELY' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-008',
      step_number: 8,
      timestamp: '2026-09-22T14:20:40Z',
      agent_role: 'Critic Agent',
      tool_call: 'critic_agent_evaluate',
      summary: 'Self-challenge routine: "What would prove this wrong?" Identified dial indicator runout < 0.02mm as decisive falsification check.',
      request_payload: { leading_hypothesis_id: 'HYP-01', all_evidence_ids: ['EV-1041', 'EV-1042', 'EV-1043', 'EV-1044', 'EV-1045'] },
      response_payload: { falsification_condition: 'Dial runout < 0.02 mm', recommendation: 'PROCEED_TO_SIMULATION' },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-009',
      step_number: 9,
      timestamp: '2026-09-22T14:21:05Z',
      agent_role: 'Simulation Agent',
      tool_call: 'run_simulation',
      summary: 'Executed deterministic simulation comparing Continue, Inspect, and Repair. Flagged Inspect as optimal tradeoff.',
      request_payload: { assumptions_version: 'sim-v1.4-deterministic', inspection_delay_min: 25, hourly_rate_usd: 1200 },
      response_payload: { recommended_option: 'INSPECT', expected_delay_min: 25, relative_exposure: 0.05, estimated_cost_usd: 750 },
      status: 'SUCCESS'
    },
    {
      event_id: 'AUD-010',
      step_number: 10,
      timestamp: '2026-09-22T14:21:20Z',
      agent_role: 'Recommendation Agent',
      tool_call: 'generate_recommendation',
      summary: 'Formulated structured recommendation: 25-min Dial/Laser Alignment Check. Gate locked pending Human Engineer approval.',
      request_payload: { target_component: 'Bearing-B04', urgency: 'HIGH' },
      response_payload: { recommendation_id: 'REC-2026-0827-01', gate_status: 'AWAITING_HUMAN_APPROVAL' },
      status: 'SUCCESS'
    }
  ]
};

// Alternative Scenario 2: Lubrication Starvation
export const SCENARIO_LUBRICATION: InvestigationCase = {
  incident_id: 'INC-2026-0902',
  asset: {
    asset_id: 'CNC-04',
    name: 'CNC-04 5-Axis Precision Machining Center',
    type: 'High-Precision Milling Center',
    model: 'DMG Mori NVX 5080 II',
    line: 'Line B (Aerospace Impeller Cell)',
    facility: 'Plant 2 - Precision Machining Bay',
    commissioned_date: '2023-04-12',
    status: 'ABNORMAL',
    health_score: 58,
    components: [
      {
        component_id: 'BEARING-B04',
        name: 'Spindle Front Bearing (Bearing-B04)',
        type: 'BEARING',
        status: 'ABNORMAL',
        last_serviced: '2026-06-10',
        details: 'High temperature rise (+28%) with high-frequency acoustic squeal.',
        sensor_ids: ['VIB-B04', 'TEMP-B04']
      }
    ]
  },
  telemetry_summary: {
    vibration: { current: 14.80, baseline: 8.75, delta_pct: 69.1, unit: 'mm/s RMS', status: 'CRITICAL' },
    temperature: { current: 78.5, baseline: 61.4, delta_pct: 27.8, unit: '°C', status: 'CRITICAL' },
    motor_current: { current: 22.8, baseline: 22.5, delta_pct: 1.3, unit: 'A', status: 'NORMAL' },
    rpm: { current: 3400, baseline: 3400, delta_pct: 0.0, unit: 'RPM', status: 'NORMAL' },
    pressure: { current: 1.8, baseline: 4.2, delta_pct: -57.1, unit: 'bar', status: 'CRITICAL' }
  },
  telemetry_series: generateTelemetrySeries(),
  evidence: [
    {
      evidence_id: 'EV-201',
      incident_id: 'INC-2026-0902',
      source: 'Telemetry stream',
      source_icon: 'Activity',
      timestamp: '2026-09-22T14:18:00Z',
      asset: 'CNC-04',
      component: 'Bearing-B04',
      observation: 'Lube line pressure dropped 57% (4.2 bar -> 1.8 bar). Temperature escalated rapidly to 78.5°C while motor current remained baseline.',
      provenance: 'bigquery://telemetry_raw/sensors/CNC-04',
      status: 'Observed',
      confidence: 'High'
    }
  ],
  hypotheses: [
    {
      hypothesis_id: 'HYP-201',
      title: 'Automatic Lubrication Line Blockage / Pump Failure',
      description: 'Progressive lube line constriction starved Bearing-B04 of oil-air mist, creating boundary friction heat.',
      status: 'Likely',
      confidence: 0.89,
      inferred_mechanism: 'Lubricant boundary failure causing dry roller contact.',
      supporting_evidence_ids: ['EV-201'],
      counter_evidence_ids: [],
      missing_evidence: ['Lube filter differential pressure transducer check'],
      next_discriminating_check: 'Check hydraulic lube pump manifold filter.',
      likelihood_rank: 1
    }
  ],
  critic_finding: {
    critic_id: 'CRITIC-202',
    target_hypothesis_id: 'HYP-201',
    run_timestamp: '2026-09-22T14:50:00Z',
    contradictions: [],
    ignored_evidence: [],
    falsification_condition: 'What would prove lube failure wrong? If oil mist flowmeter reads > 2.5 ml/min.',
    strongest_discriminating_check: 'Inline flowmeter measurement.',
    recommendation_action: 'PROCEED_TO_SIMULATION',
    confidence_delta: 0.0
  },
  simulation_params: DEFAULT_SIMULATION_PARAMS,
  simulation_results: calculateDeterministicSimulation(DEFAULT_SIMULATION_PARAMS),
  recommendation: {
    recommendation_id: 'REC-202',
    next_step: 'Flush Lubrication Line & Inspect Manifold Solenoid Valve',
    target_component: 'Lube Manifold',
    action_type: 'FLUID_SYSTEM_SERVICE',
    urgency: 'IMMEDIATE',
    time_window: 'Within 10 minutes',
    rationale: 'Severe dry friction will seize spindle within 1 hour.',
    uncertainty_pct: 11,
    evidence_references: ['EV-201'],
    estimated_duration_minutes: 20,
    safety_protocol_code: 'OSHA-LOTO-HYD-1'
  },
  approval: {
    approval_id: 'APP-202',
    incident_id: 'INC-2026-0902',
    decision: 'PENDING',
    engineer_name: 'Akhil Anupoju',
    engineer_role: 'Senior Reliability & Diagnostics Engineer',
    timestamp: '2026-09-22T14:55:00Z',
    comment: '',
    authorized_action: 'Purge Lubrication Manifold',
    signature_hash: 'PENDING'
  },
  action: null,
  outcome: null,
  audit_trail: []
};

// Ground Truth Outcome for Primary CNC-04 Scenario
export const GROUND_TRUTH_OUTCOME_CNC04: InvestigationCase['outcome'] = {
  outcome_id: 'OUT-2026-0827-SUCCESS',
  incident_id: 'INC-2026-0827',
  actual_cause: 'Bearing Misalignment (Angular Runout: 0.14 mm on Bearing-B04 sleeve collar)',
  observed_result: 'Technicians executed laser alignment diagnostic with LAK-40 kit. Measured 0.14 mm angular tilt at spindle nose. Technicians loosened rear housing bolts, inserted 0.05 mm precision stainless steel shim, and retorqued in star pattern to 85 Nm.',
  physical_findings: [
    'Dial runout measured 0.14 mm (Specification maximum: 0.02 mm) - Exceeded by 700%',
    'Bearing raceway undamaged thanks to early intervention prior to surface galling',
    'Shim pack adjusted with 0.05 mm AISI 316 shim foil',
    'Post-retorque dial runout verified at 0.012 mm (within Class P4 spec)'
  ],
  pre_vibration: 12.42,
  post_vibration: 3.10, // Dropped back down below normal!
  pre_temperature: 68.2,
  post_temperature: 58.4,
  prediction_match: true,
  top_k_recall: true,
  time_to_resolution_minutes: 32,
  accuracy_score_pct: 100
};
