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
import { StageSection, StageStatus } from './components/StageSection';
import { SituationBrief } from './components/SituationBrief';

import { 
  PRIMARY_SCENARIO_CNC04, 
  SCENARIO_LUBRICATION, 
  GROUND_TRUTH_OUTCOME_CNC04, 
  calculateDeterministicSimulation, 
  DEFAULT_SIMULATION_PARAMS 
} from './data/mockScenarios';
import { fetchIncident, postApproval, postAction, fetchOutcome, postChallenge } from './api/incidentApi';
import { ApiError } from './api/apiClient';
import { useAuth } from './auth/AuthContext';
import { approvalDecisionLabel } from './approvalDecisionLabel';
import { investigationNextStep } from './investigationNextStep';
import LoginPage from './pages/LoginPage';
import { applyTheme, readStoredTheme, saveTheme, type Theme } from './theme';
import createInvestigationStream from './api/streamApi';
import { 
  InvestigationCase, 
  EvidenceItem, 
  ApprovalDecision, 
  SimulationParameters, 
  ActionRecord,
  OutcomeRecord,
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
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);
  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  // Read frontend runtime mode from VITE_RUNTIME_MODE. If set to one of
  // CLOUD/LIVE/PRODUCTION then demo/mock fallbacks are disallowed.
  // Default (unset or LOCAL/DEMO) preserves existing developer-friendly behavior.
  const getFrontendRuntimeMode = (): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (import.meta as any).env?.VITE_RUNTIME_MODE || '';
    return String(v).toUpperCase();
  };

  const isLiveRuntime = (): boolean => {
    const mode = getFrontendRuntimeMode();
    return ['CLOUD', 'LIVE', 'PRODUCTION'].includes(mode);
  };

  // Active Scenario & Case State
  const [activeScenarioId, setActiveScenarioId] = useState<string>('CNC-04');
  const [currentCase, setCurrentCase] = useState<InvestigationCase>(PRIMARY_SCENARIO_CNC04);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState<boolean>(false);
  const [streamState, setStreamState] = useState<'idle' | 'connecting' | 'running' | 'awaiting_approval' | 'completed' | 'error'>('idle');
  // True only while a REAL live Gemini/Vertex AI call is in flight (the
  // Challenge AI action). This is the one user-triggered action that
  // actually invokes the Google ADK RootOrchestrator (Evidence -> WHY ->
  // Critic -> targeted retrieval -> revised WHY) against live Vertex AI —
  // it typically takes 30-120 seconds, so we must show explicit progress
  // rather than let the UI appear frozen/static.
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState<boolean>(false);
  const auth = useAuth();
  const useClientDemoActions = usingMock || (!isLiveRuntime() && auth.isLocalDemoUser);
  const nextInvestigationStep = investigationNextStep(currentCase);

  // TopBar now consumes Auth context directly — no DOM wiring required here.

  // UI Selection states
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>('HYP-01');
  const [selectedSimulationOption, setSelectedSimulationOption] = useState<string>('INSPECT');
  const [isEvaluationSuiteOpen, setIsEvaluationSuiteOpen] = useState<boolean>(false);

  // Show the machine and leading explanations first. Supporting detail stays
  // one click away so the initial workspace is readable without a long scroll.
  // The human decision stages still follow real approval and outcome state.
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    asset: true,
    why: true,
    critic: false,
    evidence: false,
    simulate: false,
    approve: true,
    outcome: false,
    audit: false,
  });
  const toggleStage = (id: string) => setExpandedStages(prev => ({ ...prev, [id]: !prev[id] }));

  // 3-Minute Demo Script Guide State
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(1);
  const [isDemoPlaying, setIsDemoPlaying] = useState<boolean>(false);

  // Handler: Select Scenario
  const handleSelectScenario = (id: string) => {
    setActiveScenarioId(id);
    // Reset error/loading first
    setError(null);
    if (id === 'CNC-04') {
      // try API first. Only allow demo fallback when runtime is explicitly non-live.
      const fallback = !isLiveRuntime();
      loadIncident('INC-2026-0827', fallback);
    } else {
      setCurrentCase(JSON.parse(JSON.stringify(SCENARIO_LUBRICATION)));
      setUsingMock(true);
    }
    setSelectedComponentId(null);
    setDemoStep(1);
  };

  // Load incident from API. If fallbackToMock is true, show error but load mock on failure.
  // Load incident from API. In LIVE/CLOUD runtime the application must
  // never fall back to fixture data. The `fallbackToMock` parameter is
  // allowed for explicit DEMO flows and tests only.
  const loadIncident = async (incidentId: string, fallbackToMock = false) => {
    setLoading(true);
    setError(null);
    // A local account is a demo identity, not a Firebase identity. Keep its
    // entire investigation on sample data so server evidence cannot be mixed
    // with browser-only approvals or actions.
    if (auth.isLocalDemoUser && !isLiveRuntime()) {
      setCurrentCase(JSON.parse(JSON.stringify(PRIMARY_SCENARIO_CNC04)));
      setUsingMock(true);
      setStreamState('idle');
      setLoading(false);
      return;
    }
    // Ensure we start each load assuming live data (no demo)
    setUsingMock(false);
    try {
      const ic = await fetchIncident(incidentId);
      // Successful live API load: explicitly mark runtime as live (no mock)
      setCurrentCase(ic);
      setUsingMock(false);
    } catch (err: any) {
      // If this is an authentication failure, attempt a single forced
      // token refresh before marking the app as errored. This helps when
      // the user's ID token expired between page load and this request.
      // Do not retry more than once.
      let retried = false;
      if (err instanceof ApiError && err.status === 401) {
        try {
          const refreshed = await auth.getIdToken?.(true);
          retried = true;
          if (refreshed) {
            // try fetching once more with refreshed token
            const ic2 = await fetchIncident(incidentId);
            setCurrentCase(ic2);
            setUsingMock(false);
            setLoading(false);
            return;
          }
        } catch (e) {
          // ignore refresh errors and fall through to normal error handling
        }
      }
      // visible error state — do not treat authentication/authorization errors
      // as recoverable by falling back to demo data. Only network/back-end
      // availability errors should allow the explicit demo fallback.
      const msg = err?.message || String(err);
      // If fallback is explicitly requested (demo/test mode) and this is
      // not an auth error, allow demo data. Otherwise surface the runtime
      // error so operators can see live API failures. In particular, when
      // running in LIVE/CLOUD mode the app must not silently masquerade as
      // live by loading fixture data.
      // In live/cloud runtimes (VITE_RUNTIME_MODE=LIVE/CLOUD/PRODUCTION),
      // do NOT fall back to fixture/demo data on API failures. Instead
      // surface the error and keep the UI in an explicit error state so
      // operators can see the backend problem. Demo fixtures are allowed
      // only when the caller explicitly requests fallbackToMock=true and
      // the frontend is NOT configured as a live runtime.
      const live = isLiveRuntime();
      if (!live && fallbackToMock && !(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        // demo/test explicit fallback for non-live runtimes
        setCurrentCase(JSON.parse(JSON.stringify(PRIMARY_SCENARIO_CNC04)));
        setUsingMock(true);
        // clear the visible error so the UI shows the demo banner instead
        setError(null);
        // if using mock data, ensure stream is stopped
        setStreamState('idle');
      } else {
        // In live mode or when fallback not allowed: surface error
        // If we already retried a forced token refresh above, preserve the
        // original error message so operators can inspect it.
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // SSE: start/stop investigation stream when using live data
  useEffect(() => {
    // only start stream when not using mock, authenticated, and no visible error
    if (usingMock || error || !auth.isAuthenticated) {
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
        // Defensive: ensure audit_trail exists and is an array before appending
        setCurrentCase(prev => {
          const safeAudit = Array.isArray(prev.audit_trail) ? prev.audit_trail : [];
          const auditEvent = {
            event_id: `AUD-SSE-${Date.now()}`,
            step_number: safeAudit.length + 1,
            timestamp: new Date().toISOString(),
            agent_role: 'Root Orchestrator' as const,
            tool_call: `sse:${ev.name}`,
            summary: `Pipeline step ${ev.name}`,
            request_payload: { step: step },
            response_payload: {},
            status: 'SUCCESS' as const,
          };
          return { ...prev, audit_trail: [...safeAudit, auditEvent] };
        });
      }
    }, (err) => {
      // The SSE pipeline-animation stream is a BACKGROUND, non-critical
      // visual aid. A failure here must never log the user out of the
      // whole application — only the stream itself should stop, with a
      // passive, dismissible notice. Approve/Challenge/Action flows have
      // their own independent, correctly-scoped 401 handling and remain
      // fully usable even if this stream is down.
      if (err instanceof ApiError) {
        if (err.status === 401) {
          try {
            controller.stop();
          } catch (e) {
            // ignore
          }

          (async () => {
            try {
              const refreshed = await auth.getIdToken?.(true);
              if (refreshed) {
                // Token was refreshable — the user's session is fine.
                // Restart the stream explicitly (the dependency array
                // alone will not do this since incident_id is unchanged).
                setStreamState('idle');
                setError(null);
                return;
              }
            } catch (e) {
              // ignore refresh failures
            }

            // Refresh failed: the background stream cannot authenticate,
            // but we deliberately do NOT sign the user out for a passive
            // telemetry animation failure. Surface a small, non-blocking
            // notice instead; Approve/Challenge actions remain available
            // and will independently prompt re-auth if truly needed.
            // eslint-disable-next-line no-console
            console.warn('[SSE] stream authentication failed after refresh attempt; stream stopped (session not affected)');
            setStreamState('error');
          })();
          return;
        }
        if (err.status === 403) {
          setStreamState('error');
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
  }, [currentCase.incident_id, usingMock, error, auth.isAuthenticated]);

  // Auto-manage the two human-decision stages: once the engineer approves,
  // collapse the (now resolved) approval stage and bring Outcome into
  // focus; once outcome data arrives, keep it visible. This reflects real
  // state transitions only — never a fabricated/staged reveal.
  useEffect(() => {
    if (currentCase.approval?.decision === 'APPROVED') {
      setExpandedStages(prev => ({ ...prev, approve: false, outcome: true }));
    }
  }, [currentCase.approval?.decision]);

  useEffect(() => {
    if (currentCase.outcome) {
      setExpandedStages(prev => ({ ...prev, outcome: true }));
    }
  }, [currentCase.outcome]);

  const focusStage = (id: string, anchorId: string) => {
    setExpandedStages(prev => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => scrollToSection(anchorId));
  };

  // Derive stage status (completed/current/pending/locked) from real
  // runtime state only — no fabricated progress.
  const stageStatus = (id: string): StageStatus => {
    const hasData = !loading && !error;
    const approvalDecision = currentCase.approval?.decision;
    switch (id) {
      case 'asset':
        return hasData ? 'completed' : 'pending';
      case 'why':
        return (currentCase.hypotheses?.length || 0) > 0 ? 'completed' : 'pending';
      case 'critic':
        return currentCase.critic_finding ? 'completed' : 'pending';
      case 'evidence':
        return (currentCase.evidence?.length || 0) > 0 ? 'completed' : 'pending';
      case 'simulate':
        return currentCase.recommendation ? 'completed' : 'pending';
      case 'approve':
        if (!currentCase.recommendation) return 'locked';
        if (approvalDecision === 'APPROVED' || approvalDecision === 'REJECTED') return 'completed';
        return 'current';
      case 'outcome':
        if (currentCase.outcome) return 'completed';
        if (approvalDecision === 'APPROVED') return 'current';
        return 'locked';
      case 'audit':
        return (currentCase.audit_trail?.length || 0) > 0 ? 'completed' : 'pending';
      default:
        return 'pending';
    }
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
  const handleApprovalDecision = async (decision: ApprovalDecision, comment: string) => {
    setError(null);
    const timestamp = new Date().toISOString();

    if (decision === 'CHALLENGE' && useClientDemoActions) {
      // Sample Critic findings are already present. Never imply that a local
      // demo account triggered a live ADK challenge or an approval decision.
      focusStage('critic', 'critic');
      return;
    }

    // Demo investigations contain sample evidence and browser-only decisions.
    // No local decision is sent to an approval or action endpoint.
    if (useClientDemoActions) {
      if (decision === 'APPROVED') {
        // preserve existing demo flow (client-side action creation)
        const demoApprovalId = `DEMO-APPROVED-${Date.now()}`;
        const generatedAction: ActionRecord = {
          action_id: `DEMO-ACT-${Date.now()}`,
          incident_id: currentCase.incident_id,
          approval_id: demoApprovalId,
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
            approval_id: demoApprovalId,
            decision: 'APPROVED',
            comment,
            timestamp,
            engineer_name: auth.user?.displayName || 'Local demo operator',
            engineer_role: 'Demo operator',
            signature_hash: ''
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
      // Map client decision aliases to backend canonical values when needed.
      let backendDecision = decision;
      if (decision === 'REQUEST_MORE_EVIDENCE') backendDecision = 'MORE_EVIDENCE_REQUESTED';

      // Special-case CHALLENGE: call the dedicated challenge endpoint instead
      // of using the approval API. The challenge returns a CriticFinding which
      // we store on the case for UI consumption.
      if (backendDecision === 'CHALLENGE' || decision === 'CHALLENGE') {
        setIsLiveAnalyzing(true);
        try {
          const crit = await postChallenge(currentCase.incident_id, { recommendation: currentCase.recommendation });
          setCurrentCase(prev => ({ ...prev, critic_finding: crit }));
          // Re-fetch the full incident so the UI picks up any revised
          // hypotheses the live pipeline persisted (WHY may have been
          // re-run as part of the bounded targeted-retrieval loop).
          try {
            const refreshed = await fetchIncident(currentCase.incident_id);
            setCurrentCase(prev => ({ ...prev, ...(refreshed as any), critic_finding: crit }));
          } catch (e) {
            // non-fatal: critic_finding is already applied above
          }
        } finally {
          setIsLiveAnalyzing(false);
        }
        return;
      }

      // send recommendation from currentCase as-is
      const serverApproval = await postApproval(currentCase.incident_id, { recommendation: currentCase.recommendation, decision: backendDecision, comment });
      // on success, try to refresh the full incident from the API so we pick up
      // any server-side audit or state changes; fall back to replacing only
      // the approval record when fetch fails.
      try {
        const refreshed = await fetchIncident(currentCase.incident_id);
        // Merge server-confirmed approval into the refreshed incident to
        // avoid cases where a subsequent fetch returns stale fixture data
        // that would overwrite the just-applied approval. Prefer the
        // serverApproval for the approval field (server is authoritative).
        // Also, avoid regressing the audit_trail if the refreshed payload
        // appears to have fewer entries than our current UI state.
        setCurrentCase(prev => {
          const safePrevAudit = Array.isArray(prev.audit_trail) ? prev.audit_trail : [];
          const safeRefreshedAudit = Array.isArray((refreshed as any).audit_trail) ? (refreshed as any).audit_trail : [];
          const mergedAudit = safeRefreshedAudit.length >= safePrevAudit.length ? safeRefreshedAudit : safePrevAudit;
          return { ...(refreshed as any), approval: serverApproval, audit_trail: mergedAudit } as any;
        });
        setUsingMock(false);
      } catch (e) {
        // If refresh fails, at least apply the server-confirmed approval so
        // the UI reflects the authoritative state immediately.
        setCurrentCase(prev => ({ ...prev, approval: serverApproval }));
      }
    } catch (err: any) {
      // Map ApiError to user-facing states
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('The backend could not verify your Firebase sign-in. Please retry or sign in again.');
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
        if (err.status === 502) {
          setError('Live AI analysis is temporarily unavailable (Gemini/Vertex AI call failed). No fabricated result was shown.');
          return;
        }
        if (err.status === 409) {
          // A decision was already finalized (e.g. double-click, or a stale
          // UI state from another tab/session). Refresh from the server so
          // the UI reflects the authoritative state instead of looking
          // "broken".
          setError(null);
          try {
            const refreshed = await fetchIncident(currentCase.incident_id);
            setCurrentCase(prev => ({ ...prev, ...(refreshed as any) }));
          } catch (e) {
            // ignore; next load will pick it up
          }
          return;
        }
      }

      // generic network / server error
      setError('Factory WHY could not complete this request.');
    }
  };

  // Handler: Execute Physical Inspection to reveal Ground Truth
  const handleExecuteAction = async () => {
    setError(null);
    const timestamp = new Date().toISOString();

    // Server execution requires a server-confirmed approval and Firebase auth.
    if (!useClientDemoActions) {
      const approval = currentCase.approval;
      if (!approval || approval.decision !== 'APPROVED' || approval.incident_id !== currentCase.incident_id || approval.recommendation_id !== currentCase.recommendation.recommendation_id) {
        setError('Action locked: approval not confirmed for this incident and recommendation.');
        return;
      }

      try {
        // Call server /actions endpoint
        const resp = await postAction(currentCase.incident_id, { recommendation: currentCase.recommendation, approval_id: approval.approval_id });
        // Update action and outcome from server-confirmed response
        // Update action and outcome from server-confirmed response. If the server
        // response lacks authoritative outcome or audit, fetch them explicitly
        // to maintain authoritative state.
        let finalOutcome: OutcomeRecord | null = resp.outcome || null;
        try {
          if (!finalOutcome) {
            const fetched = await fetchOutcome(currentCase.incident_id);
            finalOutcome = fetched || null;
          }
        } catch (e) {
          // If fetching outcome fails, do not block updating action; surface generic error below if needed
        }

        setCurrentCase(prev => ({
          ...prev,
          action: resp.action,
          outcome: finalOutcome,
          // do not fabricate audit events; the server should return authoritative audit which can be fetched separately
        }));
        return;
      } catch (err: any) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setError('The backend could not verify your Firebase sign-in. Please retry or sign in again.');
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

    // Complete the browser-only demo action.
    const outcome = activeScenarioId === 'CNC-04' ? GROUND_TRUTH_OUTCOME_CNC04 : null;

    if (outcome) {
      // Defensive: ensure audit_trail exists before appending
      setCurrentCase(prev => {
        const safeAudit = Array.isArray(prev.audit_trail) ? prev.audit_trail : [];
        const outcomeAuditEvent = {
          event_id: `AUD-OUT-${Date.now()}`,
          step_number: safeAudit.length + 1,
          timestamp,
          agent_role: 'Root Orchestrator' as const,
          tool_call: 'record_outcome',
          summary: `Physical inspection verified: 0.14mm runout corrected. Vibration dropped to 3.10 mm/s. Prediction matched actual cause 100%.`,
          request_payload: { outcome_id: outcome.outcome_id, incident_id: outcome.incident_id },
          response_payload: { prediction_match: true, top_k_recall: true, score: 100 },
          status: 'SUCCESS' as const
        };

        return {
          ...prev,
          action: prev.action ? { ...prev.action, status: 'COMPLETED' } : null,
          outcome,
          asset: {
            ...prev.asset,
            status: 'RESTORED',
            health_score: 98
          },
          audit_trail: [...safeAudit, outcomeAuditEvent]
        };
      });
    }
  };

  // Handler: Click an evidence ID
  const handleEvidenceClick = (evidenceId: string) => {
    const safeEvidence = Array.isArray(currentCase.evidence) ? currentCase.evidence : [];
    const found = safeEvidence.find(e => e.evidence_id === evidenceId);
    if (found) {
      setSelectedEvidence(found);
    }
  };

  // Handler: Jump to target section for demo script
  const handleDemoStepChange = (stepNumber: number) => {
    setDemoStep(stepNumber);
    const beat = DEMO_BEATS[stepNumber - 1];
    if (beat && beat.targetAnchor) {
      const stageForAnchor: Record<string, string> = {
        'machine-context': 'asset', telemetry: 'asset', evidence: 'evidence',
        hypotheses: 'why', critic: 'critic', simulation: 'simulate', approval: 'approve',
      };
      const stage = stageForAnchor[beat.targetAnchor];
      if (stage) setExpandedStages(prev => ({ ...prev, [stage]: true }));
      requestAnimationFrame(() => scrollToSection(beat.targetAnchor));
    }

    // Auto-progress actions on certain beats
    const safeApproval = currentCase?.approval || ({} as any);
    if (useClientDemoActions && stepNumber === 8 && safeApproval.decision !== 'APPROVED') {
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
      // Determine fallback behavior explicitly: only allow demo fallback when
      // the frontend runtime mode is explicitly non-live. If VITE_RUNTIME_MODE
      // is unset, do NOT silently treat the app as demo — disable fallback.
      const mode = getFrontendRuntimeMode();
      if (!mode) {
        // Runtime not configured explicitly — disable demo fallback for safety.
        // eslint-disable-next-line no-console
        console.warn('VITE_RUNTIME_MODE not set. Demo fallback disabled.');
      }
      const fallback = mode ? !isLiveRuntime() : false;
      loadIncident('INC-2026-0827', fallback);
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
  }, [isDemoPlaying, demoStep, auth.loading, auth.isAuthenticated, auth.isLocalDemoUser]);

  // Gate: auth-loading -> loading banner, unauthenticated -> LoginPage, authenticated -> app
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div role="status" className="text-center">
          <div className="text-lg font-bold">Checking authentication…</div>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (auth.isLocalDemoUser && !isLiveRuntime() && !usingMock) {
    return <div className="fw-app min-h-screen flex items-center justify-center text-slate-700" role="status">Preparing the demo investigation…</div>;
  }

  return (
    <div className="fw-app min-h-screen text-slate-900 flex flex-col font-sans selection:bg-teal-500/25 selection:text-teal-950 overflow-x-hidden">
      
      {/* 1. Top Bar */}
      <TopBar
        currentCase={currentCase}
        activeScenarioId={activeScenarioId}
        demoMode={useClientDemoActions}
        onSelectScenario={handleSelectScenario}
        onResetCase={handleResetCase}
        onOpenEvaluationSuite={() => setIsEvaluationSuiteOpen(true)}
        demoProgress={demoStep}
        onOpenDemoGuide={() => setIsDemoGuideOpen(!isDemoGuideOpen)}
        isDemoGuideOpen={isDemoGuideOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
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
      <div aria-live="polite" className="max-w-[1480px] w-full mx-auto px-4 sm:px-7 py-2">
        {isLiveAnalyzing && (
          <div className="flex items-center gap-3 bg-cyan-50/70 border border-cyan-300/60 rounded p-3 text-cyan-950 mb-2" role="status">
            <Loader2 className="animate-spin w-5 h-5 text-cyan-700 shrink-0" aria-hidden />
            <div>
              <div className="font-semibold">Gemini is checking the leading theory</div>
              <div className="text-xs text-cyan-800">
                It is reviewing evidence and looking for contradictions. This live check can take 30–120 seconds.
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 bg-slate-100/80 border border-slate-200 rounded p-2 text-slate-800" role="status">
            <Loader2 className="animate-spin w-5 h-5 text-cyan-600" aria-hidden />
            <div>
              <div className="font-semibold">Loading live incident</div>
              <div className="text-xs text-slate-600">Fetching the latest incident data…</div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 bg-amber-100/80 border border-amber-300 rounded p-3 text-amber-950" role="alert">
            <AlertTriangle className="w-5 h-5 text-amber-800 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Request needs attention</div>
              {usingMock ? (
                <div className="text-sm text-amber-900">Could not load the live incident data from the backend. The application is using a local demo scenario instead.</div>
              ) : (
                <div className="text-sm text-amber-900">
                  {error}
                </div>
              )}
            </div>
            {!usingMock && (
              <button
                onClick={() => loadIncident(currentCase.incident_id, false)}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded bg-amber-300 hover:bg-amber-400 text-slate-900 border border-amber-500/60"
              >
                Reload incident
              </button>
            )}
          </div>
        )}

        {!loading && useClientDemoActions && !error && (
          <div className="fw-demo-notice flex items-start gap-3 rounded p-3" role="status">
            <Info className="w-5 h-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <strong className="block">Demo-only investigation</strong>
              <span>All evidence shown here is sample data. Decisions and actions stay in this browser; local approval is never server authorization or a real dispatch. Sign in with Google or GitHub and load the live incident for server-backed decisions.</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Investigation Workspace Area */}
      <main className="fw-workspace flex-1 max-w-[1480px] w-full mx-auto px-4 sm:px-7 py-6 sm:py-9 space-y-7 min-w-0">

        {/* Executive Situation Brief — 5-10 second summary synthesized from live data */}
        <SituationBrief
          currentCase={currentCase}
          demoMode={useClientDemoActions}
          onNextStep={() => focusStage(nextInvestigationStep.stage, nextInvestigationStep.anchor)}
        />

        <div className="fw-workflow-overview">
          <div className="fw-workflow-intro">
            <h2>Follow the investigation</h2>
            <p>Start with what changed, test the likely cause, choose a response, and see what happened.</p>
          </div>
          <nav aria-label="Investigation workflow" className="fw-workflow-grid grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {([
              { number: '01', label: 'Observe', detail: 'What changed?', stage: 'asset', anchor: 'machine-context' },
              { number: '02', label: 'Explain', detail: 'Why might it have happened?', stage: 'why', anchor: 'hypotheses' },
              { number: '03', label: 'Decide', detail: 'What should we do?', stage: 'simulate', anchor: 'simulation' },
              { number: '04', label: 'Record', detail: 'What happened next?', stage: 'outcome', anchor: 'outcome' },
            ] as const).map((phase) => (
              <button key={phase.number} type="button" onClick={() => focusStage(phase.stage, phase.anchor)} className="fw-workflow-step text-left">
                <span className="fw-workflow-number">{phase.number}</span>
                <span className="fw-workflow-copy"><strong>{phase.label}</strong><small>{phase.detail}</small></span>
                <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </nav>
        </div>

        <div className="fw-phase-heading fw-phase-heading--observe"><span>01 / OBSERVE</span><p>Understand the machine and trace every signal to its source.</p></div>
        <StageSection
          id="machine-context" index={1} title="Asset & signals" status={stageStatus('asset')}
          phase="observe"
          guide={{ meaning: 'See which part of the machine needs attention and how its signals compare with normal operation.', explore: 'Select a component to focus the evidence, then drag the timeline to inspect changes over time.' }}
          summary={`${currentCase.asset.name} · Health ${currentCase.asset.health_score}%`}
          expanded={expandedStages.asset} onToggle={() => toggleStage('asset')}
        >
          <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 min-w-0">
              <MachineContextPanel
                asset={currentCase.asset}
                signals={currentCase.telemetry_summary}
                selectedComponentId={selectedComponentId}
                onSelectComponent={setSelectedComponentId}
              />
            </div>
            <div id="telemetry" className="lg:col-span-7 min-w-0">
              <TelemetryPanel
                summary={currentCase.telemetry_summary}
                timeSeries={currentCase.telemetry_series}
                selectedSensor={selectedComponentId}
              />
            </div>
          </div>
        </StageSection>

        <StageSection
          id="evidence" index={2} title="Evidence & provenance" status={stageStatus('evidence')}
          phase="observe"
          guide={{ meaning: 'These are observed records. Each item shows where the information came from.', explore: 'Filter by source and open an evidence item to inspect its provenance.' }}
          summary={`${currentCase.evidence?.length || 0} records`}
          expanded={expandedStages.evidence} onToggle={() => toggleStage('evidence')}
        >
          <EvidenceTimeline
            evidenceList={currentCase.evidence}
            selectedEvidenceId={selectedEvidence?.evidence_id || null}
            onSelectEvidence={setSelectedEvidence}
            filteredComponentId={selectedComponentId}
          />
        </StageSection>

        <div className="fw-phase-heading fw-phase-heading--explain"><span>02 / EXPLAIN</span><p>Compare possible causes, then challenge the leading theory.</p></div>
        <StageSection
          id="hypotheses" index={3} title="Competing explanations" status={stageStatus('why')}
          phase="explain"
          guide={{ meaning: 'Possible causes are ranked as interpretations of the evidence, with support and contradictions shown separately.', explore: 'Compare confidence and evidence links, then challenge the leading explanation.' }}
          summary={(() => {
            const lead = [...(currentCase.hypotheses || [])].sort((a, b) => a.likelihood_rank - b.likelihood_rank)[0];
            return lead ? `${lead.title} · ${Math.round(lead.confidence * 100)}%` : 'No hypotheses yet';
          })()}
          expanded={expandedStages.why} onToggle={() => toggleStage('why')}
        >
          <HypothesisCards
            hypotheses={currentCase.hypotheses}
            selectedHypothesisId={selectedHypothesisId}
            onSelectHypothesis={setSelectedHypothesisId}
            onEvidenceClick={handleEvidenceClick}
            onChallengeClick={() => focusStage('critic', 'critic')}
          />
        </StageSection>

        <StageSection
          id="critic" index={4} title="Challenge the lead" status={stageStatus('critic')}
          phase="explain"
          guide={{ meaning: 'A strong explanation should survive a search for conflicting facts and missing checks.', explore: 'Review contradictions and the proposed physical check before deciding.' }}
          summary={currentCase.critic_finding?.falsification_condition || 'No critique yet'}
          expanded={expandedStages.critic} onToggle={() => toggleStage('critic')}
        >
          <CriticSection
            criticFinding={currentCase.critic_finding}
            leadingHypothesisTitle={currentCase.hypotheses[0]?.title || 'Bearing Misalignment'}
            onEvidenceClick={handleEvidenceClick}
            onChallenge={() => handleApprovalDecision('CHALLENGE', 'Challenge the leading hypothesis with the live Critic.')}
            challengeAvailable={!useClientDemoActions && !auth.isLocalDemoUser}
            isChallenging={isLiveAnalyzing}
            onChallengeComplete={() => focusStage('simulate', 'simulation')}
          />
        </StageSection>

        <div className="fw-phase-heading fw-phase-heading--decide"><span>03 / DECIDE</span><p>Compare the trade-offs before a person authorizes the next step.</p></div>
        <StageSection
          id="simulation" index={5} title="Compare options" status={stageStatus('simulate')}
          phase="decide"
          guide={{ meaning: 'The options show modeled trade-offs in downtime, risk, uncertainty, and cost.', explore: 'Adjust assumptions to see how the comparison changes; this does not approve an action.' }}
          summary={currentCase.simulation_results?.find(r => r.recommended)?.title || currentCase.recommendation?.next_step || 'Not yet run'}
          expanded={expandedStages.simulate} onToggle={() => toggleStage('simulate')}
        >
          <SimulationPanel
            simulationResults={currentCase.simulation_results}
            currentParams={currentCase.simulation_params}
            onUpdateParams={handleUpdateSimulationParams}
            selectedOption={selectedSimulationOption}
            onSelectOption={setSelectedSimulationOption}
          />
        </StageSection>

        <StageSection
          id="approval" index={6} title="Human approval" status={stageStatus('approve')}
          phase="decide"
          guide={{ meaning: 'The recommendation is a proposal. A person makes the final decision before the action stage.', explore: 'Review the evidence and expected impact, then approve, reject, request evidence, or challenge.' }}
          summary={`Decision: ${approvalDecisionLabel(currentCase.approval?.decision)}`}
          lockedReason="awaiting recommendation"
          expanded={expandedStages.approve} onToggle={() => toggleStage('approve')}
        >
          <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div id="recommendation" className="lg:col-span-6 min-w-0">
              <RecommendationPanel
                recommendation={currentCase.recommendation}
                onEvidenceClick={handleEvidenceClick}
              />
            </div>
            <div className="lg:col-span-6 space-y-4 min-w-0">
              <ApprovalPanel
                approval={currentCase.approval || ({} as any)}
                onDecision={handleApprovalDecision}
                onChallengeClick={() => focusStage('critic', 'critic')}
                demoMode={useClientDemoActions}
                operatorName={auth.user?.displayName || auth.user?.email}
              />
            </div>
          </div>
        </StageSection>

        <div className="fw-phase-heading fw-phase-heading--record"><span>04 / RECORD</span><p>Follow the dispatched action and review the decision trail.</p></div>
        <StageSection
          id="outcome" index={7} title="Action & outcome" status={stageStatus('outcome')}
          phase="record"
          guide={{ meaning: useClientDemoActions ? 'This demo connects the approved action with a simulated inspection result.' : 'This connects the approved action with the inspection outcome returned by the server.', explore: 'Review the work steps and compare the before and after values.' }}
          summary={currentCase.outcome ? currentCase.outcome.actual_cause : 'Action not yet executed'}
          lockedReason="awaiting human approval"
          expanded={expandedStages.outcome} onToggle={() => toggleStage('outcome')}
        >
          <div className="space-y-4">
            <div id="simulated-action">
              <SimulatedActionPanel
                action={currentCase.action}
                approval={currentCase.approval || ({} as any)}
                onExecuteAction={handleExecuteAction}
                isOutcomeRevealed={!!currentCase.outcome}
                demoMode={useClientDemoActions}
              />
            </div>
            <OutcomePanel outcome={currentCase.outcome} />
          </div>
        </StageSection>

        <StageSection
          id="audit" index={8} title="Audit trail" status={stageStatus('audit')}
          phase="record"
          guide={{ meaning: 'The timeline records the sequence of agent and tool events behind this investigation.', explore: 'Filter by agent and expand an event to inspect its details.' }}
          summary={`${currentCase.audit_trail?.length || 0} events`}
          expanded={expandedStages.audit} onToggle={() => toggleStage('audit')}
        >
          <AuditPanel auditTrail={Array.isArray(currentCase.audit_trail) ? currentCase.audit_trail : []} />
        </StageSection>

      </main>


      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-4 px-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>FACTORY WHY · Industrial reliability investigations</span>
          </div>
          <div>
            <span>From signal to accountable action</span>
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
