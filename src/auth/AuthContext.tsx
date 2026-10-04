import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initFirebase } from '../firebase/init';
import { setTokenGetter } from '../api/tokenProvider';
import { GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
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
  signIn: () => Promise<void>;
  // Optional: Facebook sign-in
  signInFacebook?: () => Promise<void>;
  // Optional: Apple sign-in (may be unavailable if Firebase not configured for Apple)
  signInApple?: () => Promise<void>;
  signInLocal: (email: string, password: string) => Promise<{ uid: string; email: string; displayName: string }>;
  signUpLocal: (email: string, password: string, displayName?: string) => Promise<{ uid: string; email: string; displayName: string }>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
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

  useEffect(() => {
    if (!auth) {
      // no firebase environment; treat as unauthenticated but not loading
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (u) {
        setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [auth]);

  const signIn = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInApple = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    // Firebase supports OAuthProvider for Apple; ensure provider configured in Firebase console
    const provider = new OAuthProvider('apple.com');
    // You may need to set custom parameters depending on Apple configuration
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // surface error to caller
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
    // register token getter returning a fake token that encodes uid for dev/demo purposes
    const fakeTokenGetter = async () => `local:${u.uid}`;
    setTokenGetter(fakeTokenGetter);
    setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
    return u;
  };

  const signUpLocal = async (email: string, password: string, displayName?: string) => {
    const u = await localAuth.createLocalAccount(email, password, displayName || undefined as any);
    // after creating, register token getter and set user
    const fakeTokenGetter = async () => `local:${u.uid}`;
    setTokenGetter(fakeTokenGetter);
    setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
    return u;
  };

  const signOut = async () => {
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

  const getIdToken = async (): Promise<string | null> => {
    if (!auth || !auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      return null;
    }
  };

  // register token getter for non-React API modules
  useEffect(() => {
    setTokenGetter(getIdToken);
    return () => setTokenGetter(null);
  }, [auth]);

  const value = useMemo(() => ({ user, loading, isAuthenticated: !!user, signIn, signInApple, signInFacebook, signInLocal, signUpLocal, signOut, getIdToken }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
