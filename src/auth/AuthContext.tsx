import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initFirebase } from '../firebase/init';
import { setTokenGetter } from '../api/tokenProvider';
import { GoogleAuthProvider, FacebookAuthProvider, GithubAuthProvider, onAuthStateChanged, signInWithPopup, linkWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import * as localAuth from './localAuth';

interface AuthUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLocalDemoUser: boolean;
  // Preferred explicit names for provider sign-ins
  signInWithGoogle: () => Promise<void>;
  // GitHub sign-in
  signInWithGithub?: () => Promise<void>;
  // Backwards-compat: Apple alias may be present in some callers; map to GitHub when available
  signInApple?: () => Promise<void>;
  // Backwards-compatible alias
  signIn: () => Promise<void>;
  // Optional: Facebook sign-in
  signInFacebook?: () => Promise<void>;
  // Optional: Apple sign-in (may be unavailable if Firebase not configured for Apple)
  signInApple?: () => Promise<void>;
  signInLocal: (email: string, password: string) => Promise<{ uid: string; email: string; displayName: string }>;
  signUpLocal: (email: string, password: string, displayName?: string) => Promise<{ uid: string; email: string; displayName: string }>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  // whether Firebase frontend SDK is available/configured in this environment
  firebaseAvailable: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auth } = initFirebase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLocalDemoUser, setIsLocalDemoUser] = useState(false);
  const localSessionRef = useRef(false);
  const firebaseAvailable = !!auth;

  useEffect(() => {
    if (!auth) {
      // no firebase environment; treat as unauthenticated but not loading
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u) {
        localSessionRef.current = false;
        setIsLocalDemoUser(false);
        setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
      } else if (!localSessionRef.current) {
        // Diagnostic only (no PII/tokens): helps distinguish "Firebase
        // client session was actually cleared" from "a single API call
        // got a 401". If you see this log unexpectedly shortly after a
        // successful sign-in, the session is being dropped at the
        // Firebase SDK/browser level (e.g. third-party storage/cookie
        // partitioning), not by our backend or API code.
        // eslint-disable-next-line no-console
        console.warn('[Auth] onAuthStateChanged fired with null user — Firebase client session ended.');
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [auth]);

  const signIn = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    const provider = new GoogleAuthProvider();
    // If a user is already signed in, link the Google provider to the existing account
    if (auth.currentUser) {
      await linkWithPopup(auth.currentUser, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  };

  // Explicit Google sign-in with improved error handling
  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    const provider = new GoogleAuthProvider();
    try {
      // Do not expose provider credentials/tokens to callers; firebase updates currentUser
      // If already signed-in, link provider instead of signing in to avoid
      // account-exists-with-different-credential errors when appropriate.
      if (auth.currentUser) {
        await linkWithPopup(auth.currentUser, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: any) {
      // Handle common Firebase collision / popup errors gracefully and return a safe message
      const code = e?.code || '';
      if (code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email address but different sign-in method. Sign in using the original provider to link accounts.');
      }
      if (code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup closed before completing sign-in.');
      }
      // rethrow original for the caller to display a safe message
      throw e;
    }
  };

  const signInWithGithub = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    const provider = new GithubAuthProvider();
    try {
      if (auth.currentUser) {
        await linkWithPopup(auth.currentUser, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email address but different sign-in method. Sign in using the original provider to link accounts.');
      }
      if (code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup closed before completing sign-in.');
      }
      throw e;
    }
  };

  const signInFacebook = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    const provider = new FacebookAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      throw e;
    }
  };

  const signInLocal = async (email: string, password: string) => {
    // Attempt to authenticate against local account store
    const u = await localAuth.authenticateLocal(email, password);
    // For local/demo sign-in do NOT register a fake Authorization token with
    // the token provider. Sending a fake `local:` token to the backend causes
    // the server's Firebase token verifier to reject it (401). Instead keep
    // the frontend authenticated for demo UI flows while leaving API calls
    // unauthenticated so the backend can opt-in to anonymous/demo behavior
    // using FACTORY_WHY_ALLOW_ANONYMOUS_DEMO. This reduces accidental 401s.
    localSessionRef.current = true;
    setIsLocalDemoUser(true);
    setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
    return u;
  };

  const signUpLocal = async (email: string, password: string, displayName?: string) => {
    const u = await localAuth.createLocalAccount(email, password, displayName || undefined as any);
    // after creating, register token getter and set user
    // Same as signInLocal: do not register a fake Authorization token for
    // local/demo accounts. Keep API calls unauthenticated so the backend
    // can handle demo mode explicitly when configured.
    localSessionRef.current = true;
    setIsLocalDemoUser(true);
    setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
    return u;
  };

  const signOut = async () => {
    localSessionRef.current = false;
    setIsLocalDemoUser(false);
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        // ignore
      }
    }
    // clear local token getter when signing out
    setTokenGetter(null);
    setUser(null);
  };

  const getIdToken = async (force?: boolean): Promise<string | null> => {
    if (localSessionRef.current || !auth || !auth.currentUser) return null;
    try {
      // Firebase SDK exposes getIdToken(force) to optionally refresh the token
      // when `force` is true. We propagate the `force` arg so callers can
      // trigger a refresh when they receive 401 from the server.
      // Note: we intentionally do not expose the token value to logs.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (auth.currentUser as any).getIdToken(Boolean(force));
    } catch (e) {
      return null;
    }
  };

  // register token getter for non-React API modules
  useEffect(() => {
    setTokenGetter(getIdToken);
    return () => setTokenGetter(null);
  }, [auth]);

  // expose both explicit and backward-compatible aliases
  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      isLocalDemoUser,
      signInWithGoogle,
      signIn,
      signInWithGithub,
      // alias for backward compatibility
      signInApple: signInWithGithub,
      signInFacebook,
      signInLocal,
      signUpLocal,
      signOut,
      getIdToken,
      firebaseAvailable,
    }),
    [user, loading, firebaseAvailable, isLocalDemoUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
