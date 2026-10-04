import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { 
  ShieldAlert, 
  RotateCcw, 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Play, 
  Sparkles,
  Layers,
  Activity
} from 'lucide-react';
import { InvestigationCase } from '../types';

interface TopBarProps {
  currentCase: InvestigationCase;
  activeScenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
  onResetCase: () => void;
  onOpenEvaluationSuite: () => void;
  demoProgress: number; // 1 to 8
  onOpenDemoGuide: () => void;
  isDemoGuideOpen: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentCase,
  activeScenarioId,
  onSelectScenario,
  onResetCase,
  onOpenEvaluationSuite,
  demoProgress,
  onOpenDemoGuide,
  isDemoGuideOpen,
}) => {
  // minimal user identity display will be injected by parent via DOM or
  // a future prop; for now we will render an optional area reserved for
  // authenticated user identity and sign-out control managed by App.
  // App will set these via a small DOM-managed handler to avoid changing
  // many component props right now.
  const getStatusBadge = () => {
    if (currentCase.outcome) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="whitespace-nowrap">RESOLVED & VERIFIED</span>
        </span>
      );
    }
    if (currentCase.action) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-1 rounded">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
          <span className="whitespace-nowrap">TASK DISPATCHED</span>
        </span>
      );
    }
    if (currentCase.approval.decision === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 bg-teal-950/80 border border-teal-500/40 px-2.5 py-1 rounded">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span className="whitespace-nowrap">ACTION AUTHORIZED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2.5 py-1 rounded">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
        <span className="whitespace-nowrap">INVESTIGATING</span>
      </span>
    );
  };

  const auth = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-5 py-2.5 shadow-sm">
      <div className="max-w-[1720px] mx-auto flex flex-col gap-1 sm:gap-2 w-full">
        {/* Top row: Brand (left) + Actions (right) */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <img src="/assets/factorywhy-logo.png" alt="Factory WHY" className="h-4 sm:h-5 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
              <div className="leading-none">
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white font-mono leading-none">FACTORY WHY</span>
                  <span className="hidden sm:inline text-[10px] uppercase font-mono tracking-wider text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded bg-slate-950 leading-none">CTRL+WHY PROTOCOL</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono">Reliability Decision Workspace</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Demo Script */}
            <button
              onClick={onOpenDemoGuide}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-medium rounded border transition-colors shrink-0 ${
                isDemoGuideOpen
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
              aria-expanded={isDemoGuideOpen}
              aria-label="Toggle 3-Minute Demo Script"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline">Demo Script</span>
              <span className="text-[10px] font-mono bg-slate-950 px-1.5 py-0.5 rounded text-cyan-300 border border-slate-800">{demoProgress}/8</span>
            </button>

            {/* Reset */}
            <button
              onClick={onResetCase}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition-colors shrink-0"
              title="Reset investigation to initial anomaly state"
              aria-label="Reset investigation case"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline font-mono text-[11px]">Reset</span>
            </button>

            {/* Auth identity + sign-out */}
            {auth.isAuthenticated && (
              <div className="flex items-center gap-2 ml-2">
                <div className="text-xs text-slate-300 hidden sm:block">{auth.user?.displayName || auth.user?.email}</div>
                <button
                  onClick={() => auth.signOut()}
                  className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: Incident badges (left) + Scenario selector & Scorecard (right) */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded text-xs font-mono min-w-0">
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">INCIDENT:</span>
                <span className="font-semibold text-white">{currentCase.incident_id}</span>
              </div>
              <span className="text-slate-700 hidden xs:inline shrink-0">·</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">ASSET:</span>
                <span className="font-bold text-cyan-300">{currentCase.asset.asset_id}</span>
              </div>
              <span className="text-slate-700 hidden xs:inline shrink-0">·</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">SEVERITY:</span>
                <span className="text-rose-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />HIGH</span>
              </div>
            </div>

            <div className="flex items-center shrink-0">
              {getStatusBadge()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs max-w-full min-w-0">
              <span className="text-slate-400 text-[11px] font-mono hidden sm:inline shrink-0">CASE:</span>
              <select
                value={activeScenarioId}
                onChange={(e) => onSelectScenario(e.target.value)}
                aria-label="Select Investigation Case Scenario"
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[200px] xs:max-w-[240px] sm:max-w-xs md:max-w-none truncate"
              >
                <option value="CNC-04" className="bg-slate-900 text-white">CNC-04: Multi-Sensor Anomaly (Live Case)</option>
                <option value="CNC-04-LUBE" className="bg-slate-900 text-white">CNC-04: Pressure & Thermal Surge (Case #2)</option>
              </select>
            </div>

            <button
              onClick={onOpenEvaluationSuite}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-medium rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
              title="Open 8-Scenario Evaluation Scorecard"
              aria-label="Open Evaluation Scorecard Suite"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden md:inline">Scorecard</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-800/40">8/8</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
