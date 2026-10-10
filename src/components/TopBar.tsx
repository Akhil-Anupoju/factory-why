import React from 'react';
import { BarChart3, Layers3, RotateCcw, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { InvestigationCase } from '../types';
import type { Theme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

interface TopBarProps {
  currentCase: InvestigationCase;
  activeScenarioId: string;
  demoMode?: boolean;
  onSelectScenario: (scenarioId: string) => void;
  onResetCase: () => void;
  onOpenEvaluationSuite: () => void;
  demoProgress: number;
  onOpenDemoGuide: () => void;
  isDemoGuideOpen: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentCase,
  activeScenarioId,
  demoMode = false,
  onSelectScenario,
  onResetCase,
  onOpenEvaluationSuite,
  demoProgress,
  onOpenDemoGuide,
  isDemoGuideOpen,
  theme,
  onToggleTheme,
}) => {
  const auth = useAuth();
  const caseStatus = demoMode
    ? { label: 'Demo only', tone: 'demo' }
    : currentCase.outcome
      ? { label: 'Resolved', tone: 'resolved' }
      : currentCase.action
        ? { label: 'Action dispatched', tone: 'active' }
        : currentCase.approval?.decision === 'APPROVED'
          ? { label: 'Authorized', tone: 'active' }
          : { label: 'Investigating', tone: 'investigating' };

  return (
    <header className="fw-topbar sticky top-0 z-30">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-7 py-3 flex flex-wrap items-center gap-3 sm:gap-5">
        <div className="fw-brand flex items-center gap-3 min-w-0 mr-auto">
          <img src="/assets/factorywhy-logo.png" alt="" className="w-9 h-9 object-contain shrink-0" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          <div className="min-w-0">
            <div className="fw-brand-name">FACTORY WHY</div>
            <div className="fw-brand-subtitle">Reliability decision workspace</div>
          </div>
        </div>

        <div className="fw-case-switcher flex items-center gap-2 min-w-0 order-3 w-full lg:order-none lg:w-auto">
          <Layers3 className="w-4 h-4 shrink-0 text-teal-700" aria-hidden="true" />
          <label htmlFor="fw-case-select" className="sr-only">Investigation case</label>
          <select
            id="fw-case-select"
            value={activeScenarioId}
            onChange={(event) => onSelectScenario(event.target.value)}
            className="min-w-0 flex-1 lg:flex-none bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="CNC-04">CNC-04 · Multi-sensor anomaly</option>
            <option value="CNC-04-LUBE">CNC-04 · Pressure & thermal surge</option>
          </select>
          <span className={`fw-case-status fw-case-status--${caseStatus.tone}`}>{caseStatus.label}</span>
        </div>

        <div className="fw-toolbar flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button type="button" onClick={onOpenDemoGuide} aria-expanded={isDemoGuideOpen} className={`fw-tool-button ${isDemoGuideOpen ? 'is-active' : ''}`} title="Open the guided demo">
            <Sparkles className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Demo guide</span><small>{demoProgress}/8</small>
          </button>
          <button type="button" onClick={onOpenEvaluationSuite} className="fw-tool-button" title="Open the evaluation scorecard">
            <BarChart3 className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Scorecard</span>
          </button>
          <button type="button" onClick={onResetCase} className="fw-tool-button fw-icon-button" title="Reset investigation" aria-label="Reset investigation">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          {auth.isAuthenticated && (
            <div className="fw-account flex items-center gap-2 pl-2 sm:pl-3">
              <span className="fw-avatar" aria-hidden="true">{(auth.user?.displayName || auth.user?.email || 'U').charAt(0).toUpperCase()}</span>
              <span className="hidden xl:block max-w-32 truncate text-xs font-medium text-slate-700">{auth.user?.displayName || auth.user?.email}</span>
              <button type="button" onClick={() => auth.signOut()} className="fw-tool-button fw-icon-button" title="Sign out" aria-label="Sign out">
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
