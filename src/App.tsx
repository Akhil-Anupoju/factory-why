import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { DemoScriptBar, DEMO_BEATS } from './components/DemoScriptBar';
import { MachineContextPanel } from './components/MachineContextPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { EvidenceTimeline } from './components/EvidenceTimeline';
import { EvidenceProvenanceModal } from './components/EvidenceProvenanceModal';
import { HypothesisCards } from './components/HypothesisCards';
import { CriticSection } from './components/CriticSection';
import { SimulationPanel } from './components/SimulationPanel';
import { RecommendationPanel } from './components/RecommendationPanel';
import { ApprovalPanel } from './components/ApprovalPanel';
import { SimulatedActionPanel } from './components/SimulatedActionPanel';
import { OutcomePanel } from './components/OutcomePanel';
import { AuditPanel } from './components/AuditPanel';
import { EvaluationSuiteModal } from './components/EvaluationSuiteModal';

import { 
  PRIMARY_SCENARIO_CNC04, 
  SCENARIO_LUBRICATION, 
  GROUND_TRUTH_OUTCOME_CNC04, 
  calculateDeterministicSimulation, 
  DEFAULT_SIMULATION_PARAMS 
} from './data/mockScenarios';
import { fetchIncident, postApproval, postAction, fetchOutcome } from './api/incidentApi';
import { ApiError } from './api/apiClient';
import { useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import createInvestigationStream from './api/streamApi';
import { 
  InvestigationCase, 
  EvidenceItem, 
  ApprovalDecision, 
  SimulationParameters, 
  ActionRecord 
} from './types';
import { 
  Activity, 
  FileText, 
  GitCompare, 
  Scale, 
  Cpu, 
  ShieldCheck, 
  Award, 
  Terminal,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function App() {
  // Active Scenario & Case State
  const [activeScenarioId, setActiveScenarioId] = useState<string>('CNC-04');
  const [currentCase, setCurrentCase] = useState<InvestigationCase>(PRIMARY_SCENARIO_CNC04);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState<boolean>(false);
  const [streamState, setStreamState] = useState<'idle' | 'connecting' | 'running' | 'awaiting_approval' | 'completed' | 'error'>('idle');
  const auth = useAuth();

  // TopBar now consumes Auth context directly — no DOM wiring required here.

  // UI Selection states
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>('HYP-01');
  const [selectedSimulationOption, setSelectedSimulationOption] = useState<string>('INSPECT');
  const [isEvaluationSuiteOpen, setIsEvaluationSuiteOpen] = useState<boolean>(false);

  // 3-Minute Demo Script Guide State
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState<boolean>(true);
  const [demoStep, setDemoStep] = useState<number>(1);
  const [isDemoPlaying, setIsDemoPlaying] = useState<boolean>(false);

  // Handler: Select Scenario
  const handleSelectScenario = (id: string) => {
    setActiveScenarioId(id);
    // Reset error/loading first
    setError(null);
    if (id === 'CNC-04') {
      // try API first, fallback to local mock with visible error
      loadIncident('INC-2026-0827', true);
    } else {
      setCurrentCase(JSON.parse(JSON.stringify(SCENARIO_LUBRICATION)));
    }
    setSelectedComponentId(null);
    setDemoStep(1);
  };

  // Load incident from API. If fallbackToMock is true, show error but load mock on failure.
  const loadIncident = async (incidentId: string, fallbackToMock = false) => {
    setLoading(true);
    setError(null);
    setUsingMock(false);
    try {
      const ic = await fetchIncident(incidentId);
      setCurrentCase(ic);
    } catch (err: any) {
      // visible error state — do not treat authentication/authorization errors
      // as recoverable by falling back to demo data. Only network/back-end
      // availability errors should allow the explicit demo fallback.
      const msg = err?.message || String(err);
      setError(msg);
      // If this was an authentication or authorization failure, surface it
      // and avoid the mock fallback so the UI can prompt for re-auth.
      if (fallbackToMock && !(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        // backend unavailable or other network error: fallback to demo data
        setCurrentCase(JSON.parse(JSON.stringify(PRIMARY_SCENARIO_CNC04)));
        setUsingMock(true);
        // if using mock data, ensure stream is stopped
        setStreamState('idle');
      }
    } finally {
      setLoading(false);
    }
  };

  // SSE: start/stop investigation stream when using live data
  useEffect(() => {
    // only start stream when not using mock and no visible error
    if (usingMock || error) {
      return;
    }

    let controller = createInvestigationStream(currentCase.incident_id, (ev) => {
      // map event name to UI stage
      if (ev.name === 'awaiting_approval') {
        setStreamState('awaiting_approval');
        // stop stream after awaiting_approval
        controller.stop();
        return;
      }

      // any other named event means stream is active
      setStreamState('running');

      // integrate certain steps into UI: retrieving_telemetry -> no-op (TelemetryPanel reads data)
      // critiquing_leader -> show CriticSection highlight (keep simple)
      // For now we store minimal audit-like event into audit_trail so UI shows progression
      const step = ev.payload?.step || null;
      if (step) {
        const auditEvent = {
          event_id: `AUD-SSE-${Date.now()}`,
          step_number: currentCase.audit_trail.length + 1,
          timestamp: new Date().toISOString(),
          agent_role: 'Root Orchestrator' as const,
          tool_call: `sse:${ev.name}`,
          summary: `Pipeline step ${ev.name}`,
          request_payload: { step: step },
          response_payload: {},
          status: 'SUCCESS' as const,
        };
        setCurrentCase(prev => ({ ...prev, audit_trail: [...prev.audit_trail, auditEvent] }));
      }
    }, (err) => {
      // handle authentication/authorization failures specially; do not
      // fallback to demo data when these occur.
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Authentication required to view live incident data. Please sign in again.');
          // sign out to force re-auth flow
          auth.signOut();
          return;
        }
        if (err.status === 403) {
          setError('You are not authorized to view this incident.');
          return;
        }
      }
      // Avoid logging entire error objects which might contain sensitive
      // headers or token fragments in some environments. Log a short message
      // and preserve the object only for local developer inspection.
      try {
        // eslint-disable-next-line no-console
        console.warn('SSE error (see devtools for details)', typeof err === 'string' ? err : (err && (err as any).message) || String(err));
      } catch (e) {
        // ignore logging failures
      }
      setStreamState('error');
    });

    setStreamState('connecting');
    // start is now possibly async; call and ignore promise for now
    controller.start().catch((e) => {
      try {
        // keep message short to avoid leaking sensitive details
        // eslint-disable-next-line no-console
        console.warn('Stream failed to start:', (e as any)?.message || String(e));
      } catch (err) {
        // ignore logging errors
      }
      setStreamState('error');
    });

    return () => {
      controller.stop();
      setStreamState('idle');
    };
  }, [currentCase.incident_id, usingMock, error]);

  // Handler: Reset Case
  const handleResetCase = () => {
    handleSelectScenario(activeScenarioId);
  };

  // Handler: Update Simulation Assumptions
  const handleUpdateSimulationParams = (newParams: SimulationParameters) => {
    const updatedResults = calculateDeterministicSimulation(newParams);
    setCurrentCase(prev => ({
      ...prev,
      simulation_params: newParams,
      simulation_results: updatedResults
    }));
  };

  // Handler: Human Approval Decision
  const handleApprovalDecision = async (decision: ApprovalDecision, comment: string) => {
    const timestamp = new Date().toISOString();

    // Local demo behavior preserved when usingMock === true
    if (usingMock) {
      if (decision === 'APPROVED') {
        // preserve existing demo flow (client-side action creation)
        const generatedAction: ActionRecord = {
          action_id: `ACT-${Date.now()}`,
          incident_id: currentCase.incident_id,
          approval_id: `APP-APPROVED-${Date.now()}`,
          task_type: 'NON_DESTRUCTIVE_LASER_RUNOUT_INSPECTION',
          task_number: 'TASK-2026-0922-01',
          assigned_technician: 'D. Miller (Shift B Lead Tech)',
          required_tools: [
            'Optalign Smart RS5 Laser Alignment System',
            'Mitutoyo 0.001mm Magnetic Dial Indicator',
            'Stainless Precision Shim Pack (0.02 - 0.10 mm)',
            'Snap-On Digital Torque Wrench (Calibrated 85 Nm)'
          ],
          status: 'DISPATCHED',
          dispatched_at: timestamp,
          target_component: 'Bearing-B04 & Coupling',
          procedure_checklist: [
            'Perform electrical lockout/tagout (LOTO) on CNC-04 main disconnect.',
            'Mount laser sensor transmitter and prism on spindle shaft coupling.',
            'Clock radial and axial angular runout across 360° rotation.',
            'Adjust housing mounting shims and retorque to OEM 85 Nm spec.'
          ]
        };

        setCurrentCase(prev => ({
          ...prev,
          approval: {
            ...prev.approval,
            decision: 'APPROVED',
            comment,
            timestamp,
            signature_hash: 'SHA256:8f4c2e91a0b3...'
          },
          action: generatedAction,
          // preserve demo audit additions
          audit_trail: [...prev.audit_trail]
        }));

        if (demoStep === 7) setDemoStep(8);
      } else {
        setCurrentCase(prev => ({
          ...prev,
          approval: {
            ...prev.approval,
            decision,
            comment,
            timestamp
          }
        }));
      }

      return;
    }

    // Live path: call server endpoints. Do not fabricate actor identity.
    try {
      // send recommendation from currentCase as-is
      const serverApproval = await postApproval(currentCase.incident_id, { recommendation: currentCase.recommendation, decision, comment });
      // on success, replace approval with server-confirmed record
      setCurrentCase(prev => ({ ...prev, approval: serverApproval }));
    } catch (err: any) {
      // Map ApiError to user-facing states
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Your session has expired. Please sign in again.');
          // sign the user out to force re-auth
          auth.signOut();
          return;
        }
        if (err.status === 403) {
          setError('You are not authorized to approve or execute this action.');
          return;
        }
        if (err.status === 422) {
          setError(err.message || 'Validation failed for the approval request.');
          return;
        }
      }

      // generic network / server error
      setError('Factory WHY could not complete this request.');
    }
  };

  // Handler: Execute Physical Inspection to reveal Ground Truth
  const handleExecuteAction = async () => {
    const timestamp = new Date().toISOString();

    // Guard: only allow execution in live mode when approval is server-confirmed
    if (!usingMock) {
      const approval = currentCase.approval;
      if (!approval || approval.decision !== 'APPROVED' || approval.incident_id !== currentCase.incident_id || approval.recommendation_id !== currentCase.recommendation.recommendation_id) {
        setError('Action locked: approval not confirmed for this incident and recommendation.');
        return;
      }

      try {
        // Call server /actions endpoint
        const resp = await postAction(currentCase.incident_id, { recommendation: currentCase.recommendation, approval_id: approval.approval_id });
        // Update action and outcome from server-confirmed response
        setCurrentCase(prev => ({
          ...prev,
          action: resp.action,
          outcome: resp.outcome,
          // do not fabricate audit events; the server should return authoritative audit which can be fetched separately
        }));
        return;
      } catch (err: any) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setError('Your session has expired. Please sign in again.');
            auth.signOut();
            return;
          }
          if (err.status === 403) {
            setError('You are not authorized to approve or execute this action.');
            return;
          }
          if (err.status === 422) {
            setError(err.message || 'Validation failed for the action request.');
            return;
          }
        }
        setError('Factory WHY could not complete this request.');
        return;
      }
    }

    // Demo/local behavior preserved when usingMock === true
    const outcome = activeScenarioId === 'CNC-04' ? GROUND_TRUTH_OUTCOME_CNC04 : null;

    if (outcome) {
      const outcomeAuditEvent = {
        event_id: `AUD-OUT-${Date.now()}`,
        step_number: currentCase.audit_trail.length + 1,
        timestamp,
        agent_role: 'Root Orchestrator' as const,
        tool_call: 'record_outcome',
        summary: `Physical inspection verified: 0.14mm runout corrected. Vibration dropped to 3.10 mm/s. Prediction matched actual cause 100%.`,
        request_payload: { outcome_id: outcome.outcome_id, incident_id: outcome.incident_id },
        response_payload: { prediction_match: true, top_k_recall: true, score: 100 },
        status: 'SUCCESS' as const
      };

      setCurrentCase(prev => ({
        ...prev,
        action: prev.action ? { ...prev.action, status: 'COMPLETED' } : null,
        outcome,
        asset: {
          ...prev.asset,
          status: 'RESTORED',
          health_score: 98
        },
        audit_trail: [...prev.audit_trail, outcomeAuditEvent]
      }));
    }
  };

  // Handler: Click an evidence ID
  const handleEvidenceClick = (evidenceId: string) => {
    const found = currentCase.evidence.find(e => e.evidence_id === evidenceId);
    if (found) {
      setSelectedEvidence(found);
    }
  };

  // Handler: Jump to target section for demo script
  const handleDemoStepChange = (stepNumber: number) => {
    setDemoStep(stepNumber);
    const beat = DEMO_BEATS[stepNumber - 1];
    if (beat && beat.targetAnchor) {
      const el = document.getElementById(beat.targetAnchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Auto-progress actions on certain beats
    if (stepNumber === 8 && currentCase.approval.decision !== 'APPROVED') {
      handleApprovalDecision('APPROVED', 'Demo Walkthrough: Approved for immediate laser runout diagnostic inspection.');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Auto-play timer for demo script
  useEffect(() => {
    // On first mount, attempt to load primary scenario from API with fallback to mock.
    // Defer loading until auth resolved. If unauthenticated, App will render LoginPage.
    if (!auth.loading && auth.isAuthenticated) {
      loadIncident('INC-2026-0827', true);
    }

    let timer: NodeJS.Timeout;
    if (isDemoPlaying) {
      timer = setTimeout(() => {
        if (demoStep < DEMO_BEATS.length) {
          handleDemoStepChange(demoStep + 1);
        } else {
          setIsDemoPlaying(false);
        }
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isDemoPlaying, demoStep]);

  // Gate: auth-loading -> loading banner, unauthenticated -> LoginPage, authenticated -> app
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div role="status" className="text-center">
          <div className="text-lg font-bold">Checking authentication…</div>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      
      {/* 1. Top Bar */}
      <TopBar
        currentCase={currentCase}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
        onResetCase={handleResetCase}
        onOpenEvaluationSuite={() => setIsEvaluationSuiteOpen(true)}
        demoProgress={demoStep}
        onOpenDemoGuide={() => setIsDemoGuideOpen(!isDemoGuideOpen)}
        isDemoGuideOpen={isDemoGuideOpen}
      />

      {/* 2. Three-Minute Demo Script Bar */}
      {isDemoGuideOpen && (
        <DemoScriptBar
          currentStep={demoStep}
          onSelectStep={handleDemoStepChange}
          isPlaying={isDemoPlaying}
          onTogglePlay={() => setIsDemoPlaying(!isDemoPlaying)}
          onClose={() => setIsDemoGuideOpen(false)}
        />
      )}

      {/* Loading / Error / Mock Fallback Banner - non-modal, accessible */}
      <div aria-live="polite" className="max-w-[1720px] mx-auto px-3 sm:px-5 py-2">
        {loading && (
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded p-2 text-slate-200" role="status">
            <Loader2 className="animate-spin w-5 h-5 text-cyan-400" aria-hidden />
            <div>
              <div className="font-semibold">Loading live incident</div>
              <div className="text-xs text-slate-400">Fetching latest incident data from backend…</div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 bg-amber-900/80 border border-amber-700 rounded p-3 text-amber-50" role="alert">
            <AlertTriangle className="w-5 h-5 text-amber-200 mt-0.5" aria-hidden />
            <div>
              <div className="font-semibold">Live data unavailable</div>
              <div className="text-sm text-amber-100">Could not load the live incident data from the backend. The application is using a local demo scenario instead.</div>
              <div className="text-xs text-amber-100 mt-1">If you expected live data, check network connectivity or backend health.</div>
            </div>
          </div>
        )}

        {!loading && usingMock && !error && (
          <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded p-2 text-slate-200" role="status">
            <Info className="w-5 h-5 text-slate-300" aria-hidden />
            <div className="text-sm">
              <span className="font-medium">Demo data</span>
              <span className="text-slate-400"> — Using the local scenario for offline/demo purposes.</span>
            </div>
          </div>
        )}
      </div>

      {/* Investigation Pipeline Ribbon / Stage Stepper - Reflows smoothly on all widths */}
      <nav 
        aria-label="Investigation Stages Navigation"
        className="bg-slate-900/90 border-b border-slate-800/80 px-3 sm:px-5 py-2 w-full min-w-0"
      >
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-mono min-w-0">
          <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1 shrink-0">Stages:</span>
          
          <button 
            onClick={() => scrollToSection('machine-context')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
            <span>1. Asset Twin</span>
          </button>
          
          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('telemetry')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <Activity className="w-3 h-3 text-rose-400 shrink-0" />
            <span>2. Telemetry (+42%)</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('hypotheses')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <GitCompare className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>3. Hypotheses (WHY)</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('critic')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <Scale className="w-3 h-3 text-amber-400 shrink-0" />
            <span>4. Critic Challenge</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('evidence')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>5. Evidence Stream</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('simulation')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>6. Simulator</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('approval')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
            <span>7. Approval Gate</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('outcome')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <Award className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>8. Outcome</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">/</span>

          <button 
            onClick={() => scrollToSection('audit')}
            className="flex items-center gap-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
          >
            <Terminal className="w-3 h-3 text-slate-400 shrink-0" />
            <span>9. Audit Trail</span>
          </button>
        </div>
      </nav>

      {/* Main Investigation Workspace Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-6 min-w-0">
        
        {/* ======================================================== */}
        {/* STAGE 1: ASSET TWIN & TELEMETRY OBSERVATION               */}
        {/* Balanced 2-Column Responsive Grid                         */}
        {/* ======================================================== */}
        <section aria-label="Machine Context and Telemetry Dynamics" className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column (5 of 12 cols): Machine Context & Component Topology */}
          <div id="machine-context" className="lg:col-span-5 min-w-0">
            <MachineContextPanel
              asset={currentCase.asset}
              selectedComponentId={selectedComponentId}
              onSelectComponent={setSelectedComponentId}
            />
          </div>

          {/* Right Column (7 of 12 cols): Telemetry Dynamics with Anomaly Marker & Scrubbing */}
          <div id="telemetry" className="lg:col-span-7 min-w-0">
            <TelemetryPanel
              summary={currentCase.telemetry_summary}
              timeSeries={currentCase.telemetry_series}
              selectedSensor={selectedComponentId}
            />
          </div>

        </section>

        {/* ======================================================== */}
        {/* STAGE 2: ROOT-CAUSE HYPOTHESES & FALSIFICATION CRITIC    */}
        {/* Balanced 2-Column Responsive Grid                         */}
        {/* ======================================================== */}
        <section aria-label="Hypotheses Formulation and Critic Challenge" className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column (7 of 12 cols): WHY Agent Competing Causes */}
          <div id="hypotheses" className="lg:col-span-7 min-w-0">
            <HypothesisCards
              hypotheses={currentCase.hypotheses}
              selectedHypothesisId={selectedHypothesisId}
              onSelectHypothesis={setSelectedHypothesisId}
              onEvidenceClick={handleEvidenceClick}
              onChallengeClick={() => scrollToSection('critic')}
            />
          </div>

          {/* Right Column (5 of 12 cols): Critic Agent ("What would prove this wrong?") */}
          <div id="critic" className="lg:col-span-5 min-w-0">
            <CriticSection
              criticFinding={currentCase.critic_finding}
              leadingHypothesisTitle={currentCase.hypotheses[0]?.title || 'Bearing Misalignment'}
              onEvidenceClick={handleEvidenceClick}
              onChallengeComplete={() => scrollToSection('simulation')}
            />
          </div>

        </section>

        {/* ======================================================== */}
        {/* STAGE 3: AUDITABLE EVIDENCE STREAM                       */}
        {/* Full-Width Section                                       */}
        {/* ======================================================== */}
        <section id="evidence" aria-label="Auditable Evidence Stream" className="w-full min-w-0">
          <EvidenceTimeline
            evidenceList={currentCase.evidence}
            selectedEvidenceId={selectedEvidence?.evidence_id || null}
            onSelectEvidence={setSelectedEvidence}
            filteredComponentId={selectedComponentId}
          />
        </section>

        {/* ======================================================== */}
        {/* STAGE 4: DETERMINISTIC DECISION SIMULATOR                */}
        {/* Full-Width Section (NO NARROW COLLAPSED COLUMNS!)        */}
        {/* ======================================================== */}
        <section aria-label="Deterministic Decision Simulator" className="w-full min-w-0">
          <SimulationPanel
            simulationResults={currentCase.simulation_results}
            currentParams={currentCase.simulation_params}
            onUpdateParams={handleUpdateSimulationParams}
            selectedOption={selectedSimulationOption}
            onSelectOption={setSelectedSimulationOption}
          />
        </section>

        {/* ======================================================== */}
        {/* STAGE 5: RECOMMENDATION, APPROVAL & CONTROLLED ACTION    */}
        {/* Balanced 2-Column Responsive Grid                         */}
        {/* ======================================================== */}
        <section aria-label="Decision Recommendation and Human Approval Gate" className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column (6 of 12 cols): Synthesized Recommendation */}
          <div id="recommendation" className="lg:col-span-6 min-w-0">
            <RecommendationPanel
              recommendation={currentCase.recommendation}
              onEvidenceClick={handleEvidenceClick}
            />
          </div>

          {/* Right Column (6 of 12 cols): Human Gate, Action Dispatch & Ground Truth */}
          <div className="lg:col-span-6 space-y-4 min-w-0">
            
            {/* Human Approval Gate */}
            <div id="approval">
              <ApprovalPanel
                approval={currentCase.approval}
                onDecision={handleApprovalDecision}
                onChallengeClick={() => scrollToSection('critic')}
              />
            </div>

            {/* Simulated Action Dispatch */}
            <div id="simulated-action">
              <SimulatedActionPanel
                action={currentCase.action}
                approval={currentCase.approval}
                onExecuteAction={handleExecuteAction}
                isOutcomeRevealed={!!currentCase.outcome}
              />
            </div>

            {/* Ground Truth Outcome Verification */}
            <div id="outcome">
              <OutcomePanel outcome={currentCase.outcome} />
            </div>

          </div>

        </section>

        {/* ======================================================== */}
        {/* STAGE 6: FULL-WIDTH ADK AGENT TOOL AUDIT TRAIL           */}
        {/* Complete End-to-End Traceability                          */}
        {/* ======================================================== */}
        <section id="audit" aria-label="Agent Tool Execution Audit Trail" className="w-full pt-2 min-w-0">
          <AuditPanel auditTrail={currentCase.audit_trail} />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>FACTORY WHY · Industrial Diagnostics & Root-Cause Workspace</span>
          </div>
          <div>
            <span>Google ADK + Gemini Architecture Reference</span>
          </div>
        </div>
      </footer>

      {/* Evidence Provenance Inspector Modal */}
      {selectedEvidence && (
        <EvidenceProvenanceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}

      {/* AI Builder Cup Evaluation Scorecard Modal */}
      <EvaluationSuiteModal
        isOpen={isEvaluationSuiteOpen}
        onClose={() => setIsEvaluationSuiteOpen(false)}
        onSelectScenario={handleSelectScenario}
      />

    </div>
  );
}
