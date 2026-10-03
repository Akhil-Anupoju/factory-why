# Factory WHY — Development & Cloud Environment

> Environment baseline for the Factory WHY prototype.
>
> This document records infrastructure, cloud resources, development tooling,
> runtime identities, regional decisions, and engineering constraints that have
> already been established for the project.
>
> Backend architecture and implementation should treat these as existing project
> constraints unless a concrete technical blocker requires a change.

---

## 1. Purpose

Factory WHY is an AI-powered industrial root-cause investigation and
decision-support prototype.

This document exists so that engineers and AI coding agents understand:

- what infrastructure already exists;
- which Google Cloud project must be used;
- which regions and resource names have already been selected;
- which development tools are configured;
- which runtime identity must be used;
- which resources belong to the production application;
- which tools exist only for local development;
- what remains unimplemented;
- which safety and architectural boundaries must be preserved.

This document is **environment context**, not an application design
specification.

For product behavior and UI contracts, see:

`docs/factory-why-ui-functional-spec.md`

The Factory WHY / CTRL+WHY project blueprint should be treated as the product
intent and target-architecture reference.

---

# 2. Architecture at a Glance

The intended production architecture is:

```text
Users
  |
  v
React + TypeScript
Firebase Hosting
  |
  | Firebase Authentication
  v
FastAPI Backend
Cloud Run
  |
  v
Google ADK
  |
  +-----------------------+
  |                       |
  v                       v
Gemini / Vertex AI    Deterministic Tools
  |
  +-----------------------+
  |
  +--> Firestore
  |
  +--> BigQuery
  |
  +--> Cloud Storage
```

The local AI-assisted engineering environment is separate:

```text
Developer
   |
   v
Claude Code
   |
   v
OmniRoute
   |
   v
Gemini coding model
```

Claude Code, OmniRoute, ADK Docs MCP, and Google Agents CLI are
**development tools**.

They are not part of the Factory WHY production runtime.

---

# 3. Google Cloud Project

## Project

Project name:

```text
Factory Why Hackathon
```

Project ID:

```text
factory-why-hackathon
```

Project number:

```text
68137042939
```

Lifecycle state:

```text
ACTIVE
```

This is the canonical Google Cloud project for Factory WHY.

Do not deploy Factory WHY resources into the earlier temporary project:

```text
project-0071d886-c933-47f3-87d
```

That project was used during initial setup/billing investigation and is not the
Factory WHY application project.

---

# 4. Billing

Cloud Billing is enabled for:

```text
factory-why-hackathon
```

Billing account:

```text
01E303-FFE9C8-C2A60C
```

Billing verification returned:

```text
billingEnabled: true
```

The project is currently associated with the Google Cloud Free Trial billing
environment used during prototype development.

Cost-sensitive prototype decisions should still be preserved even though
billing is enabled.

---

# 5. Regional Strategy

Primary Google Cloud region:

```text
asia-south1
```

Location:

```text
Mumbai, India
```

The prototype uses a single-region strategy where supported.

Current/intended alignment:

| Service       | Region                      |
| ------------- | --------------------------- |
| Firestore     | `asia-south1`               |
| BigQuery      | `asia-south1`               |
| Cloud Storage | `asia-south1`               |
| Cloud Run     | `asia-south1` when deployed |

Avoid introducing resources in unrelated regions unless technically required.

Regional changes should be treated as architecture decisions rather than
implementation conveniences.

---

# 6. Enabled / Required Google Cloud Services

The project foundation includes the Google Cloud services required for the
prototype architecture.

Vertex AI / AI Platform has been explicitly verified/enabled:

```text
aiplatform.googleapis.com
```

The broader architecture uses or expects:

- Vertex AI
- Cloud Run
- Cloud Build
- Artifact Registry
- Firestore
- BigQuery
- Cloud Storage
- Cloud Logging

Exact API enablement should still be verified by deployment automation rather
than assumed from this document.

---

# 7. Firebase

Firebase is attached to the same canonical Google Cloud project:

```text
factory-why-hackathon
```

Firebase project display name:

```text
Factory Why Hackathon
```

This is intentional.

Do not create a second Firebase project for the application.

---

# 8. Firebase Web Application

A Firebase Web App has been registered.

