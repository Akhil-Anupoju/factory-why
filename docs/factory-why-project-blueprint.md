# CTRL + WHY | FACTORY WHY

## AI-Powered Industrial Root-Cause Investigation & Decision Support

**Hackathon Implementation Blueprint | Google ADK + Gemini + Firebase + GCP**  
**September 2026 | Confidential working document**

> **TEAM THESIS**
>
> Do not automate a broken process faster. Understand WHY first - then decide what should happen next.

> **Source note:** The attached Factory WHY blueprint is the primary source for the product scope, scenario, safety boundaries, data contract, evaluation plan and 10-day build plan. The shared ChatGPT URL supplied for context could not be fetched reliably in this environment, so it was not treated as an authoritative source.

---

# 1. Executive Direction

Factory WHY is the competition-scale prototype of CTRL + WHY: an AI investigation workspace for the moment a machine becomes abnormal. It does not replace a condition-monitoring system. It sits after the alert and before the decision, where engineers must reconstruct a story across telemetry, maintenance records, manuals, images and prior incidents.

The product assembles fragmented evidence, generates competing explanations, challenges the leading hypothesis, identifies missing evidence, compares response options and recommends a controlled next step.

## The one-line problem

> When a machine becomes abnormal, engineers spend valuable time reconstructing the story across disconnected systems before deciding what to inspect or do next.

## 1.1 What we will actually build

| Element          | Hackathon decision                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Asset            | One CNC machine: **CNC-04** with motor, bearing, shaft and sensors                                |
| Trigger          | Vibration **+42%**, temperature **+11%**, motor current **+8%**; RPM and pressure remain normal   |
| Context change   | Bearing replaced four days earlier                                                                |
| Evidence         | Synthetic telemetry, maintenance record, service-manual excerpt, inspection image, prior incident |
| Ground truth     | Bearing misalignment                                                                              |
| Competing causes | Bearing misalignment, lubrication issue, sensor fault                                             |
| Primary user     | Reliability / maintenance engineer                                                                |
| Approved action  | Alignment inspection; simulated maintenance task only after approval                              |

## 1.2 Product promise

The product promise is a workflow, not a chatbot claim:

```text
OBSERVE
  -> INVESTIGATE
  -> EXPLAIN WHY
  -> CHALLENGE
  -> SIMULATE
  -> RECOMMEND
  -> HUMAN APPROVAL
  -> ACT
  -> LEARN
```

- **OBSERVE:** detect a meaningful state change and reconstruct the operating context.
- **INVESTIGATE:** gather evidence from allowlisted tools before asking Gemini to conclude anything.
- **EXPLAIN WHY:** generate multiple hypotheses with supporting and contradictory evidence.
- **CHALLENGE:** make the system actively search for disconfirming evidence.
- **SIMULATE:** compare predefined response options with deterministic calculations.
- **RECOMMEND:** present a structured, evidence-backed next step with uncertainty.
- **HUMAN APPROVAL:** keep consequential actions under engineer control.
- **ACT:** execute only a permissioned, simulated maintenance action in the competition build.
- **LEARN:** compare prediction to ground truth and record the outcome for evaluation.

---

# 2. The Pitch: Problem -> Insight -> Solution -> Proof

## 2.1 30-second pitch

> Factories already detect abnormal conditions. The hard part begins after the alert: engineers must reconstruct WHY the machine changed across telemetry, maintenance history, documents and inspection evidence. CTRL + WHY turns that fragmented investigation into one evidence-backed workflow: it generates competing hypotheses, asks what would prove the leading one wrong, compares safe response options and recommends the next controlled action.

## 2.2 90-second problem story

1. A vibration alert fires on CNC-04.
2. The monitoring dashboard tells the engineer that something changed, but not why.
3. The recent maintenance record shows the bearing was replaced four days earlier.
4. Telemetry shows vibration, temperature and motor current moving together, while RPM and pressure stay normal.
5. A service manual contains the relevant inspection procedure; a simulated image provides visual evidence.
6. Factory WHY assembles this evidence, proposes bearing misalignment plus alternative causes, and maps each hypothesis to evidence.
7. The engineer clicks: **"What would prove you wrong?"** The critic identifies alignment measurement as the missing discriminating evidence.
8. The deterministic simulator compares continue, inspect and repair. The system recommends the controlled inspection, subject to human approval.
9. The approved action creates a simulated maintenance task. The actual ground-truth result is later revealed so the system can be evaluated.

## 2.3 The judge should understand one thing

> **CORE DIFFERENTIATOR:** We are not building a maintenance chatbot. We are building an investigation loop that can revise itself when evidence challenges its first hypothesis.

The **"What would prove me wrong?"** loop is the strongest differentiator.

## 2.4 What the demo must prove

| Capability                     | Visible proof in demo                                                                      | Why it matters                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Grounded GenAI                 | Gemini consumes normalized evidence and returns structured hypotheses with provenance      | Shows Gemini is essential, not decorative                 |
| Agentic workflow               | ADK routes retrieval -> reasoning -> critique -> follow-up -> simulation -> recommendation | Shows sequential tool use and purposeful agents           |
| Multimodal reasoning           | Manual text + telemetry + inspection image appear in one case                              | Shows why a general text chatbot is insufficient          |
| Self-challenge                 | Critic asks what evidence could disprove the leader                                        | Demonstrates investigation under uncertainty              |
| Deterministic decision support | Simulation uses explicit assumptions and fixed calculations                                | Prevents the LLM from inventing physical/economic numbers |
| Human control                  | Approval gate blocks action until engineer confirms                                        | Demonstrates safe action path                             |
| Measurable outcome             | Prediction is compared against known ground truth                                          | Turns the demo into an evaluated system                   |

---

# 3. Target Architecture

The architecture is deliberately narrow for the hackathon.

- **Firebase** provides the application experience and identity layer.
- **Cloud Run** provides the API and agent runtime surface.
- **Google ADK** coordinates purposeful agents.
- **Gemini** performs multimodal reasoning and structured generation.
- **Firestore** stores operational case state.
- **BigQuery** stores telemetry and evaluation data.
- **Cloud Storage** stores manuals, inspection images and supporting artifacts.
- **Cloud Logging / Trace / Monitoring** capture operational telemetry.

## Figure 1 - Competition-scale Factory WHY architecture

