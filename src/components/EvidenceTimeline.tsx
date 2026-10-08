import React, { useState } from 'react';
import { 
  FileText, 
  Activity, 
  Wrench, 
  ShieldAlert, 
  Image as ImageIcon, 
  ExternalLink, 
  Search, 
  CheckCircle2,
  Clock,
  Filter
} from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceTimelineProps {
  evidenceList: EvidenceItem[];
  selectedEvidenceId: string | null;
  onSelectEvidence: (evidence: EvidenceItem) => void;
  filteredComponentId: string | null;
}

export const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({
  evidenceList,
  selectedEvidenceId,
  onSelectEvidence,
  filteredComponentId,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const getSourceIcon = (source: EvidenceItem['source']) => {
    switch (source) {
      case 'Telemetry stream':
        return <Activity className="w-4 h-4 text-cyan-600" />;
      case 'Maintenance work order':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'Service manual':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'Prior incident':
        return <ShieldAlert className="w-4 h-4 text-purple-600" />;
      case 'Inspection image':
        return <ImageIcon className="w-4 h-4 text-rose-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  // Defensive: ensure evidenceList is an array at runtime. Backend may
  // sometimes omit or return null for this field; avoid crashing the
  // whole app by treating a missing list as empty and showing an empty
  // state. We still prefer the backend to return a correct contract.
  const evidenceListSafe: EvidenceItem[] = Array.isArray(evidenceList) ? evidenceList : [];

  const filteredItems = evidenceListSafe.filter((item) => {
    if (filterType !== 'ALL' && item.source !== filterType) {
      return false;
    }
    if (filteredComponentId) {
      if (filteredComponentId === 'BEARING-B04' && !item.component.includes('Bearing')) {
        return false;
      }
      if (filteredComponentId === 'MOTOR-M01' && !item.component.includes('Motor')) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-600 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            Auditable Evidence Stream ({filteredItems.length} Records)
          </h2>
        </div>

        {/* Source Filter Tabs - Reflows naturally */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded border border-slate-200">
          {['ALL', 'Telemetry stream', 'Maintenance work order', 'Service manual', 'Inspection image'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterType(cat)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors whitespace-nowrap ${
                filterType === cat
                  ? 'bg-cyan-500/20 text-cyan-700 font-semibold border border-cyan-500/30'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'All Sources' : cat.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Trust Notice - Reflows cleanly */}
      <div className="bg-cyan-50/30 border border-cyan-500/20 rounded p-2 text-xs flex flex-wrap items-center justify-between gap-1.5 text-cyan-700 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-600 shrink-0" />
          <span>TRUST RULE: All items below are verified OBSERVED facts with immutable provenance paths.</span>
        </div>
        <span className="text-[10px] text-slate-600">Click ID to inspect raw audit trail</span>
      </div>

      {/* Evidence Items List */}
      <div className="space-y-2.5 w-full min-w-0">
        {filteredItems.map((item) => {
          const isSelected = selectedEvidenceId === item.evidence_id;
          return (
            <div
              key={item.evidence_id}
              className={`p-3 rounded border transition-all cursor-pointer w-full min-w-0 ${
                isSelected
                  ? 'bg-slate-50 border-cyan-600/80 ring-1 ring-cyan-500/40'
                  : 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => onSelectEvidence(item)}
            >
              {/* Evidence Item Top Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-slate-200 border border-slate-300 shrink-0">
                    {getSourceIcon(item.source)}
                  </div>
                  <span className="text-xs font-bold font-mono text-cyan-700 bg-cyan-50/80 border border-cyan-200/60 px-1.5 py-0.5 rounded shrink-0">
                    {item.evidence_id}
                  </span>
                  <span className="text-xs text-slate-700 font-medium font-mono">
                    {item.source}
                  </span>
                  <span className="text-slate-400 hidden xs:inline">·</span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    {item.component}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50/60 border border-emerald-200/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {item.status}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono hidden sm:inline shrink-0">
                    {item.timestamp}
                  </span>
                </div>
              </div>

              {/* Observation Content */}
              <p className="text-xs text-slate-800 mt-2 leading-relaxed break-anywhere">
                {item.observation}
              </p>

              {/* Provenance & Detail Bottom Bar */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 break-anywhere">
                  <span className="text-slate-500 shrink-0">PROVENANCE:</span>
                  <span className="text-cyan-600/90 truncate underline decoration-dotted">
                    {item.provenance}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvidence(item);
                  }}
                  className="text-cyan-600 hover:text-cyan-700 flex items-center gap-1 text-[10px] uppercase font-semibold shrink-0"
                >
                  <span>Inspect</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
