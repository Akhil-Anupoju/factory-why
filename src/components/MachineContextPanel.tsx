import React from 'react';
import {
  Cpu,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Filter,
  Wrench,
  Clock,
  Compass
} from 'lucide-react';
import { AssetContext, TelemetrySummary } from '../types';

interface MachineContextPanelProps {
  asset: AssetContext;
  signals: TelemetrySummary;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
}

export const MachineContextPanel: React.FC<MachineContextPanelProps> = ({
  asset,
  signals,
  selectedComponentId,
  onSelectComponent,
}) => {
  const components = Array.isArray(asset.components) ? asset.components : [];
  const flaggedCount = components.filter((component) => component.status !== 'NOMINAL').length;
  const focusComponent = components.find((component) => component.status === 'ABNORMAL') || components[0];

  return (
    <div className="fw-panel bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            Machine overview
          </h2>
        </div>
        {selectedComponentId && (
          <button
            onClick={() => onSelectComponent(null)}
            className="text-[11px] text-cyan-600 hover:text-cyan-700 font-mono flex items-center gap-1 shrink-0"
          >
              <span>Show all components</span>
          </button>
        )}
      </div>

      {/* Asset Overview Card */}
      <div className="fw-asset-overview bg-slate-50/70 border border-slate-200/80 rounded p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2 truncate">
              <span>{asset.name}</span>
            </div>
            <div className="text-xs text-slate-600 mt-0.5 truncate">
              <span>{asset.model}</span> · <span className="text-slate-700">{asset.line}</span>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end shrink-0">
            <span className="text-[10px] font-mono text-slate-600 uppercase">Operating State</span>
            <span className="text-xs font-bold font-mono text-amber-600 bg-amber-50/50 border border-amber-200/50 px-2 py-0.5 rounded mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              {asset.status}
            </span>
          </div>
        </div>

        {/* Health Score & Key Telemetry Stat - Responsive Reflow */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-200/60 text-xs">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-600">Health Index</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-600">{asset.health_score}%</span>
              <span className="text-[10px] text-amber-700 font-mono">{flaggedCount} flagged {flaggedCount === 1 ? 'part' : 'parts'}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${asset.health_score}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase text-slate-600">Part to review</div>
            <div className="text-xs font-semibold text-cyan-700 mt-0.5 flex items-center gap-1">
              <Wrench className="w-3 h-3 text-cyan-600 shrink-0" />
              <span>{focusComponent?.name || 'No component selected'}</span>
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5 font-mono">
              {focusComponent ? `Last serviced: ${focusComponent.last_serviced}` : 'Component details unavailable'}
            </div>
          </div>
        </div>
      </div>

      {/* Spindle Mechanical Topology Vector Diagram */}
      <div className="fw-machine-map bg-slate-50/90 border border-slate-200/80 rounded p-2 text-center relative overflow-hidden w-full">
        <div className="text-[10px] font-mono text-slate-600 text-left mb-1 flex flex-wrap items-center justify-between gap-1">
          <span>ILLUSTRATIVE DRIVE TRAIN MAP</span>
          <span className="text-cyan-600 text-[9px]">SELECT A PART TO FOCUS</span>
        </div>

        <div className="w-full overflow-hidden flex justify-center">
          <svg viewBox="0 0 380 95" className="w-full max-w-[380px] h-auto">
          <defs>
            <linearGradient id="motorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="alertGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7f1d1d" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
          </defs>

          {/* Motor Body */}
          <g
            className="cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => onSelectComponent('MOTOR-M01')}
          >
            <rect
              x="10" y="20" width="70" height="55" rx="3"
              fill="url(#motorGrad)"
              stroke={selectedComponentId === 'MOTOR-M01' ? '#38bdf8' : '#475569'}
              strokeWidth={selectedComponentId === 'MOTOR-M01' ? '2' : '1'}
            />
            <text x="45" y="48" fill="#e2e8f0" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">MOTOR</text>
            <text x="45" y="60" fill="#f59e0b" fontSize="8" textAnchor="middle" fontFamily="monospace">{signals.motor_current.delta_pct >= 0 ? '+' : ''}{signals.motor_current.delta_pct.toFixed(0)}% CURR</text>
          </g>

          {/* Flexible Coupler */}
          <line x1="80" y1="47" x2="115" y2="47" stroke="#64748b" strokeWidth="6" strokeDasharray="3 2" />

          {/* Shaft Section 1 */}
          <g
            className="cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => onSelectComponent('SHAFT-S01')}
          >
            <rect
              x="115" y="38" width="55" height="18" rx="2"
              fill="#1e293b"
              stroke={selectedComponentId === 'SHAFT-S01' ? '#38bdf8' : '#475569'}
              strokeWidth={selectedComponentId === 'SHAFT-S01' ? '2' : '1'}
            />
            <text x="142" y="50" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">SHAFT</text>
          </g>

          {/* Bearing B-04 (Anomalous node - pulsing) */}
          <g
            className="cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => onSelectComponent('BEARING-B04')}
          >
            <rect
              x="180" y="16" width="60" height="63" rx="4"
              fill={selectedComponentId === 'BEARING-B04' ? '#450a0a' : '#1e1b4b'}
              stroke="#ef4444"
              strokeWidth="2"
            />
            <circle cx="210" cy="47" r="14" fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="4 2" />
            <text x="210" y="32" fill="#fca5a5" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">BEARING B04</text>
            <text x="210" y="70" fill="#f87171" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{signals.vibration.delta_pct >= 0 ? '+' : ''}{signals.vibration.delta_pct.toFixed(0)}% VIB</text>
          </g>

          {/* Spindle Nose & Tool Chuck */}
          <line x1="240" y1="47" x2="280" y2="47" stroke="#64748b" strokeWidth="6" />
          <polygon points="280,25 330,35 330,60 280,70" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <text x="305" y="51" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">CHUCK</text>

          {/* Sensor probe arrows */}
          {/* VIB probe on bearing */}
          <path d="M 210,5 L 210,14" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />
          <circle cx="210" cy="5" r="3" fill="#38bdf8" />
          <text x="210" y="-1" fill="#38bdf8" fontSize="7" textAnchor="middle" fontFamily="monospace">VIB-B04</text>

          {/* TEMP probe on bearing */}
          <path d="M 210,88 L 210,80" stroke="#f97316" strokeWidth="2" />
          <circle cx="210" cy="88" r="3" fill="#f97316" />
          <text x="210" y="98" fill="#f97316" fontSize="7" textAnchor="middle" fontFamily="monospace">TEMP-B04</text>
        </svg>
        </div>
      </div>

      {/* Component Hierarchy List */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-slate-600 mb-1.5">
          <span>COMPONENTS · SELECT TO FILTER</span>
          <span>STATUS</span>
        </div>

        <div className="space-y-1.5">
          {components.map((comp) => {
            const isSelected = selectedComponentId === comp.component_id;
            return (
              <div
                key={comp.component_id}
                onClick={() => onSelectComponent(isSelected ? null : comp.component_id)}
                className={`fw-component-card p-2 rounded border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-cyan-50/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                    : comp.status === 'ABNORMAL'
                    ? 'bg-slate-50/60 border-rose-100/40 hover:border-rose-300/60'
                    : 'bg-slate-50/40 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 font-mono truncate">{comp.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      comp.status === 'ABNORMAL'
                        ? 'text-rose-600 bg-rose-50/60 border border-rose-200/50'
                        : comp.status === 'INVESTIGATING'
                        ? 'text-amber-600 bg-amber-50/60 border border-amber-200/50'
                        : 'text-emerald-600 bg-emerald-50/60 border border-emerald-200/50'
                    }`}
                  >
                    {comp.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 mt-1 line-clamp-2 break-anywhere">
                  {comp.details}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-200/50 text-[10px] font-mono text-slate-500">
                  <span className="truncate">Last serviced: {comp.last_serviced}</span>
                  <div className="flex gap-1 shrink-0">
                    {comp.sensor_ids.slice(0, 2).map((s) => (
                      <span key={s} className="bg-slate-200 px-1 rounded text-slate-700">
                        {s}
                      </span>
                    ))}
                    {comp.sensor_ids.length > 2 && (
                      <span className="text-slate-600">+{comp.sensor_ids.length - 2}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
