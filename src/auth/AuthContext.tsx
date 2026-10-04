import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initFirebase } from '../firebase/init';
import { setTokenGetter } from '../api/tokenProvider';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';

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

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
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

  const value = useMemo(() => ({ user, loading, isAuthenticated: !!user, signIn, signOut, getIdToken }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
