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
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            LIKELY (LEADING)
          </span>
        );
      case 'Supported':
        return (
          <span className="text-xs font-mono font-bold text-teal-300 bg-teal-950/80 border border-teal-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            SUPPORTED
          </span>
        );
      case 'Competing':
        return (
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            COMPETING
          </span>
        );
      case 'Contradicted':
        return (
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-500/50 px-2 py-0.5 rounded flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            CONTRADICTED
          </span>
        );
      case 'Unresolved':
      default:
        return (
          <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            UNRESOLVED
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
            WHY Agent: Competing Root-Cause Hypotheses
          </h2>
        </div>

        {/* Challenge Button Trigger */}
        <button
          onClick={onChallengeClick}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold transition-all shadow-sm shadow-amber-950/50 self-start sm:self-auto shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Challenge Leading Hypothesis</span>
        </button>
      </div>

      {/* Visual Contrast Banner: Observed vs Inferred */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono w-full min-w-0">
        <div className="bg-slate-950/80 border border-cyan-500/30 p-2 rounded flex items-center gap-2 text-cyan-300">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
          <span>[OBSERVED FACTS]: Grounded in immutable sensor, CMMS & manual evidence_ids.</span>
        </div>
        <div className="bg-slate-950/80 border border-purple-500/30 p-2 rounded flex items-center gap-2 text-purple-300">
          <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
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
                  ? 'bg-slate-950 border-cyan-400/90 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-950/40'
                  : hyp.status === 'Contradicted'
                  ? 'bg-slate-950/40 border-slate-800/80 opacity-75 hover:opacity-100'
                  : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Card Header - Reflows seamlessly */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                    {hyp.hypothesis_id}
                  </span>
                  <h3 className="text-sm font-bold text-white font-sans truncate">
                    {hyp.title}
                  </h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-slate-400">Confidence:</span>
                    <span className={`font-bold tabular-nums ${isLeading ? 'text-cyan-300' : 'text-slate-400'}`}>
                      {(hyp.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {getStatusBadge(hyp.status)}
                </div>
              </div>

              {/* Confidence Progress Bar */}
              <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-2.5">
                <div
                  className={`h-full transition-all duration-500 ${
                    hyp.status === 'Contradicted'
                      ? 'bg-rose-500'
                      : hyp.status === 'Competing'
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${hyp.confidence * 100}%` }}
                />
              </div>

              {/* Inferred Mechanism Description (Styled as AI Inference) */}
              <div className="mt-3 p-2.5 bg-purple-950/20 border border-purple-900/30 rounded">
                <div className="text-[10px] font-mono uppercase text-purple-300 tracking-wider flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Inferred Causal Mechanism</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {hyp.description}
                </p>
                <div className="text-[11px] text-purple-200/80 mt-1.5 font-mono italic">
                  Physics linkage: {hyp.inferred_mechanism}
                </div>
              </div>

              {/* Supporting & Counter Evidence Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-800/70 text-xs">
                
                {/* Supporting Evidence */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold flex items-center gap-1 mb-1">
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
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/80 transition-colors flex items-center gap-1"
                          title="Click to inspect provenance"
                        >
                          <span>{id}</span>
                          <span className="text-[9px] text-emerald-400/70">↗</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">None verified</span>
                  )}
                </div>

                {/* Counter Evidence / Contradictions */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-rose-400 font-semibold flex items-center gap-1 mb-1">
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
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950/70 border border-rose-700/50 text-rose-300 hover:bg-rose-900/80 transition-colors flex items-center gap-1"
                          title="Click to inspect contradiction"
                        >
                          <span>{id}</span>
                          <span className="text-[9px] text-rose-400/70">↗</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No direct counter-evidence</span>
                  )}
                </div>
              </div>

              {/* Next Discriminating Check & Missing Evidence */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60 bg-slate-900/60 p-2 rounded text-[11px]">
                <div className="flex items-start gap-2">
                  <Search className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-mono text-cyan-300 font-semibold uppercase text-[10px]">
                      Next Discriminating Check:
                    </span>
                    <p className="text-slate-300 mt-0.5">
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
