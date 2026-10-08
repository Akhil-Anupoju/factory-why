import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Target, ArrowRight } from 'lucide-react';
import { InvestigationCase } from '../types';

interface SituationBriefProps {
  currentCase: InvestigationCase;
}

function deriveSeverity(summary: InvestigationCase['telemetry_summary']): { label: string; className: string } {
  const statuses = Object.values(summary || {}).map((c) => c.status);
  if (statuses.includes('CRITICAL')) return { label: 'HIGH SEVERITY', className: 'text-rose-700 bg-rose-50/60 border-rose-300/50' };
  if (statuses.includes('WARNING')) return { label: 'ELEVATED SEVERITY', className: 'text-amber-700 bg-amber-50/60 border-amber-300/50' };
  return { label: 'NOMINAL', className: 'text-emerald-700 bg-emerald-50/60 border-emerald-300/50' };
}

function topChangedChannels(summary: InvestigationCase['telemetry_summary']) {
  const entries = Object.entries(summary || {}).map(([key, v]) => ({ key, ...v }));
  return entries
    .filter((e) => Math.abs(e.delta_pct) > 0)
    .sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
    .slice(0, 3);
}

const CHANNEL_LABELS: Record<string, string> = {
  vibration: 'Vibration',
  temperature: 'Temperature',
  motor_current: 'Motor current',
  rpm: 'Spindle speed',
  pressure: 'Hydraulic pressure',
};

/**
 * "Situation Brief" — a 5-10 second executive summary synthesized entirely
 * from the live currentCase payload (no fabricated data). Answers: what
 * changed, why it matters, current confidence, and the recommended next
 * step, before the engineer has to read the full investigation.
 */
export const SituationBrief: React.FC<SituationBriefProps> = ({ currentCase }) => {
  const severity = deriveSeverity(currentCase.telemetry_summary);
  const changedChannels = topChangedChannels(currentCase.telemetry_summary);

  const leadingHypothesis = [...(currentCase.hypotheses || [])].sort((a, b) => a.likelihood_rank - b.likelihood_rank)[0];
  const confidencePct = leadingHypothesis ? Math.round(leadingHypothesis.confidence * 100) : null;

  const rec = currentCase.recommendation;
  const isPending = currentCase.approval?.decision === 'PENDING' || !currentCase.approval?.decision;
  const isApproved = currentCase.approval?.decision === 'APPROVED';
  const hasOutcome = !!currentCase.outcome;

  return (
    <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500" />
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono truncate tracking-tight">{currentCase.asset.asset_id}</h1>
            <div className="text-xs sm:text-sm text-slate-500 truncate">{currentCase.asset.name}</div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono px-3 py-1.5 rounded-full border shrink-0 ${severity.className}`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {severity.label}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* What changed */}
          <div className="min-w-0 lg:pr-5 pt-3 lg:pt-0 first:pt-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">What changed?</div>
            {changedChannels.length > 0 ? (
              <ul className="space-y-1.5">
                {changedChannels.map((c) => (
                  <li key={c.key} className="flex items-center gap-1.5 text-sm font-mono">
                    {c.delta_pct >= 0 ? (
                      <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${c.status === 'CRITICAL' ? 'text-rose-600' : c.status === 'WARNING' ? 'text-amber-600' : 'text-slate-400'}`} />
                    ) : (
                      <TrendingDown className={`w-3.5 h-3.5 shrink-0 ${c.status === 'CRITICAL' ? 'text-rose-600' : c.status === 'WARNING' ? 'text-amber-600' : 'text-slate-400'}`} />
                    )}
                    <span className="text-slate-700">{CHANNEL_LABELS[c.key] || c.key}</span>
                    <span className={`font-bold ${c.status === 'CRITICAL' ? 'text-rose-600' : c.status === 'WARNING' ? 'text-amber-600' : 'text-slate-500'}`}>
                      {c.delta_pct >= 0 ? '+' : ''}{c.delta_pct}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-400">No significant deviation detected.</div>
            )}
          </div>

          {/* Why it matters */}
          <div className="min-w-0 lg:px-5 pt-3 lg:pt-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">Why it matters</div>
            <div className="text-sm text-slate-700 leading-snug">
              {leadingHypothesis ? leadingHypothesis.title : 'Investigation in progress — no leading hypothesis yet.'}
            </div>
          </div>

          {/* Current confidence */}
          <div className="min-w-0 lg:px-5 pt-3 lg:pt-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">Current confidence</div>
            {confidencePct !== null ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-indigo-600 font-mono tabular-nums">{confidencePct}%</span>
                <span className="text-xs text-slate-500 leading-tight">toward<br/>{leadingHypothesis.title}</span>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Not yet determined.</div>
            )}
          </div>

          {/* Recommended next step */}
          <div className="min-w-0 lg:pl-5 pt-3 lg:pt-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">Recommended next step</div>
            {hasOutcome ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <Target className="w-3.5 h-3.5 shrink-0" /> Investigation resolved — see Outcome
              </div>
            ) : isApproved ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                <ArrowRight className="w-3.5 h-3.5 shrink-0" /> Action authorized — awaiting execution
              </div>
            ) : rec ? (
              <div>
                <div className="text-sm font-semibold text-cyan-700 leading-snug">{rec.next_step}</div>
                <div className="text-xs text-slate-500 mt-0.5">{rec.estimated_duration_minutes} min · {isPending ? 'awaiting your approval' : rec.urgency}</div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Pending analysis.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SituationBrief;