```text
Firebase Hosting
React / TypeScript
Investigation Workspace
        |
        v
Firebase Auth + App Check
        |
        v
Cloud Run
Python / FastAPI API
        |
        v
Google ADK
Orchestrator + Workflow Agents
        |
        +---------------------+
        |                     |
        v                     v
Allowlisted Tools          Gemini
Telemetry / Maintenance    Multimodal reasoning
Docs / Incidents / Image   Structured output / tool use
        |                     |
        +-----------+---------+
                    |
          +---------+----------+
          |         |          |
          v         v          v
      Firestore  BigQuery  Cloud Storage
       case state telemetry   manuals/images
       incidents  eval        artifacts
       evidence   metrics
       approvals  traces
       actions
       outcomes

Cloud Logging + Trace + Monitoring
```

## 3.1 Component responsibilities

| Layer                  | Technology                          | Responsibility                                                                            | Do not put here                                |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Experience             | Firebase Hosting + React/TypeScript | Investigation workspace, evidence timeline, hypothesis cards, simulation, approval        | Secret keys, direct industrial commands        |
| Identity               | Firebase Authentication + App Check | Sign-in, user identity, client integrity controls                                         | Business-rule authorization alone              |
| API / Runtime          | Cloud Run + Python/FastAPI          | REST/SSE endpoints, investigation state transitions, tool execution boundary              | Long-lived local filesystem state              |
| Agent orchestration    | Google ADK                          | Agent definitions, workflow routing, state/context, tool invocation                       | Deterministic calculations that should be code |
| Model                  | Gemini                              | Multimodal synthesis, hypothesis generation, critique, structured outputs, tool selection | Direct physical control of equipment           |
| Operational state      | Firestore                           | Assets, incidents, evidence, hypotheses, approvals, actions, outcomes                     | Large telemetry scans                          |
| Telemetry / evaluation | BigQuery                            | Time-series-like telemetry, synthetic scenarios, evaluation datasets and metrics          | User-facing case state                         |
| Artifact store         | Cloud Storage                       | PDF/manual excerpts, inspection images, scenario files                                    | Transactional workflow state                   |
| Simulation             | Python service/module               | Deterministic option calculations and explicit assumptions                                | LLM-generated numeric outcomes                 |
| Observability          | Cloud Logging + Trace + Monitoring  | Latency, tool calls, errors, traces, evaluation telemetry                                 | Primary audit record alone                     |

## 3.2 Why Cloud Run for the hackathon

- Cloud Run gives the team a managed container target for the Python API/ADK service, reducing infrastructure work while keeping deployment tangible for the competition.
- The service must be stateless from the container perspective; persistent case state belongs in Firestore/BigQuery/Cloud Storage.
- Use the injected `PORT` environment variable rather than hard-coding the listening port.
- Use Artifact Registry + Cloud Build or a direct source deployment path; freeze one deployment workflow early so the final day is not spent on infrastructure.

---

# 4. Google ADK Agent Design

Use ADK as the orchestration layer, not as a reason to create a large agent swarm. The purposeful roles are:

- Orchestrator
- Evidence Agent
- WHY Agent
- Critic Agent
- Simulation Agent
- Recommendation Agent
- Action Agent

The implementation should use a workflow pattern that makes execution order and permissions obvious.

## 4.1 Recommended ADK composition

| Agent                | Input                                         | Tools                                                   | Output                                                  | Permission        |
| -------------------- | --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| Root Orchestrator    | Incident + user request + workflow state      | Workflow routing / state store                          | Next agent / stop condition                             | Workflow only     |
| Evidence Agent       | Incident + twin context                       | Telemetry, maintenance, docs, incidents, image metadata | Normalized evidence bundle                              | Read-only         |
| WHY Agent            | Evidence bundle                               | Optional evidence lookup                                | 2-3 hypotheses + evidence map + uncertainty             | Read-only         |
| Critic Agent         | Evidence + hypotheses                         | Evidence lookup tools                                   | Contradictions + missing evidence + falsification check | Read-only         |
| Follow-up Retrieval  | Critic findings                               | Targeted tool calls                                     | Additional discriminating evidence                      | Read-only         |
| Simulation Agent     | Candidate actions + deterministic assumptions | Simulation functions                                    | Scenario outputs + assumptions                          | Simulation only   |
| Recommendation Agent | Evidence + hypotheses + simulation            | None or read-only evidence                              | Structured recommendation                               | Read-only         |
| Action Agent         | Approved recommendation                       | Create simulated maintenance task                       | Action record / task ID                                 | Approval required |

## 4.2 Where to use parallelism

The evidence collection phase is naturally parallel:

- telemetry;
- maintenance records;
- manuals;
- incidents;
- image metadata.

These can be retrieved independently. ADK supports workflow patterns including sequential, parallel and loop workflows; exact class/module names must be verified against the installed ADK version when scaffolding the project. The competition blueprint recommends parallel specialist retrieval conceptually.

## 4.3 Where to use a loop

Use **one bounded critique/retrieval loop**:

```text
WHY
 -> Critic
 -> targeted evidence
 -> revised WHY
```

Use a hard maximum iteration count such as **1-2 additional passes** for the competition. Do not allow an unconstrained recursive loop.

## 4.4 Agent state

```text
InvestigationState
  incident_id
  asset_context
  evidence[]
  hypotheses[]
  critic_findings[]
  missing_evidence[]
  simulation_results[]
  recommendation
  approval
  action
  outcome
  audit_events[]
```

### Design rule

The agent should stop when it has either:

1. enough evidence for a supported recommendation; or
2. insufficient evidence and must explicitly return an unresolved state.

> **"I do not know yet" is a valid product outcome.**

## 4.5 Function/tool calling boundary

Gemini should select tools through function calling, but application code must execute the function and return its result. This keeps the tool boundary explicit.

Factory WHY tools should be:

- narrow;
- typed;
- allowlisted;
- independently testable.

Initial allowlisted capabilities:

- query telemetry;
- fetch maintenance history;
- retrieve manual passages;
- retrieve incident history;
- get inspection image;
- run simulation;
- create simulated maintenance task.

The model should never directly query raw databases or call arbitrary URLs.

---

# 5. Google AI Studio + Gemini Implementation Strategy

Treat Google AI Studio as the rapid experimentation environment and Gemini as the model capability inside the deployed workflow.

