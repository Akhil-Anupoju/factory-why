import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  FileText,
  HelpCircle
} from 'lucide-react';
import { Recommendation } from '../types';

interface RecommendationPanelProps {
  recommendation: Recommendation;
  onEvidenceClick: (evidenceId: string) => void;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  recommendation,
  onEvidenceClick,
}) => {
  return (
    <div id="recommendation" className="fw-panel bg-white border border-cyan-500/40 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex min-w-0 flex-col items-start gap-2 border-b border-slate-200 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-600 shrink-0" />
          <h2 className="min-w-0 text-xs font-bold font-mono tracking-wider text-slate-800 uppercase break-anywhere">
            Recommended next step
          </h2>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-start gap-2 sm:w-auto">
          <span className="shrink-0 pt-1 text-[10px] font-mono text-slate-600 uppercase">Urgency:</span>
          <span className="inline-flex min-w-0 max-w-full items-start gap-1 rounded border border-rose-300/60 bg-rose-50/80 px-2 py-1 text-xs font-bold font-mono text-rose-700 whitespace-normal break-anywhere">
            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
            <span className="min-w-0 break-anywhere">{recommendation.urgency} ({recommendation.time_window})</span>
          </span>
        </div>
      </div>

      {/* Main Recommendation Statement */}
      <div className="bg-slate-50/90 border border-cyan-500/30 rounded-lg p-3 w-full min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 font-bold mb-1">
          Proposed action · Requires human approval
        </div>
        <h3 className="text-sm md:text-base font-bold text-slate-900 font-sans flex items-start gap-2 break-anywhere">
          <span className="text-cyan-600 font-mono shrink-0">▶</span>
          <span>{recommendation.next_step}</span>
        </h3>
        
        {/* Rationale */}
        <p className="text-xs text-slate-700 mt-2 leading-relaxed break-anywhere">
          {recommendation.rationale}
        </p>

        {/* Evidence Citations Bar */}
        <div className="mt-3 pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-600 text-[11px] uppercase shrink-0">Grounded In Evidence:</span>
          {(Array.isArray(recommendation.evidence_references) ? recommendation.evidence_references : []).map((id) => (
            <button
              key={id}
              onClick={() => onEvidenceClick(id)}
              className="px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 rounded text-[11px] font-mono transition-colors flex items-center gap-1 shrink-0"
              title={`Inspect evidence ${id}`}
            >
              <span>{id}</span>
              <span className="text-[9px] text-cyan-600/80">↗</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Spec Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono w-full min-w-0">
        <div className="bg-slate-50/70 border border-slate-200 p-2 rounded min-w-0">
          <span className="text-[10px] text-slate-600 uppercase">Estimated Downtime</span>
          <div className="text-slate-900 font-bold text-sm mt-0.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span>{recommendation.estimated_duration_minutes} Minutes</span>
          </div>
        </div>

        <div className="bg-slate-50/70 border border-slate-200 p-2 rounded min-w-0">
          <span className="text-[10px] text-slate-600 uppercase">Residual Uncertainty</span>
          <div className="text-amber-700 font-bold text-sm mt-0.5 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{recommendation.uncertainty_pct}%</span>
          </div>
        </div>

        <div className="bg-slate-50/70 border border-slate-200 p-2 rounded min-w-0">
          <span className="text-[10px] text-slate-600 uppercase">Safety Standard</span>
          <div className="text-slate-700 font-bold text-[11px] mt-0.5 truncate">
            {recommendation.safety_protocol_code}
          </div>
        </div>
      </div>
    </div>
  );
};
