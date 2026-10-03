import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Sparkles, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  Search,
  Sliders,
  Scale
} from 'lucide-react';
import { CriticFinding } from '../types';

interface CriticSectionProps {
  criticFinding: CriticFinding;
  leadingHypothesisTitle: string;
  onEvidenceClick: (evidenceId: string) => void;
  onChallengeComplete?: () => void;
}

export const CriticSection: React.FC<CriticSectionProps> = ({
  criticFinding,
  leadingHypothesisTitle,
  onEvidenceClick,
  onChallengeComplete,
}) => {
  const [isRunningCritic, setIsRunningCritic] = useState(false);
  const [criticRunCount, setCriticRunCount] = useState(1);

  const handleRunCritic = () => {
    setIsRunningCritic(true);
    setTimeout(() => {
      setIsRunningCritic(false);
      setCriticRunCount(prev => prev + 1);
      if (onChallengeComplete) {
        onChallengeComplete();
      }
    }, 800);
  };

  return (
    <div id="critic" className="bg-slate-900 border border-amber-500/40 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 relative overflow-hidden w-full min-w-0">
      {/* Visual Accent Glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-amber-300 uppercase">
              Critic Agent: Falsification & Self-Challenge
            </h2>
            <div className="text-[11px] text-slate-400 font-mono">
              Evaluating: <span className="text-white font-semibold">{leadingHypothesisTitle}</span>
            </div>
          </div>
        </div>

        {/* Action Button: What would prove this wrong? */}
        <button
          onClick={handleRunCritic}
          disabled={isRunningCritic}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded text-xs font-bold font-mono transition-all shadow-md shadow-amber-950/60 disabled:opacity-50 self-start sm:self-auto shrink-0"
        >
          {isRunningCritic ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Challenging Invariants...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>What would prove this wrong?</span>
            </>
          )}
        </button>
      </div>

      {/* Core Falsification Condition (The Primary Innovation Beat) */}
      <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 w-full min-w-0">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold block">
              Definitive Falsification Condition
            </span>
            <p className="text-xs text-amber-100 font-medium leading-relaxed font-sans break-anywhere">
              {criticFinding.falsification_condition}
            </p>
          </div>
        </div>
      </div>

      {/* 4-Zone Critic Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs w-full min-w-0">
        
        {/* Zone 1: Contradictions Exposed */}
        <div className="bg-slate-950/80 border border-slate-800 rounded p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-rose-400 font-mono font-semibold text-[11px] mb-2 uppercase">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Contradictions in Competing Theories ({criticFinding.contradictions.length})</span>
          </div>

          <div className="space-y-2">
            {criticFinding.contradictions.map((c, i) => (
              <div key={i} className="p-2 bg-slate-900/80 border border-rose-900/30 rounded text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-1 text-slate-300 font-medium">
                  <span className="break-anywhere">{c.point}</span>
                  <button
                    onClick={() => onEvidenceClick(c.conflicting_evidence_id)}
                    className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span>{c.conflicting_evidence_id}</span>
                    <span>↗</span>
                  </button>
                </div>
                <p className="text-slate-400 mt-1 text-[11px] leading-relaxed break-anywhere">
                  {c.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Zone 2: Surfaced Ignored Evidence */}
        <div className="bg-slate-950/80 border border-slate-800 rounded p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-semibold text-[11px] mb-2 uppercase">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span>Previously Ignored Evidence Resurfaced</span>
          </div>

          <div className="space-y-2">
            {criticFinding.ignored_evidence.map((ig, i) => (
              <div key={i} className="p-2 bg-slate-900/80 border border-cyan-900/30 rounded text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-1 text-slate-300 font-medium">
                  <span className="font-semibold text-white">Technician Note Provenance</span>
                  <button
                    onClick={() => onEvidenceClick(ig.evidence_id)}
                    className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span>{ig.evidence_id}</span>
                    <span>↗</span>
                  </button>
                </div>
                <p className="text-slate-300 italic mt-1 text-[11px] break-anywhere">
                  "{ig.observation}"
                </p>
                <div className="text-[10px] text-cyan-300 mt-1 font-mono break-anywhere">
                  Why it matters: {ig.significance}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone 3: Strongest Discriminating Check */}
        <div className="bg-slate-950/80 border border-slate-800 rounded p-3 md:col-span-2 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold text-[11px] uppercase mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Single Most Discriminating Next Physical Check</span>
              </div>
              <p className="text-slate-200 text-xs font-medium break-anywhere">
                {criticFinding.strongest_discriminating_check}
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Critic Recommendation</span>
              <div className="text-xs font-bold font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded mt-0.5">
                {criticFinding.recommendation_action}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
