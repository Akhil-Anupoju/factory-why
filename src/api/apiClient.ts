import { getToken } from './tokenProvider';

export class ApiError extends Error {
  status: number | null;
  /** The request URL that produced this error — diagnostic only, never
   * includes headers/tokens. Lets us pinpoint exactly which call
   * triggered a 401/sign-out instead of guessing. */
  url?: string;
  constructor(message: string, status: number | null = null, url?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

function getApiBase(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any).env?.VITE_API_BASE_URL;
  return (v || '').replace(/\/$/, '');
}

function isApiDebugEnabled(): boolean {
  // Enable safe API debug logging when VITE_API_DEBUG is set to '1' or 'true'
  // Do not log sensitive headers or bodies. This flag is intended for
  // local developer diagnostics only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any).env?.VITE_API_DEBUG || '';
  return ['1', 'true', 'True'].includes(String(v));
}

export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (e) {
    // swallow token errors; callers will observe 401 from the server if necessary
  }
  return headers;
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  const finalUrl = url.startsWith('http') || url.startsWith('/') ? `${base}${url}`.replace('//api', '/api') : `${base}/${url}`.replace('//api', '/api');

  const headersFromToken = await buildAuthHeaders();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}), ...headersFromToken };

  let res: Response;
  const debug = isApiDebugEnabled();
  const method = (init.method || 'GET').toString().toUpperCase();
  const start = Date.now();
  if (debug) {
    // Safe diagnostic: log method and endpoint and that a request started.
    // Never log Authorization header or token contents.
    // eslint-disable-next-line no-console
    console.info(`[API] START ${method} ${finalUrl}`);
  }
  try {
    res = await fetch(finalUrl, { ...init, headers, credentials: init.credentials || 'same-origin' });
  } catch (e: any) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.warn(`[API] NETWORK ERROR ${method} ${finalUrl} - ${e?.message || String(e)}`);
    }
    throw new ApiError(`Network error: ${e?.message || e}`, null);
  }
  // If we received an auth failure, attempt a single forced token refresh
  // and retry the request. This helps when the browser's ID token expired
  // between page load and the operator action. Do not attempt more than
  // one refresh here to avoid spamming the token endpoint.
  if (!res.ok && res.status === 401) {
    if (debug) {
      const duration = Date.now() - start;
      // eslint-disable-next-line no-console
      console.warn(`[API] RESPONSE ${method} ${finalUrl} -> ${res.status} ${res.statusText} (${duration}ms) (will attempt token refresh)`);
    }
    try {
      const refreshed = await getToken(true);
      if (refreshed) {
        const retryHeaders = { ...(init.headers as Record<string, string> || {}), ...headers, Authorization: `Bearer ${refreshed}` };
        try {
          res = await fetch(finalUrl, { ...init, headers: retryHeaders, credentials: init.credentials || 'same-origin' });
        } catch (e: any) {
          if (debug) {
            // eslint-disable-next-line no-console
            console.warn(`[API] RETRY NETWORK ERROR ${method} ${finalUrl} - ${e?.message || String(e)}`);
          }
          throw new ApiError(`Network error: ${e?.message || e}`, null);
        }
      }
    } catch (e) {
      // swallow refresh errors and fall through to normal handling below
    }
  }

  if (!res.ok) {
    if (debug) {
      const duration = Date.now() - start;
      // eslint-disable-next-line no-console
      console.warn(`[API] RESPONSE ${method} ${finalUrl} -> ${res.status} ${res.statusText} (${duration}ms)`);
    }
    if (res.status === 401 || res.status === 403) {
      // Always log (not gated behind VITE_API_DEBUG) — this is the exact
      // evidence needed to diagnose unexpected sign-outs. Safe: backend
      // only ever returns short fixed strings here (e.g. "Invalid token",
      // "Expired token", "Missing Authorization header"), never the token.
      const safeBody = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(`[API AUTH] ${method} ${finalUrl} -> ${res.status} "${safeBody}"`);
      throw new ApiError(res.status === 401 ? 'Authentication required' : 'Forbidden', res.status, finalUrl);
    }
    const text = await res.text().catch(() => '');
    throw new ApiError(`API error: ${res.status} ${res.statusText} - ${text}`, res.status, finalUrl);
  }

  if (debug) {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.info(`[API] OK ${method} ${finalUrl} (${duration}ms)`);
  }

  return res;
}

export default { ApiError, buildAuthHeaders, authFetch };
