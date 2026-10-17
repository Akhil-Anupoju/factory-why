import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Layers3, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { IncidentSummary } from '../api/incidentApi';
import { InvestigationCase } from '../types';
import type { Theme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

interface TopBarProps {
  currentCase: InvestigationCase;
  activeScenarioId: string;
  demoMode?: boolean;
  incidents: IncidentSummary[];
  incidentsLoading: boolean;
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
  incidents,
  incidentsLoading,
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
  const [incidentMenuOpen, setIncidentMenuOpen] = useState(false);
  const incidentPickerRef = useRef<HTMLDivElement>(null);
  const caseStatus = demoMode
    ? { label: 'Demo only', tone: 'demo' }
    : currentCase.outcome
      ? { label: 'Resolved', tone: 'resolved' }
      : currentCase.action
        ? { label: 'Action dispatched', tone: 'active' }
          : currentCase.approval?.decision === 'APPROVED'
            ? { label: 'Authorized', tone: 'active' }
            : { label: 'Investigating', tone: 'investigating' };

  useEffect(() => {
    if (!incidentMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!incidentPickerRef.current?.contains(event.target as Node)) setIncidentMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIncidentMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [incidentMenuOpen]);

  const selectIncident = (incidentId: string) => {
    onSelectScenario(incidentId);
    setIncidentMenuOpen(false);
  };

  return (
    <header className="fw-topbar sticky top-0 z-30">
      <div className="fw-topbar-inner max-w-[1480px] mx-auto w-full min-w-0 px-4 sm:px-7 py-3 flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4">
        <div className="fw-brand flex items-center gap-3 min-w-0 shrink-0 mr-auto">
          <img src="/assets/factorywhy-logo.png" alt="Factory WHY" className="w-9 h-9 object-contain shrink-0" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          <div className="min-w-0">
            <div className="fw-brand-name">FACTORY WHY</div>
            <div className="fw-brand-subtitle">Reliability decision workspace</div>
          </div>
        </div>

        <div className="fw-case-switcher flex min-w-0 shrink items-center gap-2">
          <div className="fw-incident-picker relative min-w-0 sm:flex-1" ref={incidentPickerRef}>
            <button
              type="button"
              className="fw-incident-picker-trigger flex w-full min-w-0 items-center gap-2 px-2 py-1 sm:px-0 sm:py-0"
              aria-label="Choose incident"
              aria-haspopup="listbox"
              aria-expanded={incidentMenuOpen}
              aria-controls="fw-incident-options"
              onClick={() => setIncidentMenuOpen(open => !open)}
            >
              <Layers3 className="w-4 h-4 shrink-0 text-teal-700" aria-hidden="true" />
              <span className="fw-incident-select min-w-0 truncate text-sm font-semibold text-slate-800">
                {activeScenarioId}
              </span>
              <ChevronDown className="fw-incident-picker-chevron h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            </button>
            {incidentMenuOpen && (
              <div id="fw-incident-options" className="fw-incident-options" role="listbox" aria-label="Available incidents">
                {incidentsLoading && <div className="fw-incident-options-message">Loading incidents…</div>}
                {!incidentsLoading && incidents.length === 0 && <div className="fw-incident-options-message">No incidents available</div>}
                {incidents.map(incident => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={incident.incident_id === activeScenarioId}
                    key={incident.incident_id}
                    className="fw-incident-option"
                    onClick={() => selectIncident(incident.incident_id)}
                  >
                    <span>{incident.incident_id}</span>
                    {incident.status === 'APPROVED' ? (
                      <span className="fw-incident-option-status fw-incident-option-status--approved" aria-label="Approved" title="Approved">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Approved</span>
                      </span>
                    ) : (
                      <span className="fw-incident-option-status fw-incident-option-status--investigate">Needs investigation</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={`fw-case-status fw-case-status--${caseStatus.tone}`}>{caseStatus.label}</span>
          <span className="hidden md:inline-flex shrink-0 items-center gap-1 text-xs text-slate-600">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
            {currentCase.severity || 'HIGH'}
          </span>
        </div>

        <div className="fw-toolbar flex flex-nowrap items-center gap-1 sm:gap-1.5 shrink-0">
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