Application nickname:

```text
Factory WHY Web
```

Firebase generated the normal web application configuration for the project.

The frontend should eventually consume the appropriate Firebase web
configuration through environment-aware frontend configuration.

Do not place private server credentials in frontend Firebase configuration.

The Firebase Web App registration is complete.

---

# 9. Firebase Authentication

Firebase Authentication is configured.

Enabled sign-in provider:

```text
Google
```

Public-facing application name:

```text
Factory WHY
```

Google Sign-In is the intended authentication mechanism for the prototype UI.

Authentication should eventually establish user identity for actions such as:

- approvals;
- rejections;
- requests for additional evidence;
- challenges;
- audit attribution.

Authorization semantics beyond authentication remain a backend design concern.

---

# 10. Firebase Hosting

Firebase Hosting has **not** been configured/deployed yet.

This is intentional.

Hosting belongs to a later deployment phase after frontend/backend integration.

Current status:

```text
NOT IMPLEMENTED
```

---

# 11. Firestore

Firestore has been created in the canonical project.

Database ID:

```text
(default)
```

Edition:

```text
Standard
```

Database mode:

```text
Native
```

Region:

```text
asia-south1
```

Initial security posture:

```text
Restrictive
```

Point-in-time recovery:

```text
Disabled for prototype
```

Scheduled backups:

```text
Disabled for prototype
```

Encryption:

```text
Google-managed encryption
```

Firestore is intended for **operational application state**.

Planned logical collections from the Factory WHY architecture are:

```text
assets
components
sensors
incidents
evidence
hypotheses
simulations
approvals
actions
outcomes
```

These collection names represent planned domain boundaries.

The exact production document schemas have **not** been finalized.

Backend implementation must derive schemas from:

1. the current frontend types;
2. mock scenario data;
3. the UI functional specification;
4. the Factory WHY blueprint;
5. backend contract requirements.

Do not invent complete Firestore schemas without reconciling those sources.

---

# 12. BigQuery

A BigQuery dataset has been created.

Dataset:

```text
factory_why
```

Region:

```text
asia-south1
```

BigQuery is intended for telemetry, evaluation, analytics, and agent traces
rather than primary operational workflow state.

Planned logical tables include:

```text
telemetry
evaluation_runs
evaluation_metrics
agent_traces
```

These tables have not yet been implemented as final production schemas.

Operational investigation state should not be moved into BigQuery merely
because BigQuery is available.

---

# 13. Cloud Storage

Artifact bucket:

```text
factory-why-hackathon-artifacts
```

Region:

```text
asia-south1
```

Storage class:

```text
Standard
```

Public access prevention:

```text
Enabled
```

Access model:

```text
Uniform bucket-level access
```

Cross-bucket replication:

```text
Disabled
```

Hierarchical namespace:

```text
Disabled
```

Rapid Cache:

```text
Disabled
```

Soft delete:

```text
Enabled
```

Soft-delete retention:

```text
Default 7 days
```

Object versioning:

```text
Disabled
```

Compliance retention policy:

```text
Disabled
```

Encryption:

```text
Google-managed encryption
```

The bucket is intended for artifacts such as:

```text
manuals
inspection images
scenario artifacts
simulation artifacts
screenshots
```

Artifact metadata and provenance should be represented in application state;
large binary/object content should remain in Cloud Storage.

---

# 14. Runtime Service Account

Dedicated runtime identity:

```text
factory-why-runtime@factory-why-hackathon.iam.gserviceaccount.com
```

Display purpose:

```text
Runtime identity for the Factory WHY Cloud Run backend
```

The backend should use this identity when deployed to Cloud Run.

Do not use a developer's personal Google account as the application runtime
identity.

Do not replace this identity without an explicit infrastructure decision.

---

# 15. Runtime IAM — Project-Level Roles

The runtime service account has these project-level roles:

```text
roles/aiplatform.user
roles/bigquery.jobUser
roles/datastore.user
roles/logging.logWriter
```

Purpose:

### `roles/aiplatform.user`

Allows the runtime to use Vertex AI capabilities required by the application.

### `roles/bigquery.jobUser`

Allows the runtime to execute BigQuery jobs.

### `roles/datastore.user`

