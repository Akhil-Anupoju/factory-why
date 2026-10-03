# FACTORY WHY: UI + FUNCTIONAL SPECIFICATION

**Subtitle:** Frontend behavior, information architecture, interaction states, data requirements, and backend contracts  
**Document Version:** 1.0.0 (Engineering Architecture Release)  
**Primary Target Audience:** Backend Engineers, AI/Agent Engineers (Google ADK / Gemini), Data Engineers (Firestore / BigQuery / Cloud Storage), QA & Evaluation Engineers  
**System Status:** Frontend UI Prototype Complete (Fully Functional Client State Machine & Mock Layer); Backend Implementation Pending  

---

## 1. DOCUMENT PURPOSE

### 1.1 Objective
This specification serves as the formal engineering bridge between the currently implemented **Factory WHY** frontend user interface and the forthcoming backend platform. It translates visual components, user interaction flows, mock data schemas, and UI state transitions into explicit architectural requirements for the backend engineering phase.

```
+-----------------------------------------------------------------------+
|                       CURRENT UI PROTOTYPE                            |
|        (React 19 / TypeScript / Tailwind CSS / Client State)          |
+-----------------------------------v-----------------------------------+
|                        BACKEND CONTRACTS                              |
|           (Pydantic Schemas / REST Endpoints / SSE Stream)            |
+-----------------------------------v-----------------------------------+
|                       FASTAPI RUNTIME (Cloud Run)                     |
|           (Stateless API Boundary / IAM / Token Verification)         |
+-----------------------------------v-----------------------------------+
|                       GOOGLE ADK ORCHESTRATION                        |
|  (Sequential & Bounded Workflows: Orchestrator, Evidence, WHY, Critic)|
+-----------------------------------v-----------------------------------+
|                       GEMINI REASONING ENGINE                         |
|   (Multimodal Synthesis / Structured JSON / Tool Calling Bounds)      |
+-----------------------------------v-----------------------------------+
|                    PERSISTENCE & OBSERVABILITY                        |
|  (Firestore: Case State | BigQuery: Telemetry & Eval | GCS: Artifacts)|
+-----------------------------------------------------------------------+
```

### 1.2 Target Audience & Usage
- **Backend Engineers (Python/FastAPI):** To map existing TypeScript interfaces (`src/types/index.ts`) directly into Pydantic models and implement allowlisted REST/SSE endpoints.
- **Agent / GenAI Engineers (Google ADK / Gemini):** To structure prompt contracts, system instructions, allowlisted tool calling boundaries, and bounded critique loops matching the UI expectations.
- **Database & Data Engineers (Firestore / BigQuery / Cloud Storage):** To construct the document models, partitioned telemetry tables, and immutable artifact repositories.
- **Evaluation Engineers:** To automate test harness runs across the 8-scenario benchmark suite.

### 1.3 Scope Boundary: What Is Implemented vs. What Is Intentionally Deferred
- **Currently Implemented (Frontend UI Prototype):**
  - Fully responsive, production-hardened desktop and tablet UI workspace.
  - Complete state transitions: Anomaly Alert $\to$ Telemetry Scrubbing $\to$ Evidence Inspection $\to$ Hypotheses Review $\to$ Critic Challenge $\to$ Deterministic Simulation $\to$ Approval Gate $\to$ Simulated Action $\to$ Ground Truth Reveal $\to$ Audit Trail.
  - Interactive component filtering, evidence provenance inspection modal, challengeable deterministic simulation parameters, and 8-scenario evaluation scorecard modal.
  - Type definitions matching the architectural blueprint contract.
- **Intentionally Deferred (To be implemented by Backend/ADK):**
  - Live Firebase Authentication & App Check client enforcement.
  - Live Google Cloud Run service running FastAPI.
  - Live Google ADK multi-agent workflow runtime.
  - Live Gemini API calls (currently utilizing high-fidelity synthetic data matching the prompt contract).
  - Physical or real-time SCADA / PLC / MES / ERP integrations (prohibited by design for industrial safety).

---

## 2. PRODUCT OVERVIEW

### 2.1 Mission & Value Proposition
**Factory WHY (CTRL + WHY)** is an AI-powered industrial root-cause investigation and decision-support workspace. It operates in the critical operational gap **after a machine condition-monitoring alert fires and before a maintenance engineer commits to a physical intervention**. 

Traditional industrial dashboards inform the engineer **WHAT** changed (e.g., vibration exceeded threshold). Engineers then spend hours manually cross-referencing disparate databases, SCADA historians, PDF manuals, and maintenance work orders to reconstruct the story. Factory WHY automates this contextual synthesis, presents competing explanations, subjects the leading theory to rigorous self-challenge, simulates operational trade-offs with deterministic algorithms, and enforces an unbreakable human authorization gate before dispatching action.

### 2.2 Core Persona
- **Primary User:** Senior Reliability, Maintenance, or Plant Operations Engineer.
- **User Mental Model:** Skeptical, safety-conscious, empirical, and accountable for machine uptime, worker safety, and equipment integrity. They require verifiable evidence IDs, exact numerical tolerances, and transparent trade-offs rather than opaque "AI confidence" scores.

### 2.3 The Non-Chatbot Paradigm
Factory WHY is explicitly **not a conversational chatbot**. There are no conversational prompts, floating chat widgets, or open-ended prose answers. It is a single, structured, mission-critical workspace built around an auditable investigation loop:

$$\text{OBSERVE} \longrightarrow \text{INVESTIGATE} \longrightarrow \text{EXPLAIN WHY} \longrightarrow \text{CHALLENGE} \longrightarrow \text{SIMULATE} \longrightarrow \text{RECOMMEND} \longrightarrow \text{HUMAN APPROVAL} \longrightarrow \text{ACT} \longrightarrow \text{LEARN}$$

---

## 3. PRIMARY DEMO SCENARIO

### 3.1 Operational Profile: Asset CNC-04
- **Asset ID:** `CNC-04`
- **Asset Description:** DMG Mori NVX 5080 II (5-Axis Precision Machining Center)
- **Cell / Line:** Line B (Aerospace Impeller Machining Cell)
- **Operational Status at Trigger:** `ABNORMAL` (Health Score degraded from 100% to 64%)

### 3.2 Physical Anomaly Signature
At `14:18:00 UTC`, the asset experiences a simultaneous multi-sensor step anomaly:
- **Vibration (VIB-B04):** $+41.94\%$ ($8.75 \to 12.42\text{ mm/s RMS}$) — Exceeds ISO 10816-3 Class II Alert Threshold ($9.0\text{ mm/s}$).
- **Bearing Temperature (TEMP-B04):** $+11.07\%$ ($61.4 \to 68.2^\circ\text{C}$).
- **Motor Current (CURR-M01):** $+8.00\%$ ($22.5 \to 24.3\text{ A}$).
- **Spindle Speed (RPM-S01):** Nominal ($3400\text{ RPM}$).
- **Hydraulic Line Pressure (PRESS-HYD01):** Nominal ($4.2\text{ bar}$).

### 3.3 Contextual Change Event
Four days prior (`2026-09-18`), scheduled preventive maintenance work order `WO #8841` was completed on `CNC-04`: front spindle bearing `BEARING-B04` was replaced with OEM part `SKF NN 3016 K/SP`. Technician notes recorded that the housing sleeve collar fit unusually tight on the taper.

### 3.4 Competing Hypotheses Formulated
1. **Hypothesis 1 (Leading / Likely):** Bearing Misalignment & Asymmetric Preload (Confidence: 82%).
2. **Hypothesis 2 (Competing):** Lubricant Starvation or Viscosity Breakdown (Confidence: 38%).
3. **Hypothesis 3 (Contradicted):** Accelerometer Sensor Malfunction / Signal Cable Noise (Confidence: 12%).

### 3.5 Ground Truth vs. Current Hypothesis (Strict Quarantine Rule)
- **Current Hypothesis:** An inference derived by the model from available evidence.
- **Ground Truth:** Physical fact confirmed only after shop-floor intervention: **0.14 mm angular runout at spindle coupling due to uneven seating collar torque**.
- **Quarantine Invariant:** The UI strictly conceals Ground Truth from the engineer until the simulated maintenance action is executed. Scenario names, tooltips, and card labels must never disclose the root cause during the investigation.

