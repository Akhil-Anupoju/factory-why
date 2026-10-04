// Minimal local account store for demo/manual login.
// Stores accounts in localStorage under a fixed key. Passwords are hashed
// using Web Crypto Subtle SHA-256 where available. This is purely for
// demo/offline use and not intended for production authentication.

const STORAGE_KEY = 'factorywhy_local_accounts_v1';

type AccountRecord = {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
};

function loadAccounts(): Record<string, AccountRecord> {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (!txt) return {};
    return JSON.parse(txt) as Record<string, AccountRecord>;
  } catch (e) {
    return {};
  }
}

function saveAccounts(map: Record<string, AccountRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    // ignore
  }
}

async function hashPassword(password: string): Promise<string> {
  // Use Web Crypto when available
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
      const enc = new TextEncoder().encode(password);
      const buf = await (crypto as any).subtle.digest('SHA-256', enc);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    // fallthrough to fallback
  }

  // Fallback (insecure): simple base64 encoding
  try {
    return btoa(password);
  } catch (e) {
    return String(password);
  }
}

export async function createLocalAccount(email: string, password: string, displayName: string) {
  const key = String(email).trim().toLowerCase();
  if (!key) throw new Error('Email required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  const accounts = loadAccounts();
  if (accounts[key]) throw new Error('Account already exists for this email');
  const uid = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const passwordHash = await hashPassword(password);
  const rec: AccountRecord = { uid, email: key, displayName: displayName || key.split('@')[0], passwordHash };
  accounts[key] = rec;
  saveAccounts(accounts);
  return { uid: rec.uid, email: rec.email, displayName: rec.displayName };
}

export async function authenticateLocal(email: string, password: string) {
  const key = String(email).trim().toLowerCase();
  if (!key) throw new Error('Email required');
  const accounts = loadAccounts();
  const rec = accounts[key];
  if (!rec) throw new Error('No account for that email');
  const passwordHash = await hashPassword(password);
  if (passwordHash !== rec.passwordHash) throw new Error('Invalid credentials');
  return { uid: rec.uid, email: rec.email, displayName: rec.displayName };
}

export function listLocalAccounts(): { email: string; displayName: string }[] {
  const accounts = loadAccounts();
  return Object.values(accounts).map(a => ({ email: a.email, displayName: a.displayName }));
}
