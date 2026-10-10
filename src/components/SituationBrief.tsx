import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { InvestigationCase } from '../types';
import { approvalDecisionLabel } from '../approvalDecisionLabel';

interface SituationBriefProps {
  currentCase: InvestigationCase;
  onNextStep?: () => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  vibration: 'Vibration',
  temperature: 'Temperature',
  motor_current: 'Motor current',
  rpm: 'Spindle speed',
  pressure: 'Hydraulic pressure',
};

export const SituationBrief: React.FC<SituationBriefProps> = ({ currentCase, onNextStep }) => {
  const channels = Object.entries(currentCase.telemetry_summary || {})
    .map(([key, value]) => ({ key, ...value }))
    .filter((channel) => Math.abs(channel.delta_pct) > 0)
    .sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
    .slice(0, 3);
  const leadingHypothesis = [...(currentCase.hypotheses || [])].sort((a, b) => a.likelihood_rank - b.likelihood_rank)[0];
  const confidence = leadingHypothesis ? Math.round(leadingHypothesis.confidence * 100) : null;
  const hasCriticalSignal = Object.values(currentCase.telemetry_summary || {}).some((channel) => channel.status === 'CRITICAL');
  const hasWarningSignal = Object.values(currentCase.telemetry_summary || {}).some((channel) => channel.status === 'WARNING');
  const severity = hasCriticalSignal ? 'High severity' : hasWarningSignal ? 'Elevated' : 'Nominal';
  const approved = currentCase.approval?.decision === 'APPROVED';
  const hasOutcome = !!currentCase.outcome;
  const nextStep = hasOutcome
    ? 'Investigation resolved. Review the confirmed outcome.'
    : approved
    ? 'Action authorized. Follow its execution and outcome.'
    : currentCase.recommendation?.next_step || 'Analysis is still in progress.';
  const nextButton = hasOutcome ? 'View outcome' : approved ? 'View action' : 'Review recommended action';

  return (
    <section className="fw-brief" aria-labelledby="fw-brief-heading">
      <div className="fw-brief-main">
        <div className="fw-brief-eyebrow">
          <span className="fw-live-indicator" aria-hidden="true" />
          <span>INCIDENT {currentCase.incident_id}</span>
          <span className="fw-eyebrow-divider" aria-hidden="true" />
          <span>ASSET {currentCase.asset.asset_id}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 mt-5">
          <div>
            <h1 id="fw-brief-heading" className="fw-brief-title">
              {hasOutcome ? 'Investigation resolved' : `Investigate ${currentCase.asset.asset_id}`}
            </h1>
            <p className="fw-brief-subtitle">{currentCase.asset.name} <span aria-hidden="true">·</span> Health score {currentCase.asset.health_score}%</p>
          </div>
          <span className={`fw-severity ${hasCriticalSignal ? 'fw-severity--high' : hasWarningSignal ? 'fw-severity--elevated' : 'fw-severity--nominal'}`}>
            {hasOutcome ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4" aria-hidden="true" />}
            {hasOutcome ? 'Resolved' : severity}
          </span>
        </div>

        <div className="fw-brief-explanation">
          <span className="fw-brief-label">{hasOutcome ? 'CONFIRMED CAUSE' : 'LEADING HYPOTHESIS'}</span>
          <p>{hasOutcome ? currentCase.outcome?.actual_cause : leadingHypothesis?.title || 'Investigating the evidence now.'}</p>
          {!hasOutcome && leadingHypothesis && <span className="fw-brief-hypothesis-note">Working theory · Check its supporting and conflicting evidence below.</span>}
        </div>

        <div className="fw-signal-list" aria-label="Largest signal changes">
          {channels.length > 0 ? channels.map((channel) => (
            <div key={channel.key} className="fw-signal-item">
              <span className="fw-signal-name">{CHANNEL_LABELS[channel.key] || channel.key}</span>
              <strong className={channel.status === 'CRITICAL' ? 'text-rose-700' : channel.status === 'WARNING' ? 'text-amber-700' : 'text-slate-700'}>
                {channel.delta_pct >= 0 ? <TrendingUp className="w-4 h-4" aria-hidden="true" /> : <TrendingDown className="w-4 h-4" aria-hidden="true" />}
                {channel.delta_pct >= 0 ? '+' : ''}{channel.delta_pct}%
              </strong>
            </div>
          )) : <span className="text-sm text-slate-500">No significant signal changes detected.</span>}
        </div>
      </div>

      <aside className="fw-next-action" aria-label="Next in the investigation">
        <div className="fw-next-action-top">
          <span className="fw-brief-label">NEXT IN THE INVESTIGATION</span>
          <span className="fw-next-action-index">→</span>
        </div>
        <p className="fw-next-action-copy">{nextStep}</p>
        <div className="fw-next-action-meta">
          <div><span>{hasOutcome ? 'Cause status' : 'Hypothesis score'}</span><strong>{hasOutcome ? 'Confirmed' : confidence === null ? 'Pending' : `${confidence}%`}</strong></div>
          <div><span>Human decision</span><strong>{approvalDecisionLabel(currentCase.approval?.decision)}</strong></div>
        </div>
        {onNextStep && currentCase.recommendation && (
          <button type="button" onClick={onNextStep} className="fw-next-action-button">
            {nextButton}<ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </aside>
    </section>
  );
};

export default SituationBrief;
