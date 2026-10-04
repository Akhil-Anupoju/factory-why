import React from 'react';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  User, 
  Package, 
  ArrowRight, 
  Play, 
  Lock,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { ActionRecord, ApprovalRecord } from '../types';

interface SimulatedActionPanelProps {
  action: ActionRecord | null;
  approval: ApprovalRecord;
  onExecuteAction: () => void;
  isOutcomeRevealed: boolean;
}

export const SimulatedActionPanel: React.FC<SimulatedActionPanelProps> = ({
  action,
  approval,
  onExecuteAction,
  isOutcomeRevealed,
}) => {
  const isApproved = approval.decision === 'APPROVED';
  const [running, setRunning] = React.useState(false);

  if (!isApproved) {
    return (
      <div id="simulated-action" className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-slate-400 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
            <Lock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wide block truncate">
              Action Agent: Maintenance Dispatch
            </span>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-anywhere">
              Gated by Human Approval. Action tool execution is quarantined until sign-off.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase bg-slate-950 text-slate-500 px-2 py-1 rounded border border-slate-800 shrink-0">
          LOCKED
        </span>
      </div>
    );
  }

  // Once approved, display the simulated maintenance dispatch record
  return (
    <div id="simulated-action" className="bg-slate-900 border border-cyan-500/40 rounded-lg p-3 sm:p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
              Action Agent: Maintenance Dispatch
            </h2>
            <div className="text-[11px] text-cyan-300 font-mono">
              Work Order Ref: <span className="font-bold">{action ? action.task_number : 'TASK-2026-0922-01'}</span>
            </div>
          </div>
        </div>

        <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-0.5 rounded flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {action ? action.status : 'DISPATCHED'}
        </span>
      </div>

      {/* Task Details Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono space-y-3 w-full min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-cyan-400 shrink-0" />
              Assigned Specialist
            </span>
            <div className="text-white font-bold mt-0.5 truncate">
              {action?.assigned_technician || 'D. Miller (Shift B Lead Tech)'}
            </div>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
              Execution Window
            </span>
            <div className="text-amber-300 font-bold mt-0.5 break-anywhere">
              Immediate (25 min standard allowance)
            </div>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-cyan-400 shrink-0" />
              Target Component
            </span>
            <div className="text-white font-bold mt-0.5 truncate">
              Bearing-B04 & Coupler
            </div>
          </div>
        </div>

        {/* Required Calibration & Inspection Tooling */}
        <div className="pt-2 border-t border-slate-800/80">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1 mb-1.5">
            <Package className="w-3 h-3 text-cyan-400 shrink-0" />
            Allocated Diagnostic Tooling:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Optalign Smart RS5 Laser Alignment System',
              'Mitutoyo 0.001mm Magnetic Dial Indicator',
              'Stainless Precision Shim Pack (0.02 - 0.10 mm)',
              'Snap-On Digital Torque Wrench (Calibrated 85 Nm)'
            ].map((tool, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-900 border border-slate-700/80 text-slate-300 rounded text-[11px] break-anywhere">
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Procedure Checklist */}
        <div className="pt-2 border-t border-slate-800/80">
          <span className="text-[10px] text-slate-400 uppercase block mb-1">
            Execution Protocol Checklist:
          </span>
          <div className="space-y-1.5 text-slate-300 text-[11px]">
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="break-anywhere">Step 1: Perform LOTO on CNC-04 main electrical disconnect & lock spindle brake.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="break-anywhere">Step 2: Mount dial indicator on spindle housing face; rotate shaft 360° to record Total Indicated Runout (TIR).</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="break-anywhere">Step 3: If TIR &gt; 0.02 mm, loosen housing foot bolts, shim rear pad, and torque to 85 Nm.</span>
            </div>
          </div>
        </div>
      </div>

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
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 ${running ? 'opacity-60 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500'} text-white font-bold text-xs font-mono rounded shadow-lg shadow-cyan-950/60 transition-all focus-visible:ring-2 focus-visible:ring-cyan-400 max-w-full`}
          >
            <Play className="w-4 h-4 fill-white shrink-0" />
            <span className="truncate">{running ? 'Executing…' : 'Complete Physical Inspection & Reveal Ground Truth'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
