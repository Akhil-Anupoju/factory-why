import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogIn, UserPlus, Key } from 'lucide-react';
import FactoryHero from '../assets/factory-hero.svg?url';
import AmbientGear from '../assets/ambient-gear.svg?url';

// Visually improved login page with local account creation and Google OAuth
export const LoginPage: React.FC = () => {
  const { signIn, signInLocal, signUpLocal } = useAuth() as any;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup' | 'oauth'>('oauth');

  // local form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const clearError = () => setError(null);

  const handleGoogleSignIn = async () => {
    setLoading(true); clearError();
    try {
      await signIn();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  const handleDemoSignIn = async () => {
    setLoading(true); clearError();
    const demoEmail = 'demo@factorywhy.local';
    const demoPassword = 'demopass123';
    try {
      // Try sign in first, otherwise create the demo account then sign in
      if (signInLocal) {
        try {
          await signInLocal(demoEmail, demoPassword);
          return;
        } catch (_) {
          // not found, try create
        }
      }

      if (signUpLocal) {
        await signUpLocal(demoEmail, demoPassword, 'Demo Engineer');
      } else {
        const authModule = await import('../auth/localAuth');
        await authModule.createLocalAccount(demoEmail, demoPassword, 'Demo Engineer');
        if (signInLocal) await signInLocal(demoEmail, demoPassword);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  const handleLocalSignIn = async () => {
    setLoading(true); clearError();
    try {
      await (signInLocal as any)(email, password);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  const handleLocalSignup = async () => {
    setLoading(true); clearError();
    try {
      if (signUpLocal) {
        await signUpLocal(email, password, displayName || email.split('@')[0]);
      } else {
        const authModule = await import('../auth/localAuth');
        await authModule.createLocalAccount(email, password, displayName || email.split('@')[0]);
        if (signInLocal) await signInLocal(email, password);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* subtle radial gradient behind images (low opacity so images remain visible) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900/20 via-transparent to-transparent" />
        {/* ambient gear motif (center) */}
        <img src={AmbientGear} alt="Ambient gear" className="absolute left-1/4 top-1/4 w-3/5 opacity-10 transform -translate-y-6 -translate-x-6" />
        {/* factory hero illustration (bottom-right) */}
        <img src={FactoryHero} alt="Factory illustration" className="absolute right-6 bottom-6 w-2/5 opacity-20" />
      </div>

      <div className="relative z-10 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Visual Brand & Pitch */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div>
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-400 mx-auto flex items-center justify-center text-slate-900 font-extrabold text-3xl">FW</div>
            <h1 className="text-2xl font-bold text-center mt-4">Factory WHY</h1>
            <p className="text-slate-300 text-sm mt-3 text-center">Reliable, auditable decisions for industrial maintenance — control the gate with shared human + model workflows.</p>
          </div>

          <div className="mt-6 text-center">
            <div className="text-xs text-slate-400">Try the demo account or create a local account for offline evaluation.</div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button onClick={() => { setMode('oauth'); clearError(); }} className={`px-3 py-1 rounded text-sm ${mode==='oauth'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-300'}`}>Google</button>
              <button onClick={() => { setMode('login'); clearError(); }} className={`px-3 py-1 rounded text-sm ${mode==='login'?'bg-emerald-600 text-white':'bg-slate-800 text-slate-300'}`}>Local Login</button>
              <button onClick={() => { setMode('signup'); clearError(); }} className={`px-3 py-1 rounded text-sm ${mode==='signup'?'bg-amber-500 text-white':'bg-slate-800 text-slate-300'}`}>Create Account</button>
            </div>
          </div>
        </div>

        {/* Right: Interactive Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 shadow-lg transform transition-all will-change-transform hover:-translate-y-1 hover:scale-[1.01] focus-within:-translate-y-1 focus-within:scale-[1.01]">
          {error && <div role="alert" className="mb-4 text-sm text-rose-300">{error}</div>}

          {mode === 'oauth' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-300">Sign in with Google for a quick secure authentication.</div>
              {/* Official-style Google sign-in button with accessibility attributes */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                type="button"
                aria-label="Sign in with Google"
                aria-describedby="googleSignInDesc"
                className="w-full inline-flex items-center gap-3 px-4 py-2 bg-white text-slate-900 rounded-md font-medium shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
              >
                <span className="w-6 h-6 flex items-center justify-center ml-0">
                  <svg viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden="true" focusable="false" role="img">
                    <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.5-37-4.6-54.8H272v103.8h146.9c-6.4 34.6-26.6 63.9-56.8 83.4v69.3h91.9c53.9-49.6 85.5-122.8 85.5-201.7z"/>
                    <path fill="#34A853" d="M272 544.3c76.6 0 141-25.5 188-69.2l-91.9-69.3c-25.6 17.2-58.5 27.4-96.1 27.4-73.8 0-136.3-49.8-158.6-116.4H18.6v73.4C65.8 491 163.8 544.3 272 544.3z"/>
                    <path fill="#FBBC05" d="M113.4 323.2c-11.7-34.6-11.7-71.7 0-106.3V143.5H18.6c-39.7 79.6-39.7 172.8 0 252.4l94.8-72.7z"/>
                    <path fill="#EA4335" d="M272 108.2c39 0 74 13.4 101.6 39.7l76.1-76.1C413.9 24.1 349.6 0 272 0 163.8 0 65.8 53.3 18.6 143.5l94.8 73.4C135.7 157.9 198.2 108.2 272 108.2z"/>
                  </svg>
                </span>
                <span className="flex-1 text-left">{loading ? 'Signing in…' : 'Sign in with Google'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
                  <path d="M5 12h14" stroke="#0f1724" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 5l7 7-7 7" stroke="#0f1724" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <p id="googleSignInDesc" className="sr-only">Authenticate using your Google account. No data is stored without consent.</p>

              <div className="mt-3 flex justify-center">
                <button onClick={handleDemoSignIn} disabled={loading} className="text-xs px-3 py-1 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400">Sign in as demo</button>
              </div>

              <div className="text-center text-xs text-slate-500">Or create a local account for offline/demo use.</div>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-4">
              <label className="block text-xs text-slate-400 uppercase">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-sm" placeholder="you@company.com" />

              <label className="block text-xs text-slate-400 uppercase">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-sm" placeholder="••••••••" />

              <div className="flex gap-2">
                <button onClick={handleLocalSignIn} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded font-medium">
                  <Key className="w-4 h-4" />
                  <span>{loading? 'Signing in…':'Sign in'}</span>
                </button>
                <button onClick={() => setMode('signup')} className="flex-0 px-3 py-2 bg-slate-800 text-slate-300 rounded">Create</button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-4">
              <label className="block text-xs text-slate-400 uppercase">Full name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-sm" placeholder="Akhil Anupoju" />

              <label className="block text-xs text-slate-400 uppercase">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-sm" placeholder="you@company.com" />

              <label className="block text-xs text-slate-400 uppercase">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-sm" placeholder="Min 6 characters" />

              <div className="flex gap-2">
                <button onClick={handleLocalSignup} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded font-medium">
                  <UserPlus className="w-4 h-4" />
                  <span>{loading? 'Creating…':'Create Account'}</span>
                </button>
                <button onClick={() => setMode('login')} className="flex-0 px-3 py-2 bg-slate-800 text-slate-300 rounded">Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