During the hackathon, use AI Studio to iterate:

- prompts;
- response schemas;
- tool declarations;
- safety settings;
- multimodal examples.

Only move stable prompt contracts into the ADK codebase.

## 5.1 Prompt engineering workflow

1. Start with the exact output contract before writing the prompt. Define the `Hypothesis`, `EvidenceReference`, `CriticFinding` and `Recommendation` schemas.
2. Create a minimal case in AI Studio with 5-8 evidence items and test whether Gemini separates observations from inferences.
3. Add counter-evidence and test whether the model generates multiple hypotheses instead of anchoring on the first plausible explanation.
4. Add a falsification instruction: **"For each leading hypothesis, name the strongest evidence that would lower confidence."**
5. Add provenance requirements: every major claim must reference `evidence_id` values.
6. Only after the output is stable, add tool calling and move the declarations into the ADK tool layer.
7. Version prompts in Git alongside the code and record the model/config used for each evaluation run.

## 5.2 WHY Agent system instruction

```text
You are the Factory WHY investigation agent.
Your job is not to declare a confirmed physical cause.
Generate 2-3 competing hypotheses from the supplied evidence.
Separate OBSERVED evidence from INFERRED reasoning.
For every hypothesis, list supporting evidence, counter-evidence,
and missing evidence.
Never invent telemetry, maintenance events, measurements, or costs.
If evidence is insufficient, return status=UNRESOLVED.
Every material claim must reference one or more evidence_id values.
Prefer hypotheses that explain multiple independent signals.
```

## 5.3 Structured output contract

```text
Hypothesis = {
  hypothesis_id: string,
  description: string,
  status: SUPPORTED | LIKELY | COMPETING | UNRESOLVED | CONTRADICTED,
  confidence: number,
  supporting_evidence_ids: string[],
  counter_evidence_ids: string[],
  missing_evidence: string[],
  next_discriminating_check: string | null
}
```

## 5.4 Critic prompt

```text
Review the leading hypothesis against ALL supplied evidence.
1. Identify contradictions.
2. Identify evidence the hypothesis ignores.
3. State what would prove the hypothesis wrong.
4. Identify the single most discriminating missing check.
5. Recommend whether to revise confidence or request more evidence.
Do not invent data. Return structured JSON only.
```

## 5.5 Image reasoning

For the competition image, do not ask Gemini to diagnose the machine from the photo.

Use the image as one evidence object that may support or contradict a hypothesis. The prompt should explicitly state that visual evidence is observational and may be ambiguous.

The multimodal proof is:

```text
Telemetry
  = what changed

Maintenance history
  = what changed recently

Manual
  = what could discriminate causes

Inspection image
  = what was observed visually

Gemini
  = connects these evidence types into competing explanations
```

---

# 6. Digital Twin and Data Design

For the hackathon, the digital twin is a structured operational model, not a 3D simulation platform.

It gives Gemini and the UI enough context to understand:

- the machine;
- physical component relationships;
- sensor placement;
- normal ranges;
- current state;
- recent maintenance changes.

Structured JSON/Firestore documents are sufficient. React Three Fiber / Three.js may be used only for visualization; no dedicated industrial digital-twin platform is required.

## 6.1 Firestore collections

| Collection    | Key fields                                                                                 | Purpose                         |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| `assets`      | `asset_id`, `name`, `type`, `parent_asset_id`, `status`                                    | Machine hierarchy               |
| `components`  | `component_id`, `asset_id`, `type`, `relationships`                                        | Motor/bearing/shaft context     |
| `sensors`     | `sensor_id`, `component_id`, `type`, `unit`, `normal_range`, `location`                    | Sensor metadata                 |
| `incidents`   | `incident_id`, `asset_id`, `trigger`, `severity`, `created_at`, `status`                   | Investigation case              |
| `evidence`    | `evidence_id`, `incident_id`, `source`, `timestamp`, `observation`, `provenance`, `status` | Audit-ready evidence            |
| `hypotheses`  | `hypothesis_id`, `incident_id`, `description`, `support_ids`, `counter_ids`, `missing`     | Reasoning state                 |
| `simulations` | `simulation_id`, `incident_id`, `option`, `assumptions`, `outputs`                         | Deterministic option comparison |
| `approvals`   | `approval_id`, `incident_id`, `decision`, `user_id`, `timestamp`, `comment`                | Human control gate              |
| `actions`     | `action_id`, `incident_id`, `type`, `approval_status`, `executed_at`, `result`             | Action record                   |
| `outcomes`    | `outcome_id`, `incident_id`, `actual_cause`, `observed_result`, `prediction_match`         | Learning/evaluation             |

## 6.2 Evidence contract

The evidence contract prevents the failure mode where an LLM receives loosely formatted text and produces fluent but unauditable narrative.

### Example EvidenceItem

```text
EvidenceItem = {
  evidence_id: "EV-1042",
  source: "Maintenance work order",
  timestamp: "2026-09-18T10:30:00Z",
  asset: "CNC-04",
  component: "Bearing-B04",
  observation: "Bearing replaced four days before anomaly",
  provenance: "maintenance/work-order/8841",
  status: "Observed",
  confidence: "High"
}
```

### Trust rule

> The UI must visually distinguish observed facts from model inferences. A sentence is not "evidence" because Gemini generated it.

## 6.3 BigQuery telemetry table

| Field         | Type      | Example                   | Design reason        |
| ------------- | --------- | ------------------------- | -------------------- |
| `timestamp`   | TIMESTAMP | `2026-09-22 14:18:00 UTC` | Time alignment       |
| `sensor_id`   | STRING    | `VIB-B04`                 | Sensor identity      |
| `asset_id`    | STRING    | `CNC-04`                  | Case join            |
| `value`       | FLOAT64   | `12.42`                   | Metric value         |
| `unit`        | STRING    | `mm/s`                    | Display + validation |
| `quality`     | STRING    | `GOOD`                    | Filter bad readings  |
| `scenario_id` | STRING    | `SCN-001`                 | Evaluation linkage   |

## 6.4 Cloud Storage artifacts

```text
manual.pdf or small curated manual excerpts
inspection.jpg
scenario JSON files
simulation assumptions JSON
optional architecture/demo screenshots
```

---

# 7. Tool Layer and API Contracts

