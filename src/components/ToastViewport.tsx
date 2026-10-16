import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'loading';

export interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
  duration: number;
}

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const toastStyles: Record<ToastKind, { icon: React.ReactNode; classes: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />, classes: 'fw-toast--success border-emerald-200 bg-white text-emerald-950' },
  error: { icon: <AlertCircle className="h-5 w-5" aria-hidden="true" />, classes: 'fw-toast--error border-rose-200 bg-white text-rose-950' },
  info: { icon: <Info className="h-5 w-5" aria-hidden="true" />, classes: 'fw-toast--info border-cyan-200 bg-white text-slate-900' },
  loading: { icon: <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />, classes: 'fw-toast--loading border-cyan-200 bg-white text-slate-900' },
};

const ToastItem: React.FC<ToastMessage & { onDismiss: (id: string) => void }> = ({ id, message, kind, duration, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    if (duration <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message]);

  useEffect(() => {
    if (visible) return;
    const timer = window.setTimeout(() => onDismiss(id), 180);
    return () => window.clearTimeout(timer);
  }, [visible, id, onDismiss]);

  const style = toastStyles[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/10 transition-all duration-200 ease-out ${style.classes} ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
      <span className={`mt-0.5 shrink-0 ${kind === 'success' ? 'text-emerald-600' : kind === 'error' ? 'text-rose-600' : 'text-cyan-600'}`}>{style.icon}</span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-5">{message}</span>
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss notification" className="-mr-1 -mt-1 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss }) => (
  <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6" aria-label="Notifications">
    {toasts.map(toast => <ToastItem key={toast.id} {...toast} onDismiss={onDismiss} />)}
  </div>
);
