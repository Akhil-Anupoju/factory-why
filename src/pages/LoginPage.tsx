import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogIn, UserPlus, Key, Eye, EyeOff, X } from 'lucide-react';
import FactoryHero from '../assets/factory-hero.svg?url';
import AmbientGear from '../assets/ambient-gear.svg?url';
// CNC hero image at repository root - prefer this if present
import CncImage from '../../cnc_image.webp?url';
// NOTE: place the following files under public/assets/ in your project:
// - industrial-bg.jpg (industrial background image the team provided)
// - factorywhy-logo.png (primary Factory WHY logo to be used across the site)

// Visually improved login page with local account creation and Google OAuth
export const LoginPage: React.FC = () => {
  const auth = useAuth() as any;
  const { signIn, signInWithGoogle, signInWithGithub, signInLocal, signUpLocal, firebaseAvailable } = auth as any;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // which provider is currently performing sign-in (null when idle)
  const [providerLoading, setProviderLoading] = useState<null | 'google' | 'github' | 'facebook'>(null);
  // fallback flag to show inline GitHub SVG if the PNG asset fails to load
  const [githubImgFailed, setGithubImgFailed] = useState(false);
  // default to signup to match the requested design
  const [mode, setMode] = useState<'login' | 'signup' | 'oauth'>('signup');

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const closeTermsRef = useRef<HTMLButtonElement | null>(null);

  const clearError = () => setError(null);

  // close modal on Escape
  useEffect(() => {
    if (!showTerms) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTerms(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showTerms]);

  // focus the close button when modal opens and disable background scroll
  useEffect(() => {
    if (showTerms) {
      // save current overflow
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // move focus to close button
      setTimeout(() => closeTermsRef.current?.focus(), 0);
      return () => { document.body.style.overflow = prev; };
    }
  }, [showTerms]);

  const handleGoogleSignIn = async () => {
    clearError();
    setProviderLoading('google');
    try {
      if (!firebaseAvailable) throw new Error('Firebase not initialized');
      // prefer explicit signInWithGoogle when available
      if (signInWithGoogle) {
        await signInWithGoogle();
      } else {
        await signIn();
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setProviderLoading(null);
    }
  };

  const handleGithubSignIn = async () => {
    clearError();
    setProviderLoading('github');
    try {
      if (signInWithGithub && typeof signInWithGithub === 'function') {
        await signInWithGithub();
      } else if (auth && typeof auth.signInWithGithub === 'function') {
        await auth.signInWithGithub();
      } else {
        setError('GitHub Sign-In is not configured in this environment.');
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setProviderLoading(null);
    }
  };

  const handleFacebookSignIn = async () => {
    clearError();
    setProviderLoading('facebook');
    try {
      if (auth && typeof auth.signInFacebook === 'function') {
        await auth.signInFacebook();
      } else {
        setError('Facebook Sign-In is not configured in this environment.');
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setProviderLoading(null);
    }
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
        // displayName is always computed to a non-empty string above, pass directly
        await signUpLocal(email, password, displayName);
      } else {
        const authModule = await import('../auth/localAuth');
        // localAuth.createLocalAccount expects a string display name; displayName is a string
        await authModule.createLocalAccount(email, password, displayName);
        if (signInLocal) await signInLocal(email, password);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative text-slate-900 flex items-center justify-center p-6 bg-transparent">
      {/* Background images (industrial theme) */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary industrial background: prefer project CNC image, then /assets/industrial-bg.jpg, then fallback SVGs */}
        <img src={CncImage} alt="CNC background" className="w-full h-full object-cover opacity-90" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <img src="/assets/industrial-bg.jpg" alt="Industrial background" className="w-full h-full object-cover opacity-80" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <img src="/assets/industrial-bg.svg" alt="Industrial background svg" className="w-full h-full object-cover opacity-80" />
        {/* Fallback artwork (SVG) - make more visible when no industrial-bg.jpg */}
        <img src={FactoryHero} alt="Industrial background fallback" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/10" />
        <img src={AmbientGear} alt="Ambient gear" className="absolute left-8 bottom-8 w-96 opacity-5" />
      </div>

      {/* Top-left brand for login page */}
      <div className="absolute left-6 top-6 z-20 flex items-center gap-2">
        <img src="/assets/factorywhy-logo.png" alt="Factory WHY" className="w-9 h-9 object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
        <div className="text-sm font-semibold text-white drop-shadow">Factory WHY</div>
      </div>

      {/* Centered card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="mx-auto bg-gradient-to-b from-sky-50/90 to-white rounded-2xl shadow-2xl p-8 md:p-10 text-center">
          {error && <div role="alert" className="mb-4 text-sm text-rose-600">{error}</div>}

          <div className="flex flex-col items-center gap-2 mb-3">
            <div className="w-20 h-20 bg-transparent rounded flex items-center justify-center">
              <img src="/assets/factorywhy-logo.png" alt="Factory WHY logo" className="w-16 h-16 object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
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

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4" />
                  <span> I agree to the </span>
                  <button type="button" onClick={() => setShowTerms(true)} className="underline text-cyan-600">Terms & Conditions</button>
                </label>

                <button onClick={handleLocalSignup} disabled={loading} className="w-full py-3 rounded-full bg-slate-900 text-white font-medium shadow-md">{loading? 'Creating…' : 'Create account'}</button>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex-1 border-t border-slate-200" />
                  <span className="whitespace-nowrap">Or register with</span>
                  <span className="flex-1 border-t border-slate-200" />
                </div>

                <div className="flex items-center justify-center gap-4">
                  {/* Use identical provider button styles for signup and login to ensure consistent icon/text spacing */}
                  <button
                    onClick={handleGoogleSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white"
                    aria-busy={providerLoading === 'google'}
                    aria-live="polite"
                    role="button"
                    disabled={!!providerLoading}
                  >
                    <img src="/assets/icons8-google-48.png" alt="Google" className="w-5 h-5" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                    <span className="text-sm">{providerLoading === 'google' ? 'Signing in with Google…' : 'Google'}</span>
                  </button>
                  <button
                    onClick={handleGithubSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white"
                    aria-busy={providerLoading === 'github'}
                    aria-live="polite"
                    role="button"
                    disabled={!!providerLoading}
                    title={providerLoading === 'github' ? 'Signing in with GitHub…' : 'Sign in with GitHub'}
                  >
                    {!githubImgFailed ? (
                      <img src="/assets/icons8-github-logo-64.png" alt="GitHub" className="w-5 h-5" onError={() => setGithubImgFailed(true)} />
                    ) : (
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.2 1.87.86 2.33.66.07-.52.28-.86.51-1.06-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                    )}
                    <span className="text-sm">{providerLoading === 'github' ? 'Signing in with GitHub…' : 'GitHub'}</span>
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
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handleGoogleSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white"
                    aria-busy={providerLoading === 'google'}
                    aria-live="polite"
                    role="button"
                    disabled={!!providerLoading}
                    title={providerLoading === 'google' ? 'Signing in with Google…' : 'Sign in with Google'}
                  > 
                    <img src="/assets/icons8-google-48.png" alt="Google" className="w-5 h-5" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                    <span className="text-sm">{providerLoading === 'google' ? 'Signing in with Google…' : 'Google'}</span>
                  </button>
                  <button
                    onClick={handleGithubSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white"
                    aria-busy={providerLoading === 'github'}
                    aria-live="polite"
                    role="button"
                    disabled={!!providerLoading}
                    title={providerLoading === 'github' ? 'Signing in with GitHub…' : 'Sign in with GitHub'}
                  >
                    {!githubImgFailed ? (
                      <img src="/assets/icons8-github-logo-64.png" alt="GitHub" className="w-5 h-5" onError={() => setGithubImgFailed(true)} />
                    ) : (
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.2 1.87.86 2.33.66.07-.52.28-.86.51-1.06-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                    )}
                    <span className="text-sm">{providerLoading === 'github' ? 'Signing in with GitHub…' : 'GitHub'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Terms & Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTerms(false)} />
          <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-lg shadow-lg">
            <div className="flex items-start justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Terms & Conditions - Prototype</h3>
              <button ref={closeTermsRef} aria-label="Close terms" className="text-slate-600 hover:text-slate-900 p-2 rounded" onClick={() => setShowTerms(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-auto text-sm text-slate-700 space-y-3">
              <p>This is a prototype application for demonstration purposes only. By creating an account or signing in you acknowledge that:</p>
              <ul className="list-disc pl-5">
                <li>The application is provided as-is without warranties.</li>
                <li>Any data entered may be used for testing and may be removed periodically.</li>
                <li>OAuth providers (Google, Apple, Facebook) require proper configuration before full end-to-end login will work.</li>
                <li>No production-level security guarantees are provided; do not use real credentials for sensitive accounts.</li>
              </ul>
              <p>For the purposes of this prototype, we collect only an email and a display name for local accounts. Passwords are stored using the development authentication mechanism and should not be used for production.</p>
              <p>If you have questions, contact the project maintainer.</p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowTerms(false)} className="px-4 py-2 rounded bg-slate-100">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