Provides application-level Firestore/Datastore data access required by the
runtime.

### `roles/logging.logWriter`

Allows the runtime to write application logs.

The service account intentionally does **not** have:

```text
Owner
Editor
BigQuery Admin
Storage Admin
Vertex AI Admin
Firebase Admin
```

Least privilege should remain the guiding IAM principle.

---

# 16. BigQuery Dataset-Level IAM

The runtime service account has:

```text
BigQuery Data Editor
```

scoped to:

```text
factory_why
```

This permission is intentionally dataset-scoped rather than project-wide.

The runtime therefore has:

```text
Project:
BigQuery Job User

Dataset factory_why:
BigQuery Data Editor
```

---

# 17. Cloud Storage Bucket-Level IAM

The runtime service account has:

```text
roles/storage.objectAdmin
```

scoped to:

```text
gs://factory-why-hackathon-artifacts
```

This permission is intentionally bucket-specific.

The runtime should not receive project-wide Storage Admin unless a future
requirement explicitly justifies it.

---

# 18. Vertex AI / Gemini — Production Boundary

Vertex AI is part of the **Factory WHY production architecture**.

The production reasoning path is intended to be:

```text
FastAPI
   |
   v
Google ADK
   |
   v
Gemini / Vertex AI
```

The React frontend should not directly become the production Gemini
orchestration layer.

Gemini should be used for reasoning tasks where probabilistic model behavior is
appropriate.

Deterministic calculations must remain deterministic code/tools.

---

# 19. Frontend Repository

Canonical repository:

```text
Akhil-Anupoju/factory-why
```

Default branch:

```text
main
```

GitHub is now the engineering source of truth.

Google AI Studio was used to generate and refine the initial frontend
prototype.

After export, the application was pushed to GitHub and cloned locally.

Google AI Studio should now be treated primarily as a prototyping /
experimentation environment rather than the canonical engineering repository.

---

# 20. Local Repository

Local repository path used during development:

```text
~/Documents/Ai-Builder-Cup-2026/factory-why
```

The repository has been verified against the GitHub `main` branch.

The frontend has been run successfully from this local repository.

---

# 21. Current Frontend Technology

The AI Studio generated frontend currently uses:

```text
React 19
TypeScript
Vite 8
Tailwind CSS
Lucide React
Motion
```

The repository is a Vite-based React + TypeScript application.

Important source locations:

```text
src/App.tsx
src/main.tsx
src/index.css
src/types/index.ts
src/data/mockScenarios.ts
src/components/
```

Current major components include:

```text
ApprovalPanel
AuditPanel
CriticSection
DemoScriptBar
EvaluationSuiteModal
EvidenceProvenanceModal
EvidenceTimeline
HypothesisCards
MachineContextPanel
OutcomePanel
RecommendationPanel
SimulatedActionPanel
SimulationPanel
TelemetryPanel
TopBar
```

---

# 22. Current Mock Data

The frontend currently uses synthetic/mock scenario data.

Primary mock-data source:

```text
src/data/mockScenarios.ts
```

Primary domain types:

```text
src/types/index.ts
```

The mock layer is intentional.

Backend implementation should replace mock behavior **incrementally** through
typed contracts rather than rewriting the frontend.

The current UI is the frontend behavior baseline.

---

# 23. UI Functional Specification

The repository contains:

```text
docs/factory-why-ui-functional-spec.md
```

This document describes:

- current UI behavior;
- investigation workflow;
- data expectations;
- evidence model;
- hypothesis model;
- critic behavior;
- deterministic simulator;
- recommendation behavior;
- human approval;
- simulated actions;
- outcomes;
- audit requirements;
- future backend contracts.

Backend engineering should read this document before changing application
contracts.

---

# 24. Project Blueprint

The Factory WHY / CTRL+WHY project proposal / blueprint is the product intent
and target architecture reference.

Recommended repository location:

```text
docs/factory-why-project-blueprint.md
```

The three core context sources should therefore be interpreted as:

```text
factory-why-project-blueprint.md
= WHY the product exists and intended architecture

factory-why-ui-functional-spec.md
= WHAT the current application does and expects

factory-why-environment.md
= WHAT infrastructure/tooling has already been configured

actual repository
= WHAT currently exists in code
```

