import React from 'react';
import { 
  Wrench, 
  Clock, 
  User, 
  Package, 
  Play, 
  Lock,
  FileCheck
} from 'lucide-react';
import { ActionRecord, ApprovalRecord } from '../types';

interface SimulatedActionPanelProps {
  action: ActionRecord | null;
  approval: ApprovalRecord;
  onExecuteAction: () => void;
  isOutcomeRevealed: boolean;
  demoMode?: boolean;
}

export const SimulatedActionPanel: React.FC<SimulatedActionPanelProps> = ({
  action,
  approval,
  onExecuteAction,
  isOutcomeRevealed,
  demoMode = false,
}) => {
  const safeApproval = approval || ({} as any);
  const isApproved = safeApproval.decision === 'APPROVED';
  const [running, setRunning] = React.useState(false);

  if (!isApproved) {
    return (
      <div id="simulated-action" className="fw-panel bg-slate-100/60 border border-slate-200/80 rounded-lg p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-slate-600 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Lock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold font-mono text-slate-600 uppercase tracking-wide block truncate">
              {demoMode ? 'Demo action' : 'Approved action'}
            </span>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-anywhere">
              Review and approve the recommendation to unlock this step.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-200 shrink-0">
          LOCKED
        </span>
      </div>
    );
  }

  // Once approved, display the simulated maintenance dispatch record
  return (
    <div id="simulated-action" className="fw-panel bg-white border border-cyan-500/40 rounded-lg p-3 sm:p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-600 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
              {demoMode ? 'Simulated action · browser only' : 'Approved action'}
            </h2>
            <div className="text-[11px] text-cyan-700 font-mono">
              {demoMode ? 'Sample work order:' : 'Work order:'} <span className="font-bold">{action?.task_number || 'Awaiting dispatch'}</span>
            </div>
          </div>
        </div>

        <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50/80 border border-emerald-200/60 px-2.5 py-0.5 rounded flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          {action ? action.status : 'READY'}
        </span>
      </div>

      {/* Show only details supplied by the action record. */}
      {action ? (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono space-y-3 w-full min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-600 uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-cyan-600 shrink-0" />
              Assigned Specialist
            </span>
            <div className="text-slate-900 font-bold mt-0.5 truncate">
              {action.assigned_technician || 'Unassigned'}
            </div>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] text-slate-600 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-600 shrink-0" />
              {demoMode ? 'Demo timestamp' : 'Dispatched at'}
            </span>
            <div className="text-amber-700 font-bold mt-0.5 break-anywhere">
              {action.dispatched_at}
            </div>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] text-slate-600 uppercase flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-cyan-600 shrink-0" />
              Target Component
            </span>
            <div className="text-slate-900 font-bold mt-0.5 truncate">
              {action.target_component}
            </div>
          </div>
        </div>

        {/* Required Calibration & Inspection Tooling */}
        <div className="pt-2 border-t border-slate-200/80">
          <span className="text-[10px] text-slate-600 uppercase flex items-center gap-1 mb-1.5">
            <Package className="w-3 h-3 text-cyan-600 shrink-0" />
            Allocated Diagnostic Tooling:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(action.required_tools || []).map((tool, i) => (
              <span key={i} className="px-2 py-0.5 bg-white border border-slate-300/80 text-slate-700 rounded text-[11px] break-anywhere">
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Procedure Checklist */}
        <div className="pt-2 border-t border-slate-200/80">
          <span className="text-[10px] text-slate-600 uppercase block mb-1">
            Execution Protocol Checklist:
          </span>
          <div className="space-y-1.5 text-slate-700 text-[11px]">
            {(action.procedure_checklist || []).map((step, index) => (
              <div key={`${index}-${step}`} className="flex items-start gap-1.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-800">{index + 1}</span>
                <span className="break-anywhere">Step {index + 1}: {step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Approval is recorded. The work order details will appear here when the action is dispatched.
        </div>
      )}

      {/* Action Execution Button to reveal Ground Truth */}
      {!isOutcomeRevealed && (
        <div className="flex flex-wrap justify-end pt-1">
          <button
            onClick={async () => {
              if (running) return;
              try {
                setRunning(true);
                await onExecuteAction();
              } finally {
                setRunning(false);
              }
            }}
            disabled={running}
            aria-disabled={running}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-bold text-xs font-mono rounded shadow-lg shadow-cyan-600/20 transition-all focus-visible:ring-2 focus-visible:ring-cyan-600 max-w-full ${running ? 'opacity-50 cursor-not-allowed' : 'hover:from-cyan-700 hover:to-teal-700'}`}
          >
            <Play className="w-4 h-4 fill-white shrink-0" />
            <span className="truncate">{running ? 'Loading outcome…' : demoMode ? 'Reveal simulated outcome' : 'Submit action and load outcome'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
