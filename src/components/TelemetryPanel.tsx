import React, { useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Check, 
  Flame, 
  Zap, 
  Gauge, 
  Clock, 
  SlidersHorizontal 
} from 'lucide-react';
import { TelemetrySummary, TelemetryPoint } from '../types';

interface TelemetryPanelProps {
  summary: TelemetrySummary;
  timeSeries: TelemetryPoint[];
  selectedSensor?: string | null;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  summary,
  timeSeries,
  selectedSensor,
}) => {
  const [scrubIndex, setScrubIndex] = useState<number>(timeSeries.length - 1);
  const currentScrubPoint = timeSeries[scrubIndex] || timeSeries[timeSeries.length - 1];

  // SVG Chart Dimensions
  const chartWidth = 580;
  const chartHeight = 140;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Min/Max for Vibration normalization (8 to 14)
  const minVib = 7;
  const maxVib = 14;

  const getX = (index: number) => padding.left + (index / (timeSeries.length - 1)) * innerWidth;
  const getYVib = (val: number) => padding.top + innerHeight - ((val - minVib) / (maxVib - minVib)) * innerHeight;

  // Generate SVG path for vibration
  const vibPoints = timeSeries.map((d, i) => `${getX(i)},${getYVib(d.vibration)}`).join(' L ');
  const vibArea = `${vibPoints} L ${getX(timeSeries.length - 1)},${padding.top + innerHeight} L ${getX(0)},${padding.top + innerHeight} Z`;

  // Anomaly point index is 7 (14:18)
  const anomalyIndex = timeSeries.findIndex(d => d.is_anomalous);
  const anomalyX = anomalyIndex !== -1 ? getX(anomalyIndex) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
            Live Telemetry & Anomaly Dynamics
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-mono">
          <span className="text-slate-400">Lockstep Signal Coherence:</span>
          <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded shrink-0">
            r = 0.984 (Multi-channel)
          </span>
        </div>
      </div>

      {/* 5-Card Metric Matrix - Responsive Reflow across all screen widths */}
      <div className="grid grid-cols-2 min-[540px]:grid-cols-3 xl:grid-cols-5 gap-2 w-full min-w-0">
        
        {/* Vibration Card (+42%) */}
        <div className="bg-slate-950/80 border border-rose-800/60 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 truncate">Vibration</span>
            <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950 px-1 rounded border border-rose-800/60 shrink-0">
              +{summary.vibration.delta_pct.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {currentScrubPoint.vibration.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">mm/s</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-300">{summary.vibration.baseline} mm/s</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
        </div>

        {/* Temperature Card (+11%) */}
        <div className="bg-slate-950/80 border border-amber-800/60 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 truncate">Temp</span>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-1 rounded border border-amber-800/60 shrink-0">
              +{summary.temperature.delta_pct.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {currentScrubPoint.temperature.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">°C</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-300">{summary.temperature.baseline} °C</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
        </div>

        {/* Motor Current Card (+8%) */}
        <div className="bg-slate-950/80 border border-amber-800/60 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 truncate">Current</span>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-1 rounded border border-amber-800/60 shrink-0">
              +{summary.motor_current.delta_pct.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {currentScrubPoint.motor_current.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">A</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-300">{summary.motor_current.baseline} A</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
        </div>

        {/* Spindle RPM (Normal) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 truncate">Speed</span>
            <span className="text-[10px] font-mono text-emerald-400 shrink-0">NOMINAL</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {currentScrubPoint.rpm}
            </span>
            <span className="text-[10px] font-mono text-slate-400">RPM</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-300">3400 RPM</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
        </div>

        {/* Hydraulic Pressure (Normal) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded p-2 text-left relative overflow-hidden min-w-0 col-span-2 min-[540px]:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 truncate">Pressure</span>
            <span className="text-[10px] font-mono text-emerald-400 shrink-0">NOMINAL</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-white tabular-nums">
              {currentScrubPoint.pressure.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">bar</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-300">4.2 bar</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
        </div>

      </div>

      {/* Interactive Time-Series Graph with Anomaly Marker & Scrubbing */}
      <div className="bg-slate-950 border border-slate-800 rounded p-3 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 mb-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-white font-semibold">VIBRATION DRIFT TIME-SERIES</span>
            <div className="flex items-center gap-1.5 text-rose-400 shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>VIB-B04 (Radial Peak)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
              <span className="w-2.5 h-0.5 bg-slate-500 border-t border-dashed" />
              <span>ISO 10816 Limit (9.0 mm/s)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">Scrubbed: {currentScrubPoint.display_time} UTC</span>
          </div>
        </div>

        {/* SVG Sparkline */}
        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-36">
            <defs>
              <linearGradient id="vibGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1={padding.left} y1={getYVib(9.0)} x2={chartWidth - padding.right} y2={getYVib(9.0)} stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
            <line x1={padding.left} y1={getYVib(12.0)} x2={chartWidth - padding.right} y2={getYVib(12.0)} stroke="#334155" strokeDasharray="2 2" strokeWidth="1" />
            <text x={padding.left - 4} y={getYVib(9.0) + 3} fill="#94a3b8" fontSize="8" textAnchor="end" fontFamily="monospace">9.0</text>
            <text x={padding.left - 4} y={getYVib(12.0) + 3} fill="#94a3b8" fontSize="8" textAnchor="end" fontFamily="monospace">12.0</text>

            {/* Anomaly Step Marker line */}
            {anomalyX && (
              <g>
                <line x1={anomalyX} y1={padding.top} x2={anomalyX} y2={chartHeight - padding.bottom} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={anomalyX - 45} y={padding.top} width="90" height="16" rx="2" fill="#78350f" fillOpacity="0.8" stroke="#f59e0b" strokeWidth="1" />
                <text x={anomalyX} y={padding.top + 11} fill="#fef3c7" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  ANOMALY 14:18
                </text>
              </g>
            )}

            {/* Filled Area */}
            <path d={`M ${vibArea}`} fill="url(#vibGradient)" />

            {/* Main Vibration Line */}
            <path d={`M ${vibPoints}`} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data Points */}
            {timeSeries.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getYVib(d.vibration)}
                r={i === scrubIndex ? 5 : d.is_anomalous ? 3.5 : 2}
                fill={i === scrubIndex ? '#38bdf8' : d.is_anomalous ? '#ef4444' : '#94a3b8'}
                stroke={i === scrubIndex ? '#ffffff' : 'none'}
                strokeWidth={i === scrubIndex ? 2 : 0}
                className="cursor-pointer transition-all"
                onClick={() => setScrubIndex(i)}
              />
            ))}

            {/* Scrub cursor line */}
            <line
              x1={getX(scrubIndex)}
              y1={padding.top}
              x2={getX(scrubIndex)}
              y2={chartHeight - padding.bottom}
              stroke="#38bdf8"
              strokeWidth="1.5"
            />

            {/* Time Axis Labels */}
            {timeSeries.filter((_, idx) => idx % 2 === 0).map((d, i) => {
              const originalIdx = i * 2;
              return (
                <text
                  key={d.timestamp}
                  x={getX(originalIdx)}
                  y={chartHeight - 6}
                  fill="#64748b"
                  fontSize="8"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {d.display_time}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Scrub Slider */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 mt-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">Timeline Scrubber:</span>
          </div>
          <input
            type="range"
            min="0"
            max={timeSeries.length - 1}
            value={scrubIndex}
            onChange={(e) => setScrubIndex(parseInt(e.target.value, 10))}
            className="flex-1 min-w-[120px] accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="text-xs font-mono text-cyan-300 font-semibold shrink-0 text-right">
            {currentScrubPoint.display_time} UTC
          </div>
        </div>
      </div>
    </div>
  );
};