If these sources disagree, the discrepancy must be surfaced explicitly rather
than silently resolved.

---

# 25. Frontend Dependency Correction

The AI Studio generated `package.json` originally contained:

```text
vite: ^8.3.0
esbuild: ^0.25.0
```

During local installation, npm reported an incompatible peer dependency because
the resolved Vite 8 version required a newer esbuild range.

The project was corrected to use:

```text
esbuild: ^0.28.0
```

The resolved local version during setup was:

```text
esbuild 0.28.2
```

This corrected the dependency graph.

Do not revert esbuild to the original AI Studio-generated `^0.25.0` range.

---

# 26. Frontend Verification

The exported application has been validated locally.

Dependency installation:

```text
PASS
```

npm vulnerability result during installation:

```text
0 vulnerabilities
```

TypeScript validation:

```text
npm run lint
PASS
```

The lint script currently performs:

```text
tsc --noEmit
```

Production build:

```text
npm run build
PASS
```

Development server:

```text
npm run dev
PASS
```

Local development URL:

```text
http://localhost:3000
```

Local UI acceptance testing:

```text
PASS
```

Responsive/layout acceptance was also reviewed after the AI Studio UI hardening
pass.

---

# 27. Known Frontend Build Warning

Vite currently reports a non-blocking warning that `vite.config.ts` uses:

```text
__dirname
```

while a future Vite native config loader expects:

```text
import.meta.dirname
```

The application still builds successfully.

This is a future frontend-hardening item and is not currently a backend blocker.

Do not suppress the warning merely to hide it; update the configuration when
frontend build hardening is performed.

---

# 28. Frontend Environment Template

The generated repository contains:

```text
.env.example
```

with AI Studio-oriented variables such as:

```text
GEMINI_API_KEY
APP_URL
```

These originated from the generated AI Studio application.

They must not automatically be treated as the final production environment
contract.

In particular:

- do not expose production Gemini credentials to the browser;
- do not commit real secrets;
- do not assume frontend Gemini calls are part of the final architecture.

Backend configuration must be designed separately.

---

# 29. Local Node Environment

Configured Node version:

```text
v24.21.0
```

npm:

```text
11.19.0
```

Node version manager:

```text
nvm 0.40.8
```

Node executable during setup:

```text
~/.nvm/versions/node/v24.21.0/bin/node
```

Node 24 is the standardized JavaScript runtime for this prototype environment.

---

# 30. Python Environment

The development target is:

```text
Python 3.12
```

Python tooling:

```text
uv
```

A Python 3.12 project environment was established during prerequisite setup.

The machine also contains other Python installations used by system/developer
tools.

Do not infer the Factory WHY backend runtime from whichever `python3` happens to
appear first globally.

The backend should explicitly target Python 3.12 unless a later dependency
requires a change.

---

# 31. Git

Git is installed and working.

The Factory WHY repository is connected to:

```text
https://github.com/Akhil-Anupoju/factory-why.git
```

Branch:

```text
main
```

GitHub authentication was corrected during setup so local pushes can be made to
the canonical repository.

---

# 32. gcloud CLI

Google Cloud CLI is installed and authenticated.

The active Factory WHY project should be:

```text
factory-why-hackathon
```

Before infrastructure/deployment commands, verify with:

```bash
gcloud config get-value project
```

Do not assume the project remains selected across unrelated gcloud workflows.

---

# 33. Firebase CLI

Firebase CLI is installed and authenticated.

The Firebase project corresponding to Factory WHY is:

```text
factory-why-hackathon
```

An unrelated Firebase demo project may also be visible in the user's account.

Do not deploy Factory WHY into:

```text
fir-demo-project
```

---

# 34. Claude Code

Claude Code is installed and functioning.

The installed version observed later in setup:

```text
2.1.288
```

Claude Code is the primary AI-assisted local coding environment for the backend
implementation phase.

Claude must inspect the existing repository and documentation before changing
architecture.

---

# 35. OmniRoute

OmniRoute is installed globally through npm.

Version:

```text
3.8.51
```

Executable location during setup:

```text
~/.nvm/versions/node/v24.21.0/bin/omniroute
```

Local dashboard:

```text
http://localhost:20128
```