Keep the tool layer explicit. The agent should never directly query a raw database or call arbitrary URLs. Each tool is a small, testable application function with a strict request/response schema.

## 7.1 Allowlisted tools

| Tool                      | Request                                        | Response                             | Agent(s)                   |
| ------------------------- | ---------------------------------------------- | ------------------------------------ | -------------------------- |
| `get_asset_context`       | `asset_id`                                     | `TwinContext`                        | Evidence / WHY             |
| `get_telemetry_window`    | `asset_id`, `start`, `end`, `sensor_ids`       | `TelemetryBundle`                    | Evidence                   |
| `get_maintenance_history` | `asset_id`, `since`                            | `MaintenanceBundle`                  | Evidence                   |
| `search_manual`           | `query`, `asset_type`, `limit`                 | `ManualPassage[]`                    | Evidence / Critic          |
| `get_prior_incidents`     | `asset_id`, `similar_signal_hash`              | `IncidentSummary[]`                  | Evidence                   |
| `get_inspection_image`    | `incident_id`                                  | Signed/controlled artifact reference | Evidence                   |
| `run_simulation`          | `incident_id`, `option`, `assumptions_version` | `SimulationResult`                   | Simulation                 |
| `create_maintenance_task` | `incident_id`, `task_type`, `details`          | `ActionResult`                       | Action - approval required |
| `record_outcome`          | `incident_id`, `actual_cause`, `notes`         | `OutcomeRecord`                      | Outcome                    |

## 7.2 REST endpoints

```text
POST /api/incidents
GET /api/incidents/{incident_id}
POST /api/incidents/{incident_id}/investigate
GET /api/incidents/{incident_id}/stream
POST /api/incidents/{incident_id}/challenge
POST /api/incidents/{incident_id}/simulate
POST /api/incidents/{incident_id}/approve
POST /api/incidents/{incident_id}/reject
POST /api/incidents/{incident_id}/request-evidence
POST /api/incidents/{incident_id}/actions
GET /api/incidents/{incident_id}/audit
GET /api/evaluations/latest
```

## 7.3 Event sequence

The runtime sequence for a single investigation is conceptually:

```text
Engineer
   |
   v
Browser
   |
   v
Cloud Run / FastAPI
   |
   +--> Firestore: incident state
   |
   +--> BigQuery: telemetry / evaluation
   |
   +--> Cloud Storage: docs / images
   |
   +--> Gemini / ADK
```

## 7.4 Streaming to the UI

The UI should not wait silently for a long-running investigation.

Use an event/stream endpoint from Cloud Run so the frontend can render progress states such as:

- `Retrieving telemetry`
- `Checking maintenance history`
- `Forming hypotheses`
- `Challenging leading hypothesis`
- `Running deterministic simulation`

The visible agent trace is part of the product experience: it makes the workflow understandable to the judge.

---

# 8. Investigation Workspace UX

Build one excellent investigation screen. Do not spend the hackathon on multiple dashboards. The workspace should look like an industrial control-room investigation surface, but the design language should remain clean and legible.

## Panel content and interaction

| Panel             | Content                                                 | Interaction                                   |
| ----------------- | ------------------------------------------------------- | --------------------------------------------- |
| Machine context   | CNC-04, asset hierarchy, current machine status         | Click component to filter evidence            |
| Telemetry         | Baseline vs current vibration/temp/current              | Scrub timeline to inspect change              |
| Evidence timeline | Maintenance, incidents, documents, image evidence       | Click `evidence_id` to inspect provenance     |
| Hypotheses        | 2-3 causes with confidence and support/counter evidence | Select a hypothesis for deeper inspection     |
| Challenge AI      | "What would prove this wrong?"                          | Run critic + targeted evidence                |
| Simulation        | Continue / Inspect / Repair + assumptions               | Change assumptions; rerun deterministic model |
| Recommendation    | Next step, urgency, rationale, uncertainty              | Open evidence-backed recommendation           |
| Approval          | Approve / Reject / Challenge / More Evidence            | Only approval unlocks simulated action        |
| Audit             | Agent/tool calls, decisions, outcome                    | Expand each event for traceability            |

## 8.1 Recommended visual hierarchy

```text
[ TOP BAR ] Incident #827 | CNC-04 | Severity: High | Status: Investigating

[ LEFT 30% ]       [ CENTER 45% ]        [ RIGHT 25% ]
Machine context     WHY / Hypotheses     Decision
Telemetry summary   Evidence graph       Simulation

[ FULL WIDTH ] Evidence timeline -> Challenge AI -> Recommendation -> Approval -> Audit
```

## 8.2 Trust states

| State        | Meaning                                | UI treatment                 |
| ------------ | -------------------------------------- | ---------------------------- |
| Observed     | Directly retrieved fact                | Solid evidence marker        |
| Supported    | Inference strongly backed by evidence  | Confidence + citations       |
| Likely       | Current leading explanation            | Confidence + caveat          |
| Competing    | Plausible alternative                  | Show why it remains viable   |
| Unresolved   | Evidence is insufficient               | Call to gather more evidence |
| Contradicted | Evidence conflicts with the hypothesis | Lower confidence / warning   |

---

# 9. Deterministic Simulation Design

The simulator is not a digital-physics model. It is a transparent decision-support component that uses a small set of predefined assumptions to compare response options.

> Gemini explains the trade-off; conventional code calculates the numeric result.

## 9.1 Response options

| Option   | Assumption examples                                         | Outputs                                 |
| -------- | ----------------------------------------------------------- | --------------------------------------- |
| Continue | No inspection for X hours; current state persists           | Modeled exposure, delay to intervention |
| Inspect  | Short controlled delay; diagnostic test reduces uncertainty | Inspection delay, residual uncertainty  |
| Repair   | Immediate intervention; known downtime window               | Downtime, exposure reduction            |

## 9.2 Example simulation contract

### Input

```text
SimulationInput
  option = INSPECT
  inspection_delay_minutes = 25
  modeled_failure_exposure = 0.32
  intervention_effectiveness = 0.85
  downtime_minutes_if_repair = 180
  assumptions_version = "sim-v1"
```

### Output

```text
SimulationOutput
  risk_indicator
  expected_delay
  relative_exposure
  uncertainty_reduction
  assumptions_used[]
  calculation_trace[]
```

## 9.3 Challengeable assumptions

Every modeled value should have a visible **assumptions drawer**.

