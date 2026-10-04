// Firebase frontend configuration initializer.
// Values are read from Vite environment variables. These are public values
// safe to embed in browser code. Do NOT put server/private credentials here.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export function getFirebaseConfigFromEnv(): FirebaseConfig | null {
  // Vite will expose env vars prefixed with VITE_
  // Expect variables like VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.
  // Return null when essential values are missing to allow graceful fallback in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env: any = (import.meta as any).env || {};
  const apiKey = env?.VITE_FIREBASE_API_KEY;
  const authDomain = env?.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env?.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = env?.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = env?.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = env?.VITE_FIREBASE_APP_ID;
  const measurementId = env?.VITE_FIREBASE_MEASUREMENT_ID;

  if (!apiKey || !authDomain || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
}