OpenAI-compatible API:

```text
http://localhost:20128/v1
```

Data directory:

```text
~/.omniroute
```

Database:

```text
~/.omniroute/storage.sqlite
```

Persistent configuration:

```text
~/.omniroute/.env
```

OmniRoute doctor verified:

- configuration;
- SQLite database;
- encryption;
- port availability;
- Node compatibility;
- native SQLite binary;
- server liveness;
- local machine token.

OmniRoute is **development tooling only**.

Do not deploy OmniRoute as part of Factory WHY unless an explicit future
architecture decision introduces that requirement.

---

# 36. OmniRoute Credential Storage

OmniRoute generated and uses a storage encryption key.

Persistent values belong in:

```text
~/.omniroute/.env
```

The globally installed npm package also contains an `.env` file, but OmniRoute
warned that values inside the installed package can be replaced during upgrades.

Do not put project secrets into the npm package installation directory.

Do not commit OmniRoute credentials to the Factory WHY repository.

---

# 37. Corporate / Local Certificate Environment

The development machine uses an additional Node certificate configuration:

```text
NODE_EXTRA_CA_CERTS=~/.config/dayton/cacerts
```

This caused certificate behavior differences for some Node/uv network requests.

`uv` package downloads initially failed with:

```text
invalid peer certificate: UnknownIssuer
```

For affected `uvx` commands, the working approach was:

```text
--system-certs
```

Example:

```bash
uvx --system-certs ...
```

Do not disable TLS verification.

Do not use insecure certificate bypasses.

Prefer system certificate trust when required by the local development
environment.

---

# 38. OmniRoute Development Provider

A Gemini provider connection has been configured in OmniRoute.

Provider:

```text
Gemini (Google AI Studio)
```

Connection name:

```text
factory-why-gemini
```

A Gemini API credential is stored privately in OmniRoute.

The credential must not be committed to Git or documented in plaintext.

A model connectivity test succeeded using:

```text
gemini/gemini-3.8-flash
```

This provider is used for **development/coding assistance**.

It is separate from the Factory WHY production Vertex AI architecture.

---

# 39. OmniRoute Claude Client Key

A local OmniRoute client API key was created for Claude Code.

Key name:

```text
factory-why-claude
```

The key value is intentionally not documented.

The key is used only for Claude Code → OmniRoute authentication.

It must not be:

- committed to Git;
- placed in application source;
- placed in documentation;
- exposed to the frontend.

---

# 40. Claude Code Model Routing

The configured local development route is:

```text
Claude Code
   |
   v
OmniRoute
   |
   v
factory-why-gemini
   |
   v
gemini/gemini-3.8-flash
```

OmniRoute Claude profile:

```text
gemini-gemini-3-8-flash
```

Typical launch command:

```bash
omniroute launch --profile gemini-gemini-3-8-flash
```

This is a **coding-agent route**.

It is not the Factory WHY runtime model configuration.

Do not make production architecture decisions based solely on this local
development route.

---

# 41. ADK Documentation MCP

Claude Code has a project-scoped MCP server for current Google ADK
documentation.

MCP name:

```text
adk-docs
```

Documentation source:

```text
https://adk.dev/llms.txt
```

The MCP uses:

```text
mcpdoc
```

through `uvx`.

Because of the local certificate environment and current `mcpdoc` compatibility,
the working invocation requires:

```text
--system-certs
```

and:

```text
mcp<2
```

Conceptually:

```text
uvx
  --system-certs
  --from mcpdoc
  --with "mcp<2"
  mcpdoc
```

The MCP connection has been verified as:

```text
Connected
```

Purpose:

- provide Claude Code with current ADK documentation;
- reduce stale API assumptions;
- validate ADK classes/modules/patterns against current documentation.

The MCP is development assistance and is not a runtime application dependency.

---

# 42. Claude Profile Isolation

OmniRoute Claude profiles may use a separate Claude configuration context.

During setup, normal Claude Code could see the project-local `adk-docs` MCP while
the initial OmniRoute-launched profile did not.

The MCP was subsequently configured/verified for the required development
context.

This matters because:

```text
normal Claude configuration
```

and:

```text
OmniRoute Claude profile configuration
```

should not automatically be assumed to share every setting.