The engineer can change one parameter and re-run.

The simulator is not truth; it is a structured way to expose trade-offs. Judges should be able to see that numbers originate from deterministic code and explicit assumptions rather than free-form model output.

## 9.4 What not to do

- Do not have Gemini invent downtime or financial values.
- Do not represent a deterministic scenario simulation as a prediction of a real factory.
- Do not create an autonomous shutdown path.
- Do not hide the assumptions behind a single "AI score".

---

# 10. Responsible AI, Safety and Security

Industrial AI requires strong separation between decision support and physical control. Factory WHY should demonstrate that safety is an architectural feature, not a disclaimer.

| Control                        | Implementation                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| No confirmed-cause language    | Use calibrated hypothesis states; never say the AI has physically confirmed a cause     |
| Evidence provenance            | Every major claim references `evidence_id` and source                                   |
| Observed vs inferred           | Separate raw observations from model reasoning in both schema and UI                    |
| Missing/contradictory evidence | Surface it explicitly; allow unresolved state                                           |
| Human approval                 | Action Agent cannot create a task until an authenticated engineer approval event exists |
| Least privilege                | Read-only evidence tools separated from approval-gated action tool                      |
| Client protection              | Firebase Authentication + App Check + Security Rules                                    |
| Server protection              | Cloud Run service account + IAM; server-side Firebase Admin SDK uses server credentials |
| Auditability                   | Persist approvals, tool calls, recommendations and outcomes                             |
| Data boundary                  | Use synthetic or permissioned data for the competition                                  |
| Safe demo action               | Create only a simulated maintenance task; no PLC/SCADA command path                     |

## 10.1 Firestore rule strategy

Client can read/write only case documents associated with the signed-in engineer and permitted investigation role.

Server-side Cloud Run code uses IAM/service credentials and validates the approval state before calling the action tool.

### Action tool rejection conditions

The action tool rejects requests unless:

```text
investigation.status == "AWAITING_APPROVAL"
approval.decision == "APPROVED"
approval.user_id is authenticated
```

---

# 11. Evaluation and Testing Strategy

The system should prove that Factory WHY works repeatedly, not just on one hand-tuned case.

## 11.1 Evaluation scenarios

| Scenario                              | Ground truth / purpose                      |
| ------------------------------------- | ------------------------------------------- |
| Bearing misalignment                  | Primary demo scenario                       |
| Lubrication failure                   | Similar symptoms, different evidence        |
| Sensor malfunction                    | Telemetry conflict                          |
| Motor overheating                     | Different causal signature                  |
| Conflicting evidence                  | Tests whether system remains uncertain      |
| Insufficient evidence                 | Tests request-more-evidence behavior        |
| Incorrect maintenance record          | Tests provenance and contradiction handling |
| Visual evidence contradicts telemetry | Tests multimodal reasoning                  |

## 11.2 Scorecard implementation

| Metric                | Formula / method                                               | Target behavior                      |
| --------------------- | -------------------------------------------------------------- | ------------------------------------ |
| Top-K Cause Recall    | Ground-truth cause present in top 3?                           | High recall across scenario set      |
| Evidence Groundedness | Major claims with valid evidence IDs / major claims            | Near-complete traceability           |
| Evidence Coverage     | Relevant evidence surfaced / relevant evidence in scenario     | High coverage without noise          |
| Calibration           | Confidence should fall when contradictions are introduced      | Avoid overconfident answers          |
| Investigation Time    | Anomaly creation timestamp -> recommendation timestamp         | Low and stable in repeated runs      |
| Critic Effectiveness  | Confidence/ordering change when contradictory evidence appears | Critic should materially alter cases |
| Action Safety         | Blocked action requests without approval                       | Zero bypasses                        |
| Tool Efficiency       | Necessary tool calls / total tool calls                        | Small purposeful set                 |

## 11.3 Build a regression harness

Create a local and deployed test command that runs all scenarios through the same ADK workflow.

Store:

- expected truth in `scenarios.json`;
- trace in BigQuery;
- structured output in BigQuery;
- final score in BigQuery.

This lets the team demonstrate not only the application but also an evaluation dashboard showing that the agent is measured rather than hand-tuned to one case.

Recommended layout:

```text
tests/
  scenarios/
    SCN-001...
    SCN-008...
  evaluators/
    cause_recall.py
    groundedness.py
    calibration.py
    critic_effectiveness.py
  run_eval.py
```

---

# 12. Step-by-Step Development Plan

The implementation sequence expands the original 10-day plan into implementation tickets. The priority is to get one end-to-end path working early, then add sophistication.

| Day                                    | Deliverable                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day 1 - Freeze the product**         | Lock one scenario, persona, ground truth, demo script, data contract and evaluation metrics. Create a one-page product brief and acceptance criteria.                                 |
| **Day 2 - Create the synthetic world** | Create `machine.json`, `telemetry.csv`, `maintenance.json`, `manual.pdf`, `inspection.jpg`, `incidents.json`, `scenarios.json` and `simulation.json`. Seed a single CNC-04 twin.      |
| **Day 3 - Backend foundation**         | Create GCP project services, Firebase project, Firestore collections, BigQuery dataset, Cloud Storage bucket and Cloud Run FastAPI skeleton. Establish IAM/service account structure. |
| **Day 4 - Evidence pipeline**          | Implement allowlisted tools for telemetry, maintenance, manual retrieval, prior incidents and image retrieval. Normalize every item into the Evidence Contract.                       |
| **Day 5 - Gemini WHY**                 | Use AI Studio to tune the system prompt and schema. Implement WHY Agent in ADK with structured output and evidence IDs. Add 2-3 competing hypotheses.                                 |
| **Day 6 - Critic and loop**            | Implement Critic Agent, one bounded follow-up retrieval loop, confidence revision and unresolved state. Capture traces.                                                               |
| **Day 7 - Frontend workspace**         | Build Firebase/React workspace, live investigation state, evidence timeline, hypothesis cards, challenge interaction and provenance drawer.                                           |
| **Day 8 - Simulation + approval**      | Implement deterministic simulator, assumptions drawer, approval UI, action simulator and audit trail. Verify no action occurs without approval.                                       |
| **Day 9 - Evaluation + polish**        | Run 6-8 scenarios, calculate metrics, fix grounding failures, improve error states, make traces readable, prepare architecture slide and demo fallback.                               |
| **Day 10 - Freeze + rehearse**         | Freeze dependencies, deploy final revision, run smoke tests, rehearse 3-minute pitch repeatedly, capture backup video/screenshots and document recovery steps.                        |

