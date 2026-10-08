import React from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Lock, CircleDot } from 'lucide-react';

export type StageStatus = 'completed' | 'current' | 'pending' | 'locked';

interface StageSectionProps {
  id: string;
  index: number;
  title: string;
  status: StageStatus;
  /** One-line summary shown when the section is collapsed (completed/pending/locked). */
  summary?: React.ReactNode;
  /** Short reason shown for locked/pending sections, e.g. "awaiting recommendation". */
  lockedReason?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const statusChip = (status: StageStatus) => {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50/60 border border-emerald-300/50 px-1.5 py-0.5 rounded shrink-0">
          <CheckCircle2 className="w-3 h-3 shrink-0" /> COMPLETED
        </span>
      );
    case 'current':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-cyan-700 bg-cyan-50/60 border border-cyan-400/60 px-1.5 py-0.5 rounded shrink-0">
          <CircleDot className="w-3 h-3 shrink-0 animate-pulse" /> CURRENT
        </span>
      );
    case 'locked':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
          <Lock className="w-3 h-3 shrink-0" /> LOCKED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
          PENDING
        </span>
      );
  }
};

/**
 * A single investigation stage within the single-page workspace.
 * Completed/pending/locked stages render as a compact one-line summary row.
 * The current (or manually expanded) stage renders full detail (children).
 * This implements progressive disclosure without introducing routing or
 * separate pages — clicking a header expands/collapses inline.
 */
export const StageSection: React.FC<StageSectionProps> = ({
  id,
  index,
  title,
  status,
  summary,
  lockedReason,
  expanded,
  onToggle,
  children,
}) => {
  const isInteractive = status !== 'locked';

  return (
    <section
      id={id}
      aria-label={title}
      className={`w-full min-w-0 rounded-xl border transition-all duration-150 ${
        status === 'current'
          ? 'border-cyan-300 bg-white shadow-md ring-1 ring-cyan-100'
          : status === 'locked'
          ? 'border-slate-200 bg-slate-50/60'
          : 'border-slate-200 bg-white shadow-sm hover:shadow-md'
      }`}
    >
      <button
        type="button"
        onClick={isInteractive ? onToggle : undefined}
        disabled={!isInteractive}
        aria-expanded={expanded}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${
          isInteractive ? 'cursor-pointer hover:bg-slate-50 rounded-t-xl' : 'cursor-not-allowed opacity-60 rounded-xl'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[11px] text-slate-400 shrink-0 w-5 text-right">{String(index).padStart(2, '0')}</span>
          <span className={`font-bold font-mono text-xs sm:text-sm uppercase tracking-wide shrink-0 ${status === 'current' ? 'text-cyan-700' : 'text-slate-800'}`}>
            {title}
          </span>
          {statusChip(status)}
          {!expanded && summary && (
            <span className="text-[11px] sm:text-xs text-slate-500 font-mono truncate min-w-0 ml-1">{summary}</span>
          )}
          {status === 'locked' && lockedReason && (
            <span className="text-[11px] sm:text-xs text-slate-400 italic truncate min-w-0 ml-1">{lockedReason}</span>
          )}
        </div>
        {isInteractive && (
          <span className="shrink-0 text-slate-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )}
      </button>

      {expanded && isInteractive && (
        <div className="px-3.5 sm:px-4 pb-4 pt-1 fw-animate-in">
          {children}
        </div>
      )}
    </section>
  );
};

export default StageSection;