When debugging Claude tooling, verify:

```text
/model
```

and:

```text
/mcp
```

inside the actual session being used.

---

# 43. Google Agents CLI

Google Agents CLI setup completed successfully using system certificates.

Version resolved during setup:

```text
google-agents-cli 1.8.0
```

Setup scope:

```text
workspace
```

Target coding agent:

```text
claude-code
```

The CLI itself was installed and ADK skills were installed into the Factory WHY
workspace.

The setup reported:

```text
Auth: Not authenticated
CLI: agents-cli installed
Skills: Installed
Scope: workspace
```

Authentication to Agents CLI was not completed during this setup.

The installed workspace skills are still available for Claude Code.

---

# 44. Google Agents CLI Workspace Skills

Seven skills were installed:

```text
google-agents-cli-adk-code
google-agents-cli-deploy
google-agents-cli-eval
google-agents-cli-observability
google-agents-cli-publish
google-agents-cli-scaffold
google-agents-cli-workflow
```

Claude-specific copies were created under:

```text
.claude/skills/
```

A workspace skills lock file was also created:

```text
skills-lock.json
```

These skills provide development guidance for:

- ADK coding;
- scaffolding;
- workflows;
- evaluation;
- observability;
- deployment;
- publishing.

They are **development-time skills**, not application runtime dependencies.

Review skill contents before relying on them for high-impact changes.

---

# 45. Current Development Knowledge Stack

The intended backend engineering context is now:

```text
Claude Code
   |
   +--> Factory WHY repository
   |
   +--> Factory WHY UI functional specification
   |
   +--> Factory WHY project blueprint
   |
   +--> Factory WHY environment document
   |
   +--> ADK Docs MCP
   |
   +--> Google Agents CLI skills
   |
   +--> OmniRoute → Gemini coding model
```

This context should be established before asking Claude to implement backend
features.

---

# 46. Backend Technology Target

Backend language:

```text
Python 3.12
```

Web framework:

```text
FastAPI
```

Agent framework:

```text
Google ADK
```

Reasoning model:

```text
Gemini / Vertex AI
```

Operational state:

```text
Firestore
```

Telemetry/evaluation:

```text
BigQuery
```

Artifacts:

```text
Cloud Storage
```

Runtime:

```text
Cloud Run
```

The backend does not exist yet.

---

# 47. Intended Agent Architecture

The Factory WHY blueprint intends bounded responsibilities such as:

```text
Root Orchestrator
Evidence Agent
WHY Agent
Critic Agent
Follow-up / Targeted Retrieval
Simulation Agent
Recommendation Agent
Action Agent
```

These are intended conceptual responsibilities.

Exact ADK class/module choices must be validated against current ADK
documentation before implementation.

Do not create recursive or uncontrolled agent loops.

---

# 48. First Intended Backend Vertical Slice

The intended first meaningful reasoning slice is:

```text
Root
  |
  v
Evidence
  |
  v
WHY
  |
  v
Critic
  |
  v
Targeted Evidence
  |
  v
Revised WHY
```

Simulation, recommendation, approval, and action should follow after this
reasoning/evidence loop is working and testable.

This sequence should still be validated against the current frontend and
functional specification during the architecture audit.

---

# 49. Deterministic Simulation Boundary

The UI currently compares:

```text
CONTINUE
INSPECT
REPAIR
```

Simulation values such as:

- downtime;
- modeled cost;
- residual exposure;
- delay;
- assumptions;

must ultimately be produced by deterministic/backend calculation logic where
appropriate.

Gemini may explain deterministic results.

Gemini must not silently invent authoritative numeric simulation outputs.

The distinction must remain:

```text
LLM reasoning
!=
deterministic calculation
```

---

# 50. Evidence Boundary

Evidence provenance is a first-class requirement.

Observed evidence must remain distinguishable from AI inference.

Evidence should preserve identifiers such as:

```text
evidence_id
source
timestamp
asset
component
observation
provenance
status
confidence
```

AI-generated hypotheses must reference evidence IDs rather than rewriting
observations as if they were new facts.

The backend must preserve this boundary.

---

# 51. Human Approval Boundary

The prototype has an explicit safety rule:

```text
NO APPROVAL
→
NO ACTION
```

