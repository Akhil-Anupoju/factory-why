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
  ChevronRight
} from 'lucide-react';

export default function App() {
  // Active Scenario & Case State
  const [activeScenarioId, setActiveScenarioId] = useState<string>('CNC-04');
  const [currentCase, setCurrentCase] = useState<InvestigationCase>(PRIMARY_SCENARIO_CNC04);

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
    if (id === 'CNC-04') {
      setCurrentCase(JSON.parse(JSON.stringify(PRIMARY_SCENARIO_CNC04)));
    } else {
      setCurrentCase(JSON.parse(JSON.stringify(SCENARIO_LUBRICATION)));
    }
    setSelectedComponentId(null);
    setDemoStep(1);
  };

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
  const handleApprovalDecision = (decision: ApprovalDecision, comment: string) => {
    const timestamp = new Date().toISOString();
    
    if (decision === 'APPROVED') {
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

      const approvalAuditEvent = {
        event_id: `AUD-APP-${Date.now()}`,
        step_number: currentCase.audit_trail.length + 1,
        timestamp,
        agent_role: 'Human Engineer' as const,
        tool_call: 'approve_recommendation',
        summary: `Engineer Akhil Anupoju formally approved inspection action. Note: "${comment}"`,
        request_payload: { decision: 'APPROVED', comment, authenticated_user: 'Akhil Anupoju' },
        response_payload: { approval_status: 'AUTHORIZED', authorized_at: timestamp },
        status: 'SUCCESS' as const
      };

      const actionAuditEvent = {
        event_id: `AUD-ACT-${Date.now()}`,
        step_number: currentCase.audit_trail.length + 2,
        timestamp,
        agent_role: 'Action Agent' as const,
        tool_call: 'create_maintenance_task',
        summary: `Action Agent generated work order task TASK-2026-0922-01 and dispatched to maintenance cart.`,
        request_payload: { task_number: 'TASK-2026-0922-01', target_component: 'Bearing-B04' },
        response_payload: { status: 'DISPATCHED', assigned_tech: 'D. Miller' },
        status: 'SUCCESS' as const
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
        audit_trail: [...prev.audit_trail, approvalAuditEvent, actionAuditEvent]
      }));

      // If in demo mode, advance step
      if (demoStep === 7) {
        setDemoStep(8);
      }
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
  };

  // Handler: Execute Physical Inspection to reveal Ground Truth
  const handleExecuteAction = () => {
    const timestamp = new Date().toISOString();
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
