import React from 'react';
import { 
  Play, 
  Pause, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  X, 
  CheckCircle2, 
  Clock, 
  Lightbulb,
  Award
} from 'lucide-react';

export interface DemoBeat {
  id: number;
  timeRange: string;
  screenAction: string;
  narration: string;
  judgeTakeaway: string;
  targetAnchor: string;
}

export const DEMO_BEATS: DemoBeat[] = [
  {
    id: 1,
    timeRange: '0:00 - 0:15',
    screenAction: 'CNC-04 changes from green to abnormal',
    narration: '“A machine just became abnormal. The alert tells us WHAT changed. The engineer still needs WHY.”',
    judgeTakeaway: 'Problem is obvious',
    targetAnchor: 'machine-context'
  },
  {
    id: 2,
    timeRange: '0:15 - 0:35',
    screenAction: 'Open telemetry panel & scrub time series',
    narration: '“Vibration, temperature and current drift together (+42%, +11%, +8%). RPM and pressure remain normal.”',
    judgeTakeaway: 'Real operational signal',
    targetAnchor: 'telemetry'
  },
  {
    id: 3,
    timeRange: '0:35 - 0:55',
    screenAction: 'Evidence timeline populates with provenance',
    narration: '“Factory WHY retrieves the recent bearing replacement, manual guidance, prior incident and inspection evidence.”',
    judgeTakeaway: 'Agent uses allowlisted tools & typed evidence',
    targetAnchor: 'evidence'
  },
  {
    id: 4,
    timeRange: '0:55 - 1:20',
    screenAction: 'Show 3 competing hypotheses with evidence links',
    narration: '“Gemini forms competing explanations and links each claim to evidence_id. Observed facts and inferences are visibly separated.”',
    judgeTakeaway: 'Grounded GenAI with provenance',
    targetAnchor: 'hypotheses'
  },
  {
    id: 5,
    timeRange: '1:20 - 1:40',
    screenAction: 'Click “What would prove this wrong?”',
    narration: '“Now we ask the question we built the product around: what would prove the leading hypothesis wrong?”',
    judgeTakeaway: 'Visible innovation: Self-challenging reasoning',
    targetAnchor: 'critic'
  },
  {
    id: 6,
    timeRange: '1:40 - 2:00',
    screenAction: 'Show Critic findings & discriminating check',
    narration: '“The critic identifies dial indicator / laser runout measurement (< 0.02 mm) as the single discriminating check.”',
    judgeTakeaway: 'Bounded critique prevents hallucinations',
    targetAnchor: 'critic'
  },
  {
    id: 7,
    timeRange: '2:00 - 2:20',
    screenAction: 'Run deterministic simulation & test assumptions',
    narration: '“Continue, inspect and repair are compared using deterministic assumptions in transparent code, not invented LLM numbers.”',
    judgeTakeaway: 'Deterministic decision support',
    targetAnchor: 'simulation'
  },
  {
    id: 8,
    timeRange: '2:20 - 3:00',
    screenAction: 'Engineer approves inspection -> Action dispatched -> Ground truth verified',
    narration: '“The engineer retains control. Once approved, the action agent creates a simulated maintenance task. Ground truth reveals 100% prediction match!”',
    judgeTakeaway: 'Safe action path & measurable outcome',
    targetAnchor: 'approval'
  }
];

interface DemoScriptBarProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
}

export const DemoScriptBar: React.FC<DemoScriptBarProps> = ({
  currentStep,
  onSelectStep,
  isPlaying,
  onTogglePlay,
  onClose,
}) => {
  const currentBeat = DEMO_BEATS[currentStep - 1] || DEMO_BEATS[0];

  const handleNext = () => {
    if (currentStep < DEMO_BEATS.length) {
      onSelectStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      onSelectStep(currentStep - 1);
    }
  };

  return (
    <div className="bg-slate-900 border-b border-cyan-500/30 px-3 sm:px-4 py-2 text-slate-100 shadow-md w-full min-w-0">
      <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        
        {/* Step Progress & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 shrink-0">
            <button
              onClick={onTogglePlay}
              className={`p-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                isPlaying ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
              }`}
              title={isPlaying ? 'Pause auto-progression' : 'Auto play demo walkthrough'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Auto'}</span>
            </button>
            <button
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold px-1 text-slate-300">
              {currentStep}/{DEMO_BEATS.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentStep === DEMO_BEATS.length}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>{currentBeat.timeRange}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {DEMO_BEATS.map((beat) => (
              <button
                key={beat.id}
                onClick={() => onSelectStep(beat.id)}
                className={`h-2 rounded-full transition-all ${
                  beat.id === currentStep 
                    ? 'w-6 bg-cyan-400' 
                    : beat.id < currentStep 
                    ? 'w-2.5 bg-cyan-700 hover:bg-cyan-600' 
                    : 'w-2 bg-slate-800 hover:bg-slate-700'
                }`}
                title={`Beat ${beat.id}: ${beat.screenAction}`}
              />
            ))}
          </div>
        </div>

        {/* Center: Narration Voiceover Prompt */}
        <div className="flex-1 min-w-0 px-0 sm:px-2 w-full md:w-auto">
          <div className="text-xs text-slate-200 font-medium leading-snug break-anywhere">
            <span className="text-cyan-400 font-semibold mr-1.5 font-mono">Narration:</span>
            <span className="italic text-slate-300">{currentBeat.narration}</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate font-mono">
            <span className="text-amber-400 font-semibold shrink-0">Action:</span>
            <span className="truncate">{currentBeat.screenAction}</span>
          </div>
        </div>

        {/* Right: Judge Takeaway & Close */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs bg-slate-950/80 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded max-w-full">
            <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 shrink-0">Takeaway:</span>
            <span className="font-semibold text-[11px] truncate">{currentBeat.judgeTakeaway}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 shrink-0"
            title="Minimize demo script bar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
