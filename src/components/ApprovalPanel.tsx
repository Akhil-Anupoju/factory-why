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

interface ApprovalPanelProps {
  approval: ApprovalRecord;
  onDecision: (decision: ApprovalDecision, comment: string) => void;
  onChallengeClick: () => void;
}

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({
  approval,
  onDecision,
  onChallengeClick,
}) => {
  const [comment, setComment] = useState('');
  const isApproved = approval.decision === 'APPROVED';
  // show a subtle hint when SSE indicates awaiting approval
  // the parent App will set approval.decision appropriately; keep UI unchanged here

  return (
    <div id="approval" className="bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {isApproved ? (
            <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
              Human-in-the-Loop Safety Gate & Authorization
            </h2>
            <div className="text-[11px] text-slate-400 font-mono">
              Status: <span className={isApproved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {approval.decision}
              </span>
            </div>
          </div>
        </div>

        {/* Authenticated Engineer Badge */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-xs font-mono shrink-0">
          <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-slate-400">Authenticated:</span>
          <span className="text-white font-semibold">{approval.engineer_name}</span>
          <span className="text-slate-600 hidden xs:inline">·</span>
          <span className="text-slate-400 text-[10px]">{approval.engineer_role}</span>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-slate-950/80 border border-slate-800 rounded p-2.5 text-xs text-slate-300 font-mono flex items-start gap-2 w-full min-w-0">
        <AlertCircle className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <div className="break-anywhere">
          <span className="text-cyan-300 font-bold">RESPONSIBLE AI CONTROL BOUNDARY:</span> No physical or simulated maintenance work order can be created by the Action Agent without explicit human engineer sign-off.
        </div>
      </div>

      {/* Decision State or Action Buttons */}
      {isApproved ? (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
              <Check className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold font-mono text-emerald-300 uppercase block">
                Action Formally Authorized by {approval.engineer_name}
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5 font-mono break-anywhere">
                Work Order Action Agent is unlocked. Dispatching maintenance procedure now.
              </p>
              {approval.comment && (
                <div className="text-[11px] text-emerald-200 mt-1 italic break-anywhere">
                  Engineer Note: "{approval.comment}"
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onDecision('PENDING', '')}
            className="text-xs text-slate-400 hover:text-white underline font-mono shrink-0 self-start sm:self-auto"
          >
            Revoke / Re-evaluate
          </button>
        </div>
      ) : (
        <div className="space-y-3 w-full min-w-0">
          {/* Optional Comment Input */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">
              Engineer Assessment Notes (Optional before sign-off)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Approved for immediate shift handover check. Request LAK-40 calibration kit."
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* 4 Decision Buttons */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2 pt-1 w-full min-w-0">
            {/* 1. APPROVE */}
            <button
              onClick={() => onDecision('APPROVED', comment || 'Approved for immediate laser runout diagnostic inspection.')}
              className="px-2.5 sm:px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/60"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>Approve Action</span>
            </button>

            {/* 2. REJECT */}
            <button
              onClick={() => onDecision('REJECTED', comment || 'Rejected by Lead Reliability Engineer.')}
              className="px-2.5 sm:px-3 py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>Reject</span>
            </button>

            {/* 3. REQUEST MORE EVIDENCE */}
            <button
              onClick={() => onDecision('REQUEST_MORE_EVIDENCE', comment || 'Requested high-resolution vibration spectrum FFT.')}
              className="px-2.5 sm:px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Request Evidence</span>
            </button>

            {/* 4. CHALLENGE */}
            <button
              onClick={() => {
                onDecision('CHALLENGE', 'Challenging leading hypothesis with critic agent.');
                onChallengeClick();
              }}
              className="px-2.5 sm:px-3 py-2 bg-amber-900/50 hover:bg-amber-800 text-amber-200 border border-amber-700/50 font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Challenge AI</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