## 12.1 Daily Definition of Done

- A judge-visible capability works end to end, not just a code module.
- At least one automated test exists for the new behavior.
- The case can be replayed from a clean scenario fixture.
- Any new model prompt/schema is versioned in Git.
- Any new external action has an explicit permission boundary.
- The team can show the feature in under 30 seconds during the demo.

---

# 13. Suggested Repository Structure

```text
factory-why/
├── apps/
│   ├── web/                         # Firebase-hosted React app
│   │   ├── src/
│   │   │   ├── features/investigation/
│   │   │   ├── features/machine/
│   │   │   ├── features/evidence/
│   │   │   ├── features/simulation/
│   │   │   └── features/approval/
│   │   └── firebase/
│   └── api/                         # Cloud Run FastAPI
│       ├── main.py
│       ├── routes/
│       ├── services/
│       └── auth/
├── agent/
│   ├── root_orchestrator.py
│   ├── evidence_agent.py
│   ├── why_agent.py
│   ├── critic_agent.py
│   ├── simulation_agent.py
│   ├── recommendation_agent.py
│   ├── action_agent.py
│   ├── tools/
│   ├── schemas/
│   └── prompts/
├── data/
│   ├── machine.json
│   ├── telemetry.csv
│   ├── maintenance.json
│   ├── incidents.json
│   ├── scenarios.json
│   └── simulation.json
├── artifacts/
│   ├── manual.pdf
│   └── inspection.jpg
├── simulator/
│   ├── models.py
│   └── engine.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── eval/
├── infra/
│   ├── cloudbuild.yaml
│   ├── Dockerfile
│   └── firebase.json
└── docs/
    ├── architecture.md
    ├── demo-script.md
    └── runbook.md
```

## 13.1 Dependency principles

- Keep ADK agent code independent from React and presentation logic.
- Keep deterministic simulation independent from Gemini prompts.
- Keep Firestore access behind small repository/service functions so schemas can evolve.
- Keep prompt/schema versions in Git and record the version with each investigation.
- Keep the action tool physically separate from read-only evidence tools.

---

# 14. Implementation Patterns

## 14.1 ADK pseudo-structure

```python
root_agent = SequentialWorkflow(
    evidence_agent,
    why_agent,
    critic_loop,
    simulation_agent,
    recommendation_agent,
    human_approval_gate,
    action_agent,
    outcome_agent,
)

# Evidence retrieval can be parallel inside evidence_agent.
# Critic loop is bounded and must be able to return UNRESOLVED.
# Action agent is only reachable after approval state is verified.
```

## 14.2 Cloud Run request lifecycle

1. Validate Firebase ID token / authenticated identity at the API boundary.
2. Load incident state from Firestore.
3. Create an investigation run ID and persist `status=INVESTIGATING`.
4. Call ADK root workflow with the incident and twin context.
5. Persist structured events as agents/tools return results.
6. Stream progress events to the React client where practical.
7. Persist recommendation, approval state and final outcome.
8. Return a stable investigation object that can be replayed.

## 14.3 Failure handling

| Failure                         | System behavior                                                                |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Gemini call timeout             | Persist partial trace; mark investigation `RETRYABLE`; do not invent result    |
| Tool unavailable                | Mark evidence source unavailable; continue only if sufficient evidence remains |
| Conflicting evidence            | Lower confidence or move to `UNRESOLVED`                                       |
| Malformed model JSON            | Reject output, retry with stricter schema, log failure                         |
| Simulation error                | Do not produce recommendation from missing simulation; show unavailable option |
| Approval missing                | Action endpoint returns forbidden / `approval_required`                        |
| Stale incident                  | Require case refresh before approval                                           |
| Ground truth mismatch in replay | Record evaluation failure; never silently rewrite ground truth                 |

## 14.4 Idempotency

Every investigation run and action should be idempotent.

Use:

```text
investigation_id + action_type + approval_version
```

as the logical key.

This prevents accidental duplicate simulated tasks during retries and makes the audit trail easier to explain.

---

# 15. Three-Minute Competition Demo Script

| Time      | Screen action                         | Narration                                                                                                        | Judge takeaway                             |
| --------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 0:00-0:15 | CNC-04 changes from green to abnormal | "A machine just became abnormal. The alert tells us WHAT changed. The engineer still needs WHY."                 | Problem is obvious                         |
| 0:15-0:35 | Open telemetry panel                  | "Vibration, temperature and current drift together. RPM and pressure remain normal."                             | Real operational signal                    |
| 0:35-0:55 | Evidence timeline populates           | "Factory WHY retrieves the recent bearing replacement, manual guidance, prior incident and inspection evidence." | Agent uses tools/data                      |
| 0:55-1:20 | Show 3 hypotheses                     | "Gemini forms competing explanations and links each claim to evidence."                                          | Grounded GenAI                             |
| 1:20-1:40 | Click Challenge AI                    | "Now we ask the question we built the product around: what would prove the leading hypothesis wrong?"            | Visible innovation                         |
| 1:40-2:00 | Show missing evidence                 | "The critic identifies an alignment measurement as the discriminating check."                                    | Self-challenging reasoning                 |
| 2:00-2:20 | Run simulation                        | "Continue, inspect and repair are compared using deterministic assumptions."                                     | Decision support, not hallucinated numbers |
| 2:20-2:35 | Engineer approves inspection          | "The engineer retains control. No approved action, no action tool."                                              | Responsible AI                             |
| 2:35-2:50 | Action task appears                   | "The action agent creates a simulated maintenance task."                                                         | Agentic execution                          |
| 2:50-3:00 | Reveal outcome + metric               | "Now we reveal ground truth and compare the prediction with the actual case."                                    | Measurable system                          |

## 15.1 Backup demo path

The live demo must have a local, deterministic fallback.

The backup should replay the exact same state machine from pre-recorded tool outputs while still rendering the same investigation UI.

This is not a fake demo: it is a deterministic fixture mode that allows the team to prove the UX and workflow even if a live service is temporarily unavailable during judging.

## 15.2 Five phrases worth memorizing

