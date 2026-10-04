import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogIn, UserPlus, Key, Eye, EyeOff } from 'lucide-react';
import FactoryHero from '../assets/factory-hero.svg?url';

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
        {/* Left: Full-bleed hero panel to match design in the provided image */}
        <div className="relative overflow-hidden rounded-lg shadow-lg">
          <img src={FactoryHero} alt="Factory WHY hero" className="w-full h-full object-cover max-h-[720px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/60 to-slate-900/80" />
          <div className="absolute left-6 bottom-8 text-white max-w-xs">
            <div className="text-4xl font-extrabold">Factory WHY</div>
            <div className="mt-3 text-sm opacity-90">Capturing signals. Creating auditable decisions for industrial operations.</div>
          </div>
        </div>

        {/* Right: Interactive Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 shadow-lg transform transition-all will-change-transform hover:-translate-y-1 hover:scale-[1.01] focus-within:-translate-y-1 focus-within:scale-[1.01]">
          {error && <div role="alert" className="mb-4 text-sm text-rose-300">{error}</div>}

          {/* Sign-up layout aligned to image reference: title, inputs, checkbox, CTA, OR divider, social buttons */}
          {mode === 'signup' && (
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold">Create an account</h2>
              <div className="text-sm text-slate-400">Already have an account? <button onClick={() => setMode('login')} className="text-cyan-400 underline">Log in</button></div>

              <div className="grid grid-cols-2 gap-3">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="p-3 rounded bg-slate-800 border border-slate-700" />
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="p-3 rounded bg-slate-800 border border-slate-700" />
              </div>

              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded bg-slate-800 border border-slate-700" />

              <div className="relative">
                <input type={showPassword? 'text':'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full p-3 rounded bg-slate-800 border border-slate-700" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4" /> I agree to the <a className="underline">Terms & Conditions</a></label>

              <button onClick={handleLocalSignup} disabled={loading} className="w-full py-3 rounded bg-violet-600 text-white font-medium">{loading? 'Creating…' : 'Create account'}</button>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex-1 border-t border-slate-700" />
                <span className="whitespace-nowrap">Or register with</span>
                <span className="flex-1 border-t border-slate-700" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleGoogleSignIn} className="flex items-center gap-2 justify-center p-3 rounded border border-slate-700 bg-transparent"> 
                  <img src="/assets/google-g-logo.png" alt="Google" className="w-5 h-5" />
                  <span>Google</span>
                </button>
                <button onClick={handleAppleSignIn} className="flex items-center gap-2 justify-center p-3 rounded border border-slate-700 bg-transparent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="opacity-90"><path d="M16.365 1.43c.002.157.007.314.016.47-.01.007-.02.014-.03.021C16.311 6.02 19.77 7.78 19.77 11.08c0 1.63-.64 3.08-1.7 4.05-.86.81-2.02 1.25-3.3 1.25-.75 0-1.49-.16-2.18-.48-.07-.03-.13-.06-.2-.09-1.18.29-2.47.25-3.9-.26 1.74-.45 3.05-1.56 3.87-2.92.25-.45.47-.92.61-1.42.25-.36.61-.65 1.03-.77.14-.04.28-.06.43-.06.48 0 .92.22 1.25.58.22.13.41.29.58.47.24-.13.47-.27.69-.41.93-.58 1.48-1.56 1.48-2.63 0-.9-.44-1.69-1.11-2.17-.12-.09-.25-.17-.38-.24.23-.31.43-.66.57-1.03.33-.87.52-1.81.52-2.79 0-.05 0-.09 0-.14 0-.28-.02-.56-.06-.83C15.96 1.45 16.17 1.44 16.365 1.43z"/></svg>
                  <span>Apple</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Sign in</h2>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded bg-slate-800 border border-slate-700" />
              <div className="relative">
                <input type={showPassword? 'text':'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 rounded bg-slate-800 border border-slate-700" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>

              <div className="flex gap-2">
                <button onClick={handleLocalSignIn} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded font-medium">
                  <Key className="w-4 h-4" />
                  <span>{loading? 'Signing in…':'Sign in'}</span>
                </button>
                <button onClick={() => setMode('signup')} className="flex-0 px-3 py-2 bg-slate-800 text-slate-300 rounded">Create</button>
              </div>

              <div className="text-center text-xs text-slate-500">Or sign in with</div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleGoogleSignIn} className="flex items-center gap-2 justify-center p-3 rounded border border-slate-700 bg-transparent"> 
                  <img src="/assets/google-g-logo.png" alt="Google" className="w-5 h-5" />
                  <span>Google</span>
                </button>
                <button onClick={handleAppleSignIn} className="flex items-center gap-2 justify-center p-3 rounded border border-slate-700 bg-transparent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="opacity-90"><path d="M16.365 1.43c.002.157.007.314.016.47-.01.007-.02.014-.03.021C16.311 6.02 19.77 7.78 19.77 11.08c0 1.63-.64 3.08-1.7 4.05-.86.81-2.02 1.25-3.3 1.25-.75 0-1.49-.16-2.18-.48-.07-.03-.13-.06-.2-.09-1.18.29-2.47.25-3.9-.26 1.74-.45 3.05-1.56 3.87-2.92.25-.45.47-.92.61-1.42.25-.36.61-.65 1.03-.77.14-.04.28-.06.43-.06.48 0 .92.22 1.25.58.22.13.41.29.58.47.24-.13.47-.27.69-.41.93-.58 1.48-1.56 1.48-2.63 0-.9-.44-1.69-1.11-2.17-.12-.09-.25-.17-.38-.24.23-.31.43-.66.57-1.03.33-.87.52-1.81.52-2.79 0-.05 0-.09 0-.14 0-.28-.02-.56-.06-.83C15.96 1.45 16.17 1.44 16.365 1.43z"/></svg>
                  <span>Apple</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
