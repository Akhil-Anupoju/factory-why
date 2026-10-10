import React, { useState } from 'react';
import { 
  FileText, 
  Terminal, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ExternalLink,
  ShieldCheck,
  Search
} from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditPanelProps {
  auditTrail: AuditEvent[];
}

export const AuditPanel: React.FC<AuditPanelProps> = ({ auditTrail }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('ALL');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const safeAuditTrail: AuditEvent[] = Array.isArray(auditTrail) ? auditTrail : [];
  const filteredTrail = safeAuditTrail.filter((evt) => {
    if (filterAgent === 'ALL') return true;
    return evt.agent_role === filterAgent;
  });

  return (
    <div id="audit" className="fw-panel bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-600 shrink-0" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
              Investigation activity
            </h2>
            <div className="text-[11px] text-slate-600 font-mono">
              Immutable Trace: <span className="text-cyan-700 font-semibold">{safeAuditTrail.length} Logged Events</span>
            </div>
          </div>
        </div>

        {/* Filter Agent */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-slate-600 uppercase">Filter Agent:</span>
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-slate-50 text-slate-700 border border-slate-200 rounded px-2 py-0.5 text-xs font-mono focus:outline-none"
          >
            <option value="ALL">All Agents</option>
            <option value="Root Orchestrator">Root Orchestrator</option>
            <option value="Evidence Agent">Evidence Agent</option>
            <option value="WHY Agent">WHY Agent</option>
            <option value="Critic Agent">Critic Agent</option>
            <option value="Simulation Agent">Simulation Agent</option>
            <option value="Recommendation Agent">Recommendation Agent</option>
          </select>
        </div>
      </div>

      {/* Audit Events List */}
      <div className="space-y-2 font-mono text-xs w-full min-w-0">
        {filteredTrail.map((evt) => {
          const isExpanded = expandedId === evt.event_id;

          return (
            <div
              key={evt.event_id}
              className="bg-slate-50/80 border border-slate-200 rounded overflow-hidden w-full min-w-0"
            >
              {/* Event Summary Row */}
              <div
                onClick={() => toggleExpand(evt.event_id)}
                className="p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 cursor-pointer hover:bg-white transition-colors w-full min-w-0"
              >
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                  <span className="text-slate-500 font-bold w-5 shrink-0 text-right">
                    #{evt.step_number}
                  </span>
                  
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200/60 px-1.5 py-0.5 rounded shrink-0">
                    {evt.agent_role}
                  </span>

                  <span className="text-amber-700 font-semibold truncate min-w-0">
                    {evt.tool_call}()
                  </span>

                  <span className="text-slate-600 truncate hidden md:inline font-sans text-xs">
                    {evt.summary}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    {evt.timestamp}
                  </span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50/60 border border-emerald-200/40 px-1.5 py-0.5 rounded shrink-0">
                    {evt.status}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                </div>
              </div>

              {/* Expanded JSON Payloads */}
              {isExpanded && (
                <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] space-y-2 animate-fade-in w-full min-w-0">
                  <div className="text-slate-700 font-sans mb-1 text-xs break-anywhere">
                    <strong className="text-cyan-600 font-mono">Summary:</strong> {evt.summary}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 w-full min-w-0">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase text-slate-500 block mb-1">
                        Tool Request Payload:
                      </span>
                      <pre className="p-2 bg-white border border-slate-200 rounded text-slate-700 overflow-x-auto max-h-40 max-w-full break-anywhere">
                        {JSON.stringify(evt.request_payload, null, 2)}
                      </pre>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] uppercase text-slate-500 block mb-1">
                        Tool Response Payload:
                      </span>
                      <pre className="p-2 bg-white border border-slate-200 rounded text-cyan-700 overflow-x-auto max-h-40 max-w-full break-anywhere">
                        {JSON.stringify(evt.response_payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