- **"The alert tells us what changed. Factory WHY investigates why."**
- **"Gemini does not receive raw chaos; it receives a typed evidence contract."**
- **"The critic asks what would prove the leading hypothesis wrong."**
- **"The model explains the trade-off; deterministic code calculates it."**
- **"The engineer owns the final action."**

---

# 16. Mapping to the AI Builder Cup Evaluation Criteria

Use the published rubric as a design constraint. The project should visibly earn evidence for every criterion instead of assuming the architecture alone will be credited.

| Criterion                              | Factory WHY evidence                                                                              | Implementation proof                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Technical Merit & GenAI Implementation | Gemini multimodal reasoning + structured output + tool use + ADK workflow + bounded critique loop | Agent trace, schemas, tool calls, model outputs, deployed Cloud Run              |
| Problem Alignment & Impact             | Reduces fragmented anomaly investigation and improves evidence-backed next actions                | Investigation-time metric, cause recall, evidence coverage, repeatable scenarios |
| Innovation & Creativity                | "What would prove me wrong?" + evidence graph + controlled simulation + outcome replay            | Visible critic interaction + counter-evidence + assumptions drawer               |
| UX & Solution Design                   | Single focused investigation workspace with clear evidence/provenance states                      | Fast path from anomaly -> WHY -> decision -> approval                            |

> **DESIGN PRINCIPLE:** Do not build features that are impressive only in screenshots. Build features that create a visible moment in the three-minute demo.

## 16.1 Internal technical scorecard

| Area                 | Green / ready when...                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| Agentic architecture | All major workflow transitions are visible and testable                   |
| Grounding            | Major claims resolve to evidence IDs                                      |
| Critic               | At least one contradictory scenario changes the outcome                   |
| Multimodal           | Inspection image can support or contradict a textual/telemetry hypothesis |
| Simulation           | All values originate from deterministic code and visible assumptions      |
| Safety               | No action path succeeds without approval                                  |
| Evaluation           | 8 scenarios run with stored metrics                                       |
| Deployment           | Fresh deployment can be reproduced from repo in under one hour            |

---

# 17. Environment and Deployment Runbook

> Exact CLI flags can change by ADK/Cloud release. Treat the following as the implementation sequence rather than a frozen copy-paste command set. Pin versions during Day 1 and use the current official documentation for the exact command syntax.

## 17.1 GCP/Firebase bootstrap

1. Create or select the hackathon Google Cloud project.
2. Enable Cloud Run, Artifact Registry, Firestore, BigQuery, Cloud Storage and relevant Vertex AI / Gemini APIs required by the selected integration path.
3. Create the Firebase project/app against the same Google Cloud project where appropriate.
4. Enable Firebase Authentication and select Google Sign-In or the agreed team login method.
5. Enable App Check for the web application when the client is ready to enforce it.
6. Create Firestore, BigQuery dataset and Cloud Storage bucket in the chosen region/locations consistent with the project design.
7. Create a dedicated Cloud Run service account with least-privilege permissions.

## 17.2 AI Studio workflow

1. Prototype WHY Agent prompt and schema in Google AI Studio.
2. Experiment with structured output and function calling using the smallest realistic evidence bundle.
3. Save the prompt and schema version in Git.
4. Move the stable prompt/schema into the ADK agent configuration and tests.
5. Re-run the same scenario set before every release.

## 17.3 ADK development workflow

1. Scaffold the ADK agent project using the current ADK/Agents CLI guidance.
2. Run the agent locally with fixture tools.
3. Add evaluation datasets and trace capture.
4. Add deployment target for Cloud Run.
5. Deploy a staging revision and smoke test the full investigation.
6. Freeze a final revision and record the deployed service URL, model/config version and dataset version for the demo.

## 17.4 Cloud Run deployment considerations

- Build a container image and deploy it to Cloud Run.
- The service must listen on the `PORT` environment variable.
- Avoid reliance on local disk for case state.
- Use environment variables or secret management for configuration; never commit API keys.
- Use a dedicated service account and least privilege.
- Use Cloud Logging/Trace to verify each model/tool step before demo freeze.

---

# 18. Architecture Decision Record (ADR) Summary

| Decision | Choice                        | Reason                                                         |
| -------- | ----------------------------- | -------------------------------------------------------------- |
| ADR-01   | One CNC + one line            | Enough depth for a strong story without factory-platform scope |
| ADR-02   | Firestore for workflow state  | Simple operational JSON-like state model for a prototype       |
| ADR-03   | BigQuery for telemetry/eval   | Efficient querying of scenario telemetry and metric storage    |
| ADR-04   | Cloud Storage for artifacts   | Natural home for manuals/images/scenario files                 |
| ADR-05   | Cloud Run for API/ADK service | Managed container, low ops overhead, clear GCP deployment      |
| ADR-06   | ADK for orchestration         | Purpose-built agent framework and workflow patterns            |
| ADR-07   | Gemini for reasoning          | Multimodal synthesis, structured outputs, tool use             |
| ADR-08   | Deterministic simulation      | Numeric transparency and repeatability                         |
| ADR-09   | Human approval                | Industrial safety and auditable control                        |
| ADR-10   | Synthetic dataset             | Permissioned, repeatable demo and evaluation                   |

## 18.1 Explicitly rejected for MVP

| Not building                        | Why                                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| Real PLC/SCADA integration          | Safety + integration complexity                             |
| Full digital-twin platform          | Over-scoped for the competition                             |
| ERP/MES integration                 | Use simulated action API instead                            |
| Autonomous shutdown                 | Unsafe and unnecessary                                      |
| New predictive-maintenance ML model | The innovation is investigation, not another forecast model |
| Dozens of agents                    | Complexity without visible value                            |
| Large 3D factory                    | One machine is sufficient for the story                     |
| Generic chatbot                     | Every interaction must advance the investigation            |

---

# 19. Final Pre-Submission Checklist

