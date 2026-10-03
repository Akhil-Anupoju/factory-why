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
    <div id="recommendation" className="bg-slate-900 border border-cyan-500/40 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 relative overflow-hidden w-full min-w-0">
      {/* Visual Accent */}
      <div className="absolute top-0 right-0 w-48 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
            Synthesized Next-Step Recommendation
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Urgency:</span>
          <span className="text-xs font-bold font-mono text-rose-300 bg-rose-950/80 border border-rose-700/60 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            {recommendation.urgency} ({recommendation.time_window})
          </span>
        </div>
      </div>

      {/* Main Recommendation Statement */}
      <div className="bg-slate-950/90 border border-cyan-500/30 rounded-lg p-3 w-full min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold mb-1">
          Authorized Engineering Action Proposed
        </div>
        <h3 className="text-sm md:text-base font-bold text-white font-sans flex items-start gap-2 break-anywhere">
          <span className="text-cyan-400 font-mono shrink-0">▶</span>
          <span>{recommendation.next_step}</span>
        </h3>
        
        {/* Rationale */}
        <p className="text-xs text-slate-300 mt-2 leading-relaxed break-anywhere">
          {recommendation.rationale}
        </p>

        {/* Evidence Citations Bar */}
        <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px] uppercase shrink-0">Grounded In Evidence:</span>
          {recommendation.evidence_references.map((id) => (
            <button
              key={id}
              onClick={() => onEvidenceClick(id)}
              className="px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 rounded text-[11px] font-mono transition-colors flex items-center gap-1 shrink-0"
              title={`Inspect evidence ${id}`}
            >
              <span>{id}</span>
              <span className="text-[9px] text-cyan-400/80">↗</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Spec Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono w-full min-w-0">
        <div className="bg-slate-950/70 border border-slate-800 p-2 rounded min-w-0">
          <span className="text-[10px] text-slate-400 uppercase">Estimated Downtime</span>
          <div className="text-white font-bold text-sm mt-0.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{recommendation.estimated_duration_minutes} Minutes</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-2 rounded min-w-0">
          <span className="text-[10px] text-slate-400 uppercase">Residual Uncertainty</span>
          <div className="text-amber-300 font-bold text-sm mt-0.5 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{recommendation.uncertainty_pct}%</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-2 rounded min-w-0">
          <span className="text-[10px] text-slate-400 uppercase">Safety Standard</span>
          <div className="text-slate-300 font-bold text-[11px] mt-0.5 truncate">
            {recommendation.safety_protocol_code}
          </div>
        </div>
      </div>
    </div>
  );
};
