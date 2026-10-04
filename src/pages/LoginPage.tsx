import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogIn, UserPlus, Key, Eye, EyeOff } from 'lucide-react';
import FactoryHero from '../assets/factory-hero.svg?url';
import AmbientGear from '../assets/ambient-gear.svg?url';
// NOTE: place the following files under public/assets/ in your project:
// - industrial-bg.jpg (industrial background image the team provided)
// - factorywhy-logo.png (primary Factory WHY logo to be used across the site)

// Visually improved login page with local account creation and Google OAuth
export const LoginPage: React.FC = () => {
  const auth = useAuth() as any;
  const { signIn, signInLocal, signUpLocal } = auth;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // default to signup to match the requested design
  const [mode, setMode] = useState<'login' | 'signup' | 'oauth'>('signup');

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const clearError = () => setError(null);

  const handleGoogleSignIn = async () => {
    setLoading(true); clearError();
    try {
      await signIn();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  const handleAppleSignIn = async () => {
    setLoading(true); clearError();
    try {
      if (auth && typeof auth.signInApple === 'function') {
        await auth.signInApple();
      } else {
        // Apple OAuth not configured in this environment — inform operator
        setError('Apple Sign-In is not configured in this environment.');
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
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim() || email.split('@')[0];
      if (!agree) {
        setError('You must agree to the Terms & Conditions to create an account.');
        setLoading(false);
        return;
      }

      if (signUpLocal) {
        await signUpLocal(email, password, displayName || undefined);
      } else {
        const authModule = await import('../auth/localAuth');
        await authModule.createLocalAccount(email, password, displayName || undefined);
        if (signInLocal) await signInLocal(email, password);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative text-slate-900 flex items-center justify-center p-6 bg-slate-50">
      {/* Background images (industrial theme) */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary industrial background (place public/assets/industrial-bg.jpg) - fallback to FactoryHero */}
        <img src="/assets/industrial-bg.jpg" alt="Industrial background" className="w-full h-full object-cover opacity-85" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <img src={FactoryHero} alt="Industrial background fallback" className="w-full h-full object-cover opacity-40 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/60" />
        <img src={AmbientGear} alt="Ambient gear" className="absolute left-8 bottom-8 w-96 opacity-5" />
      </div>

      {/* Top-left brand for login page */}
      <div className="absolute left-6 top-6 z-20 flex items-center gap-3">
        <img src="/assets/factorywhy-logo.png" alt="Factory WHY" className="w-10 h-10 object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
        <div className="text-sm font-semibold text-slate-900">Factory WHY</div>
      </div>

      {/* Centered card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="mx-auto bg-gradient-to-b from-sky-50/90 to-white rounded-2xl shadow-2xl p-8 md:p-10 text-center">
          {error && <div role="alert" className="mb-4 text-sm text-rose-600">{error}</div>}

          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-transparent rounded flex items-center justify-center">
              <img src="/assets/factorywhy-logo.png" alt="Factory WHY logo" className="w-12 h-12 object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
            </div>
            <h2 className="text-2xl font-bold">{mode === 'signup' ? 'Create an account' : 'Sign In'}</h2>
            <p className="text-sm text-slate-600">Capturing signals. Creating auditable decisions for industrial operations.</p>
          </div>

          {/* Form area (preserve existing logic but lighter visual style) */}
          <div>
            {mode === 'signup' && (
              <div className="space-y-4 text-left">
                <div className="text-sm text-slate-600 mb-2">Already have an account? <button onClick={() => setMode('login')} className="text-cyan-600 underline">Log in</button></div>

                <div className="grid grid-cols-2 gap-3">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="p-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400" />
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="p-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400" />
                </div>

                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400" />

                <div className="relative">
                  <input type={showPassword? 'text':'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4" /> I agree to the <a className="underline">Terms & Conditions</a></label>

                <button onClick={handleLocalSignup} disabled={loading} className="w-full py-3 rounded-full bg-slate-900 text-white font-medium shadow-md">{loading? 'Creating…' : 'Create account'}</button>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex-1 border-t border-slate-200" />
                  <span className="whitespace-nowrap">Or register with</span>
                  <span className="flex-1 border-t border-slate-200" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleGoogleSignIn} className="flex items-center gap-2 justify-center p-3 rounded-xl border border-slate-200 bg-white"> 
                    <img src="/assets/google-g-logo.png" alt="Google" className="w-5 h-5" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                    <span className="text-sm">Google</span>
                  </button>
                  <button onClick={handleAppleSignIn} className="flex items-center gap-2 justify-center p-3 rounded-xl border border-slate-200 bg-white">
                    <img src="/assets/apple-logo.png" alt="Apple" className="w-5 h-5" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
                    <span className="text-sm">Apple</span>
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="space-y-4 text-left">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400" />
                <div className="relative">
                  <input type={showPassword? 'text':'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div />
                  <button onClick={() => setMode('signup')} className="text-sm text-slate-600 underline">Create</button>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleLocalSignIn} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full font-medium">
                    <Key className="w-4 h-4" />
                    <span>{loading? 'Signing in…':'Sign in'}</span>
                  </button>
                </div>

                <div className="text-center text-xs text-slate-500">Or sign in with</div>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={handleGoogleSignIn} className="flex items-center gap-2 justify-center p-3 rounded-xl border border-slate-200 bg-white"> 
                    <img src="/assets/google-g-logo.png" alt="Google" className="w-5 h-5" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                  </button>
                  <button onClick={() => {}} className="flex items-center gap-2 justify-center p-3 rounded-xl border border-slate-200 bg-white">
                    {/* Facebook / placeholder icon - kept as SVG fallback */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#111827"><path d="M22.675 0h-21.35C.6 0 0 .6 0 1.337v21.326C0 23.4.6 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.66-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.716-1.796 1.765v2.316h3.59l-.467 3.622h-3.123V24h6.116C23.4 24 24 23.4 24 22.663V1.337C24 .6 23.4 0 22.675 0z"/></svg>
                  </button>
                  <button onClick={handleAppleSignIn} className="flex items-center gap-2 justify-center p-3 rounded-xl border border-slate-200 bg-white">
                    <img src="/assets/apple-logo.png" alt="Apple" className="w-5 h-5" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