---

## 4. APPLICATION INFORMATION ARCHITECTURE

The application interface is structured as an integrated, multi-tier industrial control-room workspace:

```
+--------------------------------------------------------------------------------------------------+
| TOP BAR: Brand | Incident # | Asset | Severity | Operational Status | Case Selector | Demo | Eval|
+--------------------------------------------------------------------------------------------------+
| DEMO SCRIPT HELPER BAR: 8-Beat Script Stepper | Narration Audio Prompt | Judge Takeaways         |
+--------------------------------------------------------------------------------------------------+
| STAGE NAVIGATION RIBBON: 1.Twin > 2.Telemetry > 3.Hypotheses > 4.Critic > 5.Evidence > ...      |
+--------------------------------------------------------------------------------------------------+
| STAGE 1: ASSET TWIN & TELEMETRY OBSERVATION (2-Column Grid: 5 / 7 cols)                          |
| [Machine Context & Spindle Drive Topology]       | [Telemetry Dynamics & Interactive Scrubber]   |
+--------------------------------------------------------------------------------------------------+
| STAGE 2: ROOT-CAUSE HYPOTHESES & FALSIFICATION CRITIC (2-Column Grid: 7 / 5 cols)                |
| [WHY Agent: Competing Hypothesis Cards]         | [Critic Agent: "What would prove wrong?"]     |
+--------------------------------------------------------------------------------------------------+
| STAGE 3: AUDITABLE EVIDENCE STREAM (Full Width 12 cols)                                          |
| [Evidence Timeline: EV-1041 to EV-1045 with Immutable Provenance Paths & Type Filters]           |
+--------------------------------------------------------------------------------------------------+
| STAGE 4: DETERMINISTIC DECISION SIMULATOR (Full Width 12 cols - No Collapsed Columns)            |
| [Assumptions Drawer (Sliders)] | [Continue ($34k)] | [Inspect ($750 - REC)] | [Repair ($6.2k)]   |
+--------------------------------------------------------------------------------------------------+
| STAGE 5: RECOMMENDATION & HUMAN APPROVAL GATE (2-Column Grid: 6 / 6 cols)                         |
| [Synthesized Recommendation]                     | [Human Approval Gate]                         |
| (Action, Urgency, Uncertainty, Citations)        | [Simulated Maintenance Dispatch (Locked)]     |
|                                                  | [Physical Ground Truth Outcome (Concealed)]   |
+--------------------------------------------------------------------------------------------------+
| STAGE 6: FULL-WIDTH ADK AGENT TOOL AUDIT TRAIL (Full Width 12 cols)                              |
| [Traceable Timeline of Agent Steps, Tool Calls, Request/Response JSON Payloads]                  |
+--------------------------------------------------------------------------------------------------+
```

---

## 5. GLOBAL HEADER

### 5.1 Component Summary
The persistent global top bar anchors the investigation workspace, presenting unambiguous situational awareness, incident identifiers, and case-switching affordances without causing layout jitter or horizontal page overflow.

### 5.2 Field-by-Field Specifications

| Field Label | Visual Representation | Data Type | Source | Provenance / Nature | Backend Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brand Identity** | `FACTORY WHY` + `FW` icon | Static Text | Client Asset | Branding | None |
| **Architecture Tag** | `CTRL+WHY PROTOCOL` | Static Text | Client Asset | Trust Marker | None |
| **Incident ID** | `INC-2026-0827` | String | `currentCase.incident_id` | Operational State | Firestore: `incidents/{incident_id}` |
| **Asset Identifier** | `CNC-04` | String | `currentCase.asset.asset_id` | Operational State | Firestore: `assets/{asset_id}` |
| **Severity Level** | `HIGH` (Rose badge + AlertTriangle) | Enum | `currentCase.severity` | Operational State | Firestore: `incidents/{incident_id}.severity` |
| **Operational State** | Calibrated Badge (`INVESTIGATING`, `ACTION AUTHORIZED`, `TASK DISPATCHED`, `RESOLVED & VERIFIED`) | Enum | Derived from `approval`, `action`, `outcome` | State Machine | Firestore: `incidents/{incident_id}.status` |
| **Case Selector** | Dropdown (`Live Case: Multi-Sensor Anomaly` vs `Case #2: Pressure Surge`) | Select | Local state | Scenario Harness | `GET /api/incidents` |
| **3-Min Demo Script** | Toggle button + Step indicator (`Step 1/8`) | Number | Client State | Demo Facilitator | None |
| **Evaluation Suite** | Button + Badge (`8/8`) | Trigger | Modal state | Evaluation Harness | `GET /api/evaluations/latest` |
| **Reset Action** | Button (`Reset`) | Trigger | Client State | Demo Reset | Re-seeds initial incident fixture |

---

## 6. MACHINE CONTEXT & COMPONENT TWIN

### 6.1 Component Summary
Provides a structural digital twin context of the abnormal CNC milling center. It renders the asset hierarchy, health score, operating status, maintenance history, and an interactive vector diagram of the spindle mechanical drive train.

### 6.2 Data Model & Visual Distinction

```
Asset: CNC-04 (DMG Mori NVX 5080 II)
├── Component: MOTOR-M01 [Drive Motor] (Sensors: CURR-M01, RPM-S01)
├── Component: BEARING-B04 [Spindle Front Bearing] (Sensors: VIB-B04, TEMP-B04) <- Anomalous
├── Component: SHAFT-S01 [Drive Shaft & Coupler] (Sensors: RPM-S01)
└── Component: SENSORS-SYS [Sensor Array] (All 5 Probes)
```

| Field Name | Displayed Label | Type | UI Category | Value in CNC-04 Case |
| :--- | :--- | :--- | :--- | :--- |
| `asset.name` | Machine Name | String | **Observed Data** | `CNC-04 5-Axis Precision Machining Center` |
| `asset.model` | Model & Spec | String | **Observed Data** | `DMG Mori NVX 5080 II` |
| `asset.line` | Operational Cell | String | **Observed Data** | `Line B (Aerospace Impeller Cell)` |
| `asset.health_score` | Health Index | Number (0-100) | **Derived Value** | `64%` (Degraded by -36 pts) |
| `asset.status` | Operating State | Enum | **Derived Value** | `ABNORMAL` |
| `components[1].details`| Maintenance Context| String | **Observed Data** | `Replaced 4 days ago under WO #8841` |
| Spindle SVG Nodes | Visual Topology | SVG Layout | **Observed Context**| Interactive motor, shaft, bearing, chuck |

### 6.3 Interactions
- **Component Click (Topology Node or Hierarchy Card):** Emits `onSelectComponent(component_id)`. Filters the evidence timeline to show records relevant to that specific component and highlights associated telemetry channels.
- **Reset Filter:** Clears the active component filter back to `null`.

---

## 7. TELEMETRY PANEL

### 7.1 Component Summary
Presents the real-time sensor dynamics across 5 channels. Demonstrates multi-channel synchronicity ($r = 0.984$), displays baseline vs. current measurements, and provides an interactive time-series chart with a scrub slider to pinpoint the onset of the anomaly.

### 7.2 Telemetry Channels Specification

| Channel ID | Display Label | Physical Unit | Baseline Value | Current Value | Delta % | Status | Nature |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `VIB-B04` | Vibration (RMS) | `mm/s RMS` | `8.75` | `12.42` | `+41.94%` | `CRITICAL` | **Observed Fact** |
| `TEMP-B04` | Bearing Temp | `°C` | `61.4` | `68.2` | `+11.07%` | `WARNING` | **Observed Fact** |
| `CURR-M01` | Motor Current | `A` | `22.5` | `24.3` | `+8.00%` | `WARNING` | **Observed Fact** |
| `RPM-S01` | Spindle Speed | `RPM` | `3400` | `3400` | `0.00%` | `NORMAL` | **Observed Fact** |
| `PRESS-HYD01`| Hyd Pressure | `bar` | `4.2` | `4.2` | `0.00%` | `NORMAL` | **Observed Fact** |

