import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogIn } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-lg p-6 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 rounded bg-cyan-900 mx-auto flex items-center justify-center text-cyan-300 font-bold text-2xl">FW</div>
        </div>
        <h1 className="text-xl font-bold">Factory WHY</h1>
        <p className="text-sm text-slate-400 mt-2">Reliability decision workspace — sign in with Google to continue.</p>

        {error && (
          <div role="alert" className="mt-3 text-sm text-rose-300">{error}</div>
        )}

        <div className="mt-6">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-900 rounded font-medium shadow"
            aria-label="Sign in with Google"
          >
            <LogIn className="w-5 h-5" />
            <span>{loading ? 'Signing in…' : 'Sign in with Google'}</span>
          </button>
        </div>
        <div className="text-xs text-slate-500 mt-4">Your Google account will be used only for authentication. No data is stored without consent.</div>
      </div>
    </div>
  );
};

export default LoginPage;
