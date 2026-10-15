import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ClipboardList, ArrowRight } from 'lucide-react';
import { DecisionReadiness } from '../decisionReadiness';

interface DecisionReadinessPanelProps {
  readiness: DecisionReadiness;
  onGoToCritic: () => void;
  onClose: () => void;
}

const STATUS_STYLE: Record<string, { icon: React.ElementType; text: string; bg: string; border: string }> = {
  PASS: { icon: CheckCircle2, text: 'text-emerald-700', bg: 'bg-emerald-50/80', border: 'border-emerald-200' },
  WARN: { icon: AlertTriangle, text: 'text-amber-700', bg: 'bg-amber-50/80', border: 'border-amber-200' },
  FAIL: { icon: XCircle, text: 'text-rose-700', bg: 'bg-rose-50/80', border: 'border-rose-200' },
};

const OVERALL_LABEL: Record<DecisionReadiness['overall'], { label: string; text: string }> = {
  READY: { label: 'Ready for sign-off', text: 'text-emerald-700' },
  REVIEW_RECOMMENDED: { label: 'Review recommended before sign-off', text: 'text-amber-700' },
  NOT_READY: { label: 'Not ready for sign-off', text: 'text-rose-700' },
};

export const DecisionReadinessPanel: React.FC<DecisionReadinessPanelProps> = ({ readiness, onGoToCritic, onClose }) => {
  const overall = OVERALL_LABEL[readiness.overall];

  return (
    <div className="border border-slate-200 rounded-lg bg-white p-3 flex flex-col gap-2.5 w-full min-w-0" role="status">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="w-4 h-4 text-cyan-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 block">
              Decision readiness check
            </span>
            <span className={`text-xs font-bold font-mono ${overall.text}`}>{overall.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-mono text-slate-500 hover:text-slate-700 shrink-0"
        >
          Hide
        </button>
      </div>

      <p className="text-[11px] text-slate-600 leading-relaxed">
        A fixed set of deterministic checks over the data already gathered — not a new AI analysis. It does not
        re-challenge the leading explanation; it only verifies whether the Critic has already covered it.
      </p>

      <div className="flex flex-col gap-1.5">
        {readiness.checks.map((check) => {
          const style = STATUS_STYLE[check.status];
          const Icon = style.icon;
          return (
            <div
              key={check.key}
              className={`flex items-start gap-2 rounded border px-2 py-1.5 text-[11px] ${style.bg} ${style.border}`}
            >
              <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${style.text}`} />
              <div className="min-w-0">
                <span className={`font-semibold font-mono ${style.text}`}>{check.label}</span>
                <p className="text-slate-700 mt-0.5 break-anywhere">{check.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!readiness.criticReviewed && (
        <button
          type="button"
          onClick={onGoToCritic}
          className="self-start flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-700 hover:text-amber-900"
        >
          Go to Critic section to challenge the hypothesis <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