### 7.3 Multi-Channel Signal Coherence
- **Displayed Value:** `Lockstep Signal Coherence: r = 0.984 (Multi-channel)`
- **Mathematical Nature:** Pearson correlation coefficient computed across vibration, temperature, and current from `14:18:00 UTC` onward.
- **Engineering Purpose:** Confirms physical multi-channel coupling, disqualifying single-channel sensor failure.

### 7.4 Interactive Time-Series Scrubber
- **Chart Geometry:** Scalable SVG vector chart mapping 12 discrete 1-hour/30-minute intervals from `08:00 UTC` to `16:00 UTC`.
- **Threshold Limit:** Rendered dashed reference line at `9.0 mm/s` (ISO 10816-3 limit).
- **Anomaly Marker:** Visual flag at index 7 (`14:18 UTC`) marking step onset.
- **Scrub Interaction:** Scrubbing the range input dynamically updates the displayed point in time, re-rendering exact metric values across all 5 cards.

---

## 8. EVIDENCE SYSTEM

### 8.1 Evidence Contract
The Evidence Contract prevents generative hallucinations by enforcing strict typing and immutable origin tracking for every ingested record.

```typescript
interface EvidenceItem {
  evidence_id: string;          // Stable identifier (e.g., "EV-1041")
  incident_id: string;          // Enclosing investigation context
  source: string;               // Allowlisted source class
  source_icon: string;          // Icon affordance
  timestamp: string;            // ISO-8601 UTC timestamp
  asset: string;                // Physical asset reference
  component: string;            // Target component
  observation: string;          // Human/Sensor observation
  provenance: string;           // Verifiable immutable storage URI
  status: "Observed";           // Invariant fact status
  confidence: "High" | "Medium" | "Low";
  details?: string;             // Detailed mechanical breakdown
  image_url?: string;           // Image asset URL (SVG data or GCS link)
  document_snippet?: string;    // Raw verbatim manual or work order text
  raw_payload?: Record<string, any>; // JSON tool output payload
}
```

### 8.2 Inventory of Active Evidence Items (CNC-04)