The application must preserve:

- Approve;
- Reject;
- Request More Evidence;
- Challenge;

as human decision points where applicable.

Action state must not unlock before the required approval condition.

Approval decisions should eventually be attributable to authenticated users and
auditable.

---

# 52. Industrial Safety Boundary

Factory WHY is currently a **decision-support prototype**.

It must not become an autonomous industrial control system.

The prototype must NOT:

```text
control PLCs
control SCADA systems
operate machinery
issue real machine commands
perform physical maintenance
execute autonomous industrial actions
```

The Action experience is simulated.

Any future movement beyond simulation requires a separate safety/security/
governance architecture decision.

---

# 53. Ground Truth Boundary

The primary demo scenario has a known evaluation ground truth, but the system
must not treat it as known during reasoning.

For the CNC-04 demo:

```text
Ground truth:
Bearing misalignment
```

During investigation, bearing misalignment remains a **hypothesis** until the
appropriate outcome/evaluation stage.

The implementation must keep separate:

```text
observed evidence
hypothesis
recommendation
human decision
simulated action
outcome
ground truth
```

---

# 54. Primary Demo Scenario

Primary machine:

```text
CNC-04
```

Observed anomaly context:

```text
Vibration +42%
Temperature +11%
Motor current +8%
RPM normal
Pressure normal
```

Recent context:

```text
Bearing replaced four days before anomaly
```

Competing causes represented by the current prototype:

```text
1. Bearing misalignment
2. Lubrication issue
3. Sensor fault
```

Evaluation ground truth:

```text
Bearing misalignment
```

This scenario is synthetic prototype data.

It must not be mistaken for real industrial telemetry.

---

# 55. Current Product Workflow

The current UX is organized around:

```text
OBSERVE
→ INVESTIGATE
→ EXPLAIN WHY
→ CHALLENGE
→ SIMULATE
→ RECOMMEND
→ HUMAN APPROVAL
→ ACT
→ LEARN
```

Backend implementation should support this workflow incrementally.

The backend should not force the UI into a generic chatbot interaction model.

---

# 56. Current Implementation Status

## Complete / Configured

```text
Google Cloud project
Billing
Regional strategy
Firebase project
Firebase Web App
Firebase Google Sign-In
Firestore
BigQuery dataset
Cloud Storage artifact bucket
Runtime service account
Runtime IAM
Vertex AI API
AI Studio frontend prototype
UI/UX hardening
UI functional specification
GitHub repository
Local repository
Frontend dependency installation
TypeScript validation
Production frontend build
Local UI acceptance
Claude Code
OmniRoute
Gemini development provider
Claude → OmniRoute routing
ADK Docs MCP
Google Agents CLI workspace skills
```

## Not Implemented Yet

```text
FastAPI backend
backend domain schemas
frontend/backend API contracts
Google ADK runtime orchestration
Evidence Agent
WHY Agent
Critic Agent
targeted retrieval loop
Firestore application repositories
BigQuery application writers/readers
Cloud Storage application integration
multimodal inspection-image workflow
deterministic backend simulator
recommendation workflow
backend approval persistence
simulated action backend
outcome persistence
evaluation pipeline
agent trace persistence
Cloud Run deployment
Firebase Hosting deployment
App Check
production deployment hardening
```

---

# 57. Engineering Rules for Backend Implementation

Backend implementation should follow these constraints.

## Preserve the frontend

Do not unnecessarily redesign or rewrite the accepted frontend.

Replace mock services/data incrementally.

## Typed contracts first

Define structured request/response/domain contracts before wiring agents.

## Preserve provenance

Evidence IDs and provenance must survive every reasoning step.

## Separate facts from inference

Observed evidence and AI inference must remain semantically distinct.

## Deterministic calculations stay deterministic

Do not delegate numeric simulation authority to Gemini.

## Human approval is mandatory

No simulated action should bypass the approval gate.

## Bounded agent workflows

Avoid uncontrolled loops.

The Critic → targeted evidence → revised WHY loop must have an explicit bound.

## Cloud Run is stateless

Persistent investigation state belongs in Firestore/other configured stores,
not local process memory.

## Least privilege

Use:

```text
factory-why-runtime
```

for runtime cloud access.

