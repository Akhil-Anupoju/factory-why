import React from 'react';
import { 
  X, 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  Check, 
  Database,
  Image as ImageIcon
} from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceProvenanceModalProps {
  evidence: EvidenceItem | null;
  onClose: () => void;
}

export const EvidenceProvenanceModal: React.FC<EvidenceProvenanceModalProps> = ({
  evidence,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!evidence) return null;

  const handleCopyProvenance = () => {
    navigator.clipboard.writeText(evidence.provenance);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provenance-modal-title"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-bold font-mono text-cyan-700 bg-cyan-50/80 border border-cyan-200 px-2 py-0.5 rounded shrink-0">
              {evidence.evidence_id}
            </span>
            <div className="flex flex-col min-w-0">
              <span id="provenance-modal-title" className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wide truncate">
                Provenance Verification Inspector
              </span>
              <span className="text-[11px] text-slate-600 font-mono truncate">
                Source: {evidence.source} · {evidence.component}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors shrink-0"
            aria-label="Close Inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-4 text-xs w-full min-w-0">
          
          {/* Trust & Provenance URI bar */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 w-full min-w-0">
            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-600 mb-1.5 gap-1">
              <span className="flex items-center gap-1.5 text-emerald-600 font-semibold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                VERIFIED IMMUTABLE RECORD
              </span>
              <span className="shrink-0">Confidence: {evidence.confidence}</span>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-white p-2 rounded border border-slate-200 font-mono text-[11px] w-full min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 text-cyan-700 break-anywhere">
                <Database className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                <span className="truncate">{evidence.provenance}</span>
              </div>
              <button
                onClick={handleCopyProvenance}
                className="p-1 text-slate-600 hover:text-slate-900 shrink-0 self-end sm:self-auto"
                title="Copy provenance URI"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Observation Details */}
          <div className="w-full min-w-0">
            <h4 className="text-[11px] font-mono uppercase text-slate-600 mb-1">Observation Statement</h4>
            <div className="p-3 bg-slate-50/70 border border-slate-200 rounded text-slate-800 leading-relaxed font-sans text-xs break-anywhere">
              {evidence.observation}
            </div>
          </div>

          {/* If there's an image preview */}
          {evidence.image_url && (
            <div>
              <h4 className="text-[11px] font-mono uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-rose-600" />
                Thermal & Optical Artifact Stream
              </h4>
              <div className="border border-slate-200 rounded overflow-hidden bg-slate-50 p-2 flex justify-center">
                <img 
                  src={evidence.image_url} 
                  alt="Thermal inspection" 
                  className="rounded max-h-56 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              {evidence.details && (
                <p className="text-[11px] text-slate-600 font-mono mt-1">
                  Analysis: {evidence.details}
                </p>
              )}
            </div>
          )}

          {/* Document Snippet if manual or work order */}
          {evidence.document_snippet && (
            <div>
              <h4 className="text-[11px] font-mono uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Document Excerpt / Work Order Record
              </h4>
              <pre className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                {evidence.document_snippet}
              </pre>
            </div>
          )}

          {/* Raw Payload JSON */}
          {evidence.raw_payload && (
            <div>
              <h4 className="text-[11px] font-mono uppercase text-slate-600 mb-1">
                Raw Allowlisted Tool Output JSON
              </h4>
              <pre className="p-3 bg-slate-50 border border-slate-200 rounded text-cyan-700 font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(evidence.raw_payload, null, 2)}
              </pre>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[11px] font-mono">
            <div>
              <span className="text-slate-500">TIMESTAMP:</span>
              <div className="text-slate-700">{evidence.timestamp}</div>
            </div>
            <div>
              <span className="text-slate-500">ASSET:</span>
              <div className="text-slate-700">{evidence.asset}</div>
            </div>
            <div>
              <span className="text-slate-500">STATUS:</span>
              <div className="text-emerald-600 font-bold">{evidence.status}</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-medium rounded transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
