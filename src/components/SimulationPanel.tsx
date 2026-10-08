import React, { useState } from 'react';
import { 
  Cpu, 
  Sliders, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert,
  ShieldCheck,
  Wrench
} from 'lucide-react';
import { SimulationParameters, SimulationOptionResult } from '../types';
import { DEFAULT_SIMULATION_PARAMS } from '../data/mockScenarios';

interface SimulationPanelProps {
  simulationResults: SimulationOptionResult[];
  currentParams: SimulationParameters;
  onUpdateParams: (newParams: SimulationParameters) => void;
  selectedOption: string;
  onSelectOption: (option: string) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  simulationResults,
  currentParams,
  onUpdateParams,
  selectedOption,
  onSelectOption,
}) => {
  const [showAssumptionsDrawer, setShowAssumptionsDrawer] = useState(false);

  const handleSliderChange = (key: keyof SimulationParameters, value: number) => {
    onUpdateParams({
      ...currentParams,
      [key]: value
    });
  };

  const handleResetDefaults = () => {
    onUpdateParams(DEFAULT_SIMULATION_PARAMS);
  };

  return (
    <section id="simulation" className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-5 flex flex-col gap-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-cyan-50/80 border border-cyan-200/60 text-cyan-600 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
              Deterministic Decision Simulator
            </h2>
            <p className="text-[11px] text-slate-600 font-mono">
              Transparent Decision Support · Deterministic Code Calculations · Model: <span className="text-slate-700 font-semibold">{currentParams.assumptions_version}</span>
            </p>
          </div>
        </div>

        {/* Assumptions Drawer Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowAssumptionsDrawer(!showAssumptionsDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors border ${
              showAssumptionsDrawer
                ? 'bg-cyan-500/20 text-cyan-700 border-cyan-500/50'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
            }`}
            aria-expanded={showAssumptionsDrawer}
            aria-label="Toggle challengeable simulation parameters"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span>Challenge Assumptions</span>
            {showAssumptionsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Assumptions Drawer (Collapsible) */}
      {showAssumptionsDrawer && (
        <div className="bg-slate-50 border border-cyan-500/30 rounded-lg p-3.5 sm:p-4 space-y-3.5 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <span className="text-cyan-700 font-bold uppercase text-[11px] block">
                Challengeable Deterministic Parameters
              </span>
              <span className="text-[10px] text-slate-600 font-sans">
                Adjust variables to test trade-offs. Calculations execute deterministically without LLM speculation.
              </span>
            </div>
            <button
              onClick={handleResetDefaults}
              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 px-2 py-1 rounded bg-white transition-colors shrink-0"
              title="Reset parameters to factory defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Param 1: Inspection Delay */}
            <div className="space-y-1.5 bg-slate-100/60 p-2.5 rounded border border-slate-200">
              <div className="flex justify-between text-slate-700 text-[11px]">
                <span>Inspection Delay:</span>
                <span className="text-cyan-700 font-bold tabular-nums">{currentParams.inspection_delay_minutes} min</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={currentParams.inspection_delay_minutes}
                onChange={(e) => handleSliderChange('inspection_delay_minutes', parseInt(e.target.value, 10))}
                className="w-full accent-cyan-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                aria-label="Inspection delay in minutes"
              />
              <span className="text-[10px] text-slate-500 block">Downtime for laser clocking</span>
            </div>

            {/* Param 2: Modeled Failure Exposure */}
            <div className="space-y-1.5 bg-slate-100/60 p-2.5 rounded border border-slate-200">
              <div className="flex justify-between text-slate-700 text-[11px]">
                <span>Failure Risk Exposure:</span>
                <span className="text-rose-600 font-bold tabular-nums">{(currentParams.modeled_failure_exposure * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={currentParams.modeled_failure_exposure}
                onChange={(e) => handleSliderChange('modeled_failure_exposure', parseFloat(e.target.value))}
                className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                aria-label="Modeled failure exposure probability"
              />
              <span className="text-[10px] text-slate-500 block">Probability of catastrophic seizure</span>
            </div>

            {/* Param 3: Intervention Effectiveness */}
            <div className="space-y-1.5 bg-slate-100/60 p-2.5 rounded border border-slate-200">
              <div className="flex justify-between text-slate-700 text-[11px]">
                <span>Diagnostic Effectiveness:</span>
                <span className="text-emerald-600 font-bold tabular-nums">{(currentParams.intervention_effectiveness * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={currentParams.intervention_effectiveness}
                onChange={(e) => handleSliderChange('intervention_effectiveness', parseFloat(e.target.value))}
                className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                aria-label="Diagnostic inspection effectiveness"
              />
              <span className="text-[10px] text-slate-500 block">Uncertainty reduction rate</span>
            </div>

            {/* Param 4: Hourly Downtime Cost */}
            <div className="space-y-1.5 bg-slate-100/60 p-2.5 rounded border border-slate-200">
              <div className="flex justify-between text-slate-700 text-[11px]">
                <span>Hourly Line Loss:</span>
                <span className="text-amber-700 font-bold tabular-nums">${currentParams.hourly_production_loss_usd}/hr</span>
              </div>
              <input
                type="range"
                min="600"
                max="2500"
                step="100"
                value={currentParams.hourly_production_loss_usd}
                onChange={(e) => handleSliderChange('hourly_production_loss_usd', parseInt(e.target.value, 10))}
                className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                aria-label="Hourly line downtime loss in dollars"
              />
              <span className="text-[10px] text-slate-500 block">Line B aerospace rate</span>
            </div>
          </div>
        </div>
      )}

      {/* 3 Response Options Comparison Grid - Reflows smoothly across widths */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
        {simulationResults.map((res) => {
          const isSelected = selectedOption === res.option;
          const isRec = res.recommended;

          return (
            <div
              key={res.option}
              role="button"
              tabIndex={0}
              onClick={() => onSelectOption(res.option)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectOption(res.option);
                }
              }}
              className={`p-4 rounded-lg border transition-all cursor-pointer flex flex-col justify-between min-w-0 ${
                isRec
                  ? 'bg-slate-50 border-cyan-600/90 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-50/40'
                  : isSelected
                  ? 'bg-slate-50 border-slate-500'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3 min-w-0">
                {/* Card Top Title & Status */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {res.option === 'CONTINUE' && <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />}
                    {res.option === 'INSPECT' && <ShieldCheck className="w-4 h-4 text-cyan-600 shrink-0" />}
                    {res.option === 'REPAIR' && <Wrench className="w-4 h-4 text-amber-600 shrink-0" />}
                    <span className="text-xs font-bold font-mono text-slate-900 truncate">
                      {res.title}
                    </span>
                  </div>

                  {isRec ? (
                    <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 border border-cyan-500/60 px-2 py-0.5 rounded shrink-0">
                      RECOMMENDED
                    </span>
                  ) : res.risk_indicator === 'HIGH' ? (
                    <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded shrink-0">
                      HIGH RISK
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shrink-0">
                      ALTERNATIVE
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-sans break-anywhere">
                  {res.description}
                </p>

                {/* Key Metrics Grid */}
                <div className="space-y-2 py-2.5 border-y border-slate-200/80 font-mono text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <span className="text-slate-600 text-[11px]">Downtime Delay:</span>
                    <span className="font-bold text-slate-900 tabular-nums shrink-0">
                      {res.expected_delay_minutes} min
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <span className="text-slate-600 text-[11px]">Residual Failure Exposure:</span>
                    <span className={`font-bold tabular-nums shrink-0 ${
                      res.relative_exposure > 0.5 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {(res.relative_exposure * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <span className="text-slate-600 text-[11px]">Uncertainty Reduction:</span>
                    <span className="font-bold text-cyan-700 tabular-nums shrink-0">
                      {(res.uncertainty_reduction * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-1 pt-1 border-t border-slate-200/40">
                    <span className="text-slate-600 text-[11px]">Modeled Financial Impact:</span>
                    <span className={`font-bold tabular-nums shrink-0 ${
                      res.estimated_cost_usd > 15000 ? 'text-rose-600' : 'text-amber-700'
                    }`}>
                      ${res.estimated_cost_usd.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Tradeoff Summary */}
                <div className="text-[11px] text-slate-700 italic font-sans leading-relaxed break-anywhere">
                  "{res.tradeoff_summary}"
                </div>
              </div>

              {/* Deterministic Trace Footer */}
              <div className="mt-4 pt-2.5 border-t border-slate-200/80 min-w-0">
                <span className="text-[10px] font-mono uppercase text-slate-600 block mb-1.5 font-semibold">
                  Calculation Trace:
                </span>
                <div className="space-y-1">
                  {res.calculation_trace.map((trace, i) => (
                    <div key={i} className="text-[10px] font-mono text-slate-600 leading-tight break-anywhere">
                      • {trace}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
};