Do not broaden IAM without justification.

## Secrets stay server-side

Never expose:

- Gemini provider credentials;
- service-account credentials;
- OmniRoute keys;
- cloud secrets;

to browser code or Git.

---

# 58. Source-of-Truth Hierarchy

During backend architecture and implementation, use these sources:

### 1. Actual repository

Represents current implemented behavior.

### 2. `docs/factory-why-ui-functional-spec.md`

Represents the accepted UI/functionality contract.

### 3. `docs/factory-why-project-blueprint.md`

Represents product intent and target architecture.

### 4. `docs/factory-why-environment.md`

Represents infrastructure/tooling decisions already made.

### 5. ADK Docs MCP

Represents current Google ADK technical documentation.

### 6. Google Agents CLI skills

Provide current development workflows/guidance.

If sources disagree:

1. identify the conflict;
2. do not silently choose;
3. explain its impact;
4. mark it as a decision/TBD where necessary.

---

# 59. Secrets Policy

This document intentionally contains no secret values.

Never add any of the following to this document:

```text
Gemini API keys
OmniRoute API keys
Firebase private credentials
OAuth tokens
Claude credentials
service-account private keys
STORAGE_ENCRYPTION_KEY
MANAGEMENT_TOKEN
passwords
access tokens
refresh tokens
```

Resource identifiers and IAM role names may be documented.

Credential values may not.

---

# 60. Backend Architecture Audit Requirement

Before backend implementation begins, Claude Code should perform a read-only
architecture audit.

The audit should inspect:

```text
current repository
docs/factory-why-project-blueprint.md
docs/factory-why-ui-functional-spec.md
docs/factory-why-environment.md
src/types/index.ts
src/data/mockScenarios.ts
all frontend components
package.json
Vite configuration
ADK Docs MCP
Google Agents CLI skills
```

The audit must not modify files.

Its purpose is to produce:

```text
Current UI
    ↓
Domain contracts
    ↓
Backend capabilities
    ↓
FastAPI boundary
    ↓
ADK responsibilities
    ↓
Deterministic tools
    ↓
Persistence mapping
    ↓
Audit/evaluation mapping
    ↓
Implementation phases
```

Only after this audit is reviewed should backend implementation begin.

---

# 61. Immediate Next Engineering Phase

The next project phase is:

```text
READ-ONLY ARCHITECTURE AUDIT
```

followed by:

```text
typed backend contracts
        ↓
FastAPI skeleton
        ↓
Evidence contracts/tools
        ↓
WHY Agent
        ↓
Critic / bounded follow-up loop
        ↓
Firestore integration
        ↓
multimodal evidence
        ↓
deterministic simulation
        ↓
recommendation
        ↓
approval + simulated action
        ↓
BigQuery evaluation
        ↓
Cloud Run
        ↓
Firebase Hosting / production hardening
```

The exact sequence may be refined by the architecture audit, but already
configured infrastructure should not be redesigned without a concrete reason.

---

# 62. Final Environment Baseline

At the start of backend engineering, the Factory WHY environment is:

```text
PRODUCT CONTEXT
├── Factory WHY / CTRL+WHY blueprint
├── UI functional specification
└── accepted React prototype

SOURCE CONTROL
└── GitHub
    └── Akhil-Anupoju/factory-why

FRONTEND
├── React
├── TypeScript
├── Vite
└── mock scenario data

IDENTITY
└── Firebase Authentication
    └── Google Sign-In

BACKEND TARGET
├── Python 3.12
├── FastAPI
├── Google ADK
└── Gemini / Vertex AI

STATE
└── Firestore
    └── asia-south1

ANALYTICS / EVALUATION
└── BigQuery
    └── factory_why
        └── asia-south1

ARTIFACTS
└── Cloud Storage
    └── factory-why-hackathon-artifacts
        └── asia-south1

RUNTIME
└── Cloud Run
    └── asia-south1

RUNTIME IDENTITY
└── factory-why-runtime

DEVELOPMENT AGENT
└── Claude Code
    ├── OmniRoute
    │   └── Gemini coding model
    ├── ADK Docs MCP
    └── Google Agents CLI skills
```

This is the established environment baseline for the Factory WHY backend
architecture and implementation phase.
