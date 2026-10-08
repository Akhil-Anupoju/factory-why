import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep logging minimal to avoid leaking tokens or sensitive headers.
    // Developers can inspect full stack in browser devtools.
    // eslint-disable-next-line no-console
    console.error('UI render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-amber-100/90 border border-amber-300 rounded p-6">
            <h2 className="text-lg font-bold mb-2">An unexpected error occurred</h2>
            <p className="text-sm text-amber-950 mb-4">
              The application encountered an unrecoverable rendering error. This prevents a blank screen and preserves diagnostic information.
            </p>
            <div className="text-xs text-amber-900 mb-4">
              {this.state.error?.message && <div><strong>Error:</strong> {this.state.error.message}</div>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 bg-amber-300 text-amber-950 rounded font-semibold"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-3 py-2 bg-slate-200 text-slate-800 rounded border border-slate-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
