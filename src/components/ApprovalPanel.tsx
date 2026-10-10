import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  HelpCircle, 
  Sparkles, 
  Lock, 
  Unlock, 
  UserCheck, 
  AlertCircle 
} from 'lucide-react';
import { ApprovalRecord, ApprovalDecision } from '../types';
import { approvalDecisionLabel } from '../approvalDecisionLabel';

interface ApprovalPanelProps {
  approval: ApprovalRecord;
  onDecision: (decision: ApprovalDecision, comment: string) => void;
  onChallengeClick: () => void;
  demoMode?: boolean;
  operatorName?: string | null;
}

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({
  approval,
  onDecision,
  onChallengeClick,
  demoMode = false,
  operatorName,
}) => {
  const [comment, setComment] = useState('');
  // Track WHICH specific action is in flight (not a single shared flag) so
  // that clicking one button only shows that button's loading state — the
  // other three remain disabled (to prevent conflicting concurrent
  // decisions) but keep their normal label.
  type BusyAction = 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_EVIDENCE' | 'CHALLENGE' | null;
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const busy = busyAction !== null;
  const runDecision = async (action: Exclude<BusyAction, null>, decision: ApprovalDecision, commentText: string, after?: () => void) => {
    if (busy) return;
    try {
      setBusyAction(action);
      await onDecision(decision, commentText);
      after?.();
    } finally {
      setBusyAction(null);
    }
  };
  const safeApproval = approval || ({} as any);
  const isApproved = safeApproval.decision === 'APPROVED';
  const isRejected = safeApproval.decision === 'REJECTED';
  // show a subtle hint when SSE indicates awaiting approval
  // the parent App will set approval.decision appropriately; keep UI unchanged here

  return (
    <div id="approval" className="fw-panel bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {isApproved ? (
            <Unlock className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          )}
            <div className="min-w-0">
              <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
                Review and sign off
              </h2>
              <div className="text-[11px] text-slate-600 font-mono">
                {demoMode ? 'Demo status:' : 'Status:'} <span className={isApproved ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {approvalDecisionLabel(safeApproval.decision)}
                </span>
              </div>
            </div>
        </div>

        {/* Authenticated Engineer Badge */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-xs font-mono min-w-0 max-w-full sm:max-w-[60%]">
          <UserCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
          <span className="text-slate-600 shrink-0">{demoMode ? 'Demo operator:' : 'Authenticated:'}</span>
          <span className="text-slate-900 font-semibold truncate min-w-0" title={demoMode ? operatorName || '' : safeApproval.engineer_name || ''}>{demoMode ? operatorName || 'Local user' : safeApproval.engineer_name || '—'}</span>
          {!demoMode && <span className="text-slate-400 hidden xs:inline shrink-0">·</span>}
          {!demoMode && <span className="text-slate-600 text-[10px] truncate min-w-0">{safeApproval.engineer_role || ''}</span>}
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-slate-50/80 border border-slate-200 rounded p-2.5 text-xs text-slate-700 font-mono flex items-start gap-2 w-full min-w-0">
        <AlertCircle className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
        <div className="break-anywhere">
          <span className="text-cyan-700 font-bold">{demoMode ? 'Browser-only demo decision:' : 'Human decision required:'}</span> {demoMode ? 'This sign-off is a local simulation. It does not authorize a server action or dispatch.' : 'Review the recommendation before unlocking the next action.'}
        </div>
      </div>

      {/* Decision State or Action Buttons */}
      {isApproved ? (
        <div className="p-3 bg-emerald-50/40 border border-emerald-500/40 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
              <Check className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold font-mono text-emerald-700 uppercase block">
                {demoMode ? `Demo decision by ${operatorName || 'local user'}` : `Action Formally Authorized by ${approval.engineer_name}`}
              </span>
              <p className="text-[11px] text-slate-700 mt-0.5 font-mono break-anywhere">
                {demoMode ? 'This local simulation is ready to review. No server approval or real dispatch was created.' : 'Work Order Action Agent is unlocked. Dispatching maintenance procedure now.'}
              </p>
              {approval.comment && (
                <div className="text-[11px] text-emerald-800 mt-1 italic break-anywhere">
                  Engineer Note: "{approval.comment}"
                </div>
              )}
            </div>
          </div>

            <span className="text-xs text-slate-600 font-mono shrink-0">Final decision</span>
        </div>
      ) : isRejected ? (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800">
          <strong className="block font-mono uppercase">Action rejected</strong>
          <p className="mt-1">No action is authorized for this recommendation. Review the decision record before reassessing the options.</p>
          {approval.comment && <p className="mt-2 italic">Engineer note: “{approval.comment}”</p>}
        </div>
      ) : (
        <div className="space-y-3 w-full min-w-0">
          {/* Optional Comment Input */}
          <div>
            <label className="block text-[11px] font-mono text-slate-600 mb-1 uppercase">
              Engineer Assessment Notes (Optional before sign-off)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Approved for immediate shift handover check. Request LAK-40 calibration kit."
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* 4 Decision Buttons */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 pt-1 w-full min-w-0">
            {/* 1. APPROVE */}
            <button
              onClick={() => runDecision('APPROVED', 'APPROVED', comment || 'Approved for immediate laser runout diagnostic inspection.')}
              disabled={busy}
              aria-disabled={busy}
              className={`px-2.5 sm:px-3 py-2 min-w-0 bg-emerald-600 text-white border border-emerald-600 font-bold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span className="truncate whitespace-nowrap">{busyAction === 'APPROVED' ? 'Approving…' : demoMode ? 'Simulate approval' : 'Approve Action'}</span>
            </button>

            {/* 2. REJECT */}
            <button
              onClick={() => runDecision('REJECTED', 'REJECTED', comment || 'Rejected by Lead Reliability Engineer.')}
              disabled={busy}
              aria-disabled={busy}
              className={`px-2.5 sm:px-3 py-2 min-w-0 bg-rose-50 text-rose-800 border border-rose-300 font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5 ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-100'}`}
            >
              <X className="w-4 h-4 shrink-0" />
              <span className="truncate whitespace-nowrap">{busyAction === 'REJECTED' ? 'Rejecting…' : 'Reject'}</span>
            </button>

            {/* 3. REQUEST MORE EVIDENCE */}
            <button
              onClick={() => runDecision('REQUEST_MORE_EVIDENCE', 'REQUEST_MORE_EVIDENCE', comment || 'Requested high-resolution vibration spectrum FFT.')}
              disabled={busy}
              aria-disabled={busy}
              className={`px-2.5 sm:px-3 py-2 min-w-0 bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5 ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`}
            >
              <HelpCircle className="w-4 h-4 text-cyan-600 shrink-0" />
              <span className="truncate whitespace-nowrap">{busyAction === 'REQUEST_MORE_EVIDENCE' ? 'Requesting…' : 'Request Evidence'}</span>
            </button>

            {/* 4. CHALLENGE */}
            <button
              onClick={() => runDecision('CHALLENGE', 'CHALLENGE', 'Challenging leading hypothesis with critic agent.', onChallengeClick)}
              disabled={busy}
              aria-disabled={busy}
              className={`px-2.5 sm:px-3 py-2 min-w-0 bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5 ${busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-100'}`}
            >
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate whitespace-nowrap">{busyAction === 'CHALLENGE' ? 'Challenging…' : demoMode ? 'View sample critique' : 'Challenge theory'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
