import React from 'react';
import { 
  Award, 
  CheckCircle2, 
  TrendingDown, 
  Clock, 
  Zap, 
  Activity, 
  FileCheck,
  Check,
  ShieldCheck,
  Lock,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { OutcomeRecord } from '../types';

interface OutcomePanelProps {
  outcome: OutcomeRecord | null;
}

export const OutcomePanel: React.FC<OutcomePanelProps> = ({ outcome }) => {
  if (!outcome) {
    return (
      <div id="outcome" className="fw-panel bg-slate-100/60 border border-slate-200/80 rounded-lg p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-slate-600 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Lock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wide block truncate">
              Inspection outcome
            </span>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-anywhere">
              The findings and before-and-after readings appear after the action is complete.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-200 shrink-0">
          PENDING
        </span>
      </div>
    );
  }

  const vibrationChangePct = outcome.pre_vibration
    ? ((outcome.post_vibration - outcome.pre_vibration) / outcome.pre_vibration) * 100
    : null;
  const temperatureChange = outcome.post_temperature - outcome.pre_temperature;

  return (
    <div id="outcome" className="fw-panel bg-white border border-emerald-500/50 rounded-lg p-3 sm:p-4 flex flex-col gap-3 relative overflow-hidden shadow-lg shadow-emerald-50/20 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-emerald-700 uppercase">
              {outcome.is_simulated ? 'Simulated inspection result' : 'Inspection result'}
            </h2>
            <div className="text-[11px] text-slate-600 font-mono">
              Outcome Reference: <span className="text-slate-800">{outcome.outcome_id}</span>
            </div>
          </div>
        </div>

        {/* Prediction Match Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 max-w-full">
          <span className={`text-xs font-bold font-mono border px-2.5 py-1 rounded flex items-center gap-1.5 shadow-sm truncate ${outcome.prediction_match === true ? 'text-emerald-700 bg-emerald-50 border-emerald-500/50' : 'text-amber-800 bg-amber-50 border-amber-400/50'}`}>
            {outcome.prediction_match === true ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : outcome.prediction_match == null ? <HelpCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{outcome.is_simulated ? 'SIMULATED · ' : ''}{outcome.prediction_match == null ? 'PREDICTION UNVERIFIED' : outcome.prediction_match ? 'PREDICTION MATCHED' : 'PREDICTION DID NOT MATCH'}</span>
          </span>
        </div>
      </div>

      {/* Actual Ground Truth Statement */}
      <div className="bg-slate-50 border border-emerald-500/30 rounded-lg p-3 space-y-2 w-full min-w-0">
        <div className="text-[10px] font-mono uppercase text-emerald-600 font-bold tracking-wider">
          {outcome.is_simulated ? 'Modeled Leading Cause' : 'Actual Confirmed Root Cause'}
        </div>
        <h3 className="text-sm md:text-base font-bold text-slate-900 font-sans break-anywhere">
          {outcome.actual_cause}
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed font-sans break-anywhere">
          {outcome.observed_result}
        </p>
        {outcome.is_simulated && (
          <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-mono text-amber-900 break-anywhere">
            Prototype simulation only: these post-values are modeled from the incident baselines, not collected physical measurements.
          </p>
        )}

        {/* Physical Findings List */}
        <div className="pt-2 border-t border-slate-200/80">
          <span className="text-[10px] font-mono uppercase text-slate-600 block mb-1">
            {outcome.is_simulated ? 'SIMULATED INSPECTION FINDINGS:' : 'SHOP FLOOR PHYSICAL FINDINGS:'}
          </span>
          <div className="space-y-1">
            {outcome.physical_findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs font-mono text-slate-700">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="break-anywhere">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Telemetry Recovery Delta Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs w-full min-w-0">
        
        {/* Vibration Recovery */}
        <div className="bg-slate-50/80 border border-slate-200 p-2.5 rounded min-w-0">
          <div className="flex justify-between items-center text-[10px] text-slate-600 uppercase">
            <span>Vibration change</span>
            <span className={`font-bold ${vibrationChangePct !== null && vibrationChangePct > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{vibrationChangePct === null ? '—' : `${vibrationChangePct > 0 ? '+' : ''}${vibrationChangePct.toFixed(0)}%`}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <div>
              <span className="text-slate-500 text-[10px] block">PRE:</span>
              <span className="text-rose-600 font-bold">{outcome.pre_vibration} mm/s</span>
            </div>
            <span className="text-slate-500 text-sm">➔</span>
            <div>
              <span className="text-slate-500 text-[10px] block">POST:</span>
              <span className="text-emerald-600 font-bold text-sm">{outcome.post_vibration} mm/s</span>
            </div>
          </div>
        </div>

        {/* Temperature Normalization */}
        <div className="bg-slate-50/80 border border-slate-200 p-2.5 rounded min-w-0">
          <div className="flex justify-between items-center text-[10px] text-slate-600 uppercase">
            <span>Temperature change</span>
            <span className={`font-bold ${temperatureChange > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{temperatureChange > 0 ? '+' : ''}{temperatureChange.toFixed(1)}°C</span>
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <div>
              <span className="text-slate-500 text-[10px] block">PRE:</span>
              <span className="text-amber-600 font-bold">{outcome.pre_temperature}°C</span>
            </div>
            <span className="text-slate-500 text-sm">➔</span>
            <div>
              <span className="text-slate-500 text-[10px] block">POST:</span>
              <span className="text-emerald-600 font-bold text-sm">{outcome.post_temperature}°C</span>
            </div>
          </div>
        </div>

        {/* Resolution Time & Accuracy Score */}
        <div className="bg-slate-50/80 border border-slate-200 p-2.5 rounded flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-center text-[10px] text-slate-600 uppercase">
            <span>{outcome.is_simulated ? 'Modeled recovery' : 'Evaluation score'}</span>
            <span className="text-cyan-700 font-bold">{outcome.is_simulated ? `${outcome.modeled_recovery_pct ?? 0}% modeled` : outcome.accuracy_score_pct === null ? '—' : `${outcome.accuracy_score_pct} / 100`}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <div>
              <span className="text-slate-500 text-[10px] block">{outcome.is_simulated ? 'MODELED DURATION:' : 'RESOLUTION:'}</span>
              <span className="text-slate-900 font-bold">{outcome.is_simulated ? '—' : `${outcome.time_to_resolution_minutes} Minutes`}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">BENCHMARK:</span>
              <span className="text-emerald-600 font-bold">{outcome.top_k_recall == null ? 'UNVERIFIED' : outcome.top_k_recall ? 'PASS' : 'REVIEW'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