| Evidence ID | Source Category | Observation Summary | Verifiable Provenance URI | Status |
| :--- | :--- | :--- | :--- | :--- |
| `EV-1041` | Telemetry stream | Multi-channel synchronicity: Vibration $+42\%$, Temp $+11\%$, Current $+8\%$ step change at 14:18 UTC. RPM & pressure invariant. | `bigquery://telemetry_raw/sensors/CNC-04/partition_20260922` | `Observed` |
| `EV-1042` | Maintenance work order | Bearing replaced 4 days prior (WO #8841). Tech notes: "Collar seating tight on taper; reused shims without laser clocking." | `cmms://work-orders/8841/signoff_shift_b` | `Observed` |
| `EV-1043` | Service manual | Section 4.2.4: Coupler angular misalignment $>0.05\text{ mm}$ causes 1X vibration harmonics and $+5\text{-}12\%$ drive current. | `gcs://factory-manuals/dmg_mori_nvx5080_sec4_spindle.pdf#page=42` | `Observed` |
| `EV-1044` | Prior incident | Archive INC-419 (June 2025): Identical thermal/vibration signature on CNC-02 resolved by 0.04 mm shim realignment. | `firestore://historical_incidents/INC-419_resolved` | `Observed` |
| `EV-1045` | Inspection image | FLIR thermal capture: 68.4°C hotspot at outer raceway. Optical inspection confirms grease seal intact with zero leakage. | `gcs://factory-artifacts/incidents/INC-2026-0827/inspection_ir_optical_b04.jpg` | `Observed` |

### 8.3 Provenance Inspector Modal
- **Trigger:** Clicking any `evidence_id` tag anywhere in the application.
- **Inspector Contents:**
  - Full observation statement.
  - Formatted raw JSON tool payload or verbatim document excerpt.
  - Image rendering (e.g., FLIR thermal overlay diagram).
  - Provenance URI with copy-to-clipboard affordance.
  - Accessible `Escape` key and click-outside dismissal handlers.

---

## 9. HYPOTHESIS SYSTEM

### 9.1 Conceptual Architecture
Hypotheses are model-generated candidate explanations. They are framed with distinctive styling (purple/indigo accents, `[AI INFERENCE]` headers) to guarantee they are never confused with observed facts.

### 9.2 Trust States
- `Supported`: Strong empirical backing across multiple independent evidence channels.
- `Likely`: Current leading explanation with plausible physical mechanism.
- `Competing`: Plausible alternative explaining subset of signals, requiring discriminating test.
- `Unresolved`: Insufficient evidence to validate; requires gathering more data.
- `Contradicted`: Directly conflicts with one or more empirical evidence records.

### 9.3 Hypothesis Data Matrix (CNC-04 Case)

| ID | Title | Status | Conf. | Supporting IDs | Counter IDs | Missing Evidence | Next Discriminating Check |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HYP-01` | **Bearing Misalignment & Asymmetric Preload** | `Likely` | 82% | `EV-1041`, `EV-1042`, `EV-1043`, `EV-1044`, `EV-1045` | None | Dial indicator runout measurement on coupling | Dial Indicator Radial Runout Test ($>0.02\text{ mm}$ confirms) |
| `HYP-02` | **Lubricant Starvation or Viscosity Breakdown** | `Competing` | 38% | `EV-1041` | `EV-1045` (Seal intact, no leakage) | Spectrographic grease analysis; acoustic emission | Check optical seal capture `EV-1045` and measure acoustic emission $>20\text{ kHz}$ |
| `HYP-03` | **Sensor Malfunction / Cable Noise** | `Contradicted`| 12% | None | `EV-1041`, `EV-1045` | Sensor loop test | Contradicted by 3-channel lockstep drift ($r=0.984$) |

---

## 10. WHY AGENT

### 10.1 Agent Role & Bound
The WHY Agent synthesizes normalized evidence bundles into structured competing hypotheses. It is strictly constrained by the system instructions:
- Must never declare a "confirmed" physical cause.
- Must separate `Observed` facts from `Inferred` mechanisms.
- Must cite explicit `evidence_id` values for all material claims.
- Must return `status = UNRESOLVED` if evidence is ambiguous or incomplete.

### 10.2 Structured Generation Schema
The backend must deliver a structured JSON payload conforming to:

```json
{
  "hypotheses": [
    {
      "hypothesis_id": "string",
      "title": "string",
      "description": "string",
      "status": "SUPPORTED | LIKELY | COMPETING | UNRESOLVED | CONTRADICTED",
      "confidence": "number (0.0 - 1.0)",
      "inferred_mechanism": "string",
      "supporting_evidence_ids": ["string"],
      "counter_evidence_ids": ["string"],
      "missing_evidence": ["string"],
      "next_discriminating_check": "string | null",
      "likelihood_rank": "integer"
    }
  ]
}
```

---

## 11. CRITIC / SELF-CHALLENGE

### 11.1 The Falsification Interaction
The core differentiator of Factory WHY is the **"What would prove this wrong?"** loop. Rather than confirming biases, the Critic Agent rigorously evaluates the leading hypothesis to find vulnerabilities.

```
+-----------------------------------------------------------------------------+
|                               CRITIC AGENT                                  |
| 1. Surface Contradictions in Competing Theories                             |
| 2. Resurface Previously Ignored Evidence (e.g., Tech Notes)                 |
| 3. Formulate the Definitive Falsification Condition                         |
| 4. Prescribe the Single Most Discriminating Physical Check                  |
+-----------------------------------------------------------------------------+
```

### 11.2 Critic Finding Output (CNC-04 Case)
- **Target Hypothesis:** `HYP-01` (Bearing Misalignment)
- **Definitive Falsification Condition:**  
  *"If a precision dial indicator or laser alignment check on the shaft coupling measures total radial runout LESS than 0.02 mm, the misalignment hypothesis is definitively FALSIFIED."*
- **Contradictions Surfaced:**
  - Disproves Sensor Fault (`HYP-03`) via lockstep current/temperature physics (`EV-1041`).
  - Weakens Lubrication Failure (`HYP-02`) via thermal localized hotspot gradient (`EV-1045`).
- **Resurfaced Ignored Evidence:**
  - Highlights technician note in `EV-1042`: *"Collar fit unusually snug during hydraulic press insertion; shim spacer reused without laser clocking."*
- **Strongest Discriminating Check:** Dial indicator / laser runout measurement at spindle coupling (Execution time: 25 minutes).
- **Critic Recommendation:** `PROCEED_TO_SIMULATION` (Confidence delta: $-0.03$).

---

## 12. DETERMINISTIC DECISION SIMULATION

### 12.1 Separation of Model Reasoning from Deterministic Math
**Strict Architectural Rule:** Generative models must **never** hallucinate downtime, repair costs, or financial risk figures. Gemini explains the qualitative trade-off; deterministic Python/TypeScript code executes the exact arithmetic.

### 12.2 Challengeable Simulation Parameters

| Parameter | Type | Default Value | Tunable Range | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `inspection_delay_minutes` | Integer | `25 min` | 10 to 60 min | Controlled pause for laser clocking |
| `modeled_failure_exposure` | Float | `0.32` (32%) | 0.05 to 0.80 | Probability of unmitigated spindle seizure |
| `intervention_effectiveness`| Float | `0.85` (85%) | 0.50 to 0.95 | Diagnostic uncertainty reduction rate |
| `downtime_minutes_if_repair`| Integer | `180 min` | 60 to 360 min | Full teardown and bearing replacement window |
| `hourly_production_loss_usd`| Float | `$1,200 / hr`| $600 to $2,500| Production loss per hour on Line B |
| `emergency_repair_multiplier`| Float | `4.5` | Fixed | Multiplier if spindle seizes during cycle |

### 12.3 Modeled Options Comparison

| Dimension | Option 1: Continue | Option 2: Inspect (RECOMMENDED) | Option 3: Full Repair |
| :--- | :--- | :--- | :--- |
| **Strategy** | Finish production batch; defer to weekend | 25-min laser runout check & shim | Complete spindle overhaul & bearing swap |
| **Downtime Delay** | `0 min` | `25 min` | `180 min` |
| **Residual Exposure**| `100%` (Unmitigated) | `4.8%` ($0.32 \times (1 - 0.85)$) | `2.0%` |
| **Uncertainty Reduction**| `0%` | `85%` | `98%` |
| **Modeled Total Cost**| `~$36,900` (Catastrophic tool wreck risk) | `~$750` ($500 downtime + $250 tooling) | `~$6,200` ($3,600 downtime + $2,600 parts)|
| **Tradeoff Rationale**| Extreme financial & seizure risk | Optimal balance: 25 min resolves 85% risk | Premature waste of 4-day-old bearing |

---

## 13. RECOMMENDATION PANEL

### 13.1 Component Role
Translates the combined evidence, critique, and simulation output into a single, structured operational proposal for the reliability engineer.

### 13.2 Specification Fields
- **Next Step:** `Execute Controlled Dial Indicator & Laser Runout Inspection on Spindle Coupling`
- **Target Component:** `Bearing-B04 / Shaft Coupling`
- **Action Type:** `NON_DESTRUCTIVE_DIAGNOSTIC_INSPECTION`
- **Urgency Level:** `HIGH` (`Within next 30 minutes before thermal accumulation`)
- **Residual Uncertainty:** `15%` (Pending physical runout measurement)
- **Estimated Duration:** `25 Minutes`
- **Safety Standard Code:** `ISO-10816-3 / OSHA-LOTO-SPINDLE-4`
- **Grounded Evidence References:** `[EV-1041, EV-1042, EV-1043, EV-1044, EV-1045]`

---

## 14. HUMAN APPROVAL GATE

### 14.1 The Core Control Boundary
Factory WHY implements safety as an **architectural invariant**:

$$\mathbf{NO\ APPROVAL \implies NO\ ACTION}$$

The Action Agent is physically and logically incapable of creating work orders or dispatching maintenance tasks until an authenticated engineer explicitly signs off.

```
[ AWAITING APPROVAL ]
       |
       +---> [ REJECT ] ----------------------------> Investigation Closed / Escalated
       |
       +---> [ REQUEST MORE EVIDENCE ] -------------> Follow-up Tool Retrieval Loop
       |
       +---> [ CHALLENGE AI ] -----------------------> Re-run Critic Agent
       |
       +---> [ APPROVE ACTION ] (Authenticated) ----> UNLOCK ACTION AGENT
```

### 14.2 Action Affordances
1. **Approve Action (Primary):** Authenticates the engineer, records digital signature hash, transitions incident status to `ACTION_AUTHORIZED`, and unlocks the Simulated Action Panel.
2. **Reject:** Records rejection rationale and terminates investigation workflow.
3. **Request More Evidence:** Emits a request for targeted data collection (e.g., portable vibration spectrum analyzer).
4. **Challenge AI:** Invokes the Critic Agent to re-evaluate invariants.

---

## 15. SIMULATED ACTION PANEL

### 15.1 Simulation Safety Guardrail
Factory WHY creates **only simulated maintenance tasks**. It has **NO direct connection** to:
- Programmable Logic Controllers (PLCs)
- SCADA supervisory systems
- Physical emergency shutdown (ESD) relays
- Machine servo drives

### 15.2 State Transitions
- **Pre-Approval State (Locked):** Rendered as a secure quarantine card: *"Locked by Human Approval Gate. Action tool execution is quarantined until sign-off."*
- **Post-Approval State (Unlocked & Dispatched):**
  - **Task Number:** `TASK-2026-0922-01`
  - **Assigned Specialist:** `D. Miller (Shift B Lead Tech)`
  - **Allocated Diagnostic Tooling:** Optalign Smart RS5 Laser System, Mitutoyo 0.001mm Dial Indicator, Stainless Precision Shims (0.02 - 0.10 mm), Snap-On Digital Torque Wrench.
  - **LOTO Checklist:** 3-step physical verification procedure.
  - **Execution Trigger:** Button *"Complete Physical Inspection & Reveal Ground Truth"*.

---

## 16. GROUND TRUTH / OUTCOME VERIFICATION

### 16.1 Quarantine & Revelation
Ground truth is permanently quarantined during the investigation to evaluate the diagnostic accuracy of the agent system without data leakage. Once the engineer clicks *"Complete Physical Inspection"*, the ground-truth physical measurement is revealed.

### 16.2 Outcome Record (CNC-04 Case)
- **Confirmed Actual Cause:** Bearing Misalignment (Angular Runout: 0.14 mm on Bearing-B04 sleeve collar).
- **Physical Verification:** Laser alignment measured 0.14 mm angular tilt (exceeds 0.02 mm OEM spec by 700%). Technicians added 0.05 mm stainless shim to rear foot, retorqued to 85 Nm in star pattern.
- **Telemetry Restoration Verification:**
  - **Vibration:** Dropped from $12.42\text{ mm/s} \to 3.10\text{ mm/s}$ ($-75\%$ restoration, within normal Class P4 limit).
  - **Temperature:** Normalized from $68.2^\circ\text{C} \to 58.4^\circ\text{C}$ ($-9.8^\circ\text{C}$).
- **Evaluation Metric:** Prediction Match: **100% (Top-1 Cause Recall)**. Resolution time: 32 minutes.

---

## 17. AUDIT TRAIL

### 17.1 End-to-End Traceability
Every agent step, tool call, request payload, response object, and human decision is logged into an immutable chronological audit trail.

### 17.2 Logged Audit Sequence (CNC-04 Case)

| Step | Timestamp (UTC) | Agent Role | Tool Call | Operation Summary |
| :--- | :--- | :--- | :--- | :--- |
| **01** | `14:18:05` | Root Orchestrator | `get_asset_context` | Ingested anomaly trigger on `VIB-B04` (12.38 mm/s). |
| **02** | `14:18:12` | Evidence Agent | `get_telemetry_window` | Retrieved 24-hr multi-sensor series; confirmed lockstep shift (`EV-1041`). |
| **03** | `14:18:30` | Evidence Agent | `get_maintenance_history` | Surfaced replacement of Bearing-B04 4 days prior (`EV-1042`). |
| **04** | `14:18:45` | Evidence Agent | `search_manual` | Retrieved Section 4.2.4 coupling tolerance ($0.02\text{ mm}$) (`EV-1043`). |
| **05** | `14:19:10` | Evidence Agent | `get_prior_incidents` | Matched archive INC-419 (similarity 0.94) (`EV-1044`). |
| **06** | `14:19:35` | Evidence Agent | `get_inspection_image` | Ingested FLIR optical/thermal capture showing 68.4°C hotspot (`EV-1045`). |
| **07** | `14:20:02` | WHY Agent | `generate_competing_hypotheses` | Formulated 3 competing hypotheses with explicit provenance. |
| **08** | `14:20:40` | Critic Agent | `critic_agent_evaluate` | Challenged invariants; established dial runout $<0.02\text{ mm}$ falsification. |
| **09** | `14:21:05` | Simulation Agent | `run_simulation` | Evaluated deterministic trade-offs across Continue, Inspect, Repair. |
| **10** | `14:21:20` | Recommendation Agent | `generate_recommendation` | Formulated 25-min laser check proposal; locked approval gate. |
| **11** | Dynamic | Human Engineer | `approve_recommendation` | Engineer authenticated sign-off with audit signature hash. |
| **12** | Dynamic | Action Agent | `create_maintenance_task` | Generated work order `TASK-2026-0922-01`. |
| **13** | Dynamic | Root Orchestrator | `record_outcome` | Logged physical runout verification (0.14 mm) & 100% prediction match. |

---

## 18. STATE MACHINE

### 18.1 Investigation State Transition Graph

```
[ NEW_ALERT ]
      │
      ▼
[ RETRIEVING_EVIDENCE ] (Allowlisted specialist tools in parallel)
      │
      ▼
[ FORMING_HYPOTHESES ] (WHY Agent structured synthesis)
      │
      ▼
[ CRITIQUING_LEADER ]  (Critic Agent self-challenge loop)
      │
      ▼
[ RUNNING_SIMULATION ] (Deterministic Python module)
      │
      ▼
[ AWAITING_APPROVAL ]  (Human Gate: Action Agent blocked)
      ├───────────────────────┬────────────────────────┐
      ▼                       ▼                        ▼
 [ REJECTED ]        [ MORE_EVIDENCE ]            [ APPROVED ]
      │                       │                        │
      ▼                       ▼                        ▼
[ TERMINATED ]       [ TARGETED_RETRIEVAL ]       [ ACTION_DISPATCHED ]
                                                       │
                                                       ▼
                                                 [ RESOLVED_EVALUATED ]
```

### 18.2 State Specifications

| State Name | Entry Condition | Visible UI Treatment | Allowed User Actions | Next Valid States |
| :--- | :--- | :--- | :--- | :--- |
| `NEW_ALERT` | Telemetry threshold trip | Anomaly alert badge | Select Case, Reset | `RETRIEVING_EVIDENCE` |
| `RETRIEVING_EVIDENCE` | Orchestrator dispatched | Evidence skeletons | Inspect early data | `FORMING_HYPOTHESES` |
| `FORMING_HYPOTHESES` | Evidence bundle normalized | Hypothesis cards | Select hypothesis | `CRITIQUING_LEADER` |
| `CRITIQUING_LEADER` | Hypotheses ready | Critic finding panel | Click "What would prove wrong?" | `RUNNING_SIMULATION` |
| `RUNNING_SIMULATION` | Critic complete | Simulator cards | Adjust parameter sliders | `AWAITING_APPROVAL` |
| `AWAITING_APPROVAL` | Recommendation ready | Yellow badge; Action locked | Approve, Reject, Challenge, Evidence | `APPROVED`, `REJECTED` |
| `APPROVED` | Engineer signed off | Teal badge; Action unlocked | Revoke approval, Execute action | `ACTION_DISPATCHED` |
| `ACTION_DISPATCHED` | Task generated | Cyan pulse; Work order shown | Execute & verify outcome | `RESOLVED_EVALUATED` |
| `RESOLVED_EVALUATED` | Ground truth verified | Emerald badge; Deltas active | Reset, Export evaluation scorecard | `NEW_ALERT` (Reset) |

---

## 19. USER ACTION $\to$ SYSTEM BEHAVIOR MATRIX

| User Action | UI Visual Response | Expected Backend Operation | Expected Data Payload | New Investigation State | Audit Event Logged | Auth Required? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Select Component** | Highlights twin node, filters evidence & telemetry | Filter cached twin graph | `{ component_id: "BEARING-B04" }` | No change | No | No |
| **Scrub Telemetry** | Cursor moves across chart; 5 metric cards update | Query time-slice buffer | `{ timestamp: "2026-09-22T14:18:00Z" }` | No change | No | No |
| **Inspect Provenance**| Opens full-screen inspector modal | `GET /api/evidence/{id}` | Formatted payload, snippet, image | No change | `inspect_evidence` | No |
| **Challenge AI** | Critic button spins; highlights falsification rule | `POST /api/incidents/{id}/challenge` | Falsification condition & contradictions | `CRITIQUE_COMPLETE` | `critic_agent_evaluate` | No |
| **Adjust Assumptions**| Slider changes; metrics & trace recalculate in pure code | Local deterministic call or `POST /api/simulate` | Updated cost & exposure outputs | `SIMULATION_UPDATED` | None (Local calculation) | No |
| **Approve Action** | Gate turns green; unlocks Action Dispatch card | `POST /api/incidents/{id}/approve` | `{ decision: "APPROVED", comment: string }` | `APPROVED` | `approve_recommendation` | **Yes (Engineer)** |
| **Reject Action** | Gate turns red; action remains blocked | `POST /api/incidents/{id}/reject` | `{ decision: "REJECTED", reason: string }` | `REJECTED` | `reject_recommendation` | **Yes (Engineer)** |
| **Request Evidence** | Prompt opens; follow-up tool suggested | `POST /api/incidents/{id}/request-evidence` | `{ requested_sensor: string }` | `MORE_EVIDENCE` | `request_targeted_evidence` | **Yes (Engineer)** |
| **Execute Action** | Dispatches maintenance task; reveals Ground Truth | `POST /api/incidents/{id}/actions` | `{ task_id: "TASK-..." }` | `ACTION_DISPATCHED` | `create_maintenance_task` | **Yes (Engineer)** |
| **Reveal Outcome** | Reveals physical ground truth & post-vibration drop | `POST /api/incidents/{id}/outcome` | Ground truth match & evaluation score | `RESOLVED_EVALUATED` | `record_outcome` | No |

---

## 20. UI COMPONENT $\to$ DATA CONTRACT MATRIX

| UI Component | Data Contract Interface | Mandatory Fields | Data Source | Nature | Backend Dependency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TopBar** | `InvestigationCase` | `incident_id`, `asset.asset_id`, `severity` | Firestore | Observed / Operational | `GET /api/incidents/{id}` |
| **MachineContext** | `AssetContext` | `asset_id`, `name`, `model`, `components[]` | Firestore / Digital Twin | Observed / Derived | `GET /api/assets/{id}` |
| **TelemetryPanel** | `TelemetrySummary` & `TelemetryPoint[]` | `vibration`, `temperature`, `motor_current`, `rpm`, `pressure` | BigQuery | Observed Timeseries | `GET /api/telemetry/{id}` |
| **EvidenceTimeline** | `EvidenceItem[]` | `evidence_id`, `source`, `observation`, `provenance`, `status` | Firestore & Storage | **Observed Facts** | `GET /api/evidence` |
| **HypothesisCards** | `Hypothesis[]` | `hypothesis_id`, `title`, `confidence`, `status`, `supporting_evidence_ids` | Gemini Structured JSON | **AI Inference** | `POST /api/hypotheses` |
| **CriticSection** | `CriticFinding` | `falsification_condition`, `contradictions[]`, `ignored_evidence[]` | Critic Agent JSON | **AI Inference** | `POST /api/challenge` |
| **SimulationPanel**| `SimulationOptionResult[]` | `option`, `expected_delay_minutes`, `relative_exposure`, `estimated_cost_usd` | Deterministic Code | **Calculated Tradeoff** | `POST /api/simulate` |
| **Recommendation** | `Recommendation` | `next_step`, `urgency`, `rationale`, `uncertainty_pct`, `evidence_references` | Recommendation Agent | **Synthesized Decision** | `POST /api/recommend` |
| **ApprovalPanel** | `ApprovalRecord` | `decision`, `engineer_name`, `signature_hash`, `timestamp` | Human Engineer Input | **Human Decision** | `POST /api/approve` |
| **SimulatedAction** | `ActionRecord` | `task_number`, `assigned_technician`, `required_tools[]`, `status` | Action Agent | **Simulated Dispatch** | `POST /api/actions` |
| **OutcomePanel** | `OutcomeRecord` | `actual_cause`, `observed_result`, `prediction_match`, `post_vibration` | Ground Truth Registry | **Physical Verification** | `POST /api/outcome` |
| **AuditPanel** | `AuditEvent[]` | `event_id`, `step_number`, `agent_role`, `tool_call`, `request_payload`, `response_payload` | Cloud Logging / Firestore | **Audit Trail** | `GET /api/audit` |

---

## 21. API CONTRACT REQUIREMENTS

### 21.1 Overview
The backend service (Cloud Run + FastAPI) must expose REST and Server-Sent Events (SSE) endpoints. All tool calling boundaries are application-side; the agent selects the tool, but application code executes it.

### 21.2 Conceptual Endpoints Specification

#### 1. Ingest / Query Incident Context
- **Endpoint:** `GET /api/incidents/{incident_id}`
- **Input:** Path parameter `incident_id: string`
- **Output:** Serialized `InvestigationCase` schema
- **Auth:** Read permission for maintenance engineer

#### 2. Streaming Investigation Execution
- **Endpoint:** `GET /api/incidents/{incident_id}/stream`
- **Output:** Server-Sent Events (SSE) streaming progress states:
  - `EVENT: retrieving_telemetry`
  - `EVENT: checking_maintenance`
  - `EVENT: generating_hypotheses`
  - `EVENT: critiquing_leader`
  - `EVENT: running_simulation`
  - `EVENT: awaiting_approval`

#### 3. Trigger Falsification Challenge
- **Endpoint:** `POST /api/incidents/{incident_id}/challenge`
- **Input:** `{ leading_hypothesis_id: string }`
- **Output:** `CriticFinding` object containing falsification conditions and contradictions.

#### 4. Run Deterministic Simulation
- **Endpoint:** `POST /api/incidents/{incident_id}/simulate`
- **Input:** `SimulationParameters` object (inspection delay, failure exposure, etc.)
- **Output:** `SimulationOptionResult[]` array containing calculated costs and calculation traces.

#### 5. Submit Human Approval Decision
- **Endpoint:** `POST /api/incidents/{incident_id}/approve`
- **Input:** `{ decision: "APPROVED" | "REJECTED" | "REQUEST_MORE_EVIDENCE" | "CHALLENGE", comment: string }`
- **Auth:** Mandatory Bearer token validation matching authenticated engineer identity.

#### 6. Dispatch Simulated Action
- **Endpoint:** `POST /api/incidents/{incident_id}/actions`
- **Condition:** Rejects with `HTTP 403 Forbidden` unless `approval.decision == "APPROVED"`.
- **Output:** `ActionRecord` with task ID and tooling assignments.

#### 7. Reveal Ground Truth & Score
- **Endpoint:** `GET /api/incidents/{incident_id}/outcome`
- **Output:** `OutcomeRecord` comparing prediction against physical truth.

#### 8. Retrieve Full Audit Trail
- **Endpoint:** `GET /api/incidents/{incident_id}/audit`
- **Output:** Chronological list of `AuditEvent` entries.

---

## 22. FIRESTORE DATA REQUIREMENTS

The operational database stores mutable workflow and case state.

| Collection Name | Purpose | Key Document Fields | Read / Write Responsibility |
| :--- | :--- | :--- | :--- |
| `assets` | Physical machine metadata | `asset_id`, `name`, `type`, `line`, `facility`, `status`, `health_score` | Read: Agent/UI; Write: Twin sync |
| `components` | Sub-assemblies | `component_id`, `asset_id`, `type`, `last_serviced`, `sensor_ids[]` | Read: Agent/UI; Write: CMMS sync |
| `sensors` | Sensor registry | `sensor_id`, `component_id`, `type`, `unit`, `baseline_range` | Read: Agent/UI; Write: IoT registry |
| `incidents` | Investigation cases | `incident_id`, `asset_id`, `severity`, `status`, `created_at` | Read: UI; Write: Orchestrator |
| `evidence` | Audit-ready facts | `evidence_id`, `incident_id`, `source`, `observation`, `provenance`, `status` | Read: UI/WHY; Write: Evidence Agent |
| `hypotheses` | Inferred explanations | `hypothesis_id`, `incident_id`, `title`, `confidence`, `status`, `support_ids[]` | Read: UI; Write: WHY Agent |
| `simulations` | Option calculations | `simulation_id`, `incident_id`, `option`, `cost`, `exposure`, `assumptions` | Read: UI; Write: Simulation Agent |
| `approvals` | Human control gate | `approval_id`, `incident_id`, `decision`, `user_id`, `timestamp`, `comment` | Read: UI; Write: Human Engineer |
| `actions` | Simulated dispatches | `action_id`, `incident_id`, `task_number`, `assigned_tech`, `status` | Read: UI; Write: Action Agent |
| `outcomes` | Ground truth records | `outcome_id`, `incident_id`, `actual_cause`, `observed_result`, `match` | Read: UI; Write: Evaluation service |

---

## 23. BIGQUERY REQUIREMENTS

### 23.1 Telemetry Storage Table (`telemetry_raw`)
High-frequency sensor time series are partitioned by day and clustered by `asset_id` and `sensor_id`:

```sql
-- Schema: factory_telemetry.sensor_readings
timestamp: TIMESTAMP,
asset_id: STRING,
sensor_id: STRING,
value: FLOAT64,
unit: STRING,
quality: STRING,         -- e.g. "GOOD", "DEGRADED", "CAL_FAULT"
scenario_id: STRING      -- Linkage to evaluation benchmarks
```

### 23.2 Evaluation Runs Table (`evaluation_benchmarks`)
Stores evaluation scores across the 8 benchmark scenarios:

```sql
-- Schema: factory_evaluations.scenario_runs
run_id: STRING,
timestamp: TIMESTAMP,
scenario_id: STRING,
top_k_cause_recall: BOOLEAN,
groundedness_score: FLOAT64,
critic_effectiveness: BOOLEAN,
human_gate_bypassed: BOOLEAN, -- Invariant test: Must always be FALSE
total_duration_sec: FLOAT64
```

---

## 24. CLOUD STORAGE REQUIREMENTS

Cloud Storage buckets store immutable raw artifacts referenced in evidence provenance strings:

1. **`gs://factory-manuals/`**: Curated PDF excerpts (e.g., `dmg_mori_nvx5080_sec4_spindle.pdf#page=42`).
2. **`gs://factory-artifacts/incidents/`**: High-resolution optical photos and radiometric FLIR thermal captures (`inspection_ir_optical_b04.jpg`).
3. **`gs://factory-scenarios/`**: Standardized test fixture files (`SCN-001.json` through `SCN-008.json`).
4. **`gs://factory-simulation-models/`**: Versioned deterministic calculation parameter profiles (`sim-v1.4.json`).

---

## 25. ERROR STATES

| Error Condition | Expected UI Presentation | System Fallback & Safety Behavior |
| :--- | :--- | :--- |
| **Telemetry Channel Drop** | Amber warning indicator on card: *"Sensor stream offline"* | Tool marks sensor unavailable; continues analysis if remaining channels provide sufficient coherence. |
| **Evidence Store Timeout** | Retrying notice with exponential backoff indicator | Investigation state marked `RETRYABLE`; does NOT hallucinate missing evidence. |
| **Image Artifact Missing** | Fallback technical SVG placeholder with metadata | Image reasoning step skipped; textual manual & telemetry reasoning continues. |
| **Gemini JSON Parse Error** | *"Model response schema violation — retrying with strict constraints"* | Backend re-prompts with JSON schema constraint; partial raw trace logged to audit. |
| **Critic Disagreement** | Displays warning banner: *"Leading hypothesis subject to unresolved contradiction"* | Automatically lowers hypothesis confidence from `Likely` to `Unresolved`. |
| **Simulation Parameter Error** | Red highlight on slider: *"Parameter exceeds physical stability envelope"* | Reverts to last known deterministic default (`sim-v1.4`). |
| **Approval Rejection** | Red gate banner: *"Action rejected by engineer. Work order aborted."* | Action Agent permanently disabled for this incident ID. |
| **Action Execution Failure** | *"Task dispatch failed — verify maintenance bus connection"* | Retries task creation idempotently (`incident_id + action_type + approval_version`). |

---

## 26. LOADING STATES

- **Initial Case Loading:** Skeleton placeholders for telemetry cards and component hierarchy.
- **Hypothesis Synthesis:** Pulsing badges with explicit status text: *"WHY Agent: Synthesizing multi-channel evidence..."*
- **Critic Execution:** Rotating gear/refresh icon on the *"What would prove this wrong?"* button with label: *"Challenging invariants..."*
- **Action Dispatch:** Spinner on the Action status badge: *"Action Agent: Provisioning LOTO task in CMMS..."*
- **Outcome Reveal:** Smooth 300ms transition animating pre/post vibration recovery deltas.

---

## 27. EMPTY STATES

- **No Counter-Evidence:** Displays clean italicized unboxed text: *"No direct counter-evidence recorded in available sources."* (Never shows broken empty boxes).
- **No Component Filter Active:** Component filter button displays *"Reset filter"* only when active; otherwise quiet.
- **Pre-Approval Action Panel:** Padlocked security banner: *"Action Agent quarantined until human authorization."*
- **Concealed Ground Truth:** *"Quarantined until maintenance action is physically executed on shop floor."*

---

## 28. SECURITY & TRUST BOUNDARIES

### 28.1 The Six Epistemological Categories

```
1. OBSERVED EVIDENCE    --> Directly retrieved physical telemetry, CMMS logs, OEM manuals.
2. AI INFERENCE         --> Generative hypotheses, inferred causal mechanisms, suspected links.
3. DETERMINISTIC MATH   --> Fixed-code downtime calculations, financial loss projections.
4. HUMAN DECISION       --> Authenticated engineer approval, rejection, or challenge.
5. SIMULATED ACTION     --> Virtual maintenance task creation in demo CMMS.
6. GROUND TRUTH         --> Physical reality revealed only post-intervention for evaluation.
```

### 28.2 The Approval Boundary
Under no circumstances may the backend call `create_maintenance_task` or any external API unless:
1. `incidents/{incident_id}.status == "AWAITING_APPROVAL"`
2. `approvals/{approval_id}.decision == "APPROVED"`
3. `approvals/{approval_id}.user_id` matches an authenticated Firebase user with the `reliability_engineer` IAM custom claim.

---

## 29. ACCESSIBILITY REQUIREMENTS

- **Keyboard Navigation:** Full tab order across all interactive elements (component nodes, telemetry scrubber, evidence inspect buttons, hypothesis cards, critic button, simulation sliders, approval buttons, and modal dismissals).
- **Focus Rings:** Visible high-contrast focus rings (`outline: 2px solid #38bdf8; outline-offset: 2px`).
- **Escape Key Handling:** Modals (Evidence Provenance and Evaluation Scorecard) dismiss immediately on `Escape`.
- **Contrast Ratios:** Minimum WCAG AA 4.5:1 text-to-background contrast on dark slate canvas.
- **Non-Color Signaling:** Every status color (rose, amber, emerald, cyan) is paired with an explicit uppercase label and geometric icon.

---

## 30. RESPONSIVE UI CONTRACT

The application supports zero unintended horizontal overflow across all standard screen widths:

| Viewport Width | Layout Architecture | Behavior |
| :--- | :--- | :--- |
| **1920px (Ultra-Wide)** | Generous 2-column tiers + full-width simulator | Ample whitespace; simulator cards ~480px wide. |
| **1680px (Standard Wide)**| Generous 2-column tiers + full-width simulator | Balanced 5:7 and 7:5 column grids. |
| **1440px (Desktop Baseline)**| Clean 2-column tiers + full-width simulator | Primary benchmark width; zero clipping. |
| **1280px (Compact Desktop)**| 2-column tiers + full-width simulator | Secondary metadata quieted; text wrapping balanced. |
| **1024px (Small Desktop)**| Compact 2-column or stacked tiers | Sidebar tags hide; simulator remains in 3 equal columns. |
| **768px (Tablet)** | Single-column stacked layout | All cards reflow vertically with full width. |
| **<640px (Mobile)** | Single-column stacked layout | Header collapses secondary controls; cards stack cleanly. |

---

## 31. CURRENT MOCK DATA VS. FUTURE REAL DATA

| Current Mock Field | Description | Future Backend Service | Nature | Backend Mapping Area |
| :--- | :--- | :--- | :--- | :--- |
| `asset` | CNC-04 Twin Hierarchy | Firestore `assets` + Digital Twin API | Observed | Firestore Asset Repository |
| `telemetry_summary` | Vibration, Temp, Current deltas | BigQuery timeseries aggregation | Observed | IoT Telemetry Collector |
| `telemetry_series` | 24-hr multi-sensor points | BigQuery `sensor_readings` | Observed | BigQuery SQL Window Function |
| `evidence[]` | 5 records with provenance | Firestore `evidence` + Cloud Storage | Observed | Evidence Agent Ingestion Tool |
| `hypotheses[]` | 3 competing causes | Gemini Structured Generation (ADK) | Inferred | WHY Agent ADK Module |
| `critic_finding` | Falsification condition & contradictions| Gemini Bounded Critique Loop (ADK) | Inferred | Critic Agent ADK Module |
| `simulation_results[]`| 3 options with delay/exposure/cost | Deterministic Python calculation module | Calculated | Python Simulator Engine |
| `recommendation` | Synthesized 25-min laser check | Gemini Recommendation Agent (ADK) | Synthesized | Recommendation ADK Agent |
| `approval` | Engineer sign-off & signature | Firestore `approvals` + Firebase Auth | Human | Approval Gate Service |
| `action` | Maintenance work order task | Simulated CMMS Service | Action | Action Agent Tool Boundary |
| `outcome` | Ground truth (0.14 mm runout) | Evaluation Fixture Registry | Ground Truth| Eval Scorecard Service |
| `audit_trail[]` | 13-step chronological log | Cloud Logging / Trace + Firestore | Audit Log | Observability Pipeline |

---

## 32. FRONTEND $\to$ BACKEND REPLACEMENT PLAN

To replace the frontend mock layer with real backend services, execute this phased transition:

```
[ Phase 1: API Boundary ]
Replace mock objects in src/data/mockScenarios.ts with fetch() calls to FastAPI endpoints.
Preserve exact TypeScript interfaces in src/types/index.ts.

[ Phase 2: Orchestration & Retrieval ]
FastAPI invokes Google ADK root workflow:
Evidence Agent calls allowlisted BigQuery, Firestore, and Cloud Storage tools.

[ Phase 3: Reasoning & Critique ]
ADK routes normalized evidence bundle to Gemini for structured hypothesis generation.
ADK routes leading hypothesis to Critic Agent for falsification check.

[ Phase 4: Deterministic Simulation ]
ADK executes Python simulation module using explicit mathematical equations.

[ Phase 5: Authorization & Simulated Execution ]
FastAPI validates Firebase Auth ID token and checks approval state before calling action tool.
```

---

## 33. BACKEND REQUIREMENTS SUMMARY

### A. Case Management Service
- Ingests anomaly alerts from monitoring systems.
- Persists investigation lifecycle states in Firestore (`incidents`).
- Provides SSE streaming endpoint (`/api/incidents/{id}/stream`).

### B. Evidence Retrieval Tools (Allowlisted)
- `get_asset_context(asset_id)`: Fetches machine twin and component hierarchy.
- `get_telemetry_window(asset_id, start, end, sensor_ids)`: Queries BigQuery for synchronous sensor streams.
- `get_maintenance_history(asset_id, since)`: Fetches CMMS work order history.
- `search_manual(query, asset_type)`: Retrieves vector embeddings / text passages from GCS manuals.
- `get_prior_incidents(asset_id, similarity_vector)`: Queries past incidents with similar anomaly profiles.
- `get_inspection_image(incident_id)`: Fetches signed URLs for optical/thermal imagery.

### C. WHY Agent (ADK + Gemini)
- Implements strict prompt instructions enforcing the Evidence Contract.
- Generates 2 to 3 competing hypotheses with supporting and counter-evidence citations.

### D. Critic Agent (ADK + Gemini)
- Implements bounded self-challenge prompt.
- Extracts contradictions, surfaces ignored evidence, and formulates falsification checks.

### E. Deterministic Simulation Module (Python)
- Implements closed-form arithmetic for delay, exposure, and financial impact.
- Guarantees zero model-hallucinated numbers.

### F. Human Approval & Safety Service
- Validates Firebase Auth tokens and custom engineer roles.
- Enforces the `NO APPROVAL -> NO ACTION` invariant.

### G. Action Agent (Gated)
- Dispatches simulated maintenance tasks to CMMS mock/integration bus.

### H. Evaluation & Benchmarking Service
- Executes regression runs against `SCN-001` through `SCN-008`.
- Logs Top-K cause recall and groundedness metrics into BigQuery.

---

## 34. BACKEND UNKNOWN / TBD REGISTER

| Area | Question / Uncertainty | Why It Matters | Decision Required |
| :--- | :--- | :--- | :--- |
| **API Endpoints** | REST path structure and SSE vs. WebSocket | Affects client connection pooling and error retry logic | **TBD — backend design decision** |
| **Firestore Schemas** | Subcollections vs. root collections for `evidence` | Impacts query performance and rule complexity | **TBD — backend design decision** |
| **ADK State Schema** | Pydantic state model for session persistence | Dictates how context is transferred between agents | **TBD — backend design decision** |
| **Gemini Model Version**| `gemini-2.5-pro` vs `gemini-2.5-flash` | Tradeoff between reasoning depth and execution latency | **TBD — backend design decision** |
| **Authentication Flow** | Google Workspace OAuth vs. Firebase Email/Password | Dictates engineer identity claims and consent screens | **TBD — backend design decision** |
| **App Check Provider** | Play Integrity, reCAPTCHA Enterprise, or Custom | Enforces client integrity against spoofed API calls | **TBD — backend design decision** |
| **CMMS Integration Bus**| Direct REST vs. pub/sub simulated queue | Affects task creation idempotency and status polling | **TBD — backend design decision** |
| **Manual Embeddings** | Vertex AI Vector Search vs. curated text passages | Affects search latency and manual retrieval accuracy | **TBD — backend design decision** |

---

## 35. TRACEABILITY MATRIX

| Blueprint Requirement | UI Implementation Component | Future Backend Capability | Target Data Source | Investigation State | Acceptance Test Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Multi-Sensor Anomaly** | `TelemetryPanel` | `get_telemetry_window` | BigQuery | `NEW_ALERT` | Vibration $+42\%$, Temp $+11\%$, Current $+8\%$ |
| **Digital Twin Context** | `MachineContextPanel` | `get_asset_context` | Firestore | `OBSERVING` | Displays motor, bearing, shaft, sensors |
| **Evidence Provenance** | `EvidenceTimeline` & Modal | `get_evidence` | GCS / CMMS / BQ | `INVESTIGATING` | Every claim references valid `evidence_id` |
| **Competing Hypotheses** | `HypothesisCards` | WHY Agent Structured Generation | Gemini + ADK | `HYPOTHESES_GENERATED` | 2-3 hypotheses; observed vs. inferred distinct |
| **Falsification Critic** | `CriticSection` | Critic Agent Self-Challenge | Gemini + ADK | `CRITIQUE_COMPLETE` | "What would prove wrong?" surfaces dial check |
| **Deterministic Simulation**| `SimulationPanel` | Python Deterministic Math | Python Engine | `SIMULATION_COMPLETE`| Continue ($34k), Inspect ($750), Repair ($6.2k) |
| **Human Authorization Gate**| `ApprovalPanel` | Approval Security Validator | Firestore / IAM | `AWAITING_APPROVAL` | Action locked until engineer approves |
| **Simulated Maintenance** | `SimulatedActionPanel` | Action Agent Work Order Dispatch| CMMS Mock Bus | `ACTION_DISPATCHED` | Generates `TASK-2026-0922-01` |
| **Ground Truth Evaluation**| `OutcomePanel` | Evaluation Outcome Verifier | Eval Registry | `RESOLVED_EVALUATED` | Verifies 0.14 mm runout & vibration recovery |
| **End-to-End Auditability** | `AuditPanel` | Cloud Logging Trace Capture | Cloud Logging | Persistent | Complete chronological log of all 13 steps |

---

## 36. ACCEPTANCE CRITERIA

A backend implementation is deemed functionally compliant with this UI specification when it satisfies the following criteria:

1. **Zero Layout Distortion:** Client renders cleanly without horizontal scrollbars across all viewports from 1024px to 1920px.
2. **Deterministic Calculation Integrity:** The simulator outputs exact values matching the formulas in Section 12; zero hallucinated numbers.
3. **Evidence Grounding Ratio $\ge 98\%$:** All claims generated by the WHY Agent reference valid `evidence_id` values.
4. **Falsification Surface:** Invoking the Critic Agent returns a concrete physical falsification test on `HYP-01`.
5. **Enforced Human Control Gate:** The backend strictly rejects any request to `/api/incidents/{id}/actions` if approval is absent (`HTTP 403`).
6. **Ground Truth Quarantine:** No API endpoint exposes `outcome.actual_cause` to the frontend until the simulated action is executed.
7. **Traceable Audit Log:** Every agent tool invocation produces a timestamped audit entry with inspectable request/response payloads.

---

## 37. FINAL ENGINEERING SUMMARY

### 37.1 Current Frontend Status
The Factory WHY frontend prototype is fully operational, hardened, and accessible. It delivers an enterprise-grade experience for reliability engineers, complete with dynamic telemetry scrubbing, evidence provenance inspection, hypothesis formulation, critic self-challenge, deterministic trade-off simulation, human-in-the-loop authorization gating, and post-intervention ground truth verification.

### 37.2 Currently Mocked Modules
All external systems (Gemini models, Google ADK orchestration, BigQuery telemetry queries, Firestore collections, Cloud Storage artifact storage, and CMMS work order dispatches) are currently simulated client-side via typed data structures in `src/data/mockScenarios.ts`.

### 37.3 Recommended Backend Implementation Order
To build out the backend without breaking the existing UI contracts, implement capabilities in this sequential order:

```
Step 1: Scaffold FastAPI server on Cloud Run with Pydantic schemas mirroring src/types/index.ts.
   ↓
Step 2: Implement Firestore collections (incidents, assets, evidence) and seed with CNC-04 fixtures.
   ↓
Step 3: Implement allowlisted retrieval tools (get_telemetry_window, search_manual, etc.).
   ↓
Step 4: Implement Google ADK Root Orchestrator and integrate the Evidence Agent.
   ↓
Step 5: Integrate Gemini for structured hypothesis generation (WHY Agent).
   ↓
Step 6: Implement bounded Critic Agent ("What would prove this wrong?").
   ↓
Step 7: Implement deterministic Python simulation calculation module.
   ↓
Step 8: Implement Firebase Auth validation and the Human Approval Gate on the Action Agent.
   ↓
Step 9: Implement BigQuery telemetry and evaluation logging.
   ↓
Step 10: Run the 8-scenario benchmark regression harness to verify Top-K cause recall and action safety.
```

---

*Document compiled and verified against the Factory WHY / CTRL+WHY Architecture Blueprint and the active production React codebase.*
