import React, { useEffect, useState } from 'react';
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

type TelemetryMetricKey = 'vibration' | 'temperature' | 'motor_current' | 'rpm' | 'pressure';

const TELEMETRY_METRICS: Record<TelemetryMetricKey, { label: string; unit: string; color: string; fill: string }> = {
  vibration: { label: 'Vibration', unit: 'mm/s RMS', color: '#e11d48', fill: 'url(#signalGradient)' },
  temperature: { label: 'Temperature', unit: '°C', color: '#d97706', fill: 'url(#signalGradient)' },
  motor_current: { label: 'Motor current', unit: 'A', color: '#7c3aed', fill: 'url(#signalGradient)' },
  rpm: { label: 'Spindle speed', unit: 'RPM', color: '#0284c7', fill: 'url(#signalGradient)' },
  pressure: { label: 'Pressure', unit: 'bar', color: '#0f766e', fill: 'url(#signalGradient)' },
};

const METRIC_KEYS = Object.keys(TELEMETRY_METRICS) as TelemetryMetricKey[];

function mostDegradedMetric(summary: TelemetrySummary): TelemetryMetricKey {
  return METRIC_KEYS.reduce((largest, key) =>
    Math.abs(summary[key].delta_pct) > Math.abs(summary[largest].delta_pct) ? key : largest,
  'vibration');
}

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
  const safeTimeSeries = Array.isArray(timeSeries) ? timeSeries : [];
  const [scrubIndex, setScrubIndex] = useState<number>(Math.max(0, safeTimeSeries.length - 1));
  const [selectedMetric, setSelectedMetric] = useState<TelemetryMetricKey>(() => mostDegradedMetric(summary));
  useEffect(() => {
    setScrubIndex(Math.max(0, safeTimeSeries.length - 1));
    setSelectedMetric(mostDegradedMetric(summary));
  }, [summary, safeTimeSeries.length]);
  const currentScrubPoint = safeTimeSeries[scrubIndex] || safeTimeSeries[safeTimeSeries.length - 1] || { vibration: 0, temperature: 0, motor_current: 0, rpm: 0, pressure: 0, display_time: '' };
  const chartMetric = TELEMETRY_METRICS[selectedMetric];
  const metricBaseline = summary[selectedMetric].baseline;
  const metricAtScrub = currentScrubPoint[selectedMetric];
  const deltaAtScrub = (key: TelemetryMetricKey) => {
    const baseline = summary[key].baseline;
    return baseline === 0 ? 0 : ((currentScrubPoint[key] - baseline) / Math.abs(baseline)) * 100;
  };
  const formatDeltaAtScrub = (key: TelemetryMetricKey) => {
    const delta = deltaAtScrub(key);
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`;
  };
  const metricDeltaPct = deltaAtScrub(selectedMetric);
  const signalSummary = [
    { name: 'Vibration', value: { ...summary.vibration, delta_pct: deltaAtScrub('vibration') } },
    { name: 'Temperature', value: { ...summary.temperature, delta_pct: deltaAtScrub('temperature') } },
    { name: 'Motor current', value: { ...summary.motor_current, delta_pct: deltaAtScrub('motor_current') } },
    { name: 'Speed', value: { ...summary.rpm, delta_pct: deltaAtScrub('rpm') } },
    { name: 'Pressure', value: { ...summary.pressure, delta_pct: deltaAtScrub('pressure') } },
  ];
  const flaggedSignals = signalSummary.filter((signal) => signal.value.status !== 'NORMAL');
  const largestChange = [...signalSummary].sort((a, b) => Math.abs(b.value.delta_pct) - Math.abs(a.value.delta_pct))[0];

  // SVG Chart Dimensions
  const chartWidth = 580;
  const chartHeight = 140;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Include all readings and reference lines so a higher anomaly stays visible.
  const chartExtent = safeTimeSeries.reduce(
    (range, point) => ({ min: Math.min(range.min, point[selectedMetric]), max: Math.max(range.max, point[selectedMetric]) }),
    {
      min: Math.min(metricBaseline, summary[selectedMetric].current, selectedMetric === 'vibration' ? 9 : metricBaseline),
      max: Math.max(metricBaseline, summary[selectedMetric].current, selectedMetric === 'vibration' ? 9 : metricBaseline),
    },
  );
  const chartPadding = Math.max((chartExtent.max - chartExtent.min) * 0.18, Math.abs(metricBaseline) * 0.015, 0.1);
  const minValue = chartExtent.min - chartPadding;
  const maxValue = chartExtent.max + chartPadding;

  const getX = (index: number) => {
    if (safeTimeSeries.length <= 1) return padding.left;
    return padding.left + (index / (safeTimeSeries.length - 1)) * innerWidth;
  };
  const getYValue = (val: number) => padding.top + innerHeight - ((val - minValue) / (maxValue - minValue)) * innerHeight;

  // Plot the selected telemetry channel so the graph and scrubbed cards
  // always describe the same signal (including the incident's abnormal one).
  const signalPoints = safeTimeSeries.map((d, i) => `${getX(i)},${getYValue(d[selectedMetric])}`).join(' L ');
  const signalArea = safeTimeSeries.length > 0 ? `${signalPoints} L ${getX(safeTimeSeries.length - 1)},${padding.top + innerHeight} L ${getX(0)},${padding.top + innerHeight} Z` : '';
  const baselineY = getYValue(metricBaseline);
  const isoVibrationLimitY = selectedMetric === 'vibration' ? getYValue(9) : null;

  // Anomaly point index is 7 (14:18)
  const anomalyIndex = safeTimeSeries.findIndex(d => d.is_anomalous);
  const anomalyX = anomalyIndex !== -1 ? getX(anomalyIndex) : null;

  return (
    <div className="fw-panel bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-3 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-600 shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            Signals over time
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-mono">
          <span className="text-slate-600">Current reading vs. baseline</span>
        </div>
      </div>

      <div className="fw-signal-insight">
        <div>
          <span className="fw-signal-insight-label">AT A GLANCE</span>
          <strong>{flaggedSignals.length} of {signalSummary.length} signals need review</strong>
          <p>Each card compares the selected time with its normal baseline.</p>
        </div>
        {largestChange && (
          <div className="fw-signal-insight-change">
            <span>LARGEST CHANGE</span>
            <strong>{largestChange.name} {largestChange.value.delta_pct >= 0 ? '+' : ''}{largestChange.value.delta_pct.toFixed(0)}%</strong>
          </div>
        )}
      </div>

      {/* 5-Card Metric Matrix - Responsive Reflow across all screen widths */}
      <div className="grid grid-cols-2 min-[540px]:grid-cols-3 xl:grid-cols-5 gap-2 w-full min-w-0">
        
        {/* Vibration Card (+42%) */}
        <div className="fw-telemetry-metric bg-slate-50/80 border border-rose-200/60 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-600 truncate">Vibration</span>
            <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-1 rounded border border-rose-200/60 shrink-0">
              {formatDeltaAtScrub('vibration')}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {currentScrubPoint.vibration.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-slate-600">mm/s</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-700">{summary.vibration.baseline} mm/s</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
        </div>

        {/* Temperature Card (+11%) */}
        <div className="fw-telemetry-metric bg-slate-50/80 border border-amber-200/60 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-600 truncate">Temp</span>
            <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-200/60 shrink-0">
              {formatDeltaAtScrub('temperature')}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {currentScrubPoint.temperature.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-slate-600">°C</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-700">{summary.temperature.baseline} °C</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
        </div>

        {/* Motor Current Card (+8%) */}
        <div className="fw-telemetry-metric bg-slate-50/80 border border-amber-200/60 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-600 truncate">Current</span>
            <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-200/60 shrink-0">
              {formatDeltaAtScrub('motor_current')}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {currentScrubPoint.motor_current.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-slate-600">A</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-700">{summary.motor_current.baseline} A</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
        </div>

        {/* Spindle RPM (Normal) */}
        <div className="fw-telemetry-metric bg-slate-50/80 border border-slate-200 rounded p-2 text-left relative overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-600 truncate">Speed</span>
            <span className="text-[10px] font-mono text-emerald-700 shrink-0">{formatDeltaAtScrub('rpm')}</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {currentScrubPoint.rpm}
            </span>
            <span className="text-[10px] font-mono text-slate-600">RPM</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-700">{summary.rpm.baseline} RPM</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
        </div>

        {/* Hydraulic Pressure (Normal) */}
        <div className="fw-telemetry-metric bg-slate-50/80 border border-slate-200 rounded p-2 text-left relative overflow-hidden min-w-0 col-span-2 min-[540px]:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-slate-600 truncate">Pressure</span>
            <span className="text-[10px] font-mono text-emerald-700 shrink-0">{formatDeltaAtScrub('pressure')}</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {currentScrubPoint.pressure.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-slate-600">bar</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
            Base: <span className="text-slate-700">{summary.pressure.baseline} bar</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
        </div>

      </div>

      {/* Interactive Time-Series Graph with Anomaly Marker & Scrubbing */}
      <div className="fw-telemetry-chart bg-slate-50 border border-slate-200 rounded p-3 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600 mb-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <label className="flex items-center gap-2 text-slate-900 font-semibold">
              <span>SELECT TREND</span>
              <select
                aria-label="Telemetry trend to graph"
                value={selectedMetric}
                onChange={(event) => setSelectedMetric(event.target.value as TelemetryMetricKey)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {METRIC_KEYS.map((key) => (
                  <option key={key} value={key}>{TELEMETRY_METRICS[key].label}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1.5 shrink-0" style={{ color: chartMetric.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartMetric.color }} />
              <span>{chartMetric.label} ({chartMetric.unit})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 shrink-0">
              <span className="w-2.5 h-0.5 border-t border-dashed border-cyan-700" />
              <span>Baseline ({metricBaseline} {chartMetric.unit})</span>
            </div>
            {selectedMetric === 'vibration' && (
              <div className="flex items-center gap-1.5 text-slate-600 shrink-0">
                <span className="w-2.5 h-0.5 bg-slate-500 border-t border-dashed" />
                <span>ISO 10816 alert (9.0 mm/s)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Clock className="w-3.5 h-3.5 text-cyan-600" />
            <span className="text-cyan-700 font-semibold">Scrubbed: {currentScrubPoint.display_time} UTC</span>
          </div>
        </div>

        {/* SVG Sparkline */}
        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-36">
            <defs>
              <linearGradient id="signalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartMetric.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={chartMetric.color} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Scale-aware grid and baseline reference. */}
            {[0, 1, 2].map((tick) => {
              const value = maxValue - ((maxValue - minValue) * tick) / 2;
              const y = getYValue(value);
              return <g key={tick}>
                <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#cbd5e1" strokeDasharray="2 4" strokeWidth="1" />
                <text x={padding.left - 4} y={y + 3} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">{value.toFixed(selectedMetric === 'rpm' ? 0 : 1)}</text>
              </g>;
            })}
            <line x1={padding.left} y1={baselineY} x2={chartWidth - padding.right} y2={baselineY} stroke="#0e7490" strokeDasharray="4 3" strokeWidth="1.5" />
            {isoVibrationLimitY !== null && <line x1={padding.left} y1={isoVibrationLimitY} x2={chartWidth - padding.right} y2={isoVibrationLimitY} stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />}

            {/* Anomaly Step Marker line */}
            {anomalyX !== null && (
              <g>
                <line x1={anomalyX} y1={padding.top} x2={anomalyX} y2={chartHeight - padding.bottom} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x={anomalyX - 45} y={padding.top} width="90" height="16" rx="2" fill="#78350f" fillOpacity="0.8" stroke="#f59e0b" strokeWidth="1" />
                <text x={anomalyX} y={padding.top + 11} fill="#fef3c7" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  ANOMALY {safeTimeSeries[anomalyIndex]?.display_time}
                </text>
              </g>
            )}

            {/* Filled Area */}
            {signalArea && <path d={`M ${signalArea}`} fill={chartMetric.fill} />}

            {/* Selected telemetry signal */}
            {signalPoints && <path d={`M ${signalPoints}`} fill="none" stroke={chartMetric.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

            {/* Data Points */}
            {safeTimeSeries.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getYValue(d[selectedMetric])}
                r={i === scrubIndex ? 5 : d.is_anomalous ? 3.5 : 2}
                fill={i === scrubIndex ? '#0891b2' : d.is_anomalous ? chartMetric.color : '#94a3b8'}
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
            {safeTimeSeries.filter((_, idx) => idx % 2 === 0).map((d, i) => {
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

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono" aria-live="polite">
          <span className="text-slate-600">{chartMetric.label} at {currentScrubPoint.display_time}: <strong className="text-slate-900">{metricAtScrub.toFixed(selectedMetric === 'temperature' ? 1 : 2)} {chartMetric.unit}</strong></span>
          <span className={`font-bold ${Math.abs(metricDeltaPct) >= 10 ? 'text-rose-700' : 'text-slate-700'}`}>
            {metricDeltaPct >= 0 ? '+' : ''}{metricDeltaPct.toFixed(1)}% vs baseline
          </span>
        </div>

        {/* Scrub Slider */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 mt-2 pt-2 border-t border-slate-200/80">
          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[10px] font-mono text-slate-600 uppercase">Explore timeline:</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(0, safeTimeSeries.length - 1)}
            value={scrubIndex}
            onChange={(e) => setScrubIndex(parseInt(e.target.value, 10))}
            className="flex-1 min-w-[120px] accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="text-xs font-mono text-cyan-700 font-semibold shrink-0 text-right">
            {currentScrubPoint.display_time} UTC
          </div>
        </div>
      </div>
    </div>
  );
};
