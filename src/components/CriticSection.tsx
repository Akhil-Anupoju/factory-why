import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Search,
  Scale,
  Sparkles
} from 'lucide-react';
import { CriticFinding } from '../types';

interface CriticSectionProps {
  criticFinding: CriticFinding | null | undefined;
  leadingHypothesisTitle: string;
  onEvidenceClick: (evidenceId: string) => void;
  onChallenge: () => void;
  challengeAvailable: boolean;
  isChallenging?: boolean;
  onChallengeComplete?: () => void;
}

export const CriticSection: React.FC<CriticSectionProps> = ({
  criticFinding,
  leadingHypothesisTitle,
  onEvidenceClick,
  onChallenge,
  challengeAvailable,
  isChallenging = false,
  onChallengeComplete,
}) => {
  return (
    <div id="critic" className="fw-panel fw-critic border border-amber-500/40 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30 shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-amber-700 uppercase">
              Challenge the leading theory
            </h2>
            <div className="text-[11px] text-slate-600 font-mono">
              Evaluating: <span className="text-slate-900 font-semibold">{leadingHypothesisTitle}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onChallenge}
          disabled={!challengeAvailable || isChallenging}
          className="fw-critic-challenge flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold font-mono self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isChallenging ? 'Challenging with AI…' : 'Challenge this hypothesis'}</span>
        </button>
      </div>
      {!challengeAvailable && <p className="text-[11px] text-slate-600">{criticFinding ? 'These are sample Critic findings.' : 'A live Critic challenge is unavailable in this demo.'} Sign in with Google or GitHub and load the live incident to run a new AI challenge.</p>}

      {!criticFinding ? (
        <div className="fw-critic-card rounded border border-slate-200 p-3 text-xs text-slate-700" role="status">
          No Critic findings are available yet. Use the challenge action above to check the leading hypothesis against the evidence.
        </div>
      ) : <>
      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">Critic findings</p>

      {/* Core Falsification Condition (The Primary Innovation Beat) */}
      <div className="fw-critic-note border border-amber-400/50 rounded-lg p-3 w-full min-w-0">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-600 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold block">
              What would prove this theory wrong?
            </span>
            <p className="text-xs text-amber-900 font-medium leading-relaxed font-sans break-anywhere">
              {criticFinding.falsification_condition}
            </p>
          </div>
        </div>
      </div>

      {/* 4-Zone Critic Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs w-full min-w-0">
        
        {/* Zone 1: Contradictions Exposed */}
        <div className="fw-critic-card border border-slate-200 rounded p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-rose-600 font-mono font-semibold text-[11px] mb-2 uppercase">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Contradicting evidence ({criticFinding.contradictions.length})</span>
          </div>

          <div className="space-y-2">
            {criticFinding.contradictions.length === 0 && <p className="text-[11px] text-slate-600">No contradictions were identified in this review.</p>}
            {criticFinding.contradictions.map((c, i) => (
              <div key={i} className="fw-critic-detail p-2 border border-rose-100/30 rounded text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-1 text-slate-700 font-medium">
                  <span className="break-anywhere">{c.point}</span>
                  <button
                    onClick={() => onEvidenceClick(c.conflicting_evidence_id)}
                    className="text-[10px] font-mono text-cyan-600 hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span>{c.conflicting_evidence_id}</span>
                    <span>↗</span>
                  </button>
                </div>
                <p className="text-slate-600 mt-1 text-[11px] leading-relaxed break-anywhere">
                  {c.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Zone 2: Surfaced Ignored Evidence */}
        <div className="fw-critic-card border border-slate-200 rounded p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-cyan-600 font-mono font-semibold text-[11px] mb-2 uppercase">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span>Evidence worth a second look</span>
          </div>

          <div className="space-y-2">
            {criticFinding.ignored_evidence.map((ig, i) => (
              <div key={i} className="fw-critic-detail p-2 border border-cyan-100/30 rounded text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-1 text-slate-700 font-medium">
                  <span className="font-semibold text-slate-900">Technician Note Provenance</span>
                  <button
                    onClick={() => onEvidenceClick(ig.evidence_id)}
                    className="text-[10px] font-mono text-cyan-600 hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span>{ig.evidence_id}</span>
                    <span>↗</span>
                  </button>
                </div>
                <p className="text-slate-700 italic mt-1 text-[11px] break-anywhere">
                  "{ig.observation}"
                </p>
                <div className="text-[10px] text-cyan-700 mt-1 font-mono break-anywhere">
                  Why it matters: {ig.significance}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone 3: Strongest Discriminating Check */}
        <div className="fw-critic-card border border-slate-200 rounded p-3 md:col-span-2 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-emerald-600 font-mono font-semibold text-[11px] uppercase mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Best physical check to separate causes</span>
              </div>
              <p className="text-slate-800 text-xs font-medium break-anywhere">
                {criticFinding.strongest_discriminating_check}
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] font-mono text-slate-600 uppercase">Suggested check</span>
              <div className="text-xs font-bold font-mono text-cyan-700 bg-cyan-50/80 border border-cyan-200/60 px-2 py-0.5 rounded mt-0.5">
                {criticFinding.recommendation_action}
              </div>
            </div>
          </div>
        </div>

      </div>
      {onChallengeComplete && (
        <div className="flex justify-end border-t border-slate-200 pt-3">
          <button type="button" onClick={onChallengeComplete} className="fw-critic-continue flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold font-mono">
            Continue to simulation <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      </>}
    </div>
  );
};