| Check      | Pass condition                                                         |
| ---------- | ---------------------------------------------------------------------- |
| Problem    | One sentence explains the investigation gap                            |
| Persona    | Reliability/maintenance engineer is explicit                           |
| Scenario   | CNC-04 bearing anomaly is reproducible from fixture data               |
| Evidence   | Telemetry + maintenance + document + image + incident can be retrieved |
| Gemini     | Hypotheses and critique are structured and cited                       |
| ADK        | Workflow trace shows orchestrated agent/tool steps                     |
| Critic     | "What would prove me wrong?" changes at least one scenario             |
| Simulation | Options calculate deterministically from visible assumptions           |
| Approval   | Action is impossible before human approval                             |
| Audit      | Tool calls, decisions and outcome are stored                           |
| Evaluation | At least 6-8 scenarios are measured                                    |
| Deployment | Firebase + Cloud Run deployment works from a clean revision            |
| Fallback   | Recorded/local deterministic replay is ready                           |
| Pitch      | 3-minute script fits with no rushed narration                          |

## Final pitch

> **"Do not just tell the engineer that something is wrong. Show them WHY, show the evidence, show what could prove it wrong, and show what happens next."**

---

# 20. Sources and Current Platform References

## Primary competition/source document

**Factory WHY - AI Builder Cup 2026 Modified Blueprint (user-provided attachment).**

This document is the authoritative basis for:

- product scope;
- MVP scenario;
- evidence contract;
- evaluation plan;
- responsible-AI boundaries;
- competition demo flow.

## Platform references included by the source blueprint

1. **Google AI Studio quickstart** - AI Studio prompt experimentation, run settings, structured output, function calling, grounding.
   - <https://ai.google.dev/gemini-api/docs/ai-studio-quickstart>
2. **Google AI Studio Build mode** - Full-stack prototyping, Firebase setup, GitHub sync, deployment to Cloud Run.
   - <https://ai.google.dev/gemini-api/docs/aistudio-build-mode>
3. **Gemini function calling** - Model/tool interaction pattern and application-side execution of functions.
   - <https://ai.google.dev/gemini-api/docs/function-calling>
4. **Google Cloud function calling on Vertex AI** - Function calling + structured output guidance for Gemini on Google Cloud.
   - <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling>
5. **ADK documentation index** - Current ADK scope: agents, workflow patterns, Google Cloud, integrations and evaluation.
   - <https://adk.dev/llms.txt>
6. **ADK / Agents CLI quickstart** - Current agent development lifecycle including evaluation and Cloud Run deployment.
   - <https://google.github.io/agents-cli/guide/quickstart-tutorial/>
7. **Cloud Run documentation** - Managed container runtime, deployment, runtime contract and IAM.
   - <https://docs.cloud.google.com/run/docs>
8. **Firebase Firestore security** - Authentication, Security Rules and App Check security model.
   - <https://firebase.google.com/docs/firestore/security/overview>
9. **Firebase App Check** - App Check enforcement and protection against unverified requests.
   - <https://firebase.google.com/docs/app-check/enable-enforcement>
10. **Firebase Authentication** - Web Authentication setup and Firebase Auth lifecycle.
    - <https://firebase.google.com/docs/auth/web/start>

---

# Appendix A — Demo Data Package

The source blueprint specifies this demo data package:

```text
machine.json
telemetry.csv
maintenance.json
manual.pdf
inspection.jpg
incidents.json
scenarios.json
simulation.json
```

Descriptions:

- `machine.json` — CNC-04 asset hierarchy and components.
- `telemetry.csv` — baseline + anomaly time series.
- `maintenance.json` — bearing replacement and prior work orders.
- `manual.pdf` — short service-manual excerpt.
- `inspection.jpg` — simulated inspection evidence.
- `incidents.json` — historical incident cases.
- `scenarios.json` — ground truth and evaluation cases.
- `simulation.json` — deterministic assumptions and response models.

---

# Appendix B — Product Scope Snapshot

## One-machine MVP

The hackathon build intentionally narrows the product to:

```text
One production line
    |
    v
CNC-04
    |
    +--> Motor
    +--> Bearing
    +--> Shaft
    +--> Sensors
```

The digital twin is structured operational context rather than a photorealistic factory environment.

## Trigger signature

```text
Vibration       +42%
Temperature     +11%
Motor current    +8%
RPM              normal
Pressure         normal
```

## Context change

```text
Bearing replaced four days earlier
```

## Evidence set

```text
Synthetic telemetry
Maintenance record
Service-manual excerpt
Inspection image
Prior incident
```

## Competing causes

```text
Bearing misalignment
Lubrication issue
Sensor fault
```

## Ground truth

```text
Bearing misalignment
```

## Controlled action

```text
Alignment inspection
        |
        v
Simulated maintenance task
        |
        v
ONLY AFTER HUMAN APPROVAL
```

---

# Appendix C — Core Trust and Safety Rules

The application must preserve the following distinctions throughout the workflow:

```text
OBSERVED FACT
    !=
AI INFERENCE

HYPOTHESIS
    !=
CONFIRMED CAUSE

SIMULATION
    !=
REAL-WORLD PREDICTION

RECOMMENDATION
    !=
AUTHORIZED ACTION

GROUND TRUTH
    !=
CURRENT INVESTIGATION KNOWLEDGE
```

The core operational safety condition is:

```text
NO APPROVAL
     |
     v
NO ACTION
```

And the core product philosophy is:

```text
Alert
  -> Story reconstruction
  -> Evidence
  -> Competing explanations
  -> Challenge
  -> Missing evidence
  -> Deterministic consequences
  -> Controlled recommendation
  -> Human decision
  -> Simulated action
  -> Outcome
  -> Evaluation
```

---

# Appendix D — Implementation Readiness Principles

Before a feature is considered implementation-ready, it should satisfy all of the following:

- Its behavior is visible in the investigation workflow.
- Its input/output contract is typed.
- Its provenance is explicit.
- Its permissions are explicit.
- Its failure state is defined.
- Its persistence location is defined.
- Its test path is defined.
- Its model/tool boundary is explicit.
- It can be replayed from deterministic fixture data where applicable.
- It supports the three-minute demo rather than existing only as an architectural abstraction.

---

# Appendix E — Final Product Vision

Factory WHY is an investigation operating layer for industrial operations.

The digital twin supplies machine context; telemetry and operational records supply evidence; Gemini and ADK coordinate grounded investigation; the critic challenges premature conclusions; deterministic simulation compares response options; and the engineer retains authority over consequential actions.

> **FINAL PITCH**
>
> “Do not just tell the engineer that something is wrong. Show them WHY, show the evidence, show what could prove it wrong, and show what happens next.”

---

**CTRL + WHY • FACTORY WHY • AI BUILDER CUP 2026**
