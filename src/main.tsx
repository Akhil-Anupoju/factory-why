import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './auth/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { applyTheme, readStoredTheme } from './theme';

applyTheme(readStoredTheme());

function ClientErrorCatcher({children}: {children: React.ReactNode}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      // Prefer stack if available
      const msg = (ev.error && ((ev.error as any).stack || ev.error.message)) || ev.message || String(ev);
      console.error('Captured window error', ev.error || ev.message, ev);
      setError(String(msg));
      return false;
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      const msg = (reason && ((reason as any).stack || reason.message)) || String(reason);
      console.error('Captured unhandledrejection', reason);
      setError(String(msg));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (error) {
    // Render a visible overlay with the error details to help debugging blank-page runtime errors.
    return (
      <div style={{position: 'fixed', inset: 0, padding: 20, background: 'rgba(0,0,0,0.85)', color: '#fff', zIndex: 9999, fontFamily: 'monospace', overflow: 'auto'}}>
        <h2 style={{color: '#ff6b6b'}}>Client runtime error detected</h2>
        <pre style={{whiteSpace: 'pre-wrap', color: '#fff'}}>{error}</pre>
        <p>Open DevTools Console for stack trace. This overlay is temporary — remove after debugging.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Ensure a root container exists to make mount errors easier to diagnose
if (!document.getElementById('root')) {
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
}

try {
  createRoot(document.getElementById('root')!).render(
    <ClientErrorCatcher>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </ClientErrorCatcher>
  );
} catch (e) {
  // Synchronous render failure fallback: write to DOM so the user sees something instead of a blank page.
  console.error('Render failed synchronously', e);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<pre style="color: red; padding: 16px;">Render failed synchronously:\n${String(e)}</pre>`;
  }
}
