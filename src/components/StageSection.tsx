import React from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Lock, CircleDot } from 'lucide-react';

export type StageStatus = 'completed' | 'current' | 'pending' | 'locked';

interface StageSectionProps {
  id: string;
  index: number;
  title: string;
  status: StageStatus;
  phase?: 'observe' | 'explain' | 'decide' | 'record';
  guide?: { meaning: string; explore: string };
  /** One-line summary shown when the section is collapsed (completed/pending/locked). */
  summary?: React.ReactNode;
  /** Short reason shown for locked/pending sections, e.g. "awaiting recommendation". */
  lockedReason?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const statusChip = (status: StageStatus, id: string) => {
  switch (status) {
    case 'completed': {
      const isRecorded = id === 'approval' || id === 'outcome';
      return (
        <span className={`fw-stage-status ${isRecorded ? 'fw-stage-status--complete' : 'fw-stage-status--available'}`}>
          {isRecorded ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <CircleDot className="w-3.5 h-3.5 shrink-0" />}
          {id === 'approval' ? 'Decision recorded' : id === 'outcome' ? 'Outcome recorded' : 'Ready to review'}
        </span>
      );
    }
    case 'current':
      return (
        <span className="fw-stage-status fw-stage-status--current">
          <CircleDot className="w-3.5 h-3.5 shrink-0" /> Needs attention
        </span>
      );
    case 'locked':
      return (
        <span className="fw-stage-status fw-stage-status--locked">
          <Lock className="w-3.5 h-3.5 shrink-0" /> Locked
        </span>
      );
    default:
      return (
        <span className="fw-stage-status fw-stage-status--pending">
          Pending
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
  phase = 'observe',
  guide,
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
      className={`fw-stage fw-stage--${status} w-full min-w-0`}
      data-phase={phase}
    >
      <button
        type="button"
        onClick={isInteractive ? onToggle : undefined}
        disabled={!isInteractive}
        aria-expanded={expanded}
        className={`fw-stage-trigger w-full flex items-center justify-between gap-4 text-left ${isInteractive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="fw-stage-index shrink-0">{String(index).padStart(2, '0')}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="fw-stage-title">{title}</span>
              {statusChip(status, id)}
            </div>
            {!expanded && summary && <div className="fw-stage-summary truncate">{summary}</div>}
            {status === 'locked' && lockedReason && <div className="fw-stage-summary">{lockedReason}</div>}
          </div>
        </div>
        {isInteractive && (
          <span className="fw-stage-chevron shrink-0">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </span>
        )}
      </button>

      {expanded && isInteractive && (
        <div className="fw-stage-content fw-animate-in">
          {guide && (
            <div className="fw-stage-guide">
              <div className="fw-stage-guide-item">
                <span>WHAT THIS SHOWS</span>
                <p>{guide.meaning}</p>
              </div>
              <div className="fw-stage-guide-item fw-stage-guide-item--action">
                <span>WHAT TO DO</span>
                <p>{guide.explore}</p>
              </div>
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  );
};

export default StageSection;
