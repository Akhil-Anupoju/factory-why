import React from 'react';
import { 
  GitCompare, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  XCircle, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Search
} from 'lucide-react';
import { Hypothesis, TrustState } from '../types';

interface HypothesisCardsProps {
  hypotheses: Hypothesis[];
  selectedHypothesisId: string;
  onSelectHypothesis: (id: string) => void;
  onEvidenceClick: (evidenceId: string) => void;
  onChallengeClick: () => void;
}

export const HypothesisCards: React.FC<HypothesisCardsProps> = ({
  hypotheses,
  selectedHypothesisId,
  onSelectHypothesis,
  onEvidenceClick,
  onChallengeClick,
}) => {
  const getStatusBadge = (status: TrustState) => {
    switch (status) {
      case 'Likely':
        return (
          <span className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50/80 border border-cyan-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
            LIKELY (LEADING)
          </span>
        );
      case 'Supported':
        return (
          <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50/80 border border-teal-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            SUPPORTED
          </span>
        );
      case 'Competing':
        return (
          <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50/80 border border-amber-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            COMPETING
          </span>
        );
      case 'Contradicted':
        return (
          <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50/80 border border-rose-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            CONTRADICTED
          </span>
        );
      case 'Unresolved':
      default:
        return (
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
            UNRESOLVED
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-cyan-600 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            WHY Agent: Competing Root-Cause Hypotheses
          </h2>
        </div>

        {/* Challenge Button Trigger */}
        <button
          onClick={onChallengeClick}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 border border-amber-500/40 rounded text-xs font-semibold transition-all shadow-sm shadow-amber-50/50 self-start sm:self-auto shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Challenge Leading Hypothesis</span>
        </button>
      </div>

      {/* Visual Contrast Banner: Observed vs Inferred */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono w-full min-w-0">
        <div className="bg-slate-50/80 border border-cyan-500/30 p-2 rounded flex items-center gap-2 text-cyan-700">
          <div className="w-2 h-2 rounded-full bg-cyan-600 shrink-0" />
          <span>[OBSERVED FACTS]: Grounded in immutable sensor, CMMS & manual evidence_ids.</span>
        </div>
        <div className="bg-slate-50/80 border border-purple-500/30 p-2 rounded flex items-center gap-2 text-purple-700">
          <div className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
          <span>[AI INFERENCE]: Synthesized mechanical hypotheses subject to falsification critic.</span>
        </div>
      </div>

      {/* Hypothesis Cards List */}
      <div className="space-y-3 w-full min-w-0">
        {hypotheses.map((hyp) => {
          const isSelected = selectedHypothesisId === hyp.hypothesis_id;
          const isLeading = hyp.status === 'Likely' || hyp.status === 'Supported';

          return (
            <div
              key={hyp.hypothesis_id}
              onClick={() => onSelectHypothesis(hyp.hypothesis_id)}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer text-left w-full min-w-0 ${
                isSelected
                  ? 'bg-slate-50 border-cyan-600/90 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-50/40'
                  : hyp.status === 'Contradicted'
                  ? 'bg-slate-50/40 border-slate-200/80 opacity-75 hover:opacity-100'
                  : 'bg-slate-50/70 border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Card Header - Reflows seamlessly */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded shrink-0">
                    {hyp.hypothesis_id}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 font-sans truncate">
                    {hyp.title}
                  </h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-slate-600">Confidence:</span>
                    <span className={`font-bold tabular-nums ${isLeading ? 'text-cyan-700' : 'text-slate-600'}`}>
                      {(hyp.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {getStatusBadge(hyp.status)}
                </div>
              </div>

              {/* Confidence Progress Bar */}
              <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2.5">
                <div
                  className={`h-full transition-all duration-500 ${
                    hyp.status === 'Contradicted'
                      ? 'bg-rose-500'
                      : hyp.status === 'Competing'
                      ? 'bg-amber-600'
                      : 'bg-cyan-600'
                  }`}
                  style={{ width: `${hyp.confidence * 100}%` }}
                />
              </div>

              {/* Inferred Mechanism Description (Styled as AI Inference) */}
              <div className="mt-3 p-2.5 bg-purple-50/20 border border-purple-100/30 rounded">
                <div className="text-[10px] font-mono uppercase text-purple-700 tracking-wider flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>Inferred Causal Mechanism</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-sans">
                  {hyp.description}
                </p>
                <div className="text-[11px] text-purple-800/80 mt-1.5 font-mono italic">
                  Physics linkage: {hyp.inferred_mechanism}
                </div>
              </div>

              {/* Supporting & Counter Evidence Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200/70 text-xs">
                
                {/* Supporting Evidence */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-600 font-semibold flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Supporting Evidence ({hyp.supporting_evidence_ids.length})
                  </span>
                  {hyp.supporting_evidence_ids.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {hyp.supporting_evidence_ids.map((id) => (
                        <button
                          key={id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEvidenceClick(id);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50/70 border border-emerald-300/50 text-emerald-700 hover:bg-emerald-100/80 transition-colors flex items-center gap-1"
                          title="Click to inspect provenance"
                        >
                          <span>{id}</span>
                          <span className="text-[9px] text-emerald-600/70">↗</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">None verified</span>
                  )}
                </div>

                {/* Counter Evidence / Contradictions */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-rose-600 font-semibold flex items-center gap-1 mb-1">
                    <XCircle className="w-3 h-3" />
                    Counter-Evidence ({hyp.counter_evidence_ids.length})
                  </span>
                  {hyp.counter_evidence_ids.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {hyp.counter_evidence_ids.map((id) => (
                        <button
                          key={id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEvidenceClick(id);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-50/70 border border-rose-300/50 text-rose-700 hover:bg-rose-100/80 transition-colors flex items-center gap-1"
                          title="Click to inspect contradiction"
                        >
                          <span>{id}</span>
                          <span className="text-[9px] text-rose-600/70">↗</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No direct counter-evidence</span>
                  )}
                </div>
              </div>

              {/* Next Discriminating Check & Missing Evidence */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 bg-slate-100/60 p-2 rounded text-[11px]">
                <div className="flex items-start gap-2">
                  <Search className="w-3.5 h-3.5 text-cyan-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-mono text-cyan-700 font-semibold uppercase text-[10px]">
                      Next Discriminating Check:
                    </span>
                    <p className="text-slate-700 mt-0.5">
                      {hyp.next_discriminating_check}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
