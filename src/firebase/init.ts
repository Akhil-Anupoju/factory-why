import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirebaseConfigFromEnv } from './config';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

export function initFirebase(): { app: FirebaseApp | null; auth: Auth | null } {
  if (_app && _auth) return { app: _app, auth: _auth };

  const cfg = getFirebaseConfigFromEnv();
  if (!cfg) {
    // Running in an environment where Firebase config is not provided (tests/CI)
    return { app: null, auth: null };
  }

  try {
    _app = initializeApp(cfg as any);
    _auth = getAuth(_app);
    return { app: _app, auth: _auth };
  } catch (e) {
    // initialization failed (possibly in SSR/test environment)
    return { app: null, auth: null };
  }
}
